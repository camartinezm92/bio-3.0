import React, { useState, useRef } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Trash2, 
  HardDrive, 
  Calendar, 
  User, 
  FileCheck2,
  Layers,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { Equipment, MaintenanceReport } from '@/types';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { syncEquipmentWithHistory } from '@/lib/sync-logic';
import { cn } from '@/lib/utils';

interface BatchMaintenanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment;
  onSuccess: (count: number) => void;
}

export interface BatchItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: 'preventive' | 'corrective' | 'calibration';
  date: string;
  technicianName: string;
  reportNumber: string;
  description: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  errorMessage?: string;
  driveFileUrl?: string;
  driveFileId?: string;
}

export const BatchMaintenanceModal: React.FC<BatchMaintenanceModalProps> = ({
  open,
  onOpenChange,
  equipment,
  onSuccess
}) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<BatchItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [globalType, setGlobalType] = useState<'preventive' | 'corrective' | 'calibration'>('preventive');
  const [globalDate, setGlobalDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [globalTechnician, setGlobalTechnician] = useState<string>(
    user?.displayName || user?.email?.split('@')[0] || 'Ingeniería Biomédica'
  );
  const [overallError, setOverallError] = useState<string | null>(null);

  // Helper to convert File to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('No se pudo convertir el archivo a Base64'));
        }
      };
      reader.onerror = () => reject(new Error('Error de lectura en el archivo'));
      reader.readAsDataURL(file);
    });
  };

  // Extract a sensible date from filename if available (e.g., 2024-05-12 or 20240512)
  const extractDateFromFilename = (filename: string): string => {
    const matchIso = filename.match(/\b(20\d{2})[-_/.](0[1-9]|1[0-2])[-_/.](0[1-9]|[12]\d|3[01])\b/);
    if (matchIso) {
      return `${matchIso[1]}-${matchIso[2]}-${matchIso[3]}`;
    }
    const matchCompact = filename.match(/\b(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\b/);
    if (matchCompact) {
      return `${matchCompact[1]}-${matchCompact[2]}-${matchCompact[3]}`;
    }
    return globalDate || new Date().toISOString().slice(0, 10);
  };

  // Extract potential report number from filename (e.g., MP-1234, RP2024-001, etc.)
  const extractReportNumber = (filename: string, index: number): string => {
    const clean = filename.replace(/\.[^/.]+$/, '');
    const match = clean.match(/(?:RP|MP|MC|CAL|REP|NRO|N|DOC)[-_# ]*([a-zA-Z0-9]+)/i);
    if (match && match[1]) {
      return match[0].toUpperCase().replace(/\s+/g, '-');
    }
    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `HIST-${year}-${index + 1}-${randomSuffix}`;
  };

  // Infer maintenance type from filename keywords
  const inferTypeFromFilename = (filename: string): 'preventive' | 'corrective' | 'calibration' => {
    const lower = filename.toLowerCase();
    if (lower.includes('calibracion') || lower.includes('calibración') || lower.includes('metrolog') || lower.includes('certificado')) {
      return 'calibration';
    }
    if (lower.includes('correctivo') || lower.includes('falla') || lower.includes('reparac') || lower.includes('danio') || lower.includes('daño')) {
      return 'corrective';
    }
    return globalType;
  };

  const handleFilesAdded = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setOverallError(null);

    const newItems: BatchItem[] = [];
    const currentLength = items.length;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Size check limit: 20MB per file
      if (file.size > 20 * 1024 * 1024) {
        setOverallError(`El archivo "${file.name}" supera los 20MB. Comprima o seleccione un archivo más liviano.`);
        continue;
      }

      const inferredDate = extractDateFromFilename(file.name);
      const inferredType = inferTypeFromFilename(file.name);
      const inferredNumber = extractReportNumber(file.name, currentLength + i);

      newItems.push({
        id: `batch-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        file,
        name: file.name,
        size: file.size,
        type: inferredType,
        date: inferredDate,
        technicianName: globalTechnician,
        reportNumber: inferredNumber,
        description: `Mantenimiento histórico cargado masivamente (${file.name})`,
        status: 'pending'
      });
    }

    setItems(prev => [...prev, ...newItems]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveItem = (id: string) => {
    if (isProcessing) return;
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleUpdateItem = (id: string, updates: Partial<BatchItem>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const applyGlobalDefaultsToAll = () => {
    setItems(prev => prev.map(item => ({
      ...item,
      type: globalType,
      date: globalDate,
      technicianName: globalTechnician
    })));
  };

  const handleUploadAll = async () => {
    if (items.length === 0) return;
    setIsProcessing(true);
    setOverallError(null);

    let successCount = 0;
    const year = new Date().getFullYear();

    for (let i = 0; i < items.length; i++) {
      const current = items[i];
      if (current.status === 'success') {
        successCount++;
        continue;
      }

      handleUpdateItem(current.id, { status: 'uploading', errorMessage: undefined });

      try {
        // 1. Convert to Base64
        const base64Data = await fileToBase64(current.file);

        // 2. Prepare clean filename for Google Drive
        const safeSerial = (equipment.serial || 'SN').replace(/[^a-zA-Z0-9_-]/g, '_');
        const safeReportNum = (current.reportNumber || `RP-${i + 1}`).replace(/[^a-zA-Z0-9_-]/g, '_');
        const ext = current.file.name.includes('.') ? current.file.name.split('.').pop() : 'pdf';
        const cleanDriveFileName = `${safeSerial}_${current.type.toUpperCase()}_${safeReportNum}_${current.date}.${ext}`;

        // 3. Upload to Drive folder (Mantenimientos)
        const driveRes = await fetch('/api/drive/upload-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            equipmentDirId: equipment.driveFolderId || '',
            equipmentSerial: equipment.serial,
            equipmentName: equipment.name,
            technologyScope: equipment.technologyScope || 'biomedical',
            folderType: current.type === 'calibration' ? 'calibration' : 'maintenance',
            fileName: cleanDriveFileName,
            base64: base64Data,
            mimeType: current.file.type || 'application/pdf'
          })
        });

        let driveLink = '';
        let driveId = '';
        if (driveRes.ok) {
          const driveData = await driveRes.json();
          driveLink = driveData.webViewLink || (driveData.fileId ? `https://drive.google.com/file/d/${driveData.fileId}/view` : '');
          driveId = driveData.fileId || '';
        } else {
          console.warn(`Respuesta no-ok en Drive para ${current.name}, continuando registro en base de datos.`);
        }

        // 4. Save to Firestore collection `reports`
        const newReport: Partial<MaintenanceReport> = {
          equipmentId: equipment.id,
          equipmentName: equipment.name,
          brand: equipment.brand || '',
          model: equipment.model || '',
          serial: equipment.serial || '',
          location: equipment.location || '',
          serviceName: equipment.serviceName || '',
          registrationInvima: equipment.registrationInvima || '',
          technicianId: user?.uid || 'tech-batch',
          technicianName: current.technicianName || user?.displayName || 'Técnico Especializado',
          date: current.date,
          reportNumber: current.reportNumber,
          type: current.type,
          description: current.description || `Mantenimiento cargado en lote: ${current.file.name}`,
          technicalDiagnosis: 'Cargue masivo de soporte documental histórico de mantenimiento.',
          workPerformed: `Intervención técnica acreditada mediante soporte adjunto (${current.file.name}).`,
          finalDiagnosis: 'Equipo operativo y conforme según reporte adjunto.',
          equipmentStatus: 'operative',
          observations: `Cargue masivo realizado por ${user?.email || 'Usuario'} el ${new Date().toLocaleDateString('es-CO')}. Archivo original: ${current.file.name}`,
          deliveredBy: current.technicianName || 'Técnico de Servicio',
          deliveredByRole: 'Ingeniero / Técnico Biomédico',
          receivedBy: 'Medicina Intensiva del Tolima S.A. - UCI Honda',
          receivedByRole: 'Líder de Tecnología / Almacén',
          status: 'completed',
          driveFileId: driveId || undefined,
          driveFileUrl: driveLink || undefined,
          attachmentUrl: driveLink || undefined,
          technologyScope: equipment.technologyScope || 'biomedical',
          createdAt: serverTimestamp()
        };

        if (current.type === 'calibration') {
          newReport.calibrationDate = current.date;
          // Calculate estimated next calibration if frequency is known
          if (equipment.calibrationFrequency) {
            const calDate = new Date(current.date);
            calDate.setMonth(calDate.getMonth() + Number(equipment.calibrationFrequency));
            newReport.nextCalibrationDate = calDate.toISOString().slice(0, 10);
          }
        }

        await addDoc(collection(db, 'reports'), newReport);

        handleUpdateItem(current.id, { 
          status: 'success', 
          driveFileUrl: driveLink, 
          driveFileId: driveId 
        });
        successCount++;
      } catch (err: any) {
        console.error(`Error procesando archivo ${current.name}:`, err);
        handleUpdateItem(current.id, { 
          status: 'error', 
          errorMessage: err.message || 'Error al subir a Drive o registrar en Firestore' 
        });
      }
    }

    // 5. Re-synchronize equipment with all reports to keep lastMaintenance & schedule up to date
    try {
      const q = query(collection(db, 'reports'), where('equipmentId', '==', equipment.id));
      const reportsSnap = await getDocs(q);
      const allReports = reportsSnap.docs.map(d => ({ ...d.data(), id: d.id })) as MaintenanceReport[];
      await syncEquipmentWithHistory(equipment, allReports);
    } catch (syncErr) {
      console.warn("Aviso: Sincronización de resumen de equipo postergada:", syncErr);
    }

    setIsProcessing(false);
    if (successCount > 0) {
      onSuccess(successCount);
    }
  };

  const completedCount = items.filter(it => it.status === 'success').length;
  const errorCount = items.filter(it => it.status === 'error').length;
  const pendingCount = items.filter(it => it.status === 'pending' || it.status === 'uploading').length;

  return (
    <Dialog open={open} onOpenChange={(val) => !isProcessing && onOpenChange(val)}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col p-0 rounded-3xl border-slate-200">
        
        {/* Header */}
        <DialogHeader className="p-6 pb-4 bg-slate-900 text-white rounded-t-3xl border-b border-slate-800 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-primary/20 text-primary-300 border-primary/30 uppercase text-[10px] font-black">
                  Cargue Masivo
                </Badge>
                <Badge variant="outline" className="text-slate-300 border-slate-700 text-[10px]">
                  Google Drive + Historial
                </Badge>
              </div>
              <DialogTitle className="text-xl font-black text-white flex items-center gap-2">
                <UploadCloud className="h-6 w-6 text-primary" />
                Cargar Mantenimientos en Lote
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-300 mt-1">
                Suba múltiples reportes (PDF o imágenes) para el equipo{' '}
                <span className="font-bold text-white">{equipment.name}</span> (Serial: {equipment.serial || 'S/N'}, Placa: {equipment.assetNumber}).
                Se archivarán automáticamente en la carpeta de <strong>Mantenimientos en Google Drive</strong> y se integrarán al historial.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Configuración rápida para todos */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" />
                Valores por defecto para los archivos cargados
              </span>
              {items.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={applyGlobalDefaultsToAll}
                  disabled={isProcessing}
                  className="h-7 text-[11px] rounded-lg font-bold border-slate-300 hover:bg-slate-100"
                >
                  Aplicar a todos los archivos
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-slate-600">Tipo de Intervención</Label>
                <select
                  value={globalType}
                  onChange={(e) => setGlobalType(e.target.value as any)}
                  disabled={isProcessing}
                  className="w-full text-xs font-semibold rounded-xl border border-slate-200 bg-white p-2 focus:ring-2 focus:ring-primary/20"
                >
                  <option value="preventive">Mantenimiento Preventivo</option>
                  <option value="corrective">Mantenimiento Correctivo</option>
                  <option value="calibration">Calibración / Calificación</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-slate-600">Fecha Predeterminada</Label>
                <Input
                  type="date"
                  value={globalDate}
                  onChange={(e) => setGlobalDate(e.target.value)}
                  disabled={isProcessing}
                  className="h-9 text-xs rounded-xl border-slate-200 bg-white"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-bold text-slate-600">Técnico / Proveedor</Label>
                <Input
                  type="text"
                  placeholder="Ej: Ing. Biomédico / Proveedor"
                  value={globalTechnician}
                  onChange={(e) => setGlobalTechnician(e.target.value)}
                  disabled={isProcessing}
                  className="h-9 text-xs rounded-xl border-slate-200 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Dropzone / File Picker */}
          <div 
            onClick={() => !isProcessing && fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-3xl p-6 text-center transition-all cursor-pointer group flex flex-col items-center justify-center gap-2",
              isProcessing 
                ? "opacity-50 cursor-not-allowed border-slate-200 bg-slate-50" 
                : "border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary"
            )}
          >
            <div className="h-12 w-12 rounded-2xl bg-white shadow-xs border border-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <UploadCloud className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900">
                Haga clic para seleccionar o arrastre reportes aquí
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Seleccione múltiples archivos (PDF, JPG, PNG). Hasta 20MB por reporte.
              </p>
            </div>
            <input 
              ref={fileInputRef}
              type="file" 
              multiple 
              accept=".pdf,image/png,image/jpeg,image/jpg" 
              onChange={(e) => handleFilesAdded(e.target.files)} 
              className="hidden" 
              disabled={isProcessing}
            />
          </div>

          {overallError && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{overallError}</span>
            </div>
          )}

          {/* Listado de archivos agregados */}
          {items.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-slate-500" />
                  Archivos en Cola ({items.length})
                </h4>
                <div className="flex items-center gap-2 text-xs">
                  {completedCount > 0 && (
                    <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      {completedCount} subidos
                    </span>
                  )}
                  {errorCount > 0 && (
                    <span className="text-red-700 font-bold bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                      {errorCount} con error
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isProcessing}
                    onClick={() => setItems([])}
                    className="h-7 text-xs text-slate-400 hover:text-red-600"
                  >
                    Vaciar lista
                  </Button>
                </div>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl bg-white overflow-hidden max-h-[380px] overflow-y-auto">
                {items.map((item, idx) => (
                  <div key={item.id} className="p-3.5 hover:bg-slate-50/70 transition-colors space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                          {item.status === 'uploading' ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          ) : item.status === 'success' ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : item.status === 'error' ? (
                            <AlertCircle className="h-4 w-4 text-red-600" />
                          ) : (
                            <FileText className="h-4 w-4 text-slate-500" />
                          )}
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-black text-slate-900 truncate" title={item.name}>
                            {idx + 1}. {item.name}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {(item.size / 1024).toFixed(0)} KB • Serial: {equipment.serial || 'S/N'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.status === 'success' && item.driveFileUrl && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(item.driveFileUrl, '_blank')}
                            className="h-7 px-2 text-[10px] font-bold text-emerald-700 hover:bg-emerald-50 rounded-lg"
                          >
                            <HardDrive className="h-3 w-3 mr-1" />
                            Ver en Drive
                          </Button>
                        )}

                        {item.status !== 'success' && !isProcessing && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(item.id)}
                            className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Metadata fields editable per item */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block mb-0.5">Tipo</span>
                        <select
                          value={item.type}
                          disabled={isProcessing || item.status === 'success'}
                          onChange={(e) => handleUpdateItem(item.id, { type: e.target.value as any })}
                          className="w-full text-[11px] font-medium rounded-lg border border-slate-200 bg-white p-1.5 focus:ring-1 focus:ring-primary"
                        >
                          <option value="preventive">Preventivo</option>
                          <option value="corrective">Correctivo</option>
                          <option value="calibration">Calibración</option>
                        </select>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block mb-0.5">Fecha Reporte</span>
                        <Input
                          type="date"
                          value={item.date}
                          disabled={isProcessing || item.status === 'success'}
                          onChange={(e) => handleUpdateItem(item.id, { date: e.target.value })}
                          className="h-7 text-[11px] rounded-lg border-slate-200 bg-white p-1.5"
                        />
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block mb-0.5">N° Reporte / Radicado</span>
                        <Input
                          type="text"
                          value={item.reportNumber}
                          disabled={isProcessing || item.status === 'success'}
                          onChange={(e) => handleUpdateItem(item.id, { reportNumber: e.target.value })}
                          className="h-7 text-[11px] rounded-lg border-slate-200 bg-white p-1.5 font-mono"
                        />
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-400 block mb-0.5">Técnico / Entidad</span>
                        <Input
                          type="text"
                          value={item.technicianName}
                          disabled={isProcessing || item.status === 'success'}
                          onChange={(e) => handleUpdateItem(item.id, { technicianName: e.target.value })}
                          className="h-7 text-[11px] rounded-lg border-slate-200 bg-white p-1.5"
                        />
                      </div>
                    </div>

                    {item.errorMessage && (
                      <p className="text-[11px] text-red-600 bg-red-50 p-2 rounded-lg border border-red-100">
                        {item.errorMessage}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 px-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            {items.length === 0 ? (
              <span>Ningún archivo seleccionado aún</span>
            ) : (
              <span>
                Total: <strong className="text-slate-900">{items.length}</strong> archivo(s) •{' '}
                <strong className="text-emerald-700">{completedCount}</strong> completados •{' '}
                Destino: <code className="bg-slate-200/80 px-1.5 py-0.5 rounded text-[11px] text-slate-800">Drive / Equipos / {equipment.serial} / Mantenimientos</code>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              disabled={isProcessing}
              onClick={() => onOpenChange(false)}
              className="rounded-xl font-bold text-xs h-10 px-4 border-slate-300 hover:bg-slate-100 flex-1 sm:flex-initial"
            >
              {completedCount > 0 ? 'Cerrar' : 'Cancelar'}
            </Button>

            <Button
              type="button"
              disabled={items.length === 0 || isProcessing || pendingCount === 0}
              onClick={handleUploadAll}
              className="rounded-xl font-bold text-xs h-10 px-5 bg-primary hover:bg-primary/90 text-white shadow-sm flex-1 sm:flex-initial"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Subiendo a Drive ({completedCount}/{items.length})...
                </>
              ) : (
                <>
                  <UploadCloud className="mr-2 h-4 w-4" />
                  Procesar y Cargar ({pendingCount})
                </>
              )}
            </Button>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
};
