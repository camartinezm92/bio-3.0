import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, Save, Loader2, CheckCircle2, ExternalLink, Image as ImageIcon, FileUp, ShieldCheck, Plus, Trash } from 'lucide-react';
import { collection, addDoc, doc, updateDoc, serverTimestamp, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Equipment, Service, Provider } from '@/types';
import { mockServices } from '@/services/mockData';
import { generateEquipmentCVPDF } from '@/lib/pdfGenerator';
import { projectScheduleMonths } from '@/lib/schedule-utils';

interface EquipmentFormProps {
  onCancel: () => void;
  initialData?: Equipment;
  onSuccess?: () => void;
}

export default function EquipmentForm({ onCancel, initialData, onSuccess }: EquipmentFormProps) {
  const [step, setStep] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [services, setServices] = React.useState<Service[]>([]);
  const [annexes, setAnnexes] = React.useState<{ name: string; url?: string; file?: File }[]>(initialData?.annexes || []);
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [manualFile, setManualFile] = React.useState<File | null>(null);
  const [protocolFile, setProtocolFile] = React.useState<File | null>(null);
  const [sheetsId, setSheetsId] = React.useState('');

  const [formData, setFormData] = React.useState<Partial<Equipment>>(initialData 
    ? { ...initialData, originalSerial: initialData.serial } 
    : {
    name: '',
    brand: '',
    model: '',
    serial: '',
    assetNumber: '',
    serviceId: '',
    serviceName: '',
    status: 'active',
    riskClass: 'I',
    biomedicalType: 'diagnostic',
    maintenanceFrequency: 4,
    location: '',
    acquisitionDate: '',
    registrationInvima: '',
    registrationExpiration: '',
    lastMaintenance: '',
    nextMaintenance: '',
  });

  const [providers, setProviders] = React.useState<Provider[]>([]);

  React.useEffect(() => {
    // Cargar config de Sheets si existe
    const loadConfig = async () => {
      const docSnap = await getDoc(doc(db, 'config', 'google'));
      if (docSnap.exists()) {
        setSheetsId(docSnap.data().spreadsheetId || '');
      }
    };
    loadConfig();

    // Fetch existing photo preview
    if (initialData?.photoId && !formData.photoThumbnail) {
      fetch(`/api/drive/file/${initialData.photoId}/base64`)
        .then(res => res.json())
        .then(data => {
          if (data.base64 && !data.error) {
            handleChange('photoThumbnail', data.base64);
          }
        })
        .catch(err => console.warn('No se pudo precargar miniatura', err));
    }

    const unsubscribe = onSnapshot(collection(db, 'services'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Service[];
      
      if (data.length === 0) {
        setServices(mockServices);
      } else {
        setServices(data);
      }
    }, (error) => {
      console.warn("EquipmentForm services snapshot error:", error);
    });

    const unsubProviders = onSnapshot(collection(db, 'providers'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Provider[];
      setProviders(data);
    }, (error) => {
      console.warn("EquipmentForm providers snapshot error:", error);
    });

    return () => {
      unsubscribe();
      unsubProviders();
    };
  }, []);

  const handleChange = (field: keyof Equipment, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleServiceChange = (serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    setFormData(prev => ({ 
      ...prev, 
      serviceId, 
      serviceName: service?.name || '' 
    }));
  };

  // Auto-calculate next maintenance date
  React.useEffect(() => {
    if (formData.lastMaintenance && formData.maintenanceFrequency) {
      const last = new Date(formData.lastMaintenance);
      if (!isNaN(last.getTime())) {
        const next = new Date(last);
        next.setMonth(next.getMonth() + Number(formData.maintenanceFrequency));
        const nextStr = next.toISOString().split('T')[0];
        if (formData.nextMaintenance !== nextStr) {
          setFormData(prev => ({ ...prev, nextMaintenance: nextStr }));
        }
      }
    }
  }, [formData.lastMaintenance, formData.maintenanceFrequency]);

  // Auto-calculate next calibration date
  React.useEffect(() => {
    if (formData.lastCalibration && formData.calibrationFrequency) {
      const last = new Date(formData.lastCalibration);
      if (!isNaN(last.getTime())) {
        const next = new Date(last);
        next.setMonth(next.getMonth() + Number(formData.calibrationFrequency));
        const nextStr = next.toISOString().split('T')[0];
        if (formData.nextCalibration !== nextStr) {
          setFormData(prev => ({ ...prev, nextCalibration: nextStr }));
        }
      }
    }
  }, [formData.lastCalibration, formData.calibrationFrequency]);

  const validateStep = () => {
    if (step === 1) {
      return formData.name && formData.brand && formData.model && formData.serial && formData.assetNumber && formData.serviceId;
    }
    if (step === 2) {
      return formData.riskClass && formData.biomedicalType && formData.registrationInvima && formData.registrationExpiration;
    }
    if (step === 3) {
      return formData.maintenanceFrequency && formData.lastMaintenance && formData.nextMaintenance;
    }
    if (step === 4) {
      return true; // Accesorios y anexos son opcionales
    }
    if (step === 5) {
      return formData.equipmentType && formData.predominantTechnology; // Requerir algunos básicos
    }
    if (step === 6) {
      return true; 
    }
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const getBase64 = (file: File): Promise<string> => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      };

      let photoBase64 = '';
      if (photoFile) photoBase64 = await getBase64(photoFile);

      let manualData = null;
      if (manualFile) {
        manualData = {
          base64: await getBase64(manualFile),
          name: manualFile.name,
          mimeType: manualFile.type || 'application/pdf'
        };
      }

      let protocolData = null;
      if (protocolFile) {
        protocolData = {
          base64: await getBase64(protocolFile),
          name: protocolFile.name,
          mimeType: protocolFile.type || 'application/pdf'
        };
      }

      // Convert new annexes files into base64 payload
      const annexesPayload = [];
      const existingAnnexes = [];
      let totalFilesSize = 0;

      for (const annex of annexes) {
        if (annex.file) {
          totalFilesSize += annex.file.size;
          annexesPayload.push({
            name: annex.file.name,
            mimeType: annex.file.type || 'application/pdf',
            base64: await getBase64(annex.file)
          });
        } else {
          existingAnnexes.push(annex);
        }
      }

      if (totalFilesSize > 25 * 1024 * 1024) {
        throw new Error('El peso total de los archivos adjuntos excede los 25MB recomendados. Por favor suba menos anexos o redúzcalos para evitar errores de conexión.');
      }

      // 0. Generate CV PDF
      const cvPdfBase64 = generateEquipmentCVPDF(formData as Equipment, [], [], true) as string;
      const cvDate = formData.lastCalibration ? `_Calibrado_${formData.lastCalibration}` : '';
      const cvName = `HV_${formData.assetNumber || 'NA'}_${(formData.name || 'Equipo').replace(/\s+/g, '_')}${cvDate}.pdf`;

      // 1. Llamar al servidor para crear Carpeta Drive y Fila en Sheets
      const syncRes = await fetch('/api/equipment/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipment: formData,
          isEdit: !!initialData?.id,
          photo: photoBase64,
          manual: manualData,
          protocol: protocolData,
          annexFiles: annexesPayload,
          cvPdf: { base64: cvPdfBase64, name: cvName },
          sheetsId: sheetsId || null
        })
      });

      const responseText = await syncRes.text();
      let syncData: any = {};
      try {
        syncData = JSON.parse(responseText);
      } catch (e) {
        // If the response is HTML, it's likely a 413 Payload Too Large or a 500 error from the proxy
        if (responseText.toLowerCase().includes('<html')) {
          if (syncRes.status === 413) {
            throw new Error('Los archivos son demasiado pesados para procesarlos en una sola solicitud. Intente subir menos anexos a la vez o comprímalos. (Error 413: Payload Too Large)');
          }
          throw new Error('El servidor devolvió un error inesperado (posiblemente por el tamaño de los archivos o un fallo de conexión). Intente con archivos menos pesados. Detalle: ' + syncRes.status);
        }
        throw new Error(`Respuesta no válida del servidor: ${responseText.substring(0, 50)}...`);
      }

      if (!syncRes.ok) throw new Error(syncData.error || 'Fallo en la sincronización con Drive/Sheets');

      // Unificar anexos antiguos con los nuevos subidos a drive
      const finalAnnexes = [...existingAnnexes];
      if (syncData.uploadedAnnexes) {
         for (const upload of syncData.uploadedAnnexes) {
            finalAnnexes.push({ name: upload.name, url: upload.url });
         }
      }

      const driveMetadata = {
        driveFolderId: syncData.driveFolderId || formData.driveFolderId || '',
        photoId: syncData.photoId || formData.photoId || '',
        manualUrl: syncData.manualId ? `https://drive.google.com/file/d/${syncData.manualId}/view` : formData.manualUrl,
        technicalSheetUrl: syncData.protocolId ? `https://drive.google.com/file/d/${syncData.protocolId}/view` : formData.technicalSheetUrl,
        updatedAt: serverTimestamp()
      };

      const currentYear = new Date().getFullYear();
      const scheduledMaintenanceMonths = projectScheduleMonths(formData.nextMaintenance || formData.lastMaintenance, formData.maintenanceFrequency, currentYear);
      const scheduledCalibrationMonths = projectScheduleMonths(formData.nextCalibration || formData.lastCalibration, formData.calibrationFrequency, currentYear);
      const scheduledQualificationMonths = projectScheduleMonths(formData.nextQualification, formData.qualificationFrequency, currentYear);

      const dataToSave = { 
        ...formData, 
        ...driveMetadata, 
        annexes: finalAnnexes,
        scheduledMaintenanceMonths,
        scheduledCalibrationMonths,
        scheduledQualificationMonths
      };
      delete dataToSave.photoThumbnail; // No guardamos Base64 en Firestore para ahorrar DB, todo va por Drive

      // 2. Guardar en Firestore con la metadata de Drive
      if (initialData?.id) {
        await updateDoc(doc(db, 'equipment', initialData.id), dataToSave);
      } else {
        await addDoc(collection(db, 'equipment'), {
          ...dataToSave,
          createdAt: serverTimestamp()
        });
      }
      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onCancel();
      }, 2000);
    } catch (error: any) {
      console.error('Error saving equipment:', error);
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Card className="max-w-2xl mx-auto p-12 text-center space-y-4 animate-in zoom-in-95 duration-300">
        <div className="flex justify-center">
          <div className="bg-emerald-100 p-4 rounded-full">
            <CheckCircle2 className="h-12 w-12 text-emerald-600" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-slate-900">¡Registro Exitoso!</h2>
        <p className="text-slate-500">El equipo ha sido guardado correctamente en el sistema.</p>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto shadow-xl border-slate-100 overflow-hidden rounded-3xl">
      <CardHeader className="bg-slate-50/50 border-b pb-8">
        <CardTitle className="text-xl font-bold text-slate-900">
          {initialData?.id ? 'Editar Equipo' : 'Registro de Nuevo Equipo'}
        </CardTitle>
        <div className="flex gap-3 mt-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div 
              key={i} 
              className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i <= step ? 'bg-primary shadow-sm shadow-primary/20' : 'bg-slate-200'}`}
            />
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-8 space-y-6">
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-[10px]">1</span>
              Información Básica
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-700 font-semibold">Nombre del Equipo *</Label>
                <Input 
                  id="name" 
                  placeholder="Ej: Monitor Multiparámetros" 
                  value={formData.name ?? ""}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="rounded-xl border-slate-200 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand" className="text-slate-700 font-semibold">Marca *</Label>
                <Input 
                  id="brand" 
                  placeholder="Ej: Mindray" 
                  value={formData.brand ?? ""}
                  onChange={(e) => handleChange('brand', e.target.value)}
                  className="rounded-xl border-slate-200 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model" className="text-slate-700 font-semibold">Modelo *</Label>
                <Input 
                  id="model" 
                  placeholder="Ej: ePM 12" 
                  value={formData.model ?? ""}
                  onChange={(e) => handleChange('model', e.target.value)}
                  className="rounded-xl border-slate-200 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="serial" className="text-slate-700 font-semibold">Número de Serial *</Label>
                <Input 
                  id="serial" 
                  placeholder="Ej: MN-123456" 
                  value={formData.serial ?? ""}
                  onChange={(e) => handleChange('serial', e.target.value)}
                  className="rounded-xl border-slate-200 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="acquisitionDate" className="text-slate-700 font-semibold">Fecha de Adquisición</Label>
                <Input 
                  id="acquisitionDate" 
                  type="date" 
                  value={formData.acquisitionDate ?? ""}
                  onChange={(e) => handleChange('acquisitionDate', e.target.value)}
                  className="rounded-xl border-slate-200 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assetNumber" className="text-slate-700 font-semibold">Activo Fijo *</Label>
                <Input 
                  id="assetNumber" 
                  placeholder="Ej: AF-001" 
                  value={formData.assetNumber ?? ""}
                  onChange={(e) => handleChange('assetNumber', e.target.value)}
                  className="rounded-xl border-slate-200 focus:ring-primary/20"
                />
                         <div className="space-y-2">
                <Label htmlFor="service" className="text-slate-700 font-semibold">Servicio *</Label>
                <Select onValueChange={handleServiceChange} value={formData.serviceId || ""}>
                  <SelectTrigger className="rounded-xl border-slate-200">
                    <SelectValue>
                      {formData.serviceName || "Seleccionar servicio"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {services.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="provider" className="text-slate-700 font-semibold">Proveedor Asignado</Label>
                  <Button variant="link" size="sm" type="button" className="h-4 p-0 text-[10px]" onClick={() => window.open('/providers', '_blank')}>+ Nuevo</Button>
                </div>
                <Select 
                  onValueChange={(v) => {
                    const selected = providers.find(p => p.id === v);
                    setFormData(prev => ({ 
                      ...prev, 
                      providerId: v, 
                      providerName: selected?.name || '',
                      providerCity: selected?.city || '' // Note: providerCity may need to be added to Provider type but we will just pass empty if it fails.
                    }));
                  }} 
                  value={formData.providerId || ""}
                >
                  <SelectTrigger className="rounded-xl border-slate-200">
                    <SelectValue placeholder="Seleccione un proveedor" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {providers.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                    {providers.length === 0 && (
                      <div className="p-2 text-sm text-slate-500 italic text-center">Sin proveedores</div>
                    )}
                  </SelectContent>
                </Select>
              </div>    </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-[10px]">2</span>
              Clasificación y Riesgo
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label className="text-slate-700 font-semibold">Imagen del Equipo</Label>
                <div 
                  className="border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 transition-colors cursor-pointer group"
                  onClick={() => document.getElementById('eq-image-upload')?.click()}
                >
                  <ImageIcon className="h-8 w-8 text-slate-300 group-hover:text-primary transition-colors" />
                  <p className="text-sm font-bold text-slate-500">
                    {formData.photoId && !formData.imageUrl ? 'Ya existe una foto en Drive. Clic para reemplazarla' : 'Haga clic para subir foto del equipo'}
                  </p>
                  <input 
                    id="eq-image-upload"
                    type="file" 
                    className="hidden" 
                    accept="image/*" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setPhotoFile(file);
                        handleChange('imageUrl', file.name);

                        // Crear thumbnail para el PDF local
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const img = new Image();
                          img.onload = () => {
                            const canvas = document.createElement('canvas');
                            const MAX_WIDTH = 500;
                            const MAX_HEIGHT = 500;
                            let width = img.width;
                            let height = img.height;
                            
                            if (width > height) {
                              if (width > MAX_WIDTH) {
                                height *= MAX_WIDTH / width;
                                width = MAX_WIDTH;
                              }
                            } else {
                              if (height > MAX_HEIGHT) {
                                width *= MAX_HEIGHT / height;
                                height = MAX_HEIGHT;
                              }
                            }
                            canvas.width = width;
                            canvas.height = height;
                            const ctx = canvas.getContext('2d');
                            ctx?.drawImage(img, 0, 0, width, height);
                            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                            handleChange('photoThumbnail', dataUrl as keyof Equipment as any);
                          }
                          img.src = event.target?.result as string;
                        };
                        reader.readAsDataURL(file);
                      }
                    }} 
                  />
                  {formData.photoThumbnail ? (
                    <div className="mt-4 relative w-32 h-32 rounded-xl overflow-hidden border-2 border-slate-200">
                      <img src={formData.photoThumbnail} alt="Preview" className="w-full h-full object-contain bg-slate-50" />
                    </div>
                  ) : formData.imageUrl && (
                    <Badge variant="secondary" className="mt-2">{formData.imageUrl}</Badge>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="risk" className="text-slate-700 font-semibold">Clase de Riesgo *</Label>
                <Select onValueChange={(v) => handleChange('riskClass', v)} value={formData.riskClass || ""}>
                  <SelectTrigger className="rounded-xl border-slate-200">
                    <SelectValue placeholder="Seleccionar clase" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="I">Clase I (Bajo)</SelectItem>
                    <SelectItem value="IIa">Clase IIa (Moderado)</SelectItem>
                    <SelectItem value="IIb">Clase IIb (Alto)</SelectItem>
                    <SelectItem value="III">Clase III (Muy Alto)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="type" className="text-slate-700 font-semibold">Tipo Biomédico *</Label>
                <Select onValueChange={(v) => handleChange('biomedicalType', v)} value={formData.biomedicalType || ""}>
                  <SelectTrigger className="rounded-xl border-slate-200">
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="diagnostic">Diagnóstico</SelectItem>
                    <SelectItem value="treatment">Tratamiento</SelectItem>
                    <SelectItem value="rehabilitation">Rehabilitación</SelectItem>
                    <SelectItem value="support">Soporte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invima" className="text-slate-700 font-semibold">Registro INVIMA *</Label>
                <div className="flex gap-2">
                  <Input 
                    id="invima" 
                    placeholder="Ej: 2019DM-0001234" 
                    value={formData.registrationInvima ?? ""}
                    onChange={(e) => handleChange('registrationInvima', e.target.value)}
                    className="rounded-xl border-slate-200 focus:ring-primary/20"
                  />
                  <Button 
                    variant="outline" 
                    size="icon" 
                    type="button"
                    className="rounded-xl shrink-0"
                    onClick={() => window.open('https://consultaregistro.invima.gov.co/Consultas/consultas/consreg_encabcum.jsp', '_blank')}
                    title="Consultar en INVIMA"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invimaExp" className="text-slate-700 font-semibold">Vencimiento INVIMA *</Label>
                <Input 
                  id="invimaExp" 
                  type="date" 
                  value={formData.registrationExpiration ?? ""}
                  onChange={(e) => handleChange('registrationExpiration', e.target.value)}
                  className="rounded-xl border-slate-200 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-4 md:col-span-2">
                <Label className="text-slate-700 font-semibold">Manual de Usuario</Label>
                
                <div className="flex gap-2">
                  <Input 
                    placeholder="Enlace externo (URL) del manual u hoja de vida..." 
                    value={!manualFile ? (formData.manualUrl ?? '') : ''}
                    disabled={!!manualFile}
                    onChange={(e) => handleChange('manualUrl', e.target.value)}
                    className="rounded-xl border-slate-200 focus:ring-primary/20"
                  />
                  <Button 
                    variant="outline" 
                    type="button" 
                    className="rounded-xl shrink-0"
                    onClick={() => {
                        if (manualFile) {
                          setManualFile(null);
                          handleChange('manualUrl', '');
                        } else {
                          document.getElementById('manual-upload')?.click();
                        }
                    }}
                  >
                    <FileUp className="h-4 w-4 mr-2" />
                    {manualFile ? 'Quitar Archivo' : 'Subir Archivo (Drive)'}
                  </Button>
                  <input type="file" className="hidden" id="manual-upload" accept=".pdf,.doc,.docx" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setManualFile(file);
                      handleChange('manualUrl', file.name); // temporal filename
                    }
                  }} />
                </div>
                {manualFile && <p className="text-xs text-emerald-600 font-bold flex items-center gap-1 mt-1"><CheckCircle2 className="h-3 w-3" /> Archivo seleccionado: {manualFile.name} (se subirá a Drive)</p>}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-slate-700 font-semibold">Protocolo de Limpieza</Label>
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="bg-white p-3 rounded-xl shadow-sm">
                    <ShieldCheck className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-900">Adjuntar Protocolo</p>
                    <p className="text-[10px] text-slate-500 uppercase font-bold">PDF / Imagen (Se enviará al Drive)</p>
                  </div>
                  <input type="file" className="hidden" id="protocol-upload" accept=".pdf,image/*" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setProtocolFile(file);
                      handleChange('technicalSheetUrl', file.name);
                    }
                  }} />
                  <Button variant="outline" size="sm" className="rounded-xl" type="button" onClick={() => document.getElementById('protocol-upload')?.click()}>
                    {formData.technicalSheetUrl ? 'Cambiar' : 'Seleccionar'}
                  </Button>
                </div>
                {formData.technicalSheetUrl && <p className="text-xs text-emerald-600 font-bold flex items-center gap-1 mt-1"><CheckCircle2 className="h-3 w-3" /> {formData.technicalSheetUrl} listo para subir</p>}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-[10px]">3</span>
              Mantenimiento y Garantía
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="freq" className="text-slate-700 font-semibold">Frecuencia Manto. (Meses) *</Label>
                <Input 
                  id="freq" 
                  type="number" 
                  value={formData.maintenanceFrequency || ""}
                  onChange={(e) => handleChange('maintenanceFrequency', e.target.value ? parseInt(e.target.value) : '')}
                  className="rounded-xl border-slate-200 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastManto" className="text-slate-700 font-semibold">Último Mantenimiento *</Label>
                <Input 
                  id="lastManto" 
                  type="date" 
                  value={formData.lastMaintenance ?? ""}
                  onChange={(e) => handleChange('lastMaintenance', e.target.value)}
                  className="rounded-xl border-slate-200 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nextManto" className="text-slate-700 font-semibold">Próximo Mantenimiento *</Label>
                <Input 
                  id="nextManto" 
                  type="date" 
                  value={formData.nextMaintenance ?? ""}
                  onChange={(e) => handleChange('nextMaintenance', e.target.value)}
                  className="rounded-xl border-slate-200 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="calibFreq" className="text-slate-700 font-semibold">Frecuencia Calib. (Meses)</Label>
                <Input 
                  id="calibFreq" 
                  type="number" 
                  value={formData.calibrationFrequency || ""}
                  onChange={(e) => handleChange('calibrationFrequency', e.target.value ? parseInt(e.target.value) : '')}
                  className="rounded-xl border-slate-200 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastCalib" className="text-slate-700 font-semibold">Última Calibración</Label>
                <Input 
                  id="lastCalib" 
                  type="date" 
                  value={formData.lastCalibration ?? ""}
                  onChange={(e) => handleChange('lastCalibration', e.target.value)}
                  className="rounded-xl border-slate-200 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qualFreq" className="text-slate-700 font-semibold">Frecuencia Calific. (Meses)</Label>
                <Input 
                  id="qualFreq" 
                  type="number" 
                  value={formData.qualificationFrequency || ""}
                  onChange={(e) => handleChange('qualificationFrequency', e.target.value ? parseInt(e.target.value) : '')}
                  className="rounded-xl border-slate-200 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastQual" className="text-slate-700 font-semibold">Última Calificación</Label>
                <Input 
                  id="lastQual" 
                  type="date" 
                  value={formData.lastQualification ?? ""}
                  onChange={(e) => handleChange('lastQualification', e.target.value)}
                  className="rounded-xl border-slate-200 focus:ring-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location" className="text-slate-700 font-semibold">Ubicación Específica</Label>
                <Input 
                  id="location" 
                  placeholder="Ej: Cubículo 5" 
                  value={formData.location ?? ""}
                  onChange={(e) => handleChange('location', e.target.value)}
                  className="rounded-xl border-slate-200 focus:ring-primary/20"
                />
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-[10px]">4</span>
              Anexos y Documentación Legal
            </div>
            <div className="space-y-4">
              <p className="text-xs text-slate-500 font-medium">Adjunte documentos como RUT/DIAN, Certificados de Calidad, Facturas, etc.</p>
              
              <div className="grid gap-4">
                {annexes.map((annex, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="h-5 w-5 text-emerald-600" />
                      <span className="text-sm font-bold text-emerald-900">{annex.name}</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100 rounded-lg"
                      onClick={() => setAnnexes(prev => prev.filter((_, i) => i !== idx))}
                    >
                      Eliminar
                    </Button>
                  </div>
                ))}
              </div>

              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 hover:bg-slate-50 transition-colors cursor-pointer group relative">
                <FileUp className="h-8 w-8 text-slate-400 group-hover:text-primary transition-colors" />
                <div className="text-center">
                  <p className="font-bold text-slate-900">Subir Nuevo Anexo</p>
                  <p className="text-xs text-slate-500">PDF, Imágenes o Documentos</p>
                </div>
                <input 
                  type="file" 
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 10 * 1024 * 1024) {
                        alert("El archivo es demasiado grande (Máximo 10MB individual). Por favor use archivos más ligeros.");
                        return;
                      }
                      setAnnexes(prev => [...prev, { name: file.name, url: '#', file }]);
                    }
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-[10px]">5</span>
              Características Técnicas
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-slate-700 font-semibold">Tipo de Equipo *</Label>
                <Select onValueChange={(v) => handleChange('equipmentType', v)} value={formData.equipmentType || ""}>
                  <SelectTrigger className="rounded-xl border-slate-200">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="Fijo">Fijo</SelectItem>
                    <SelectItem value="Móvil">Móvil</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-semibold">Tecnología Predominante *</Label>
                <Select onValueChange={(v) => handleChange('predominantTechnology', v)} value={formData.predominantTechnology || ""}>
                  <SelectTrigger className="rounded-xl border-slate-200">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="Mecánico">Mecánico</SelectItem>
                    <SelectItem value="Electrónico">Electrónico</SelectItem>
                    <SelectItem value="Eléctrico">Eléctrico</SelectItem>
                    <SelectItem value="Hidráulico">Hidráulico</SelectItem>
                    <SelectItem value="Neumático">Neumático</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-semibold">Clasif. Biomédica</Label>
                <Select onValueChange={(v) => handleChange('biomedicalClassification', v)} value={formData.biomedicalClassification || ""}>
                  <SelectTrigger className="rounded-xl border-slate-200">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="Rehabilitación">Rehabilitación</SelectItem>
                    <SelectItem value="Prevención">Prevención</SelectItem>
                    <SelectItem value="Tratamiento">Tratamiento</SelectItem>
                    <SelectItem value="Diagnóstico">Diagnóstico</SelectItem>
                    <SelectItem value="Análisis de Lab">Análisis de Lab</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-semibold">Fuente de Alimentación</Label>
                <Input placeholder="Ej: Electricidad, Batería..." value={formData.powerSupply || ""} onChange={(e) => handleChange('powerSupply', e.target.value)} className="rounded-xl border-slate-200" />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-semibold">Dimensiones</Label>
                <Input placeholder="Ej: 140 x 193 x 95 mm" value={formData.dimensions || ""} onChange={(e) => handleChange('dimensions', e.target.value)} className="rounded-xl border-slate-200" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-slate-700 font-semibold">Principio Fisiológico de Funcionamiento</Label>
                <Textarea placeholder="Describa el uso y principio..." value={formData.physiologicalPrinciple || ""} onChange={(e) => handleChange('physiologicalPrinciple', e.target.value)} className="rounded-xl border-slate-200" />
              </div>
            </div>
            
            <h4 className="font-bold text-slate-800 border-b pb-2 mt-4 text-sm uppercase">Especificaciones</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Voltaje', key: 'voltage' },
                { label: 'Amperaje', key: 'amperage' },
                { label: 'Temp (ºC)', key: 'temperature' },
                { label: 'Humedad', key: 'humidity' },
                { label: 'Potencia', key: 'power' },
                { label: 'Frecuencia', key: 'frequency' },
                { label: 'Capacidad', key: 'capacity' },
                { label: 'Vel. (RPM)', key: 'speedRpm' },
                { label: 'Presión (PSI)', key: 'pressure' },
                { label: 'Vida Útil', key: 'lifespan' },
                { label: 'Peso (Kg)', key: 'weight' },
                { label: 'Otro', key: 'other' }
              ].map((spec) => (
                <div key={spec.key} className="space-y-1">
                  <Label className="text-[10px] uppercase text-slate-500 font-bold">{spec.label}</Label>
                  <Input 
                    value={formData.technicalCharacteristics?.[spec.key as keyof typeof formData.technicalCharacteristics] || ""} 
                    onChange={(e) => handleChange('technicalCharacteristics', { ...formData.technicalCharacteristics, [spec.key]: e.target.value })} 
                    className="h-8 rounded-lg border-slate-200 text-xs" 
                    placeholder="NA"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-[10px]">6</span>
              Componentes y Fabricante
            </div>
            
            <div className="space-y-4">
              <h4 className="font-bold text-slate-800 text-sm uppercase">Datos del Fabricante</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500 font-bold">Fabricante</Label>
                  <Input value={formData.manufacturerInfo?.name || ""} onChange={(e) => handleChange('manufacturerInfo', { ...formData.manufacturerInfo, name: e.target.value })} className="rounded-xl border-slate-200" placeholder="Nombre de la empresa" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500 font-bold">Dirección</Label>
                  <Input value={formData.manufacturerInfo?.address || ""} onChange={(e) => handleChange('manufacturerInfo', { ...formData.manufacturerInfo, address: e.target.value })} className="rounded-xl border-slate-200" placeholder="Ej: Calle 47 #5-26" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500 font-bold">País</Label>
                  <Input value={formData.manufacturerInfo?.country || ""} onChange={(e) => handleChange('manufacturerInfo', { ...formData.manufacturerInfo, country: e.target.value })} className="rounded-xl border-slate-200" placeholder="Ej: CHINA" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500 font-bold">Email / Web</Label>
                  <Input value={formData.manufacturerInfo?.email || ""} onChange={(e) => handleChange('manufacturerInfo', { ...formData.manufacturerInfo, email: e.target.value })} className="rounded-xl border-slate-200" placeholder="Ej: info@mindray.com" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-slate-800 text-sm uppercase">Repuestos, Componentes y Accesorios</h4>
                <Button type="button" variant="outline" size="sm" onClick={() => handleChange('accessories', [...(formData.accessories || []), { description: '', brand: '', model: '', serial: '', reference: '', quantity: 1 }])}>
                  <Plus className="h-3 w-3 mr-1" /> Añadir
                </Button>
              </div>
              <div className="space-y-2">
                {(formData.accessories || []).map((acc, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <Input className="col-span-3 text-xs h-8" placeholder="Descripción" value={acc.description} onChange={(e) => {
                      const newAcc = [...(formData.accessories || [])];
                      newAcc[idx].description = e.target.value;
                      handleChange('accessories', newAcc);
                    }}/>
                    <Input className="col-span-2 text-xs h-8" placeholder="Marca" value={acc.brand} onChange={(e) => {
                      const newAcc = [...(formData.accessories || [])];
                      newAcc[idx].brand = e.target.value;
                      handleChange('accessories', newAcc);
                    }}/>
                    <Input className="col-span-2 text-xs h-8" placeholder="Modelo" value={acc.model} onChange={(e) => {
                      const newAcc = [...(formData.accessories || [])];
                      newAcc[idx].model = e.target.value;
                      handleChange('accessories', newAcc);
                    }}/>
                    <Input className="col-span-2 text-xs h-8" placeholder="Serie" value={acc.serial} onChange={(e) => {
                      const newAcc = [...(formData.accessories || [])];
                      newAcc[idx].serial = e.target.value;
                      handleChange('accessories', newAcc);
                    }}/>
                    <Input className="col-span-2 text-xs h-8" placeholder="Cantidad" type="number" value={acc.quantity} onChange={(e) => {
                      const newAcc = [...(formData.accessories || [])];
                      newAcc[idx].quantity = parseInt(e.target.value) || 0;
                      handleChange('accessories', newAcc);
                    }}/>
                    <Button variant="ghost" size="icon" className="col-span-1 h-8 w-8 text-red-500" onClick={() => {
                      const newAcc = [...(formData.accessories || [])];
                      newAcc.splice(idx, 1);
                      handleChange('accessories', newAcc);
                    }}><Trash className="h-4 w-4" /></Button>
                  </div>
                ))}
                {(!formData.accessories || formData.accessories.length === 0) && (
                  <p className="text-xs text-slate-400 italic">No hay componentes añadidos.</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-bold text-slate-800 text-sm uppercase">Recomendaciones del Fabricante</h4>
              <Textarea 
                placeholder="Ej: SU USO DEBE SER POR PARTE DE PERSONAL CAPACITADO..." 
                value={formData.manufacturerRecommendations || ""} 
                onChange={(e) => handleChange('manufacturerRecommendations', e.target.value)} 
                className="rounded-xl border-slate-200" 
              />
            </div>

            <div className="space-y-4">
              <h4 className="font-bold text-slate-800 text-sm uppercase">Manuales Disponibles</h4>
              <div className="flex flex-wrap gap-4">
                {['Usuario', 'Servicio', 'Componentes', 'Despiece'].map(manual => (
                  <div key={manual} className="flex items-center space-x-2">
                    <Checkbox id={`manual-${manual}`} checked={(formData.manualsAvailable || []).includes(manual as any)} onCheckedChange={(checked) => {
                      const current = formData.manualsAvailable || [];
                      if (checked) {
                        handleChange('manualsAvailable', [...current, manual]);
                      } else {
                        handleChange('manualsAvailable', current.filter(m => m !== manual));
                      }
                    }} />
                    <Label htmlFor={`manual-${manual}`} className="text-sm font-medium text-slate-700">{manual}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between p-8 bg-slate-50/50 border-t">
        <Button variant="ghost" onClick={step === 1 ? onCancel : () => setStep(step - 1)} className="rounded-xl">
          {step === 1 ? 'Cancelar' : <><ArrowLeft className="mr-2 h-4 w-4" /> Anterior</>}
        </Button>
        <Button 
          onClick={step === 6 ? handleSubmit : () => setStep(step + 1)} 
          disabled={!validateStep() || loading}
          className="rounded-xl px-8 shadow-lg shadow-primary/20"
        >
          {loading ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</>
          ) : step === 6 ? (
            <><Save className="mr-2 h-4 w-4" /> Finalizar Registro</>
          ) : (
            <>Siguiente <ArrowRight className="ml-2 h-4 w-4" /></>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
