import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileUp, X, CheckCircle2, Loader2, Info } from 'lucide-react';
import { collection, addDoc, serverTimestamp, doc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Equipment, MaintenanceReport } from '@/types';
import { cn } from '@/lib/utils';
import { syncEquipmentWithHistory } from '@/lib/sync-logic';

import { projectScheduleMonths, isMoreRecent } from '@/lib/schedule-utils';

interface CalibrationFormProps {
  equipment: Equipment;
  onCancel: () => void;
  onSuccess?: () => void;
}

export function CalibrationForm({ equipment, onCancel, onSuccess }: CalibrationFormProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Calculate next calibration date if frequency exists
  const getDefaultNextDate = (currentDate: string) => {
    if (!equipment.calibrationFrequency || isNaN(Number(equipment.calibrationFrequency))) return '';
    const date = new Date(currentDate);
    date.setMonth(date.getMonth() + Number(equipment.calibrationFrequency));
    return date.toISOString().split('T')[0];
  };

  const today = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    calibrationDate: today,
    nextCalibrationDate: getDefaultNextDate(today),
    provider: '',
    description: '',
    attachmentUrl: '' // Just the file name for display
  });

  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  // Auto-update next date if calibration date changes
  useEffect(() => {
    if (formData.calibrationDate && equipment.calibrationFrequency) {
      setFormData(prev => ({
        ...prev,
        nextCalibrationDate: getDefaultNextDate(formData.calibrationDate)
      }));
    }
  }, [formData.calibrationDate]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attachmentFile) {
      alert("Es obligatorio adjuntar el certificado de calibración.");
      return;
    }
    
    if (!formData.calibrationDate || !formData.nextCalibrationDate) {
      alert("Las fechas de calibración son obligatorias.");
      return;
    }

    setLoading(true);
    try {
      // 1. Convert File to Base64
      const getBase64 = (file: File): Promise<string> => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      };
      
      const attachmentBase64 = await getBase64(attachmentFile);
      let finalDriveUrl = null;

      const fileExtension = attachmentFile.name.split('.').pop() || 'pdf';

      // 2. Upload to Drive under 'Calibraciones'
      const attachmentUploadRes = await fetch('/api/drive/upload-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipmentDirId: equipment.driveFolderId || '',
          equipmentSerial: equipment.serial,
          equipmentName: equipment.name,
          folderType: 'calibration',
          fileName: `${formData.calibrationDate} - ${equipment.serial}.${fileExtension}`,
          base64: attachmentBase64,
          mimeType: attachmentFile.type || 'application/pdf'
        })
      });
      
      if (attachmentUploadRes.ok) {
        const attachResult = await attachmentUploadRes.json();
        if (attachResult.webViewLink) {
          finalDriveUrl = attachResult.webViewLink;
        }
      }

      if (!finalDriveUrl) {
         console.warn("No se obtuvo webViewLink tras subir al drive.");
      }

      // 3. Create Report Record (Type: Calibration)
      const reportData = {
        equipmentId: equipment.id,
        equipmentName: equipment.name,
        equipmentBrand: equipment.brand,
        equipmentModel: equipment.model,
        equipmentSerial: equipment.serial,
        technicianId: auth.currentUser?.uid || 'system',
        technicianName: auth.currentUser?.displayName || auth.currentUser?.email || 'Técnico',
        date: formData.calibrationDate,
        status: 'completed',
        type: 'calibration',
        calibrationDate: formData.calibrationDate,
        nextCalibrationDate: formData.nextCalibrationDate,
        provider: formData.provider,
        description: formData.description || 'Calibración realizada y certificado adjunto.',
        createdAt: serverTimestamp(),
        driveFileUrl: finalDriveUrl // This is the important part! We save the PDF link as the main report link
      };

      await addDoc(collection(db, 'reports'), reportData);
      
      // Force sync after adding calibration report
      const q = query(collection(db, 'reports'), where('equipmentId', '==', equipment.id));
      const reportsSnap = await getDocs(q);
      const allReports = reportsSnap.docs.map(d => ({ ...d.data(), id: d.id })) as MaintenanceReport[];
      await syncEquipmentWithHistory(equipment, allReports);

       // 5. Sync Sheets
       try {
        await fetch('/api/equipment/sync-sheets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            equipment: { ...equipment, lastCalibration: formData.calibrationDate, nextCalibration: formData.nextCalibrationDate },
            actionReason: `Actualización de Calibración: ${formData.calibrationDate}`
          })
        });
      } catch (e) {
        console.error('Error sincronizando Sheets:', e);
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onCancel();
      }, 2000);

    } catch (error) {
      console.error('Error saving calibration:', error);
      alert('Hubo un error al guardar la calibración.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-sky-100 shadow-xl animate-in zoom-in-95 duration-500">
        <div className="h-24 w-24 bg-sky-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="h-12 w-12 text-sky-500" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">¡Calibración Registrada!</h2>
        <p className="text-slate-500 text-center max-w-md">El certificado ha sido anexado exitosamente y las fechas del equipo han sido actualizadas.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto my-8">
      <div className="bg-sky-500 p-6 flex justify-between items-center text-white">
        <div>
          <h2 className="text-2xl font-black flex items-center gap-2">
            Registro de Calibración
            <Badge className="bg-white/20 hover:bg-white/30 text-white rounded-lg border-none shadow-none uppercase tracking-widest text-[10px]">
              {equipment.serial}
            </Badge>
          </h2>
          <p className="text-sky-100 font-medium opacity-90 mt-1">Anexe el certificado oficial del proveedor</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onCancel} className="text-white hover:bg-white/20 rounded-full h-10 w-10">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="p-8 space-y-8">
        
        {/* Important Info Card */}
        <div className="bg-slate-50 p-4 pt-4 rounded-2xl flex items-start gap-4 border border-slate-100">
             <Info className="h-5 w-5 text-sky-500 shrink-0 mt-0.5" />
             <div className="space-y-1">
                 <p className="text-sm font-bold text-slate-900">Sobre las calibraciones</p>
                 <p className="text-xs text-slate-500 leading-relaxed">
                     Este módulo no genera un reporte en PDF. Usted debe subir el certificado provisto por el proveedor o el metrólogo. 
                     El archivo quedará guardado directamente en la carpeta del equipo dentro de Google Drive.
                 </p>
             </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">FECHA DE CALIBRACIÓN REALIZADA</Label>
            <Input 
              type="date" 
              required
              value={formData.calibrationDate} 
              onChange={(e) => handleChange('calibrationDate', e.target.value)} 
              className="h-12 bg-slate-50 border-slate-200 rounded-xl px-4 font-medium"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between">
              PRÓXIMA CALIBRACIÓN SUGERIDA
              {equipment.calibrationFrequency && <span className="text-sky-500 ml-2">(Frecuencia: {equipment.calibrationFrequency} meses)</span>}
            </Label>
            <Input 
              type="date" 
              required
              value={formData.nextCalibrationDate} 
              onChange={(e) => handleChange('nextCalibrationDate', e.target.value)} 
              className="h-12 bg-slate-50 border-slate-200 rounded-xl px-4 font-medium"
            />
          </div>
        </div>

        <div className="space-y-2">
            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">PROVEEDOR / EMPRESA CALIBRADORA (OPCIONAL)</Label>
            <Input 
              placeholder="Ej. Metrología SAS"
              value={formData.provider} 
              onChange={(e) => handleChange('provider', e.target.value)} 
              className="h-12 bg-slate-50 border-slate-200 rounded-xl px-4 font-medium"
            />
        </div>

        <div className="space-y-2">
            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">SUBIR CERTIFICADO PDF *</Label>
            <div className={cn(
              "flex items-center gap-4 p-4 border-2 border-dashed rounded-2xl transition-colors bg-slate-50",
              attachmentFile ? "border-emerald-500 bg-emerald-50/50" : "border-slate-300 hover:border-slate-400 focus-within:border-sky-500"
            )}>
              <div className={cn(
                "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
                attachmentFile ? "bg-emerald-100 text-emerald-600" : "bg-white border border-slate-200 text-slate-400"
              )}>
                <FileUp className="h-6 w-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">
                  {attachmentFile ? attachmentFile.name : 'Seleccione el archivo'}
                </p>
                <p className="text-xs text-slate-500 truncate">
                   {attachmentFile ? `${(attachmentFile.size / 1024 / 1024).toFixed(2)} MB` : 'PDF, JPG, PNG'}
                </p>
              </div>
              <input 
                 type="file" 
                 className="hidden" 
                 id="cert-upload" 
                 accept="application/pdf,image/*" 
                 onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setAttachmentFile(file);
                 }} 
              />
              <Button 
                variant={attachmentFile ? "ghost" : "outline"} 
                className={cn(
                  "rounded-xl font-bold shrink-0",
                  attachmentFile ? "text-emerald-700 hover:text-emerald-800 hover:bg-emerald-200/50" : "bg-white"
                )}
                type="button" 
                onClick={() => document.getElementById('cert-upload')?.click()}
              >
                {attachmentFile ? 'Cambiar Archivo' : 'Examinar...'}
              </Button>
            </div>
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">OBSERVACIONES ADICIONALES</Label>
          <Textarea 
            placeholder="Resultados relevantes o anotaciones sobre el proceso..." 
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            className="min-h-[100px] rounded-2xl border-slate-200 bg-slate-50 p-4"
          />
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
          <Button type="button" variant="ghost" onClick={onCancel} className="rounded-xl font-bold text-slate-500 h-12 px-6">
            Cancelar
          </Button>
          <Button type="submit" disabled={loading} className="rounded-xl font-bold bg-sky-500 hover:bg-sky-600 text-white h-12 px-8 shadow-lg shadow-sky-200 transition-all hover:scale-[1.02]">
            {loading ? (
               <>
                 <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                 Subiendo al Drive...
               </>
            ) : (
               'Guardar Certificado'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

// Needed mock for Badge inside this file
const Badge = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", className)} {...props} />
))
Badge.displayName = "Badge"
