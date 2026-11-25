import React, { useState, useRef, useEffect, useMemo } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  UploadCloud,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  HardDrive,
  Search,
  Eye,
  X,
  RotateCcw,
  ExternalLink,
  Sparkles,
  Check,
  ChevronsUpDown
} from 'lucide-react';
import { Equipment, MaintenanceReport } from '@/types';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { db, cleanFirestoreData, handleFirestoreError, OperationType } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { syncEquipmentWithHistory } from '@/lib/sync-logic';
import { cn } from '@/lib/utils';

interface MultiEquipmentBatchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipmentList: Equipment[];
  onSuccess: (summary: { count: number; equipmentCount: number }) => void;
}

export interface MultiBatchRow {
  id: string;
  file: File;
  objectUrl: string;
  name: string;
  size: number;
  equipmentId: string;
  autoMatched?: boolean;
  type: 'preventive' | 'corrective' | 'calibration';
  date: string;
  technicianName: string;
  reportNumber: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  errorMessage?: string;
  driveFileUrl?: string;
  driveFileId?: string;
}

type ColumnKey = 'index' | 'file' | 'equipment' | 'type' | 'date' | 'technician' | 'reportNumber' | 'status';

const DEFAULT_COL_WIDTHS: Record<ColumnKey, number> = {
  index: 46,
  file: 280,
  equipment: 320,
  type: 190,
  date: 150,
  technician: 185,
  reportNumber: 145,
  status: 130
};

