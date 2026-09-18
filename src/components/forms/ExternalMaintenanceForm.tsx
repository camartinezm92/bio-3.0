import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileUp, X, CheckCircle2, Loader2, Info, Building2 } from 'lucide-react';
import { collection, addDoc, serverTimestamp, doc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Equipment, MaintenanceReport } from '@/types';
import { cn } from '@/lib/utils';
import { calculateNextMaintenance, isMoreRecent, projectScheduleMonths } from '@/lib/schedule-utils';
import { syncEquipmentWithHistory } from '@/lib/sync-logic';

interface ExternalMaintenanceFormProps {
  equipment: Equipment;
  onCancel: () => void;
  onSuccess?: () => void;
}

export function ExternalMaintenanceForm({ equipment, onCancel, onSuccess }: ExternalMaintenanceFormProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const today = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    date: today,
    provider: '',
    description: '',
  });

  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attachmentFile) {
      alert("Es obligatorio adjuntar el reporte de mantenimiento.");
      return;
    }

    if (!formData.provider) {
      alert("El nombre del proveedor es obligatorio.");
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

      // 2. Upload to Drive under 'mantenimiento'
      // Filename format: YYYY-MM-DD - [Provider Name].pdf
      const fileName = `${formData.date} - ${formData.provider}.${fileExtension}`;

      const attachmentUploadRes = await fetch('/api/drive/upload-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipmentDirId: equipment.driveFolderId || '',
          equipmentSerial: equipment.serial,
          equipmentName: equipment.name,
          folderType: 'preventive',
          fileName: fileName,
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

      // 3. Create Report Record (Type: preventive - External)
      const reportData = {
        equipmentId: equipment.id,
        equipmentName: equipment.name,
        equipmentBrand: equipment.brand,
        equipmentModel: equipment.model,
        equipmentSerial: equipment.serial,
        technicianId: auth.currentUser?.uid || 'system',
        technicianName: auth.currentUser?.displayName || auth.currentUser?.email || 'Técnico Externo',
        date: formData.date,
        status: 'completed',
        type: 'preventive',
        isExternal: true,
        provider: formData.provider,
        description: formData.description || `Mantenimiento preventivo realizado por ${formData.provider}. Reporte adjunto.`,
        createdAt: serverTimestamp(),
        driveFileUrl: finalDriveUrl,
        reportNumber: `EXT-${Date.now().toString().slice(-6)}`
      };

      await addDoc(collection(db, 'reports'), reportData);
      
      // Force sync after adding external report
      const q = query(collection(db, 'reports'), where('equipmentId', '==', equipment.id));
      const reportsSnap = await getDocs(q);
      const allReports = reportsSnap.docs.map(d => ({ ...d.data(), id: d.id })) as MaintenanceReport[];
      await syncEquipmentWithHistory(equipment, allReports);

      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onCancel();
      }, 2000);

    } catch (error) {
      console.error('Error saving external maintenance:', error);
      alert('Hubo un error al guardar el reporte externo.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-indigo-100 shadow-xl animate-in zoom-in-95 duration-500">
        <div className="h-24 w-24 bg-indigo-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 className="h-12 w-12 text-indigo-500" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">¡Reporte Registrado!</h2>
        <p className="text-slate-500 text-center max-w-md">El mantenimiento externo ha sido anexado exitosamente a la hoja de vida del equipo.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto my-8">
      <div className="bg-indigo-600 p-6 flex justify-between items-center text-white">
        <div>
          <h2 className="text-2xl font-black flex items-center gap-2">
            Mantenimiento por Tercero
            <Badge className="bg-white/20 hover:bg-white/30 text-white rounded-lg border-none shadow-none uppercase tracking-widest text-[10px]">
              {equipment.serial}
            </Badge>
          </h2>
          <p className="text-indigo-100 font-medium opacity-90 mt-1">Anexe el informe técnico entregado por el proveedor externo</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onCancel} className="text-white hover:bg-white/20 rounded-full h-10 w-10">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="p-8 space-y-8">
        
        <div className="bg-slate-50 p-4 pt-4 rounded-2xl flex items-start gap-4 border border-slate-100">
             <Info className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
             <div className="space-y-1">
                 <p className="text-sm font-bold text-slate-900">Sobre reportes externos</p>
                 <p className="text-xs text-slate-500 leading-relaxed">
                     Utilice esta opción cuando el mantenimiento fue realizado por un proveedor fuera de la organización. 
                     El archivo PDF se guardará en la carpeta "Reportes / Mantenimientos" del equipo.
                 </p>
             </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">FECHA DEL SERVICIO</Label>
            <Input 
              type="date" 
              required
              value={formData.date} 
              onChange={(e) => handleChange('date', e.target.value)} 
              className="h-12 bg-slate-50 border-slate-200 rounded-xl px-4 font-medium"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">EMPRESA / PROVEEDOR</Label>
            <div className="relative">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                required
                placeholder="Ej. Biomedical Group"
                value={formData.provider} 
                onChange={(e) => handleChange('provider', e.target.value)} 
                className="h-12 bg-slate-50 border-slate-200 rounded-xl pl-12 pr-4 font-medium"
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">SUBIR REPORTE (PDF / IMAGEN) *</Label>
            <div className={cn(
              "flex items-center gap-4 p-4 border-2 border-dashed rounded-2xl transition-colors bg-slate-50",
              attachmentFile ? "border-emerald-500 bg-emerald-50/50" : "border-slate-300 hover:border-slate-400 focus-within:border-indigo-500"
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
                 id="manto-upload" 
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
                onClick={() => document.getElementById('manto-upload')?.click()}
              >
                {attachmentFile ? 'Cambiar Archivo' : 'Examinar...'}
              </Button>
            </div>
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">OBSERVACIONES DEL PROVEEDOR</Label>
          <Textarea 
            placeholder="Resumen de actividades o repuestos cambiados por el tercero..." 
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            className="min-h-[100px] rounded-2xl border-slate-200 bg-slate-50 p-4"
          />
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
          <Button type="button" variant="ghost" onClick={onCancel} className="rounded-xl font-bold text-slate-500 h-12 px-6">
            Cancelar
          </Button>
          <Button type="submit" disabled={loading} className="rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white h-12 px-8 shadow-lg shadow-indigo-200 transition-all hover:scale-[1.02]">
            {loading ? (
               <>
                 <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                 Subiendo al Drive...
               </>
            ) : (
               'Guardar Reporte Externo'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

const Badge = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", className)} {...props} />
))
Badge.displayName = "Badge"
