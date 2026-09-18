import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { 
  Save, 
  Loader2, 
  CheckCircle2, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  FileUp,
  Image as ImageIcon,
  Camera,
  Eraser,
  PenTool
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { collection, addDoc, serverTimestamp, getDocs, query, where, orderBy, limit, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Equipment, MaintenanceReport, SparePart, VerificationItem } from '@/types';
import { useAuth } from '@/lib/AuthContext';
import { syncEquipmentWithHistory } from '@/lib/sync-logic';
import {
  detectTechnology,
  ALL_TECHNOLOGIES,
  TECHNOLOGY_BY_ID,
  TechnologyItem
} from '@/data/technologyChecklists';
import TechnologySelectorDialog from '@/components/forms/TechnologySelectorDialog';

import { projectScheduleMonths, calculateNextMaintenance, isMoreRecent } from '@/lib/schedule-utils';

interface MaintenanceFormProps {
  equipment: Equipment;
  onCancel: () => void;
  onSuccess?: () => void;
  initialType?: 'preventive' | 'corrective' | 'calibration';
  initialTechnologyId?: string;
}

export default function MaintenanceForm({ equipment, onCancel, onSuccess, initialType, initialTechnologyId }: MaintenanceFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const deliverySigRef = React.useRef<SignatureCanvas>(null);
  const receptionSigRef = React.useRef<SignatureCanvas>(null);
  
  // Technology state
  const initialTech = React.useMemo(() => {
    if (initialTechnologyId && TECHNOLOGY_BY_ID[initialTechnologyId]) {
      return TECHNOLOGY_BY_ID[initialTechnologyId];
    }
    return detectTechnology(equipment.name, equipment.biomedicalType);
  }, [initialTechnologyId, equipment.name, equipment.biomedicalType]);

  const [currentTechnology, setCurrentTechnology] = React.useState<TechnologyItem>(initialTech);
  const [showTechModal, setShowTechModal] = React.useState(false);
  const [newItemName, setNewItemName] = React.useState('');
  const [showAddItem, setShowAddItem] = React.useState(false);

  const [formData, setFormData] = React.useState<Partial<MaintenanceReport>>({
    equipmentId: equipment.id,
    equipmentName: equipment.name,
    brand: equipment.brand,
    model: equipment.model,
    serial: equipment.serial,
    location: equipment.location,
    serviceName: equipment.serviceName,
    registrationInvima: equipment.registrationInvima,
    technicianId: user?.uid || '',
    technicianName: user?.displayName || '',
    date: new Date().toISOString().split('T')[0],
    dateReception: new Date().toISOString().split('T')[0],
    responsibleReception: '',
    reportNumber: 'Cargando...',
    type: initialType || 'preventive',
    subType: initialType === 'corrective' ? 'reparation' : 'plan',
    mode: 'fixed',
    description: '',
    reporterName: 'NA',
    reporterRole: 'NA',
    technicalDiagnosis: '',
    workPerformed: '',
    technologyId: initialTech.id,
    technologyName: initialTech.name,
    finalDiagnosis: '',
    equipmentStatus: 'operative',
    observations: '',
    deliveredBy: user?.displayName || '',
    deliveredByRole: 'INGENIERO BIOMÉDICO',
    receivedBy: '',
    receivedByRole: 'TERAPEUTA RESPIRATORIA',
    status: 'completed',
  });

  React.useEffect(() => {
    const fetchLastReportNumber = async () => {
      const year = new Date().getFullYear();
      const q = query(
        collection(db, 'reports'),
        where('reportNumber', '>=', `RP${year}-`),
        where('reportNumber', '<=', `RP${year}-\uf8ff`),
        orderBy('reportNumber', 'desc'),
        limit(1)
      );
      
      try {
        const querySnapshot = await getDocs(q);
        let nextNumber = 1;
        
        if (!querySnapshot.empty) {
          const lastReport = querySnapshot.docs[0].data() as MaintenanceReport;
          // Extract number from RP2026-001
          const parts = lastReport.reportNumber.split('-');
          if (parts.length === 2) {
            const lastNumber = parseInt(parts[1], 10);
            if (!isNaN(lastNumber)) {
              nextNumber = lastNumber + 1;
            }
          }
        }
        
        const formattedNumber = nextNumber.toString().padStart(3, '0');
        setFormData(prev => ({
          ...prev,
          reportNumber: `RP${year}-${formattedNumber}`
        }));
      } catch (error) {
        console.error('Error fetching last report number:', error);
        // Fallback to random if fetch fails
        setFormData(prev => ({
          ...prev,
          reportNumber: `RP${year}-${Math.floor(1000 + Math.random() * 9000)}`
        }));
      }
    };

    fetchLastReportNumber();
  }, []);

  const [spareParts, setSpareParts] = React.useState<SparePart[]>([]);
  const [attachmentFile, setAttachmentFile] = React.useState<File | null>(null);
  const [photos, setPhotos] = React.useState<string[]>([]);
  const photoInputRef = React.useRef<HTMLInputElement>(null);

  // Initialize verification items from current technology
  const [verificationItems, setVerificationItems] = React.useState<VerificationItem[]>(() => {
    return initialTech.items.map(name => ({ name, status: 'C' as const }));
  });

  const handleSelectTechnology = (tech: TechnologyItem) => {
    setCurrentTechnology(tech);
    setFormData(prev => ({
      ...prev,
      technologyId: tech.id,
      technologyName: tech.name
    }));
    setVerificationItems(tech.items.map(name => ({ name, status: 'C' as const })));
  };

  const markAllVerification = (status: 'C' | 'NC' | 'NA') => {
    setVerificationItems(prev => prev.map(item => ({ ...item, status })));
  };

  const handleAddCustomItem = () => {
    if (!newItemName.trim()) return;
    setVerificationItems(prev => [...prev, { name: newItemName.trim().toUpperCase(), status: 'C' }]);
    setNewItemName('');
    setShowAddItem(false);
  };

  const handleRemoveVerificationItem = (index: number) => {
    setVerificationItems(prev => prev.filter((_, i) => i !== index));
  };

  const compressImage = (file: File, maxWidth = 1000, maxHeight = 1000, quality = 0.82): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            if (width / height > maxWidth / maxHeight) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context error'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = (err) => reject(err);
        img.src = event.target?.result as string;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  const handlePhotosSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newPhotos: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      try {
        const compressed = await compressImage(file);
        newPhotos.push(compressed);
      } catch (err) {
        console.error('Error compressing image:', err);
      }
    }

    setPhotos(prev => [...prev, ...newPhotos].slice(0, 8));
    if (e.target) e.target.value = '';
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const getSignatureData = (ref: React.RefObject<SignatureCanvas>) => {
    if (!ref.current || ref.current.isEmpty()) return null;
    try {
      return ref.current.getTrimmedCanvas().toDataURL('image/png');
    } catch (e) {
      console.warn('getTrimmedCanvas failed, falling back to raw canvas', e);
      return ref.current.getCanvas().toDataURL('image/png');
    }
  };

  const handleChange = (field: keyof MaintenanceReport, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addSparePart = () => {
    setSpareParts([...spareParts, { description: '', quantity: 1, provider: '', partNumber: '', reference: '', value: 0 }]);
  };

  const removeSparePart = (index: number) => {
    setSpareParts(spareParts.filter((_, i) => i !== index));
  };

  const updateSparePart = (index: number, field: keyof SparePart, value: any) => {
    const newParts = [...spareParts];
    newParts[index] = { ...newParts[index], [field]: value };
    setSpareParts(newParts);
  };

  const toggleVerification = (index: number, status: 'C' | 'CU' | 'NC' | 'NA') => {
    const normalizedStatus = status === 'CU' ? 'C' : status;
    const newItems = [...verificationItems];
    newItems[index].status = normalizedStatus;
    setVerificationItems(newItems);
  };

  const formatDuration = (start: string, end: Date) => {
    const startDate = new Date(start);
    const diffMs = end.getTime() - startDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}min`;
    }
    return `${mins}min`;
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let pauseDuration = undefined;
      
      if (equipment.pauseStartDate) {
        pauseDuration = formatDuration(equipment.pauseStartDate, now);
      }

      const reportData: any = {
        ...formData,
        equipmentId: equipment.id,
        equipmentName: equipment.name,
        type: formData.type || 'preventive',
        date: formData.date || new Date().toISOString().split('T')[0],
        reportNumber: formData.reportNumber || `MT-${Math.floor(100000 + Math.random() * 900000)}`,
        technicianId: user?.uid,
        spareParts,
        verificationItems,
        photos,
        deliveredBySignature: getSignatureData(deliverySigRef),
        receivedBySignature: getSignatureData(receptionSigRef),
      };
      
      if (equipment.status === 'paused' && equipment.pauseStartDate) {
        const start = new Date(equipment.pauseStartDate);
        const end = now;
        const diffMs = end.getTime() - start.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        reportData.pauseDuration = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        reportData.pauseStartDate = equipment.pauseStartDate;
        reportData.pauseEndDate = now.toISOString();
      }

      // 1. Generar el PDF en Memoria (Base64) usando pdfGenerator.ts
      try {
        const { generateMaintenancePDF } = await import('@/lib/pdfGenerator');
        const pdfBase64 = generateMaintenancePDF(reportData as any, true) as unknown as string;
        
        // 2. Subir a Google Drive
        const fType = formData.type || 'preventive';
        const fileUploadResponse = await fetch('/api/drive/upload-document', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             equipmentDirId: equipment.driveFolderId || '',
             equipmentSerial: equipment.serial,
             equipmentName: equipment.name,
             folderType: fType,
             fileName: `Reporte_${reportData.reportNumber}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.pdf`,
             base64: pdfBase64,
             mimeType: 'application/pdf'
           })
        });

        if (fileUploadResponse.ok) {
           const uploadResult = await fileUploadResponse.json();
           if (uploadResult.webViewLink) {
             reportData.driveFileUrl = uploadResult.webViewLink;
           }
        }

        // 2.5 Subir el anexo (si existe y es calibración o mantenimiento)
        if (attachmentFile) {
           const getBase64 = (file: File): Promise<string> => {
             return new Promise((resolve) => {
               const reader = new FileReader();
               reader.onloadend = () => resolve(reader.result as string);
               reader.readAsDataURL(file);
             });
           };
           const attachmentBase64 = await getBase64(attachmentFile);
           
           const attachmentUploadRes = await fetch('/api/drive/upload-document', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
               equipmentDirId: equipment.driveFolderId || '',
               equipmentSerial: equipment.serial,
               equipmentName: equipment.name,
               folderType: fType,
               fileName: `ANEXO_${reportData.reportNumber}_${attachmentFile.name.replace(/\s+/g, '_')}`,
               base64: attachmentBase64,
               mimeType: attachmentFile.type || 'application/octet-stream' // usually pdf or img
             })
           });
           
           if (attachmentUploadRes.ok) {
             const attachResult = await attachmentUploadRes.json();
             if (attachResult.webViewLink) {
               reportData.attachmentUrl = attachResult.webViewLink; // Guardar id/url de donde quedo
             }
           }
        }

      } catch (pdfErr) {
        console.error('No se pudo subir a drive automáticamente:', pdfErr);
      }

      await addDoc(collection(db, 'reports'), {
        ...reportData,
        createdAt: serverTimestamp()
      });

      // --- CENTRALIZED SYNC ---
      // Fetch all reports to get a full picture and sync the equipment
      const q = query(collection(db, 'reports'), where('equipmentId', '==', equipment.id));
      const reportsSnap = await getDocs(q);
      const allReports = reportsSnap.docs.map(d => ({ ...d.data(), id: d.id })) as MaintenanceReport[];
      await syncEquipmentWithHistory(equipment, allReports);
      // --- END CENTRALIZED SYNC ---

      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onCancel();
      }, 2000);
    } catch (error) {
      console.error('Error saving report:', error);
      alert('Error al guardar el reporte técnico.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Card className="max-w-4xl mx-auto p-12 text-center space-y-4 animate-in zoom-in-95 duration-300">
        <div className="flex justify-center">
          <div className="bg-emerald-100 p-4 rounded-full">
            <CheckCircle2 className="h-12 w-12 text-emerald-600" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-slate-900">¡Reporte Guardado!</h2>
        <p className="text-slate-500">El reporte técnico ha sido registrado exitosamente en la hoja de vida.</p>
      </Card>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onCancel} className="rounded-xl">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver
        </Button>
        <div className="text-right">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Formulario GTE-FOR-015-V3</p>
          <h1 className="text-2xl font-black text-slate-900">Reporte Técnico de Mantenimiento</h1>
        </div>
      </div>

      <Card className="shadow-2xl border-slate-100 rounded-3xl overflow-hidden">
        <CardHeader className="bg-slate-900 text-white p-8">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="bg-white p-2 rounded-xl">
                <img src="/logo.png" alt="UCI Honda" className="h-12 w-auto" onError={(e) => e.currentTarget.src = 'https://via.placeholder.com/150x50?text=LOGO'} />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">MEDICINA INTENSIVA DEL TOLIMA S.A. - UCI HONDA</CardTitle>
                <p className="text-slate-400 text-sm">GESTIÓN DE TECNOLOGÍA - REPORTE TÉCNICO</p>
              </div>
            </div>
            <div className="text-right space-y-1">
              <Badge variant="outline" className="text-white border-white/20">Versión: 0,3</Badge>
              <p className="text-[10px] text-slate-400">Página 1 de 1</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-8 space-y-10">
          {/* Active Technology Banner */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-700 shadow-md">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-500/30">
                  Protocolo de Tecnología
                </span>
                <span className="text-xs text-slate-300 font-medium">({currentTechnology.category})</span>
              </div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                {currentTechnology.name}
              </h3>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowTechModal(true)}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-xl font-bold text-xs h-9 shrink-0 shadow-sm"
            >
              Cambiar Tecnología / Protocolo
            </Button>
          </div>

          {/* Section 1: Basic Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
            <div className="space-y-1">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha Recepción</Label>
              <Input type="date" value={formData.dateReception ?? ""} onChange={(e) => handleChange('dateReception', e.target.value)} className="bg-white border-slate-200" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha Servicio</Label>
              <Input type="date" value={formData.date ?? ""} onChange={(e) => handleChange('date', e.target.value)} className="bg-white border-slate-200" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Responsable Recepción</Label>
              <Input value={formData.responsibleReception ?? ""} onChange={(e) => handleChange('responsibleReception', e.target.value)} className="bg-white border-slate-200" placeholder="Nombre" />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">N° Reporte</Label>
              <Input value={formData.reportNumber ?? ""} readOnly className="bg-slate-100 border-slate-200 font-bold text-primary" />
            </div>
          </div>

          {/* Section 2: Equipment Data */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <span className="bg-primary text-white h-5 w-5 rounded-full flex items-center justify-center text-[10px]">1</span>
              Datos del Equipo
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500">EQUIPO</Label>
                <p className="font-bold text-slate-900 border-b border-slate-100 pb-1">{equipment.name}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500">MODELO</Label>
                <p className="font-bold text-slate-900 border-b border-slate-100 pb-1">{equipment.model}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500">MARCA</Label>
                <p className="font-bold text-slate-900 border-b border-slate-100 pb-1">{equipment.brand}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500">SERIE</Label>
                <p className="font-bold text-slate-900 border-b border-slate-100 pb-1">{equipment.serial}</p>
              </div>
            </div>
          </div>

          {/* Section 3: General Data */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <span className="bg-primary text-white h-5 w-5 rounded-full flex items-center justify-center text-[10px]">2</span>
              Datos Generales
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500">INVIMA</Label>
                <p className="font-bold text-slate-900 border-b border-slate-100 pb-1">{equipment.registrationInvima}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500">UBICACIÓN</Label>
                <p className="font-bold text-slate-900 border-b border-slate-100 pb-1">{equipment.serviceName} - {equipment.location}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500">MODO</Label>
                <div className="flex gap-4 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={formData.mode === 'mobile'} onCheckedChange={() => handleChange('mode', 'mobile')} />
                    <span className="text-sm font-bold">MÓVIL</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={formData.mode === 'fixed'} onCheckedChange={() => handleChange('mode', 'fixed')} />
                    <span className="text-sm font-bold">FIJO</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Type of Maintenance */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <span className="bg-primary text-white h-5 w-5 rounded-full flex items-center justify-center text-[10px]">3</span>
              Tipo de Mantenimiento
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors ${formData.type === 'preventive' ? 'border-primary bg-primary' : 'border-slate-300'}`}>
                    {formData.type === 'preventive' && <div className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                  <input type="radio" className="hidden" name="type" checked={formData.type === 'preventive'} onChange={() => handleChange('type', 'preventive')} />
                  <span className="font-black text-slate-900">MANTENIMIENTO PREVENTIVO</span>
                </label>
                <div className="grid grid-cols-2 gap-4 pl-9">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={formData.subType === 'plan'} onCheckedChange={() => handleChange('subType', 'plan')} disabled={formData.type !== 'preventive'} />
                    <span className="text-xs font-bold">PLAN DE MANTO.</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={formData.subType === 'revision'} onCheckedChange={() => handleChange('subType', 'revision')} disabled={formData.type !== 'preventive'} />
                    <span className="text-xs font-bold">REVISIÓN</span>
                  </label>
                </div>
              </div>
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors ${formData.type === 'corrective' ? 'border-primary bg-primary' : 'border-slate-300'}`}>
                    {formData.type === 'corrective' && <div className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                  <input type="radio" className="hidden" name="type" checked={formData.type === 'corrective'} onChange={() => handleChange('type', 'corrective')} />
                  <span className="font-black text-slate-900">MANTENIMIENTO CORRECTIVO</span>
                </label>
                <div className="grid grid-cols-2 gap-4 pl-9">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={formData.subType === 'reparation'} onCheckedChange={() => handleChange('subType', 'reparation')} disabled={formData.type !== 'corrective'} />
                    <span className="text-xs font-bold">REPARACIÓN</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={formData.subType === 'replacement'} onCheckedChange={() => handleChange('subType', 'replacement')} disabled={formData.type !== 'corrective'} />
                    <span className="text-xs font-bold">REPOSICIÓN</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Section 5: Description */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <span className="bg-primary text-white h-5 w-5 rounded-full flex items-center justify-center text-[10px]">4</span>
              Descripción del Reporte
            </h3>
            <Textarea 
              placeholder="Describa el motivo del mantenimiento o la falla reportada..." 
              value={formData.description ?? ""}
              onChange={(e) => handleChange('description', e.target.value)}
              className="min-h-[100px] rounded-2xl border-slate-200"
            />
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500">NOMBRE REPORTANTE</Label>
                <Input value={formData.reporterName ?? ""} onChange={(e) => handleChange('reporterName', e.target.value)} className="rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500">CARGO DEL REPORTANTE</Label>
                <Input value={formData.reporterRole ?? ""} onChange={(e) => handleChange('reporterRole', e.target.value)} className="rounded-xl" />
              </div>
            </div>
          </div>

          {/* Section 6: Technical Diagnosis */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <span className="bg-primary text-white h-5 w-5 rounded-full flex items-center justify-center text-[10px]">5</span>
              Diagnóstico Técnico
            </h3>
            <Textarea 
              placeholder="Estado inicial encontrado..." 
              value={formData.technicalDiagnosis ?? ""}
              onChange={(e) => handleChange('technicalDiagnosis', e.target.value)}
              className="min-h-[80px] rounded-2xl border-slate-200"
            />
          </div>

          {/* Section 7: Work Performed */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <span className="bg-primary text-white h-5 w-5 rounded-full flex items-center justify-center text-[10px]">6</span>
              Trabajo Realizado
            </h3>
            <Textarea 
              placeholder="Detalle de las actividades realizadas..." 
              value={formData.workPerformed ?? ""}
              onChange={(e) => handleChange('workPerformed', e.target.value)}
              className="min-h-[120px] rounded-2xl border-slate-200"
            />
          </div>

          {/* Section 8: Spare Parts */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <span className="bg-primary text-white h-5 w-5 rounded-full flex items-center justify-center text-[10px]">7</span>
                Repuestos Utilizados
              </h3>
              <Button variant="outline" size="sm" onClick={addSparePart} className="rounded-xl h-8">
                <Plus className="mr-2 h-3 w-3" /> Agregar Repuesto
              </Button>
            </div>
            <div className="border rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold text-slate-500 text-[10px] uppercase">Descripción</th>
                    <th className="px-4 py-3 text-left font-bold text-slate-500 text-[10px] uppercase">Cant.</th>
                    <th className="px-4 py-3 text-left font-bold text-slate-500 text-[10px] uppercase">Proveedor</th>
                    <th className="px-4 py-3 text-left font-bold text-slate-500 text-[10px] uppercase">Ref/Parte</th>
                    <th className="px-4 py-3 text-left font-bold text-slate-500 text-[10px] uppercase">Valor</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {spareParts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-medium italic">No se utilizaron repuestos</td>
                    </tr>
                  ) : (
                    spareParts.map((part, index) => (
                      <tr key={index}>
                        <td className="p-2"><Input value={part.description ?? ""} onChange={(e) => updateSparePart(index, 'description', e.target.value)} className="h-8 border-none shadow-none focus-visible:ring-0" /></td>
                        <td className="p-2 w-20"><Input type="number" value={part.quantity ?? ""} onChange={(e) => updateSparePart(index, 'quantity', parseInt(e.target.value))} className="h-8 border-none shadow-none focus-visible:ring-0" /></td>
                        <td className="p-2"><Input value={part.provider ?? ""} onChange={(e) => updateSparePart(index, 'provider', e.target.value)} className="h-8 border-none shadow-none focus-visible:ring-0" /></td>
                        <td className="p-2"><Input value={part.reference ?? ""} onChange={(e) => updateSparePart(index, 'reference', e.target.value)} className="h-8 border-none shadow-none focus-visible:ring-0" /></td>
                        <td className="p-2 w-32"><Input type="number" value={part.value ?? ""} onChange={(e) => updateSparePart(index, 'value', parseFloat(e.target.value))} className="h-8 border-none shadow-none focus-visible:ring-0" /></td>
                        <td className="p-2"><Button variant="ghost" size="icon" onClick={() => removeSparePart(index)} className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 8: Verification */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <span className="bg-primary text-white h-5 w-5 rounded-full flex items-center justify-center text-[10px]">8</span>
                  Verificación de Funcionamiento y Estado
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Protocolo: <span className="font-bold text-slate-800">{currentTechnology.name}</span> ({verificationItems.length} puntos de chequeo)
                </p>
              </div>

              {/* Quick Actions */}
              <div className="flex items-center flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => markAllVerification('C')}
                  className="h-8 text-xs font-bold rounded-xl border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-400"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                  Marcar Todos C
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => markAllVerification('NA')}
                  className="h-8 text-xs font-bold rounded-xl border-slate-300 text-slate-600 hover:bg-slate-100"
                >
                  Marcar Todos NA
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddItem(!showAddItem)}
                  className="h-8 text-xs font-bold rounded-xl border-slate-200 hover:bg-slate-100"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Agregar Ítem
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowTechModal(true)}
                  className="h-8 text-xs font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800"
                >
                  Cambiar Tecnología
                </Button>
              </div>
            </div>

            {/* Custom Item Input */}
            {showAddItem && (
              <div className="p-3 bg-white border border-slate-200 rounded-2xl flex items-center gap-2 shadow-sm animate-in fade-in-50">
                <Input
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Nombre del ítem de verificación..."
                  className="h-9 text-xs font-medium rounded-xl"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomItem();
                    }
                  }}
                  autoFocus
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddCustomItem}
                  className="h-9 px-4 rounded-xl text-xs font-bold bg-primary text-white"
                >
                  Agregar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowAddItem(false);
                    setNewItemName('');
                  }}
                  className="h-9 text-xs rounded-xl"
                >
                  Cancelar
                </Button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 bg-slate-50 p-6 rounded-2xl border border-slate-100">
              {verificationItems.map((item, index) => {
                const isC = item.status === 'C' || item.status === 'CU';
                const isNC = item.status === 'NC';
                const isNA = item.status === 'NA';

                return (
                  <div
                    key={index}
                    className="flex items-center justify-between py-2.5 px-3 bg-white rounded-xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-colors group"
                  >
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-tight pr-2 flex-1">
                      {item.name}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleVerification(index, 'C')}
                        className={`h-7 px-2.5 rounded-lg text-[11px] font-black tracking-wide transition-all ${
                          isC
                            ? 'bg-emerald-600 text-white shadow-xs scale-105'
                            : 'bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700'
                        }`}
                        title="Cumple"
                      >
                        C
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleVerification(index, 'NC')}
                        className={`h-7 px-2.5 rounded-lg text-[11px] font-black tracking-wide transition-all ${
                          isNC
                            ? 'bg-rose-600 text-white shadow-xs scale-105'
                            : 'bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-700'
                        }`}
                        title="No Cumple"
                      >
                        NC
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleVerification(index, 'NA')}
                        className={`h-7 px-2.5 rounded-lg text-[11px] font-black tracking-wide transition-all ${
                          isNA
                            ? 'bg-slate-600 text-white shadow-xs scale-105'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
                        }`}
                        title="No Aplica"
                      >
                        NA
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveVerificationItem(index)}
                        className="h-7 w-7 text-slate-300 hover:text-destructive hover:bg-destructive/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Eliminar ítem"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 10: Final Diagnosis & Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <span className="bg-primary text-white h-5 w-5 rounded-full flex items-center justify-center text-[10px]">9</span>
                Diagnóstico Final
              </h3>
              <Textarea 
                placeholder="Conclusión técnica..." 
                value={formData.finalDiagnosis ?? ""}
                onChange={(e) => handleChange('finalDiagnosis', e.target.value)}
                className="min-h-[80px] rounded-2xl border-slate-200"
              />
            </div>
            <div className="space-y-4">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <span className="bg-primary text-white h-5 w-5 rounded-full flex items-center justify-center text-[10px]">10</span>
                Estado del Equipo
              </h3>
              <div className="grid grid-cols-1 gap-3">
                <label className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${formData.equipmentStatus === 'operative' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100'}`}>
                  <span className="font-bold text-slate-900">OPERATIVO</span>
                  <Checkbox checked={formData.equipmentStatus === 'operative'} onCheckedChange={() => handleChange('equipmentStatus', 'operative')} />
                </label>
                <label className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${formData.equipmentStatus === 'non_operative' ? 'border-amber-500 bg-amber-50' : 'border-slate-100'}`}>
                  <span className="font-bold text-slate-900">NO OPERATIVO</span>
                  <Checkbox checked={formData.equipmentStatus === 'non_operative'} onCheckedChange={() => handleChange('equipmentStatus', 'non_operative')} />
                </label>
                <label className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${formData.equipmentStatus === 'retired' ? 'border-destructive bg-destructive/5' : 'border-slate-100'}`}>
                  <span className="font-bold text-slate-900">DAR DE BAJA</span>
                  <Checkbox checked={formData.equipmentStatus === 'retired'} onCheckedChange={() => handleChange('equipmentStatus', 'retired')} />
                </label>
              </div>
            </div>
          </div>

          {/* Section 11: Observations */}
          <div className="space-y-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <span className="bg-primary text-white h-5 w-5 rounded-full flex items-center justify-center text-[10px]">11</span>
              Observaciones
            </h3>
            <Textarea 
              placeholder="Recomendaciones adicionales..." 
              value={formData.observations ?? ""}
              onChange={(e) => handleChange('observations', e.target.value)}
              className="min-h-[80px] rounded-2xl border-slate-200"
            />
          </div>

          {/* Section 12: Photographic Evidence */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <span className="bg-primary text-white h-5 w-5 rounded-full flex items-center justify-center text-[10px]">12</span>
                Evidencia Fotográfica
              </h3>
              <div>
                <input 
                  type="file" 
                  ref={photoInputRef} 
                  onChange={handlePhotosSelected} 
                  accept="image/*" 
                  multiple 
                  className="hidden" 
                />
                <Button 
                  type="button"
                  variant="outline" 
                  size="sm" 
                  onClick={() => photoInputRef.current?.click()} 
                  className="rounded-xl h-9 bg-white shadow-sm hover:bg-slate-50 border-slate-200 font-bold text-xs"
                >
                  <Camera className="mr-2 h-4 w-4 text-primary" />
                  Adjuntar Fotos / Evidencia
                </Button>
              </div>
            </div>

            {photos.length === 0 ? (
              <div 
                onClick={() => photoInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 hover:border-primary/50 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-slate-50"
              >
                <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
                  <Camera className="h-5 w-5" />
                </div>
                <p className="text-xs font-bold text-slate-700">Haga clic para adjuntar fotos de evidencia técnica</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Las imágenes se optimizarán e imprimirán directamente en el reporte PDF.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  {photos.map((photo, idx) => (
                    <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 bg-white aspect-square shadow-sm">
                      <img 
                        src={photo} 
                        alt={`Evidencia ${idx + 1}`} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="h-8 w-8 rounded-full shadow-lg"
                          onClick={() => removePhoto(idx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <span className="absolute bottom-1.5 left-1.5 text-[9px] font-black bg-slate-900/70 text-white px-2 py-0.5 rounded-md">
                        Foto #{idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 font-medium text-right">
                  {photos.length} foto(s) adjunta(s) (máximo 8)
                </p>
              </div>
            )}
          </div>

          {/* Section 13: Signatures */}
          <div className="space-y-4 pt-6 border-t">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <span className="bg-primary text-white h-5 w-5 rounded-full flex items-center justify-center text-[10px]">13</span>
              Firmas de Entrega y Recepción
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div className="space-y-4">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest text-center border-b pb-2">ENTREGADO POR</p>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-500">NOMBRE</Label>
                    <Input value={formData.deliveredBy ?? ""} onChange={(e) => handleChange('deliveredBy', e.target.value)} className="rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-500">CARGO</Label>
                    <Input value={formData.deliveredByRole ?? ""} onChange={(e) => handleChange('deliveredByRole', e.target.value)} className="rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-500">FIRMA</Label>
                    <div className="border-2 border-slate-100 rounded-2xl bg-white overflow-hidden relative group">
                      <SignatureCanvas 
                        ref={deliverySigRef}
                        penColor="black"
                        canvasProps={{ className: "w-full h-40 cursor-crosshair" }}
                      />
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute top-2 right-2 rounded-full h-8 w-8 bg-slate-50/80 hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => deliverySigRef.current?.clear()}
                        type="button"
                      >
                        <Eraser className="h-4 w-4 text-slate-500" />
                      </Button>
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none">
                        <p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">Espacio para firma</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest text-center border-b pb-2">RECIBIDO POR</p>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-500">NOMBRE</Label>
                    <Input value={formData.receivedBy ?? ""} onChange={(e) => handleChange('receivedBy', e.target.value)} className="rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-500">CARGO</Label>
                    <Input value={formData.receivedByRole ?? ""} onChange={(e) => handleChange('receivedByRole', e.target.value)} className="rounded-xl" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-500">FIRMA</Label>
                    <div className="border-2 border-slate-100 rounded-2xl bg-white overflow-hidden relative group">
                      <SignatureCanvas 
                        ref={receptionSigRef}
                        penColor="black"
                        canvasProps={{ className: "w-full h-40 cursor-crosshair" }}
                      />
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute top-2 right-2 rounded-full h-8 w-8 bg-slate-50/80 hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => receptionSigRef.current?.clear()}
                        type="button"
                      >
                        <Eraser className="h-4 w-4 text-slate-500" />
                      </Button>
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none">
                        <p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">Espacio para firma</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="bg-slate-50 p-8 border-t flex justify-end gap-4">
          <Button variant="ghost" onClick={onCancel} className="rounded-xl px-8">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="rounded-xl px-12 shadow-xl shadow-primary/20 h-12 text-lg font-bold">
            {loading ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Guardando Reporte...</>
            ) : (
              <><Save className="mr-2 h-5 w-5" /> Finalizar y Guardar Reporte</>
            )}
          </Button>
        </CardFooter>
      </Card>
      
      <p className="text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest">
        Copia Controlada - Sistema de Gestión de Calidad UCI Honda
      </p>

      {/* Technology Selector Dialog */}
      <TechnologySelectorDialog
        open={showTechModal}
        onOpenChange={setShowTechModal}
        onSelectTechnology={handleSelectTechnology}
        selectedTechId={currentTechnology.id}
        equipmentName={equipment.name}
        equipmentType={equipment.biomedicalType}
      />
    </div>
  );
}