const MIN_COL_WIDTHS: Record<ColumnKey, number> = {
  index: 40,
  file: 140,
  equipment: 180,
  type: 140,
  date: 130,
  technician: 120,
  reportNumber: 110,
  status: 110
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const normalizeToken = (val: string) => (val || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

export const MultiEquipmentBatchModal: React.FC<MultiEquipmentBatchModalProps> = ({
  open,
  onOpenChange,
  equipmentList,
  onSuccess
}) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<MultiBatchRow[]>([]);
  const [colWidths, setColWidths] = useState<Record<ColumnKey, number>>(DEFAULT_COL_WIDTHS);
  const [resizingCol, setResizingCol] = useState<ColumnKey | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);

  const [globalType, setGlobalType] = useState<'preventive' | 'corrective' | 'calibration'>('preventive');
  const [globalDate, setGlobalDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [globalTechnician, setGlobalTechnician] = useState<string>(
    user?.displayName || user?.email?.split('@')[0] || 'Ingeniería Biomédica'
  );
  const [overallError, setOverallError] = useState<string | null>(null);

  // Preview pane state
  const [previewRowId, setPreviewRowId] = useState<string | null>(null);

  // Equipment picker state
  const [pickerRowId, setPickerRowId] = useState<string | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerScopeFilter, setPickerScopeFilter] = useState<'all' | 'biomedical' | 'computing' | 'infrastructure'>('all');

  const equipmentMap = useMemo(() => {
    const map = new Map<string, Equipment>();
    equipmentList.forEach(eq => map.set(eq.id, eq));
    return map;
  }, [equipmentList]);

  // Revoke object URLs on unmount
  const rowsRef = useRef<MultiBatchRow[]>([]);
  rowsRef.current = rows;
  useEffect(() => {
    return () => {
      rowsRef.current.forEach(r => {
        try {
          URL.revokeObjectURL(r.objectUrl);
        } catch {
          // ignore
        }
      });
    };
  }, []);

  // Column drag resizing
  const startResize = (colKey: ColumnKey, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = colWidths[colKey];
    setResizingCol(colKey);

    const onMouseMove = (moveEvt: MouseEvent) => {
      const delta = moveEvt.clientX - startX;
      const nextWidth = Math.max(MIN_COL_WIDTHS[colKey], Math.min(720, startWidth + delta));
      setColWidths(prev => ({ ...prev, [colKey]: nextWidth }));
    };

    const onMouseUp = () => {
      setResizingCol(null);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

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
      reader.onerror = () => reject(new Error('Error leyendo el archivo'));
      reader.readAsDataURL(file);
    });
  };

  const extractDateFromFilename = (filename: string): string => {
    const matchIso = filename.match(/\b(20\d{2})[-_/.](0[1-9]|1[0-2])[-_/.](0[1-9]|[12]\d|3[01])\b/);
    if (matchIso) {
      return `${matchIso[1]}-${matchIso[2]}-${matchIso[3]}`;
    }
    const matchDmy = filename.match(/\b(0[1-9]|[12]\d|3[01])[-_/.](0[1-9]|1[0-2])[-_/.](20\d{2})\b/);
    if (matchDmy) {
      return `${matchDmy[3]}-${matchDmy[2]}-${matchDmy[1]}`;
    }
    const matchCompact = filename.match(/\b(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\b/);
    if (matchCompact) {
      return `${matchCompact[1]}-${matchCompact[2]}-${matchCompact[3]}`;
    }
    return globalDate || new Date().toISOString().slice(0, 10);
  };

  const inferTypeFromFilename = (filename: string): 'preventive' | 'corrective' | 'calibration' => {
    const lower = filename.toLowerCase();
    if (
      lower.includes('calibrac') ||
      lower.includes('metrolog') ||
      lower.includes('certific') ||
      lower.includes('calificacion') ||
      lower.includes('calificación')
    ) {
      return 'calibration';
    }
    if (
      lower.includes('correctiv') ||
      lower.includes('falla') ||
      lower.includes('reparac') ||
      lower.includes('danio') ||
      lower.includes('daño')
    ) {
      return 'corrective';
    }
    if (lower.includes('preventiv')) {
      return 'preventive';
    }
    return globalType;
  };

  const extractReportNumber = (filename: string, index: number): string => {
    const clean = filename.replace(/\.[^/.]+$/, '').trim();

    // 1. Format "CODIGO - SERIAL - EQUIPO" (e.g. "MFFL-26-09-002 - XZZS33457 - VENTILADOR")
    const parts = clean.split(/\s+-\s+/).map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const firstSeg = parts[0];
      if (/^[A-Za-z0-9]{2,}(?:[-_][A-Za-z0-9]+)*$/.test(firstSeg) && /\d/.test(firstSeg) && firstSeg.length <= 40) {
        return firstSeg.toUpperCase();
      }
    }

    // 2. Leading structured code at start of filename (e.g. "MFFL-26-09-002_VENTILADOR" or "MFFL-26-09-002")
    const leadingCodeMatch = clean.match(/^([A-Za-z]{2,12}(?:-[A-Za-z0-9]{1,12}){1,5})(?=[\s_]|$)/);
    if (leadingCodeMatch && /\d/.test(leadingCodeMatch[1])) {
      return leadingCodeMatch[1].toUpperCase();
    }

    // 3. Fallback keyword pattern (RP-123, MP-01, etc.)
    const match = clean.match(/(?:RP|MP|MC|CAL|REP|NRO|CERT|DOC)[-_# ]*([a-zA-Z0-9-]+)/i);
    if (match && match[1]) {
      return match[0].toUpperCase().replace(/\s+/g, '-');
    }

    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `LOT-${year}-${index + 1}-${randomSuffix}`;
  };

  const tryMatchEquipmentFromFilename = (filename: string): Equipment | undefined => {
    const clean = filename.replace(/\.[^/.]+$/, '').trim();
    if (!clean) return undefined;

    const parts = clean.split(/\s+-\s+/).map(p => p.trim()).filter(Boolean);
    const activePool = equipmentList.filter(e => e.serial || e.assetNumber);

    // If format is "CODIGO - SERIAL - EQUIPO", prioritize exact matching on the serial segment (parts[1])
    if (parts.length >= 2) {
      const serialSegment = parts[1];
      const normSeg = normalizeToken(serialSegment);
      if (normSeg.length >= 3) {
        const exactSerial = activePool.filter(eq => normalizeToken(eq.serial || '') === normSeg);
        if (exactSerial.length === 1) return exactSerial[0];

        // Handle double/compound serials like "FMA028743BG-FMAO06770BG"
        const subTokens = serialSegment.split(/[-_/,\s]+/).map(normalizeToken).filter(t => t.length >= 4);
        if (subTokens.length > 0) {
          const subMatches = activePool.filter(eq => {
            const s = normalizeToken(eq.serial || '');
            return s.length >= 4 && subTokens.some(tok => s === tok || s.includes(tok) || tok.includes(s));
          });
          if (subMatches.length === 1) return subMatches[0];
        }

        const exactAsset = activePool.filter(eq => normalizeToken(eq.assetNumber || '') === normSeg);
        if (exactAsset.length === 1) return exactAsset[0];
      }
    }

    // Exclude leading report code segment when searching remaining text so report codes don't falsely match serials
    const searchTarget = parts.length >= 2 ? parts.slice(1).join(' ') : clean;
    const normalizedFile = normalizeToken(searchTarget);
    if (!normalizedFile) return undefined;

    const serialMatches = activePool.filter(eq => {
      const s = normalizeToken(eq.serial || '');
      return s.length >= 4 && normalizedFile.includes(s);
    });
    if (serialMatches.length === 1) return serialMatches[0];

    const assetMatches = activePool.filter(eq => {
      const a = normalizeToken(eq.assetNumber || '');
      return a.length >= 4 && normalizedFile.includes(a);
    });
    if (assetMatches.length === 1) return assetMatches[0];

    return undefined;
  };

  const handleFilesAdded = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setOverallError(null);

    const allowedExts = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
    const newRows: MultiBatchRow[] = [];
    const baseLen = rows.length;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const isSupportedMime =
        file.type === 'application/pdf' ||
        file.type.startsWith('image/') ||
        allowedExts.includes(ext);

      if (!isSupportedMime) {
        setOverallError(`El archivo "${file.name}" no tiene un formato soportado (solo PDF, JPG, PNG o WEBP).`);
        continue;
      }

      if (file.size > 20 * 1024 * 1024) {
        setOverallError(`El archivo "${file.name}" supera los 20 MB permitidos.`);
        continue;
      }

      const matchedEq = tryMatchEquipmentFromFilename(file.name);

      newRows.push({
        id: `mb-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        file,
        objectUrl: URL.createObjectURL(file),
        name: file.name,
        size: file.size,
        equipmentId: matchedEq?.id || '',
        autoMatched: Boolean(matchedEq),
        type: inferTypeFromFilename(file.name),
        date: extractDateFromFilename(file.name),
        technicianName: globalTechnician,
        reportNumber: extractReportNumber(file.name, baseLen + i),
        status: 'pending'
      });
    }

    setRows(prev => [...prev, ...newRows]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateRow = (id: string, patch: Partial<MultiBatchRow>) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRow = (id: string) => {
    if (isProcessing) return;
    setRows(prev => {
      const target = prev.find(r => r.id === id);
      if (target) {
        try {
          URL.revokeObjectURL(target.objectUrl);
        } catch {
          // ignore
        }
      }
      return prev.filter(r => r.id !== id);
    });
    if (previewRowId === id) setPreviewRowId(null);
    if (pickerRowId === id) setPickerRowId(null);
  };

  const applyDefaultsToPending = () => {
    if (isProcessing) return;
    setRows(prev =>
      prev.map(r =>
        r.status === 'pending' || r.status === 'error'
          ? {
              ...r,
              type: globalType,
              date: globalDate,
              technicianName: globalTechnician
            }
          : r
      )
    );
  };

  const pendingOrErrorRows = rows.filter(r => r.status === 'pending' || r.status === 'error');
  const unassignedCount = pendingOrErrorRows.filter(r => !r.equipmentId).length;
  const readyCount = pendingOrErrorRows.filter(r => r.equipmentId && r.date).length;
  const successRowsCount = rows.filter(r => r.status === 'success').length;

  const filteredEquipmentOptions = useMemo(() => {
    const term = pickerSearch.trim().toLowerCase();
    return equipmentList
      .filter(eq => {
        if (pickerScopeFilter !== 'all') {
          const eqScope = eq.technologyScope || 'biomedical';
          if (eqScope !== pickerScopeFilter) return false;
        }
        if (!term) return true;
        return (
          (eq.serial || '').toLowerCase().includes(term) ||
          (eq.name || '').toLowerCase().includes(term) ||
          (eq.assetNumber || '').toLowerCase().includes(term) ||
          (eq.brand || '').toLowerCase().includes(term) ||
          (eq.model || '').toLowerCase().includes(term) ||
          (eq.serviceName || '').toLowerCase().includes(term)
        );
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [equipmentList, pickerSearch, pickerScopeFilter]);

  const previewRow = useMemo(() => rows.find(r => r.id === previewRowId) || null, [rows, previewRowId]);

  const handleSaveAll = async () => {
    if (rows.length === 0) return;

    const toProcess = rows.filter(r => r.status !== 'success');
    if (toProcess.length === 0) return;

    const missingEq = toProcess.filter(r => !r.equipmentId || !r.date);
    if (missingEq.length > 0) {
      setOverallError(
        `Hay ${missingEq.length} archivo(s) sin equipo o fecha asignada. Selecciona el equipo correspondiente en cada fila antes de guardar.`
      );
      return;
    }

    setIsProcessing(true);
    setOverallError(null);

    let savedCount = 0;
    const touchedEquipmentIds = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const current = rows[i];
      if (current.status === 'success') continue;

      const eq = equipmentMap.get(current.equipmentId);
      if (!eq) {
        updateRow(current.id, {
          status: 'error',
          errorMessage: 'Equipo no encontrado en el inventario.'
        });
        continue;
      }

      updateRow(current.id, { status: 'uploading', errorMessage: undefined });

      try {
        const base64Data = await fileToBase64(current.file);
        const safeSerial = (eq.serial || 'SN').replace(/[^a-zA-Z0-9_-]/g, '_');
        const safeReportNum = (current.reportNumber || `RP-${i + 1}`).replace(/[^a-zA-Z0-9_-]/g, '_');
        const ext = current.file.name.includes('.') ? current.file.name.split('.').pop() : 'pdf';
        const cleanDriveFileName = `${safeSerial}_${current.type.toUpperCase()}_${safeReportNum}_${current.date}.${ext}`;

        const driveRes = await fetch('/api/drive/upload-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            equipmentDirId: eq.driveFolderId || '',
            equipmentSerial: eq.serial,
            equipmentName: eq.name,
            technologyScope: eq.technologyScope || 'biomedical',
            folderType: current.type === 'calibration' ? 'calibration' : 'maintenance',
            fileName: cleanDriveFileName,
            base64: base64Data,
            mimeType: current.file.type || 'application/pdf'
          })
        });

        if (!driveRes.ok) {
          const errPayload = await driveRes.json().catch(() => ({}));
          throw new Error(errPayload.error || `Error subiendo a Google Drive (HTTP ${driveRes.status})`);
        }

        const driveData = await driveRes.json();
        const driveLink =
          driveData.webViewLink ||
          (driveData.fileId ? `https://drive.google.com/file/d/${driveData.fileId}/view` : '');
        const driveId = driveData.fileId || '';

        const typeLabel =
          current.type === 'calibration'
            ? 'Calibración'
            : current.type === 'corrective'
              ? 'Mantenimiento Correctivo'
              : 'Mantenimiento Preventivo';

        const reportPayload: Partial<MaintenanceReport> = {
          equipmentId: eq.id,
          equipmentName: eq.name,
          brand: eq.brand || '',
          model: eq.model || '',
          serial: eq.serial || '',
          location: eq.location || '',
          serviceName: eq.serviceName || '',
          registrationInvima: eq.registrationInvima || '',
          technicianId: user?.uid || 'tech-batch',
          technicianName: current.technicianName || user?.displayName || 'Técnico Especializado',
          date: current.date,
          reportNumber: current.reportNumber,
          type: current.type,
          description: `${typeLabel} cargado en lote multi-equipo (${current.file.name})`,
          technicalDiagnosis: `Soporte documental de ${typeLabel.toLowerCase()} cargado mediante cargue masivo.`,
          workPerformed: `Intervención acreditada mediante documento adjunto (${current.file.name}).`,
          finalDiagnosis: 'Equipo operativo y conforme según soporte adjunto.',
          equipmentStatus: 'operative',
          observations: `Cargue masivo multi-equipo realizado por ${user?.email || 'Usuario'} el ${new Date().toLocaleDateString('es-CO')}. Archivo original: ${current.file.name}`,
          deliveredBy: current.technicianName || 'Técnico de Servicio',
          deliveredByRole: 'Ingeniero / Técnico Biomédico',
          receivedBy: 'Medicina Intensiva del Tolima S.A. - UCI Honda',
          receivedByRole: 'Gestión de Tecnología',
          status: 'completed',
          driveFileId: driveId || undefined,
          driveFileUrl: driveLink || undefined,
          attachmentUrl: driveLink || undefined,
          technologyScope: eq.technologyScope || 'biomedical',
          createdAt: serverTimestamp()
        };

        if (current.type === 'calibration') {
          reportPayload.calibrationDate = current.date;
          if (eq.calibrationFrequency) {
            const calDate = new Date(`${current.date}T12:00:00`);
            if (!isNaN(calDate.getTime())) {
              calDate.setMonth(calDate.getMonth() + Number(eq.calibrationFrequency));
              reportPayload.nextCalibrationDate = calDate.toISOString().slice(0, 10);
            }
          }
        }

        try {
          await addDoc(collection(db, 'reports'), cleanFirestoreData(reportPayload));
        } catch (fsErr) {
          handleFirestoreError(fsErr, OperationType.CREATE, 'reports');
        }

        updateRow(current.id, {
          status: 'success',
          driveFileUrl: driveLink,
          driveFileId: driveId
        });

        touchedEquipmentIds.add(eq.id);
        savedCount++;
      } catch (err: any) {
        console.error(`Error procesando ${current.name}:`, err);
        updateRow(current.id, {
          status: 'error',
          errorMessage: err?.message || 'Error al subir a Drive o guardar en Firestore'
        });
      }
    }

    // Re-sync maintenance / calibration dates for every updated equipment
    for (const eqId of touchedEquipmentIds) {
      const eq = equipmentMap.get(eqId);
      if (!eq) continue;
      try {
        const q = query(collection(db, 'reports'), where('equipmentId', '==', eqId));
        const reportsSnap = await getDocs(q);
        const allReports = reportsSnap.docs.map(d => ({ ...d.data(), id: d.id })) as MaintenanceReport[];
        await syncEquipmentWithHistory(eq, allReports);
      } catch (syncErr) {
        console.warn(`Aviso: No se pudo sincronizar fechas del equipo ${eq.name}:`, syncErr);
      }
    }

    setIsProcessing(false);
    if (savedCount > 0 && missingEq.length === 0) {
      const allSucceeded = rowsRef.current.every(r => r.status === 'success');
      if (allSucceeded) {
        onSuccess({ count: savedCount, equipmentCount: touchedEquipmentIds.size });
      }
    }
  };

  const resetAll = () => {
    if (isProcessing) return;
    rows.forEach(r => {
      try {
        URL.revokeObjectURL(r.objectUrl);
      } catch {
        // ignore
      }
    });
    setRows([]);
    setPreviewRowId(null);
    setPickerRowId(null);
    setOverallError(null);
  };

  const totalTableWidth = Object.values(colWidths).reduce((sum, w) => sum + w, 0);

  return (
    <Dialog
      open={open}
      onOpenChange={nextOpen => {
        if (isProcessing && !nextOpen) return;
        if (!nextOpen) {
          setPickerRowId(null);
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-w-[96vw] sm:max-w-[96vw] w-[1400px] h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-white">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-6">
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-slate-900">
                Cargue Masivo Multi-Equipo
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Sube un paquete de PDF o imágenes, relaciona cada archivo con su equipo, fecha y tipo de reporte, y archiva automáticamente en Google Drive actualizando las fechas de cada equipo.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setColWidths(DEFAULT_COL_WIDTHS)}
                className="h-8 text-xs font-medium whitespace-nowrap"
                title="Restaurar ancho estándar de columnas"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Restaurar Columnas
              </Button>
              {rows.length > 0 && !isProcessing && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetAll}
                  className="h-8 text-xs font-medium text-rose-600 border-rose-200 hover:bg-rose-50 whitespace-nowrap"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Limpiar Lista
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Controls & Dropzone */}
        <div className="px-6 py-3 border-b border-slate-200 bg-white space-y-3 shrink-0">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
            {/* Dropzone */}
            <div
              onDragOver={e => {
                e.preventDefault();
                if (!isProcessing) setIsDraggingFiles(true);
              }}
              onDragLeave={() => setIsDraggingFiles(false)}
              onDrop={e => {
                e.preventDefault();
                setIsDraggingFiles(false);
                if (!isProcessing) handleFilesAdded(e.dataTransfer.files);
              }}
              onClick={() => !isProcessing && fileInputRef.current?.click()}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-lg border border-dashed cursor-pointer transition-colors flex-1 min-w-0',
                isDraggingFiles
                  ? 'border-primary bg-primary/5'
                  : 'border-slate-300 bg-slate-50/60 hover:bg-slate-100/70',
                isProcessing && 'opacity-50 pointer-events-none'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                className="hidden"
                onChange={e => handleFilesAdded(e.target.files)}
              />
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <UploadCloud className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">
                  {rows.length === 0
                    ? 'Haz clic o arrastra aquí un paquete de archivos (PDF, JPG, PNG)'
                    : 'Agregar más archivos PDF o imágenes al lote'}
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  Si el nombre del archivo contiene el número de serie o fecha, se sugerirá automáticamente. Máx. 20 MB por archivo.
                </p>
              </div>
            </div>

            {/* Global Defaults */}
            <div className="flex flex-wrap items-end gap-2 shrink-0">
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-slate-600">Tipo por defecto</Label>
                <Select
                  value={globalType}
                  onValueChange={v => setGlobalType(v as 'preventive' | 'corrective' | 'calibration')}
                  disabled={isProcessing}
                >
                  <SelectTrigger className="h-9 w-[170px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preventive">Manto. Preventivo</SelectItem>
                    <SelectItem value="corrective">Manto. Correctivo</SelectItem>
                    <SelectItem value="calibration">Calibración</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-slate-600">Fecha por defecto</Label>
                <Input
                  type="date"
                  value={globalDate}
                  onChange={e => setGlobalDate(e.target.value)}
                  disabled={isProcessing}
                  className="h-9 w-[142px] text-xs tabular-nums"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-slate-600">Técnico / Proveedor</Label>
                <Input
                  value={globalTechnician}
                  onChange={e => setGlobalTechnician(e.target.value)}
                  placeholder="Nombre técnico o proveedor"
                  disabled={isProcessing}
                  className="h-9 w-[175px] text-xs"
                />
              </div>

              {rows.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={applyDefaultsToPending}
                  disabled={isProcessing || pendingOrErrorRows.length === 0}
                  className="h-9 px-3 text-xs font-medium whitespace-nowrap"
                >
                  Aplicar a pendientes
                </Button>
              )}
            </div>
          </div>

          {overallError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="flex-1">{overallError}</span>
              <button
                type="button"
                onClick={() => setOverallError(null)}
                className="text-rose-500 hover:text-rose-800"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Main Workspace: Resizable Table + Optional Live Preview Pane */}
        <div className="flex-1 min-h-0 flex overflow-hidden relative bg-slate-50/40">
          {/* Table Container */}
          <div className={cn('flex-1 min-w-0 overflow-auto', resizingCol && 'select-none')}>
            {rows.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-10 text-center">
                <div className="h-14 w-14 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                  <HardDrive className="h-7 w-7" />
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  Aún no has cargado archivos en este lote
                </p>
                <p className="text-xs text-slate-500 max-w-md mt-1">
                  Selecciona varios reportes o certificados (PDF, JPG, PNG) para relacionarlos en tabla con cada equipo, ajustar las columnas a tu gusto y guardarlos de una sola vez en Google Drive.
                </p>
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 h-9 px-4 text-xs font-semibold"
                >
                  <UploadCloud className="h-4 w-4 mr-2" />
                  Seleccionar Paquete de Archivos
                </Button>
              </div>
            ) : (
              <table
                className="border-collapse table-fixed bg-white text-xs"
                style={{ width: `${Math.max(totalTableWidth, 100)}px`, minWidth: '100%' }}
              >
                <colgroup>
                  <col style={{ width: `${colWidths.index}px` }} />
                  <col style={{ width: `${colWidths.file}px` }} />
                  <col style={{ width: `${colWidths.equipment}px` }} />
                  <col style={{ width: `${colWidths.type}px` }} />
                  <col style={{ width: `${colWidths.date}px` }} />
                  <col style={{ width: `${colWidths.technician}px` }} />
                  <col style={{ width: `${colWidths.reportNumber}px` }} />
                  <col style={{ width: `${colWidths.status}px` }} />
                </colgroup>
                <thead className="sticky top-0 z-20 bg-slate-100 border-b border-slate-200 text-slate-700">
                  <tr>
                    <th className="relative px-2 py-2.5 text-center font-semibold border-r border-slate-200">
                      #
                    </th>
                    {(
                      [
                        { key: 'file', label: 'Archivo (arrastra el borde para ajustar)' },
                        { key: 'equipment', label: 'Equipo / Serie Relacionado' },
                        { key: 'type', label: 'Tipo de Reporte' },
                        { key: 'date', label: 'Fecha' },
                        { key: 'technician', label: 'Técnico / Proveedor' },
                        { key: 'reportNumber', label: 'N° Reporte' }
                      ] as { key: ColumnKey; label: string }[]
                    ).map(col => (
                      <th
                        key={col.key}
                        className="relative px-3 py-2.5 text-left font-semibold border-r border-slate-200 whitespace-nowrap overflow-hidden text-ellipsis"
                      >
                        <span className="block truncate pr-2">{col.label}</span>
                        <div
                          onMouseDown={e => startResize(col.key, e)}
                          title="Arrastra horizontalmente para cambiar el ancho de esta columna"
                          className={cn(
                            'absolute top-0 right-0 h-full w-2 cursor-col-resize flex items-center justify-center group hover:bg-primary/20',
                            resizingCol === col.key && 'bg-primary/30'
                          )}
                        >
                          <span className="h-4 w-0.5 bg-slate-300 group-hover:bg-primary rounded-full" />
                        </div>
                      </th>
                    ))}
                    <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">
                      Estado / Acción
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, idx) => {
                    const selectedEq = row.equipmentId ? equipmentMap.get(row.equipmentId) : undefined;
                    const isImage =
                      row.file.type.startsWith('image/') ||
                      /\.(jpg|jpeg|png|webp)$/i.test(row.name);
                    const rowDisabled = isProcessing || row.status === 'success';

                    return (
                      <tr
                        key={row.id}
                        className={cn(
                          'align-top transition-colors',
                          row.status === 'success' && 'bg-emerald-50/40',
                          row.status === 'error' && 'bg-rose-50/40',
                          previewRowId === row.id && 'bg-sky-50/60',
                          row.status === 'pending' && 'hover:bg-slate-50/80'
                        )}
                      >
                        {/* # */}
                        <td className="px-2 py-2.5 text-center font-mono tabular-nums text-slate-400 border-r border-slate-100">
                          {idx + 1}
                        </td>

                        {/* Archivo */}
                        <td className="px-3 py-2 border-r border-slate-100 align-top">
                          <div className="flex items-start gap-2 min-w-0">
                            <div className="mt-0.5 shrink-0 text-slate-500">
                              {isImage ? (
                                <ImageIcon className="h-4 w-4 text-sky-600" />
                              ) : (
                                <FileText className="h-4 w-4 text-rose-600" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p
                                className="font-medium text-slate-900 break-words leading-snug"
                                title={row.name}
                              >
                                {row.name}
                              </p>
                              <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 tabular-nums">
                                <span>{formatBytes(row.size)}</span>
                                <span>·</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewRowId(prev => (prev === row.id ? null : row.id))
                                  }
                                  className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                                >
                                  <Eye className="h-3 w-3" />
                                  {previewRowId === row.id ? 'Ocultar vista' : 'Ver archivo'}
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Equipo Relacionado */}
                        <td className="px-2.5 py-2 border-r border-slate-100 align-top">
                          <button
                            type="button"
                            disabled={rowDisabled}
                            onClick={() => {
                              setPickerSearch('');
                              setPickerScopeFilter('all');
                              setPickerRowId(row.id);
                            }}
                            className={cn(
                              'w-full text-left px-2.5 py-1.5 rounded-md border text-xs transition-colors flex items-start justify-between gap-2',
                              selectedEq
                                ? 'border-slate-200 bg-white hover:border-primary/50 text-slate-900'
                                : 'border-amber-300 bg-amber-50/60 hover:bg-amber-50 text-amber-900',
                              rowDisabled && 'opacity-75 cursor-not-allowed'
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              {selectedEq ? (
                                <>
                                  <p className="font-semibold text-slate-900 break-words leading-snug">
                                    {selectedEq.name}
                                  </p>
                                  <p className="text-[11px] text-slate-500 font-mono tabular-nums break-all mt-0.5">
                                    S/N: {selectedEq.serial || 'N/A'}
                                    {selectedEq.assetNumber ? ` · Placa: ${selectedEq.assetNumber}` : ''}
                                  </p>
                                  <p className="text-[10px] text-slate-400 truncate">
                                    {selectedEq.serviceName || 'Sin servicio'}
                                    {row.autoMatched ? ' · Detectado en nombre' : ''}
                                  </p>
                                </>
                              ) : (
                                <span className="font-medium flex items-center gap-1.5 py-1">
                                  <Search className="h-3.5 w-3.5 shrink-0" />
                                  Seleccionar equipo / serie...
                                </span>
                              )}
                            </div>
                            <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-1" />
                          </button>
                        </td>

                        {/* Tipo de Reporte */}
                        <td className="px-2.5 py-2 border-r border-slate-100 align-top">
                          <Select
                            value={row.type}
                            onValueChange={val =>
                              updateRow(row.id, {
                                type: val as 'preventive' | 'corrective' | 'calibration'
                              })
                            }
                            disabled={rowDisabled}
                          >
                            <SelectTrigger className="h-8 text-xs w-full bg-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="preventive">Manto. Preventivo</SelectItem>
                              <SelectItem value="corrective">Manto. Correctivo</SelectItem>
                              <SelectItem value="calibration">Calibración</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-[10px] text-slate-400 mt-1 truncate">
                            Drive: {row.type === 'calibration' ? 'Reportes / Calibraciones' : 'Reportes / Mantenimientos'}
                          </p>
                        </td>

                        {/* Fecha */}
                        <td className="px-2.5 py-2 border-r border-slate-100 align-top">
                          <Input
                            type="date"
                            value={row.date}
                            onChange={e => updateRow(row.id, { date: e.target.value })}
                            disabled={rowDisabled}
                            className="h-8 text-xs tabular-nums bg-white"
                          />
                        </td>

                        {/* Técnico / Proveedor */}
                        <td className="px-2.5 py-2 border-r border-slate-100 align-top">
                          <Input
                            value={row.technicianName}
                            onChange={e => updateRow(row.id, { technicianName: e.target.value })}
                            placeholder="Técnico o proveedor"
                            disabled={rowDisabled}
                            className="h-8 text-xs bg-white"
                          />
                        </td>

                        {/* N° Reporte */}
                        <td className="px-2.5 py-2 border-r border-slate-100 align-top">
                          <Input
                            value={row.reportNumber}
                            onChange={e => updateRow(row.id, { reportNumber: e.target.value })}
                            disabled={rowDisabled}
                            className="h-8 text-xs font-mono bg-white"
                          />
                        </td>

                        {/* Estado / Acción */}
                        <td className="px-2.5 py-2 text-right align-top">
                          <div className="flex flex-col items-end gap-1">
                            {row.status === 'pending' && (
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={cn(
                                    'text-[11px] font-medium',
                                    row.equipmentId ? 'text-slate-600' : 'text-amber-700'
                                  )}
                                >
                                  {row.equipmentId ? 'Listo' : 'Falta equipo'}
                                </span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  disabled={isProcessing}
                                  onClick={() => removeRow(row.id)}
                                  className="h-7 w-7 text-slate-400 hover:text-rose-600"
                                  title="Quitar archivo"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}

                            {row.status === 'uploading' && (
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Guardando...
                              </span>
                            )}

                            {row.status === 'success' && (
                              <div className="flex flex-col items-end gap-1">
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Guardado
                                </span>
                                {row.driveFileUrl && (
                                  <button
                                    type="button"
                                    onClick={() => window.open(row.driveFileUrl, '_blank')}
                                    className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    Ver en Drive
                                  </button>
                                )}
                              </div>
                            )}

                            {row.status === 'error' && (
                              <div className="flex flex-col items-end gap-1">
                                <div className="flex items-center gap-1 text-[11px] font-semibold text-rose-700">
                                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                  Error
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    disabled={isProcessing}
                                    onClick={() => removeRow(row.id)}
                                    className="h-6 w-6 text-slate-400 hover:text-rose-600"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                                {row.errorMessage && (
                                  <span
                                    className="text-[10px] text-rose-600 text-right max-w-[115px] leading-tight line-clamp-2"
                                    title={row.errorMessage}
                                  >
                                    {row.errorMessage}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Side Preview Drawer for inspecting scanned JPG/PDF while assigning serial */}
          {previewRow && (
            <div className="w-[380px] xl:w-[440px] border-l border-slate-200 bg-white flex flex-col shrink-0">
              <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between gap-2 bg-slate-50">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate" title={previewRow.name}>
                    {previewRow.name}
                  </p>
                  <p className="text-[11px] text-slate-500">Vista previa del documento</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setPreviewRowId(null)}
                  className="h-7 w-7 shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 bg-slate-100 overflow-auto p-3 flex items-center justify-center">
                {previewRow.file.type.startsWith('image/') ||
                /\.(jpg|jpeg|png|webp)$/i.test(previewRow.name) ? (
                  <img
                    src={previewRow.objectUrl}
                    alt={previewRow.name}
                    className="max-w-full max-h-full object-contain rounded border border-slate-200 bg-white"
                  />
                ) : (
                  <iframe
                    src={previewRow.objectUrl}
                    title={previewRow.name}
                    className="w-full h-full rounded border border-slate-200 bg-white"
                  />
                )}
              </div>
            </div>
          )}

          {/* In-Dialog Equipment Picker Overlay (avoids focus-trap & overflow clipping issues) */}
          {pickerRowId && (
            <div className="absolute inset-0 z-40 bg-slate-900/35 flex items-center justify-center p-4">
              <div className="w-full max-w-2xl bg-white rounded-xl border border-slate-200 shadow-2xl flex flex-col max-h-[82vh] overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50">
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-slate-900">
                      Seleccionar Equipo del Sistema
                    </h4>
                    <p className="text-[11px] text-slate-500 truncate">
                      Archivo: {rows.find(r => r.id === pickerRowId)?.name}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setPickerRowId(null)}
                    className="h-8 w-8 shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="p-3 border-b border-slate-200 space-y-2.5 bg-white">
                  <div className="relative">
                    <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      autoFocus
                      value={pickerSearch}
                      onChange={e => setPickerSearch(e.target.value)}
                      placeholder="Buscar por número de serie, nombre del equipo, placa o servicio..."
                      className="pl-9 h-9 text-xs"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {(
                      [
                        { id: 'all', label: 'Todos' },
                        { id: 'biomedical', label: 'Biomédica' },
                        { id: 'computing', label: 'Cómputo TIC' },
                        { id: 'infrastructure', label: 'Infraestructura' }
                      ] as const
                    ).map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setPickerScopeFilter(tab.id)}
                        className={cn(
                          'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                          pickerScopeFilter === tab.id
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                    <span className="ml-auto text-[11px] text-slate-400 tabular-nums">
                      {filteredEquipmentOptions.length} equipo(s)
                    </span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                  {filteredEquipmentOptions.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      No se encontraron equipos que coincidan con "{pickerSearch}".
                    </div>
                  ) : (
                    filteredEquipmentOptions.map(eq => {
                      const currentRow = rows.find(r => r.id === pickerRowId);
                      const isSelected = currentRow?.equipmentId === eq.id;
                      const scopeLabel =
                        eq.technologyScope === 'computing'
                          ? 'TIC'
                          : eq.technologyScope === 'infrastructure'
                            ? 'Infraestructura'
                            : 'Biomédica';

                      return (
                        <button
                          key={eq.id}
                          type="button"
                          onClick={() => {
                            updateRow(pickerRowId, {
                              equipmentId: eq.id,
                              autoMatched: false
                            });
                            setPickerRowId(null);
                          }}
                          className={cn(
                            'w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3',
                            isSelected && 'bg-primary/5'
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-900 truncate">
                                {eq.name}
                              </span>
                              <span className="text-[10px] text-slate-400 shrink-0">
                                {scopeLabel}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600 font-mono tabular-nums mt-0.5">
                              Serie: <strong className="text-slate-900">{eq.serial || 'S/N'}</strong>
                              {eq.assetNumber ? ` · Placa: ${eq.assetNumber}` : ''}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate mt-0.5">
                              {[eq.brand, eq.model, eq.serviceName].filter(Boolean).join(' · ') || 'Sin detalles'}
                            </div>
                          </div>
                          {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-600 flex flex-wrap items-center gap-3 tabular-nums">
            <span>
              <strong>{rows.length}</strong> archivo(s) en lote
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-emerald-700 font-medium">
              <strong>{readyCount}</strong> listos para guardar
            </span>
            {unassignedCount > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-amber-700 font-medium">
                  <strong>{unassignedCount}</strong> sin equipo asignado
                </span>
              </>
            )}
            {successRowsCount > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-sky-700 font-medium">
                  <strong>{successRowsCount}</strong> guardados
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              type="button"
              variant="outline"
              disabled={isProcessing}
              onClick={() => onOpenChange(false)}
              className="h-9 px-4 text-xs font-medium"
            >
              Cerrar
            </Button>
            <Button
              type="button"
              disabled={isProcessing || pendingOrErrorRows.length === 0 || unassignedCount > 0}
              onClick={handleSaveAll}
              className="h-9 px-5 text-xs font-semibold whitespace-nowrap"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Subiendo a Drive y Actualizando Equipos...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Guardar {pendingOrErrorRows.length > 0 ? `(${pendingOrErrorRows.length})` : ''} en Drive y Equipos
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
