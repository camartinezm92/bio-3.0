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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  ArrowLeft, 
  Save, 
  Loader2, 
  CheckCircle2, 
  ArrowLeftRight,
  Search,
  User,
  MapPin,
  Eraser,
  PenTool,
  FileText,
  Download,
  ExternalLink
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { collection, addDoc, serverTimestamp, getDocs, query, where, orderBy, limit, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Equipment, Transfer, Service } from '@/types';
import { useAuth } from '@/lib/AuthContext';
import { mockServices } from '@/services/mockData';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Add "Externo" to services for the form
const extendedServices = [...mockServices, { id: 'external', name: 'EXTERNO (PROVEEDOR/TALLER)', description: 'Servicio fuera de la clínica' }];


interface TransferFormProps {
  onCancel: () => void;
  onSuccess?: () => void;
  initialData?: Transfer;
  readOnly?: boolean;
}

export default function TransferForm({ onCancel, onSuccess, initialData, readOnly }: TransferFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [equipmentList, setEquipmentList] = React.useState<Equipment[]>([]);
  const [selectedEquipment, setSelectedEquipment] = React.useState<Equipment | null>(initialData ? {
    id: initialData.equipmentId,
    name: initialData.equipmentName,
    serial: initialData.equipmentSerial,
    assetNumber: initialData.equipmentAsset,
    serviceId: initialData.originServiceId,
    serviceName: initialData.originServiceName
  } as any : null);
  const [isSearching, setIsSearching] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<Equipment[]>([]);
  
  const deliverySigRef = React.useRef<SignatureCanvas>(null);
  const receptionSigRef = React.useRef<SignatureCanvas>(null);
  
  const [formData, setFormData] = React.useState<Partial<Transfer>>(initialData || {
    date: new Date().toISOString().split('T')[0],
    technicianId: user?.uid || '',
    technicianName: user?.displayName || '',
    reason: '',
    observations: '',
    destinationLocation: '',
    destinationServiceId: '',
    destinationServiceName: '',
    isExternal: false,
    externalName: '',
    temporarySerial: '',
    reportNumber: 'Cargando...',
    status: 'completed'
  });

  // Load signatures if initialData exists
  React.useEffect(() => {
    if (initialData) {
      if (initialData.deliveredBySignature && deliverySigRef.current) {
        deliverySigRef.current.fromDataURL(initialData.deliveredBySignature);
      }
      if (initialData.receivedBySignature && receptionSigRef.current) {
        receptionSigRef.current.fromDataURL(initialData.receivedBySignature);
      }
    }
  }, [initialData]);

  // Fetch consecutive number
  React.useEffect(() => {
    const fetchLastTransferNumber = async () => {
      const year = new Date().getFullYear();
      try {
        const q = query(
          collection(db, 'transfers'),
          where('reportNumber', '>=', `TR${year}-`),
          where('reportNumber', '<=', `TR${year}-\uf8ff`),
          orderBy('reportNumber', 'desc'),
          limit(1)
        );
        
        const querySnapshot = await getDocs(q);
        let nextNumber = 1;
        
        if (!querySnapshot.empty) {
          const lastNumberStr = querySnapshot.docs[0].data().reportNumber.split('-')[1];
          nextNumber = parseInt(lastNumberStr) + 1;
        }
        
        const formattedNumber = nextNumber.toString().padStart(3, '0');
        setFormData(prev => ({
          ...prev,
          reportNumber: `TR${year}-${formattedNumber}`
        }));
      } catch (error) {
        console.error('Error fetching last transfer number:', error);
        setFormData(prev => ({
          ...prev,
          reportNumber: `TR${year}-${Math.floor(100 + Math.random() * 900)}`
        }));
      }
    };

    fetchLastTransferNumber();
  }, []);

  // Search equipment
  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setIsSearching(true);
    setSearchResults([]);
    try {
      // 1. Try exact match for Asset Number
      const qAsset = query(
        collection(db, 'equipment'),
        where('assetNumber', '==', searchTerm.trim())
      );
      const snapAsset = await getDocs(qAsset);
      
      if (!snapAsset.empty) {
        selectEquipment({ ...snapAsset.docs[0].data(), id: snapAsset.docs[0].id } as Equipment);
        return;
      }

      // 2. Try exact match for Serial
      const qSerial = query(
        collection(db, 'equipment'),
        where('serial', '==', searchTerm.trim())
      );
      const snapSerial = await getDocs(qSerial);
      
      if (!snapSerial.empty) {
        selectEquipment({ ...snapSerial.docs[0].data(), id: snapSerial.docs[0].id } as Equipment);
        return;
      }

      // 3. Try partial match for Name (fetching all and filtering locally for better UX)
      // Note: In production with thousands of items, this should be a prefix query or use Algolia
      const qAll = query(collection(db, 'equipment'), limit(100));
      const snapAll = await getDocs(qAll);
      const allEq = snapAll.docs.map(doc => ({ ...doc.data(), id: doc.id } as Equipment));
      
      const filtered = allEq.filter(eq => 
        eq.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        eq.serial.toLowerCase().includes(searchTerm.toLowerCase()) ||
        eq.assetNumber.toLowerCase().includes(searchTerm.toLowerCase())
      );

      if (filtered.length === 1) {
        selectEquipment(filtered[0]);
      } else if (filtered.length > 1) {
        setSearchResults(filtered);
      } else {
        alert('No se encontró ningún equipo con ese nombre, serial o activo fijo.');
      }
    } catch (error) {
      console.error('Error searching equipment:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const selectEquipment = (eq: Equipment) => {
    setSelectedEquipment(eq);
    setSearchResults([]);
    setFormData(prev => ({
      ...prev,
      equipmentId: eq.id,
      equipmentName: eq.name,
      equipmentSerial: eq.serial,
      equipmentAsset: eq.assetNumber,
      originServiceId: eq.serviceId,
      originServiceName: eq.serviceName || 'No especificado'
    }));
  };

  const handleChange = (field: keyof Transfer, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleDestinationChange = (serviceId: string) => {
    const service = extendedServices.find(s => s.id === serviceId);
    setFormData(prev => ({
      ...prev,
      destinationServiceId: serviceId,
      destinationServiceName: service?.name || '',
      isExternal: serviceId === 'external'
    }));
  };

  const clearSignature = (ref: React.RefObject<SignatureCanvas>) => {
    ref.current?.clear();
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

  const loadImage = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = url;
    });
  };

  const generatePDF = async (data: any, returnBase64?: boolean) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFillColor(37, 99, 235); // blue-600
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('MEDICINA INTENSIVA DEL TOLIMA S.A.', 50, 15);
    doc.text('UCI HONDA', 50, 22);
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('GESTIÓN DE TECNOLOGÍA - ACTA DE TRASLADO', 50, 28);
    doc.text(`N° ACTA: ${data.reportNumber} | FECHA: ${data.date}`, 50, 34);

    // Add Logo to Header
    try {
      const logoBase64 = await loadImage('/logo.png');
      // No circle background needed if header is lighter and logo is fixed
      doc.addImage(logoBase64, 'PNG', 15, 7, 26, 26);
    } catch (e) {
      console.warn('Could not add logo to PDF, trying placeholder', e);
      try {
        // Fallback to a simple shape if image fails
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(1);
        doc.circle(30, 20, 15, 'S');
        doc.setFontSize(14);
        doc.text('UCI', 24, 22);
      } catch (err) {
        console.error('Final fallback failed', err);
      }
    }

    // Equipment Info
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('1. INFORMACIÓN DEL EQUIPO', 20, 55);
    
    const eqInfo = [
      ['Equipo:', data.equipmentName],
      ['Serial:', data.temporarySerial ? `${data.equipmentSerial} (${data.temporarySerial})` : data.equipmentSerial],
      ['Activo Fijo:', data.equipmentAsset],
      ['Origen:', data.originServiceName]
    ];
    
    autoTable(doc, {
      startY: 60,
      head: [],
      body: eqInfo,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } }
    });

    // Transfer Details
    const currentY = (doc as any).lastAutoTable.finalY + 10;
    doc.text('2. DETALLES DEL TRASLADO', 20, currentY);
    
    const transInfo = [
      ['Destino:', data.isExternal ? `EXTERNO - ${data.externalName}` : data.destinationServiceName],
      ['Ubicación:', data.destinationLocation || 'N/A'],
      ['Motivo:', data.reason.toUpperCase()],
      ['Serial Temporal:', data.temporarySerial || 'N/A']
    ];
    
    autoTable(doc, {
      startY: currentY + 5,
      head: [],
      body: transInfo,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } }
    });

    // Observations
    const obsY = (doc as any).lastAutoTable.finalY + 10;
    doc.text('3. OBSERVACIONES', 20, obsY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const splitObs = doc.splitTextToSize(data.observations || 'Sin observaciones adicionales.', pageWidth - 40);
    doc.text(splitObs, 20, obsY + 8);

    // Signatures
    const sigY = obsY + 40;
    doc.setFont('helvetica', 'bold');
    doc.text('4. FIRMAS DE RESPONSABILIDAD', 20, sigY);
    
    if (data.deliveredBySignature) {
      doc.addImage(data.deliveredBySignature, 'PNG', 20, sigY + 5, 60, 30);
    }
    doc.line(20, sigY + 35, 80, sigY + 35);
    doc.setFontSize(8);
    doc.text('ENTREGA (ORIGEN)', 20, sigY + 40);
    doc.text(data.technicianName || 'Técnico', 20, sigY + 44);

    if (data.receivedBySignature) {
      doc.addImage(data.receivedBySignature, 'PNG', 120, sigY + 5, 60, 30);
    }
    doc.line(120, sigY + 35, 180, sigY + 35);
    doc.text('RECIBE (DESTINO)', 120, sigY + 40);
    doc.text(data.isExternal ? data.externalName : 'Responsable Destino', 120, sigY + 44);

    if (returnBase64) {
      return doc.output('datauristring');
    } else {
      doc.save(`Acta_Traslado_${data.reportNumber}.pdf`);
    }
  };

  const handleSubmit = async () => {
    if (!selectedEquipment || !formData.destinationServiceId || !formData.reason) {
      alert('Por favor complete todos los campos obligatorios.');
      return;
    }

    if (formData.isExternal && !formData.externalName) {
      alert('Por favor ingrese el nombre del proveedor/entidad externa.');
      return;
    }

    setLoading(true);
    try {
      let transferData: any = {
        ...formData,
        deliveredBySignature: getSignatureData(deliverySigRef),
        receivedBySignature: getSignatureData(receptionSigRef),
      };

      // 1. Generate PDF Base64
      try {
        const pdfBase64 = await generatePDF(transferData, true) as unknown as string;
        
        // 2. Upload to Drive (general Traslados folder + equipment folder internally handled by server)
        const fileUploadResponse = await fetch('/api/drive/upload-document', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             equipmentDirId: selectedEquipment.driveFolderId || '',
             folderType: 'transfer',
             fileName: `${selectedEquipment.serial}_ACTA_TRASLADO_${transferData.reportNumber}.pdf`,
             base64: pdfBase64,
             mimeType: 'application/pdf'
           })
        });

        if (fileUploadResponse.ok) {
           const uploadResult = await fileUploadResponse.json();
           if (uploadResult.webViewLink) {
             transferData.driveFileUrl = uploadResult.webViewLink;
           }
        }
      } catch (pdfErr) {
        console.error('No se pudo subir a drive automáticamente:', pdfErr);
      }

      transferData.createdAt = serverTimestamp();

      // 3. Save Transfer Record
      await addDoc(collection(db, 'transfers'), transferData);

      // 4. Update Equipment Location and Serial if temporary
      const equipmentUpdate: any = {
        serviceId: formData.destinationServiceId,
        serviceName: formData.isExternal ? `EXTERNO: ${formData.externalName}` : formData.destinationServiceName,
        location: formData.destinationLocation || selectedEquipment.location,
        updatedAt: serverTimestamp()
      };

      if (formData.temporarySerial) {
        // We keep the original serial and just store the temporary one
        equipmentUpdate.temporarySerial = formData.temporarySerial;
      } else {
        // If no temporary serial, ensure it's cleared (in case of a return)
        equipmentUpdate.temporarySerial = null;
      }

      await updateDoc(doc(db, 'equipment', selectedEquipment.id), equipmentUpdate);

      // 5. Sync Sheets
      try {
        await fetch('/api/equipment/sync-sheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            equipment: { ...selectedEquipment, ...equipmentUpdate }
          })
        });
      } catch (e) {
        console.error('Error sincronizando Sheets:', e);
      }

      // Generate PDF automatically
      await generatePDF(transferData);

      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onCancel();
      }, 2000);
    } catch (error) {
      console.error('Error saving transfer:', error);
      alert('Error al registrar el traslado.');
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
        <h2 className="text-2xl font-bold text-slate-900">¡Traslado Exitoso!</h2>
        <p className="text-slate-500">El movimiento del equipo ha sido registrado y el inventario actualizado.</p>
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
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Formulario GTE-FOR-018-V1</p>
          <h1 className="text-2xl font-black text-slate-900">Acta de Traslado de Equipo</h1>
        </div>
      </div>

      <Card className="shadow-2xl border-slate-100 rounded-3xl overflow-hidden">
        <CardHeader className="bg-blue-600 text-white p-8">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="bg-white p-2 rounded-xl">
                <img src="/logo.png" alt="UCI Honda" className="h-12 w-auto" onError={(e) => e.currentTarget.src = 'https://via.placeholder.com/150x50?text=LOGO'} />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">MEDICINA INTENSIVA DEL TOLIMA S.A. - UCI HONDA</CardTitle>
                <p className="text-slate-400 text-sm">GESTIÓN DE TECNOLOGÍA - ACTA DE TRASLADO</p>
              </div>
            </div>
            <div className="text-right space-y-2">
              <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/20">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">N° ACTA</p>
                <p className="text-xl font-black text-white font-mono">{formData.reportNumber}</p>
              </div>
              {initialData && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={async () => await generatePDF(formData)}
                  className="w-full bg-white/5 border-white/10 text-white hover:bg-white/10 rounded-xl h-10"
                >
                  <Download className="mr-2 h-4 w-4" /> Descargar PDF
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-8 space-y-10">
          {/* Section 1: Equipment Search */}
          {!selectedEquipment ? (
            <div className="space-y-4 bg-slate-50 p-8 rounded-3xl border border-slate-100">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                Buscar Equipo para Traslado
              </h3>
              <div className="flex gap-4">
                <div className="relative flex-1">
                    <Input 
                      placeholder="Ingrese Serial o Activo Fijo..." 
                      value={searchTerm ?? ""}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      className="h-14 rounded-2xl border-slate-200 pl-4 text-lg font-bold"
                    />
                </div>
                <Button 
                  onClick={handleSearch} 
                  disabled={isSearching}
                  className="h-14 px-8 rounded-2xl shadow-lg shadow-primary/20"
                >
                  {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Buscar'}
                </Button>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                * El equipo debe estar registrado previamente en el inventario para realizar el traslado.
              </p>

              {searchResults.length > 0 && (
                <div className="mt-6 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Resultados encontrados ({searchResults.length}):</p>
                  <div className="grid gap-3">
                    {searchResults.map(eq => (
                      <button
                        key={eq.id}
                        onClick={() => selectEquipment(eq)}
                        className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:border-primary hover:bg-primary/5 transition-all text-left group"
                      >
                        <div>
                          <p className="font-bold text-slate-900 group-hover:text-primary">{eq.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                            Serial: {eq.serial} | Activo: {eq.assetNumber}
                          </p>
                        </div>
                        <div className="px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-black text-slate-500 group-hover:bg-primary group-hover:text-white">
                          SELECCIONAR
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  Información del Equipo Seleccionado
                </h3>
                {!readOnly && (
                  <Button variant="ghost" size="sm" onClick={() => setSelectedEquipment(null)} className="text-xs font-bold text-primary">
                    Cambiar Equipo
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Equipo</Label>
                  <p className="font-black text-slate-900">{selectedEquipment.name}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Marca / Modelo</Label>
                  <p className="font-bold text-slate-700">{selectedEquipment.brand} {selectedEquipment.model}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Serial</Label>
                  <p className="font-mono font-bold text-slate-900">{selectedEquipment.serial}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Activo Fijo</Label>
                  <p className="font-mono font-bold text-slate-900">{selectedEquipment.assetNumber}</p>
                </div>
              </div>
            </div>
          )}

          {selectedEquipment && (
            <div className="space-y-10 animate-in fade-in duration-700">
              {/* Section 2: Transfer Details */}
              <div className="grid md:grid-cols-2 gap-12">
                <div className="space-y-6">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-rose-500" />
                    Origen y Destino
                  </h3>
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Servicio de Origen</Label>
                      <p className="text-lg font-black text-slate-900">{formData.originServiceName}</p>
                    </div>
                    <div className="flex justify-center">
                      <ArrowLeftRight className="h-8 w-8 text-primary/30 rotate-90 md:rotate-0" />
                    </div>
                    <div className="space-y-4 p-6 bg-primary/5 rounded-3xl border border-primary/10">
                      <div className="space-y-2">
                        <Label className="text-sm font-bold text-slate-700">Servicio de Destino *</Label>
                        <Select onValueChange={handleDestinationChange} disabled={readOnly} value={formData.destinationServiceId || ""}>
                          <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-white">
                            <SelectValue placeholder="Seleccione el servicio..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {extendedServices.map(service => (
                              <SelectItem key={service.id} value={service.id}>{service.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {formData.isExternal && (
                        <div className="space-y-2 animate-in zoom-in-95">
                          <Label className="text-sm font-bold text-slate-700">Nombre del Externo (Proveedor/Taller) *</Label>
                          <Input 
                            placeholder="Ej: Siemens Healthineers, Biomédica del Tolima..." 
                            value={formData.externalName ?? ""}
                            onChange={(e) => handleChange('externalName', e.target.value)}
                            disabled={readOnly}
                            className="h-12 rounded-xl border-primary/30 bg-white focus:ring-primary/20"
                          />
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label className="text-sm font-bold text-slate-700">Ubicación Específica</Label>
                        <Input 
                          placeholder="Ej: Cubículo 10, Sala 2..." 
                          value={formData.destinationLocation ?? ""}
                          onChange={(e) => handleChange('destinationLocation', e.target.value)}
                          disabled={readOnly}
                          className="h-12 rounded-xl border-slate-200 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                    <FileText className="h-5 w-5 text-sky-500" />
                    Justificación del Movimiento
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-bold text-slate-700">Motivo del Traslado *</Label>
                      <Select onValueChange={(v) => handleChange('reason', v)} disabled={readOnly} value={formData.reason || ""}>
                        <SelectTrigger className="h-12 rounded-xl border-slate-200">
                          <SelectValue placeholder="Seleccione el motivo..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="reparacion">Reparación Técnica</SelectItem>
                          <SelectItem value="calibracion">Calibración / Calificación</SelectItem>
                          <SelectItem value="prestamo">Préstamo entre Servicios</SelectItem>
                          <SelectItem value="necesidad">Necesidad del Paciente</SelectItem>
                          <SelectItem value="traslado_definitivo">Traslado Definitivo</SelectItem>
                          <SelectItem value="baja">Proceso de Baja</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {(formData.reason === 'reparacion' || formData.reason === 'calibracion') && formData.isExternal && (
                      <div className="space-y-2 animate-in zoom-in-95">
                        <Label className="text-sm font-bold text-slate-700">Serial Temporal (Equipo de Cobertura)</Label>
                        <Input 
                          placeholder="Ingrese el serial del equipo prestado..." 
                          value={formData.temporarySerial ?? ""}
                          onChange={(e) => handleChange('temporarySerial', e.target.value)}
                          disabled={readOnly}
                          className="h-12 rounded-xl border-amber-200 bg-amber-50/30"
                        />
                        <p className="text-[10px] text-amber-600 font-bold">
                          * Este serial se mostrará en el inventario mientras el equipo original esté fuera.
                        </p>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label className="text-sm font-bold text-slate-700">Observaciones Adicionales</Label>
                      <Textarea 
                        placeholder="Detalle cualquier información relevante sobre el estado del equipo al momento del traslado..." 
                        className="min-h-[150px] rounded-2xl border-slate-200"
                        value={formData.observations ?? ""}
                        onChange={(e) => handleChange('observations', e.target.value)}
                        disabled={readOnly}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Signatures */}
              <div className="grid md:grid-cols-2 gap-8 pt-8 border-t">
                <div className="space-y-4">
                  <Label className="text-xs font-black text-slate-500 uppercase tracking-widest">Firma Entrega (Origen)</Label>
                  <div className="border-2 border-slate-200 rounded-3xl bg-white overflow-hidden group">
                    <SignatureCanvas 
                      ref={deliverySigRef}
                      penColor="black"
                      canvasProps={{ className: cn("w-full h-40", readOnly ? "cursor-default" : "cursor-crosshair") }}
                    />
                    <div className="bg-slate-50 p-2 flex justify-between items-center border-t">
                      <span className="text-[10px] font-bold text-slate-400 uppercase ml-2 flex items-center gap-1">
                        <PenTool className="h-3 w-3" /> {readOnly ? 'Firma Registrada' : 'Firmar aquí'}
                      </span>
                      {!readOnly && (
                        <Button variant="ghost" size="sm" onClick={() => clearSignature(deliverySigRef)} className="h-8 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50">
                          <Eraser className="h-3 w-3 mr-1" /> Limpiar
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-center text-xs font-bold text-slate-500">{formData.technicianName}</p>
                </div>

                <div className="space-y-4">
                  <Label className="text-xs font-black text-slate-500 uppercase tracking-widest">Firma Recibe (Destino)</Label>
                  <div className="border-2 border-slate-200 rounded-3xl bg-white overflow-hidden group">
                    <SignatureCanvas 
                      ref={receptionSigRef}
                      penColor="black"
                      canvasProps={{ className: cn("w-full h-40", readOnly ? "cursor-default" : "cursor-crosshair") }}
                    />
                    <div className="bg-slate-50 p-2 flex justify-between items-center border-t">
                      <span className="text-[10px] font-bold text-slate-400 uppercase ml-2 flex items-center gap-1">
                        <PenTool className="h-3 w-3" /> {readOnly ? 'Firma Registrada' : 'Firmar aquí'}
                      </span>
                      {!readOnly && (
                        <Button variant="ghost" size="sm" onClick={() => clearSignature(receptionSigRef)} className="h-8 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50">
                          <Eraser className="h-3 w-3 mr-1" /> Limpiar
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-center text-xs font-bold text-slate-500">
                    {formData.isExternal ? formData.externalName : 'Responsable Destino'}
                  </p>
                </div>
              </div>

              {!readOnly && (
                <div className="flex justify-end gap-4 pt-10">
                  <Button variant="ghost" onClick={onCancel} className="h-14 px-8 rounded-2xl font-bold">
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleSubmit} 
                    disabled={loading}
                    className="h-14 px-12 rounded-2xl shadow-xl shadow-primary/20 text-lg font-black"
                  >
                    {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Procesando...</> : <><Save className="mr-2 h-5 w-5" /> Registrar Traslado</>}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
