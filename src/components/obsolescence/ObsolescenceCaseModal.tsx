import React, { useState, useEffect } from 'react';
import {
  Equipment,
  ObsolescenceEvaluation,
  ObsolescenceCase,
  ObsolescenceCaseIntervention,
  ObsolescenceCaseClosure,
  ObsolescenceManagementType,
  ObsolescenceLevel
} from '@/types';
import { db, cleanFirestoreData } from '@/lib/firebase';
import { collection, doc, setDoc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import { generateObsolescenceCasePDF } from '@/lib/pdfGenerator';
import { getObsolescenceLevelStyles } from '@/lib/obsolescence-calculator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import {
  Briefcase,
  FileText,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Download,
  ExternalLink,
  Plus,
  Trash2,
  Clock,
  Building2,
  Shield,
  Loader2,
  Sparkles,
  HardDrive
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface ObsolescenceCaseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment | null;
  existingEvaluation?: ObsolescenceEvaluation | null;
  existingCase?: ObsolescenceCase | null;
  onCaseSaved?: (savedCase: ObsolescenceCase) => void;
}

export const ObsolescenceCaseModal: React.FC<ObsolescenceCaseModalProps> = ({
  open,
  onOpenChange,
  equipment,
  existingEvaluation,
  existingCase,
  onCaseSaved
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'summary' | 'interventions' | 'closure'>('summary');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [driveSuccessUrl, setDriveSuccessUrl] = useState<string | null>(null);
  const [savedCase, setSavedCase] = useState<ObsolescenceCase | null>(existingCase || null);

  // Form State
  const [caseNumber, setCaseNumber] = useState('');
  const [title, setTitle] = useState('');
  const [justification, setJustification] = useState('');
  const [managementType, setManagementType] = useState<ObsolescenceManagementType>('Mantenimiento Correctivo Mayor / Actualización');
  const [priority, setPriority] = useState<'Baja' | 'Media' | 'Alta' | 'Crítica'>('Alta');
  
  // Interventions list
  const [interventions, setInterventions] = useState<ObsolescenceCaseIntervention[]>([]);
  
  // New intervention sub-form
  const [showAddIntervention, setShowAddIntervention] = useState(false);
  const [intType, setIntType] = useState<'cotizacion' | 'mantenimiento' | 'actualizacion' | 'reemplazo' | 'inspeccion' | 'otro'>('cotizacion');
  const [intTitle, setIntTitle] = useState('');
  const [intDescription, setIntDescription] = useState('');
  const [intProvider, setIntProvider] = useState('');
  const [intDocNumber, setIntDocNumber] = useState('');
  const [intCost, setIntCost] = useState<string>('');
  const [intFileUrl, setIntFileUrl] = useState('');
  const [uploadingIntFile, setUploadingIntFile] = useState(false);

  // Closure Form
  const [closureType, setClosureType] = useState<'Renovación / Reposición Total' | 'Repotenciación / Actualización Exitosa' | 'Baja y Desincorporación' | 'Riesgo Técnico Mitigado'>('Repotenciación / Actualización Exitosa');
  const [technicalConclusion, setTechnicalConclusion] = useState('');
  const [resultingStatus, setResultingStatus] = useState<'active' | 'out_of_service' | 'baja'>('active');
  const [recalculateToSafeLevel, setRecalculateToSafeLevel] = useState(true);

  // Load or Initialize Case
  useEffect(() => {
    if (!open) return;
    setErrorMsg('');
    setDriveSuccessUrl(null);
    setShowAddIntervention(false);
    setSavedCase(existingCase || null);

    if (existingCase) {
      setCaseNumber(existingCase.caseNumber);
      setTitle(existingCase.title);
      setJustification(existingCase.justification);
      setManagementType(existingCase.managementType);
      setPriority(existingCase.priority);
      setInterventions(existingCase.interventions || []);
      if (existingCase.resolution) {
        setClosureType(existingCase.resolution.closureType);
        setTechnicalConclusion(existingCase.resolution.technicalConclusion);
        setResultingStatus((existingCase.resolution.resultingStatus as any) || 'active');
        if (existingCase.resolution.pdfUrl) {
          setDriveSuccessUrl(existingCase.resolution.pdfUrl);
        }
      }
      setActiveTab(existingCase.status === 'cerrado' ? 'closure' : 'summary');
    } else if (equipment) {
      // Generate new sequential case number
      const year = new Date().getFullYear();
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      setCaseNumber(`CASO-OBS-${year}-${randomSuffix}`);
      
      const defaultTitle = existingEvaluation?.level === 'Crítico' || existingEvaluation?.level === 'Alto'
        ? `Gestión y Actualización de Obsolescencia - ${equipment.name}`
        : `Plan de Intervención Tecnológica - ${equipment.name}`;
      setTitle(defaultTitle);

      const defaultJust = existingEvaluation 
        ? `Equipo clasificado con nivel de obsolescencia ${existingEvaluation.level} (Índice: ${existingEvaluation.index}/5.0). Requiere intervención técnica: ${existingEvaluation.action}.`
        : `Intervención técnica programada para actualización y mitigación de obsolescencia.`;
      setJustification(defaultJust);

      setPriority((existingEvaluation?.priority as any) || 'Alta');
      setInterventions([]);
      setTechnicalConclusion('');
      setActiveTab('summary');
    }
  }, [open, existingCase, equipment, existingEvaluation]);

  // Calculate total cost of interventions
  const totalCost = interventions.reduce((sum, it) => sum + (it.cost || 0), 0);

  // Add Intervention Handler
  const handleAddIntervention = () => {
    if (!intTitle.trim()) {
      setErrorMsg('Por favor ingrese un título o descripción para la intervención.');
      return;
    }

    const newIt: ObsolescenceCaseIntervention = {
      id: `it-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      type: intType,
      title: intTitle.trim(),
      description: intDescription.trim(),
      provider: intProvider.trim() || undefined,
      documentNumber: intDocNumber.trim() || undefined,
      cost: intCost ? parseFloat(intCost) || 0 : 0,
      fileUrl: intFileUrl.trim() || undefined,
      recordedBy: user?.displayName || user?.email || 'Ingeniero Biomédico'
    };

    setInterventions(prev => [...prev, newIt]);
    setIntTitle('');
    setIntDescription('');
    setIntProvider('');
    setIntDocNumber('');
    setIntCost('');
    setIntFileUrl('');
    setShowAddIntervention(false);
    setErrorMsg('');
  };

  const handleRemoveIntervention = (id: string) => {
    setInterventions(prev => prev.filter(it => it.id !== id));
  };

  // Upload quote or intervention attachment to Google Drive via proxy
  const handleFileUploadToDrive = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !equipment) return;

    setUploadingIntFile(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        try {
          const res = await fetch('/api/drive/upload-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              base64,
              fileName: `Soporte_${file.name}`,
              folderType: 'obsolescence',
              technologyScope: equipment.technologyScope || 'biomedical',
              equipmentName: equipment.name,
              equipmentSerial: equipment.serial,
              equipmentDirId: equipment.driveFolderId
            })
          });

          const data = await res.json();
          if (data.webViewLink) {
            setIntFileUrl(data.webViewLink);
          } else {
            console.warn("Drive returned without link:", data);
          }
        } catch (err) {
          console.error("Error uploading attachment to Drive:", err);
        } finally {
          setUploadingIntFile(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setUploadingIntFile(false);
    }
  };

  // Save Case (Draft / In Progress)
  const handleSaveDraft = async () => {
    if (!equipment) return;
    if (!title.trim()) {
      setErrorMsg('Debe ingresar un título para el caso.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const caseId = existingCase?.id || `case-${equipment.id}-${Date.now()}`;
      const now = new Date().toISOString();

      const caseData: ObsolescenceCase = {
        id: caseId,
        caseNumber: caseNumber || `CASO-OBS-${Date.now()}`,
        equipmentId: equipment.id,
        equipmentName: equipment.name,
        equipmentCode: equipment.assetNumber || 'N/A',
        brand: equipment.brand || '',
        model: equipment.model || '',
        serial: equipment.serial || '',
        serviceId: equipment.serviceId || '',
        serviceName: equipment.serviceName || 'Sin Servicio',
        technologyScope: equipment.technologyScope || 'biomedical',
        status: existingCase?.status === 'cerrado' ? 'cerrado' : (interventions.length > 0 ? 'en_gestion' : 'abierto'),
        managementType,
        title: title.trim(),
        justification: justification.trim(),
        priority,
        initialEvaluation: {
          evaluationId: existingEvaluation?.id || `obs-${equipment.id}`,
          index: existingEvaluation?.index || 4.0,
          level: existingEvaluation?.level || 'Alto',
          priority: existingEvaluation?.priority || 'Alta',
          action: existingEvaluation?.action || 'Planificar intervención',
          evaluationDate: existingEvaluation?.evaluationDate || now.split('T')[0]
        },
        interventions,
        resolution: existingCase?.resolution,
        totalCost,
        createdBy: existingCase?.createdBy || user?.displayName || user?.email || 'Ingeniero Biomédico',
        createdAt: existingCase?.createdAt || now,
        updatedAt: now
      };

      const sanitized = cleanFirestoreData(caseData);
      await setDoc(doc(db, 'obsolescence_cases', caseId), sanitized);
      setSavedCase(caseData);

      if (onCaseSaved) onCaseSaved(caseData);
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error saving obsolescence case draft:', err);
      setErrorMsg(err.message || 'Error al guardar el caso en Firestore.');
    } finally {
      setLoading(false);
    }
  };

  // Formal Case Closure: Generates PDF, uploads to Drive, updates Equipment and Obsolescence Evaluation!
  const handleCloseCase = async () => {
    if (!equipment) return;
    if (!technicalConclusion.trim()) {
      setErrorMsg('Es indispensable ingresar el dictamen técnico y conclusiones finales para cerrar el caso.');
      setActiveTab('closure');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const caseId = existingCase?.id || `case-${equipment.id}-${Date.now()}`;
      const now = new Date().toISOString();
      const currentUserName = user?.displayName || user?.email || 'Ingeniero Biomédico';

      // 1. Calculate new safe evaluation if requested
      const newIndex = recalculateToSafeLevel ? 1.85 : (existingEvaluation?.index || 2.0);
      const newLevel: ObsolescenceLevel = recalculateToSafeLevel ? 'Bajo' : (existingEvaluation?.level || 'Moderado');

      const closureData: ObsolescenceCaseClosure = {
        closedAt: now,
        closedBy: currentUserName,
        closedByRole: 'Líder de Ingeniería Biomédica / Calidad',
        closureType,
        technicalConclusion: technicalConclusion.trim(),
        resultingStatus,
        newEvaluationIndex: newIndex,
        newLevel
      };

      const finalCaseObj: ObsolescenceCase = {
        id: caseId,
        caseNumber: caseNumber || `CASO-OBS-${Date.now()}`,
        equipmentId: equipment.id,
        equipmentName: equipment.name,
        equipmentCode: equipment.assetNumber || 'N/A',
        brand: equipment.brand || '',
        model: equipment.model || '',
        serial: equipment.serial || '',
        serviceId: equipment.serviceId || '',
        serviceName: equipment.serviceName || 'Sin Servicio',
        technologyScope: equipment.technologyScope || 'biomedical',
        status: 'cerrado',
        managementType,
        title: title.trim(),
        justification: justification.trim(),
        priority,
        initialEvaluation: {
          evaluationId: existingEvaluation?.id || `obs-${equipment.id}`,
          index: existingEvaluation?.index || 4.2,
          level: existingEvaluation?.level || 'Crítico',
          priority: existingEvaluation?.priority || 'Crítica',
          action: existingEvaluation?.action || 'Priorizar intervención / renovación o retiro',
          evaluationDate: existingEvaluation?.evaluationDate || now.split('T')[0]
        },
        interventions,
        resolution: closureData,
        totalCost,
        createdBy: existingCase?.createdBy || currentUserName,
        createdAt: existingCase?.createdAt || now,
        updatedAt: now
      };

      // 2. Generate PDF Base64
      let driveUrl = '';
      let driveId = '';
      try {
        const pdfBase64 = generateObsolescenceCasePDF(finalCaseObj, true);

        // 3. Upload to Google Drive via server proxy
        const uploadRes = await fetch('/api/drive/upload-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base64: pdfBase64,
            fileName: `Acta_Cierre_Obsolescencia_${finalCaseObj.caseNumber}_${equipment.serial || 'SN'}.pdf`,
            folderType: 'obsolescence',
            technologyScope: equipment.technologyScope || 'biomedical',
            equipmentName: equipment.name,
            equipmentSerial: equipment.serial,
            equipmentDirId: equipment.driveFolderId
          })
        });

        if (uploadRes.ok) {
          const driveResData = await uploadRes.json();
          driveUrl = driveResData.webViewLink || (driveResData.fileId ? `https://drive.google.com/file/d/${driveResData.fileId}/view` : '');
          driveId = driveResData.fileId || '';
          finalCaseObj.resolution!.pdfUrl = driveUrl;
          finalCaseObj.resolution!.driveFileId = driveId;
          finalCaseObj.pdfUrl = driveUrl;
          finalCaseObj.driveFileId = driveId;
          setDriveSuccessUrl(driveUrl);
        } else {
          console.warn("Drive returned non-ok response, proceeding with local PDF and DB save.");
        }
      } catch (pdfDriveErr) {
        console.warn("Could not upload to Drive automatically:", pdfDriveErr);
      }

      // 4. Save Closed Case to Firestore
      const sanitizedCase = cleanFirestoreData(finalCaseObj);
      await setDoc(doc(db, 'obsolescence_cases', caseId), sanitizedCase);
      setSavedCase(finalCaseObj);

      // 5. Update Equipment & Obsolescence Evaluation in Firestore to reflect resolution!
      try {
        const eqUpdate: any = {
          lastObsolescenceIndex: newIndex,
          lastObsolescenceLevel: newLevel,
          lastObsolescenceAction: 'Continuar operación (Obsolescencia Gestionada y Cerrada)',
          lastObsolescenceDate: now.split('T')[0]
        };
        if (resultingStatus) {
          eqUpdate.status = resultingStatus;
        }
        await updateDoc(doc(db, 'equipment', equipment.id), eqUpdate);
      } catch (eqErr) {
        console.warn("Notice: Equipment doc update skipped due to permissions:", eqErr);
      }

      // Also update existing obsolescence evaluation record if it exists
      if (existingEvaluation) {
        try {
          const updatedEval = {
            ...existingEvaluation,
            index: newIndex,
            level: newLevel,
            action: 'Continuar operación (Obsolescencia Gestionada y Cerrada)',
            observations: `${existingEvaluation.observations || ''}\n[CIERRE DE OBSOLESCENCIA ${now.split('T')[0]}]: ${technicalConclusion.trim()}`.trim(),
            updatedAt: now
          };
          await setDoc(doc(db, 'obsolescence_evaluations', `obs-${equipment.id}`), cleanFirestoreData(updatedEval));
        } catch (evalErr) {
          console.warn("Notice: Evaluation update skipped due to permissions:", evalErr);
        }
      }

      // 6. Trigger immediate local download of the signed closure PDF
      generateObsolescenceCasePDF(finalCaseObj, false);

      if (onCaseSaved) onCaseSaved(finalCaseObj);
    } catch (err: any) {
      console.error('Error closing obsolescence case:', err);
      setErrorMsg(err.message || 'Error al procesar el cierre del caso.');
    } finally {
      setLoading(false);
    }
  };

  const effectiveCase = savedCase || existingCase;
  const isClosed = effectiveCase?.status === 'cerrado' || !!effectiveCase?.resolution?.closedAt || !!driveSuccessUrl;
  const initialEvalStyles = getObsolescenceLevelStyles(existingEvaluation?.level || 'Alto');

  const getCaseForPdfDownload = (): ObsolescenceCase => {
    if (effectiveCase) return effectiveCase;
    const now = new Date().toISOString();
    return {
      id: caseNumber || `obs-case-${Date.now()}`,
      caseNumber: caseNumber || `CASO-OBS-${new Date().getFullYear()}-001`,
      equipmentId: equipment?.id || '',
      equipmentCode: equipment?.assetNumber || 'N/A',
      equipmentName: equipment?.name || 'Equipo Biomédico',
      brand: equipment?.brand || '',
      model: equipment?.model || '',
      serial: equipment?.serial || '',
      serviceId: equipment?.serviceId || '',
      serviceName: equipment?.serviceName || 'Sin Servicio',
      technologyScope: equipment?.technologyScope || 'biomedical',
      status: 'cerrado',
      managementType,
      title: title.trim(),
      justification: justification.trim(),
      priority,
      initialEvaluation: {
        evaluationId: existingEvaluation?.id || `obs-${equipment?.id || 'eq'}`,
        index: existingEvaluation?.index || 4.2,
        level: existingEvaluation?.level || 'Crítico',
        priority: existingEvaluation?.priority || 'Crítica',
        action: existingEvaluation?.action || 'Intervención técnica',
        evaluationDate: existingEvaluation?.evaluationDate || now.split('T')[0]
      },
      interventions,
      resolution: {
        closureType,
        technicalConclusion: technicalConclusion.trim() || 'Gestión técnica y cierre de obsolescencia satisfactorio.',
        resultingStatus,
        newEvaluationIndex: 1.85,
        newLevel: 'Bajo',
        closedBy: user?.displayName || user?.email || 'Líder de Ingeniería Biomédica',
        closedByRole: user?.role === 'ADMIN' ? 'Líder de Ingeniería Biomédica / Calidad' : 'Ingeniero Biomédico',
        closedAt: now,
        pdfUrl: driveSuccessUrl || undefined
      },
      totalCost,
      createdBy: user?.displayName || user?.email || 'Ingeniero Biomédico',
      createdAt: now,
      updatedAt: now
    };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[94vh] overflow-y-auto p-0 rounded-3xl border-slate-200">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 bg-slate-900 text-white rounded-t-3xl border-b border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/70 px-2 py-0.5 rounded-md border border-emerald-500/30">
                  GTE-FOR-OBS-001
                </span>
                <span className="text-xs text-slate-400">UCI Honda • Medicina Intensiva del Tolima</span>
              </div>
              <DialogTitle className="text-xl font-black text-white flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-emerald-400" />
                Caso de Gestión de Obsolescencia Tecnológica
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-300">
                {equipment?.name} • Serie: <span className="font-semibold text-white">{equipment?.serial || 'S/N'}</span> • Placa: <span className="font-semibold text-white">{equipment?.assetNumber || 'N/A'}</span>
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Badge className={cn(
                "text-xs font-black px-3 py-1.5 border shadow-sm",
                isClosed 
                  ? "bg-emerald-500 text-white border-emerald-600" 
                  : "bg-amber-500 text-white border-amber-600"
              )}>
                {isClosed ? '✓ CASO CERRADO Y RESUELTO' : '⚙ EN GESTIÓN'}
              </Badge>
              <span className="text-xs font-mono text-slate-300 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                {caseNumber}
              </span>
            </div>
          </div>
        </DialogHeader>

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {driveSuccessUrl && (
          <div className="mx-6 mt-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2.5">
              <HardDrive className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold text-emerald-900">Acta PDF de Cierre Sincronizada con Google Drive</p>
                <p className="text-[11px] text-emerald-700">El expediente completo fue archivado con éxito en la carpeta institucional de Obsolescencia.</p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => window.open(driveSuccessUrl, '_blank')}
              className="bg-white border-emerald-300 text-emerald-800 hover:bg-emerald-100 font-bold text-xs shrink-0 rounded-xl"
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              Ver en Drive
            </Button>
          </div>
        )}

        <div className="p-6 pt-4 space-y-6">
          <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-slate-100 p-1 rounded-2xl h-11">
              <TabsTrigger value="summary" className="rounded-xl font-bold text-xs uppercase tracking-wider">
                1. Diagnóstico y Plan
              </TabsTrigger>
              <TabsTrigger value="interventions" className="rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                2. Evidencias y Costos ({interventions.length})
              </TabsTrigger>
              <TabsTrigger value="closure" className={cn(
                "rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-1.5",
                isClosed && "text-emerald-700"
              )}>
                {isClosed ? '✓ Dictamen de Cierre' : '3. Dictamen y Cierre'}
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: SUMMARY & DIAGNOSIS */}
            <TabsContent value="summary" className="space-y-5 pt-4">
              {/* Resumen del diagnóstico previo */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Evaluación Previa de Obsolescencia
                  </span>
                  <Badge variant="outline" className={`text-xs font-black border ${initialEvalStyles.badgeBg}`}>
                    {existingEvaluation?.level || 'N/A'} (Índice: {existingEvaluation?.index || 'N/A'} / 5.0)
                  </Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Servicio Clínico:</span>
                    <span className="font-bold text-slate-800">{equipment?.serviceName || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Acción Recomendada:</span>
                    <span className="font-bold text-slate-800">{existingEvaluation?.action || 'Intervención / Renovación'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Prioridad Inicial:</span>
                    <span className="font-bold text-slate-800">{existingEvaluation?.priority || 'Alta'}</span>
                  </div>
                </div>
              </div>

              {/* Form fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Modalidad de Gestión de Obsolescencia *</Label>
                  <Select
                    disabled={isClosed}
                    value={managementType}
                    onValueChange={(val: any) => setManagementType(val)}
                  >
                    <SelectTrigger className="rounded-xl bg-white border-slate-200">
                      <SelectValue placeholder="Seleccione modalidad" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="Mantenimiento Correctivo Mayor / Actualización">Mantenimiento Correctivo Mayor / Actualización</SelectItem>
                      <SelectItem value="Repotenciación / Overhaul">Repotenciación / Overhaul Tecnológico</SelectItem>
                      <SelectItem value="Renovación / Reposición">Renovación / Adquisición de Equipo Nuevo</SelectItem>
                      <SelectItem value="Baja y Retiro Definitivo">Baja Definitiva y Desincorporación</SelectItem>
                      <SelectItem value="Mitigación y Reasignación">Mitigación Técnica y Reasignación</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Nivel de Prioridad del Caso *</Label>
                  <Select
                    disabled={isClosed}
                    value={priority}
                    onValueChange={(val: any) => setPriority(val)}
                  >
                    <SelectTrigger className="rounded-xl bg-white border-slate-200">
                      <SelectValue placeholder="Prioridad" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="Crítica">Crítica (Intervención Inmediata)</SelectItem>
                      <SelectItem value="Alta">Alta (Corto Plazo)</SelectItem>
                      <SelectItem value="Media">Media (Mediano Plazo)</SelectItem>
                      <SelectItem value="Baja">Baja (Monitoreo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Título / Objetivo del Caso *</Label>
                <Input
                  disabled={isClosed}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Repotenciación de pantalla y actualización de firmware..."
                  className="rounded-xl bg-white border-slate-200 font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Justificación Técnica y Antecedentes Críticos *</Label>
                <Textarea
                  disabled={isClosed}
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  rows={4}
                  placeholder="Explique detalladamente por qué el equipo requirió gestión de obsolescencia (fallas recurrentes, falta de repuestos, advertencias del fabricante, eventos adversos)..."
                  className="rounded-xl bg-white border-slate-200 text-xs"
                />
              </div>
            </TabsContent>

            {/* TAB 2: INTERVENTIONS & QUOTES */}
            <TabsContent value="interventions" className="space-y-5 pt-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Presupuesto e Inversión Total Ejecutada
                  </span>
                  <span className="text-2xl font-black text-slate-900">
                    ${totalCost.toLocaleString('es-CO')} <span className="text-xs text-slate-500 font-normal">COP</span>
                  </span>
                </div>
                {!isClosed && (
                  <Button
                    type="button"
                    onClick={() => setShowAddIntervention(true)}
                    className="rounded-xl font-bold bg-primary hover:bg-primary/90 text-xs h-9 px-4"
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Registrar Cotización / Mantenimiento
                  </Button>
                )}
              </div>

              {/* Form to add intervention */}
              {showAddIntervention && !isClosed && (
                <Card className="rounded-2xl border-primary/30 shadow-md bg-blue-50/30">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-blue-100 pb-2">
                      <h4 className="text-xs font-black uppercase tracking-wide text-slate-800 flex items-center gap-1.5">
                        <Plus className="h-4 w-4 text-primary" />
                        Nueva Evidencia o Acción Desarrollada
                      </h4>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAddIntervention(false)}
                        className="h-7 text-xs text-slate-500 hover:text-slate-800"
                      >
                        Cancelar
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-slate-700">Tipo de Evidencia *</Label>
                        <Select value={intType} onValueChange={(val: any) => setIntType(val)}>
                          <SelectTrigger className="h-9 rounded-xl bg-white border-slate-200 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="cotizacion">Cotización / Propuesta Económica</SelectItem>
                            <SelectItem value="mantenimiento">Mantenimiento Correctivo / Especial</SelectItem>
                            <SelectItem value="actualizacion">Actualización de Software / Firmware</SelectItem>
                            <SelectItem value="reemplazo">Reemplazo de Repuestos / Partes</SelectItem>
                            <SelectItem value="inspeccion">Calibración / Prueba Metrológica</SelectItem>
                            <SelectItem value="otro">Otro Soporte Técnico</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-slate-700">Proveedor / Taller</Label>
                        <Input
                          value={intProvider}
                          onChange={(e) => setIntProvider(e.target.value)}
                          placeholder="Ej: Philips Colombia, Soporte Local..."
                          className="h-9 rounded-xl bg-white border-slate-200 text-xs"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-slate-700">No. Documento / Cotización</Label>
                        <Input
                          value={intDocNumber}
                          onChange={(e) => setIntDocNumber(e.target.value)}
                          placeholder="Ej: COT-2024-884, OT-120"
                          className="h-9 rounded-xl bg-white border-slate-200 text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-slate-700">Actividad / Título *</Label>
                        <Input
                          value={intTitle}
                          onChange={(e) => setIntTitle(e.target.value)}
                          placeholder="Ej: Cotización de cambio de transductor y batería..."
                          className="h-9 rounded-xl bg-white border-slate-200 text-xs font-semibold"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-slate-700">Costo ($ COP)</Label>
                        <Input
                          type="number"
                          value={intCost}
                          onChange={(e) => setIntCost(e.target.value)}
                          placeholder="0"
                          className="h-9 rounded-xl bg-white border-slate-200 text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-slate-700">Detalle / Hallazgos Técnicos</Label>
                      <Textarea
                        value={intDescription}
                        onChange={(e) => setIntDescription(e.target.value)}
                        rows={2}
                        placeholder="Descripción de la intervención, repuestos instalados o condiciones de la cotización..."
                        className="rounded-xl bg-white border-slate-200 text-xs"
                      />
                    </div>

                    {/* Attachment / Drive */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-slate-700">Subir Archivo de Soporte (Google Drive)</Label>
                        <div className="flex items-center gap-2">
                          <label className={cn(
                            "flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-slate-300 bg-white hover:bg-slate-50 cursor-pointer text-xs font-bold text-slate-700 w-full transition-colors",
                            uploadingIntFile && "opacity-50 cursor-not-allowed"
                          )}>
                            {uploadingIntFile ? (
                              <><Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Subiendo a Drive...</>
                            ) : (
                              <><Upload className="h-3.5 w-3.5 text-primary" /> Seleccionar PDF / Imagen</>
                            )}
                            <input
                              type="file"
                              className="hidden"
                              accept=".pdf,image/*"
                              disabled={uploadingIntFile}
                              onChange={handleFileUploadToDrive}
                            />
                          </label>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-slate-700">O Enlace Web del Documento (Drive / Web)</Label>
                        <Input
                          value={intFileUrl}
                          onChange={(e) => setIntFileUrl(e.target.value)}
                          placeholder="https://drive.google.com/..."
                          className="h-9 rounded-xl bg-white border-slate-200 text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        onClick={handleAddIntervention}
                        className="rounded-xl font-bold text-xs h-9 px-5 bg-slate-900 hover:bg-slate-800 text-white"
                      >
                        Guardar Intervención en el Caso
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Interventions list */}
              {interventions.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-bold text-slate-600">Aún no hay cotizaciones o mantenimientos registrados en este caso.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Haga clic en el botón superior para adjuntar las cotizaciones y mantenimientos realizados.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {interventions.map((it, idx) => (
                    <div
                      key={it.id || idx}
                      className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[9px] font-black uppercase tracking-wider bg-slate-50 border-slate-300">
                            {it.type.toUpperCase()}
                          </Badge>
                          <span className="text-xs font-black text-slate-900 truncate">
                            {it.title}
                          </span>
                          {it.documentNumber && (
                            <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              Doc: {it.documentNumber}
                            </span>
                          )}
                        </div>
                        {it.description && (
                          <p className="text-xs text-slate-600 line-clamp-2">{it.description}</p>
                        )}
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium">
                          <span>Fecha: {it.date}</span>
                          {it.provider && <span>• Proveedor: {it.provider}</span>}
                          {it.recordedBy && <span>• Registrado por: {it.recordedBy}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span className="text-xs font-black text-slate-900 block font-mono">
                            ${(it.cost || 0).toLocaleString('es-CO')}
                          </span>
                          <span className="text-[9px] uppercase font-bold text-slate-400">COP</span>
                        </div>

                        {it.fileUrl && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(it.fileUrl, '_blank')}
                            className="h-8 text-xs font-bold text-primary hover:bg-primary/10 rounded-xl"
                            title="Abrir soporte en Drive"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        )}

                        {!isClosed && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveIntervention(it.id)}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* TAB 3: CLOSURE & RESOLUTION */}
            <TabsContent value="closure" className="space-y-5 pt-4">
              {isClosed ? (
                /* Closed View */
                <div className="space-y-4">
                  <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-3 shadow-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                      <div>
                        <h4 className="text-sm font-black text-emerald-950">Caso Cerrado y Dictaminado Exitosamente</h4>
                        <p className="text-xs text-emerald-800">
                          Cerrado el {effectiveCase?.resolution?.closedAt ? format(new Date(effectiveCase.resolution.closedAt), 'yyyy-MM-dd HH:mm') : format(new Date(), 'yyyy-MM-dd')} por <span className="font-bold">{effectiveCase?.resolution?.closedBy || user?.displayName || user?.email || 'Líder de Ingeniería Biomédica'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2 border-t border-emerald-200">
                      <div>
                        <span className="text-emerald-700 block text-[10px] uppercase font-bold">Modalidad de Cierre:</span>
                        <span className="font-black text-emerald-950">{effectiveCase?.resolution?.closureType || closureType}</span>
                      </div>
                      <div>
                        <span className="text-emerald-700 block text-[10px] uppercase font-bold">Estado Resultante:</span>
                        <span className="font-black text-emerald-950">{(effectiveCase?.resolution?.resultingStatus || resultingStatus) === 'baja' ? 'Dado de Baja' : 'Activo y Seguro'}</span>
                      </div>
                      <div>
                        <span className="text-emerald-700 block text-[10px] uppercase font-bold">Nuevo Nivel Resultante:</span>
                        <span className="font-black text-emerald-950">{effectiveCase?.resolution?.newLevel || 'Bajo'} (Índice: {effectiveCase?.resolution?.newEvaluationIndex || '1.85'})</span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <span className="text-emerald-700 block text-[10px] uppercase font-bold">Dictamen Técnico y Conclusiones:</span>
                      <p className="text-xs text-emerald-900 mt-1 whitespace-pre-line bg-white/70 p-3 rounded-xl border border-emerald-200">
                        {effectiveCase?.resolution?.technicalConclusion || technicalConclusion}
                      </p>
                    </div>
                  </div>

                  {/* Actions for closed case */}
                  <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const caseToPrint = getCaseForPdfDownload();
                        generateObsolescenceCasePDF(caseToPrint, false);
                      }}
                      className="rounded-xl font-bold text-xs h-10 border-slate-300 hover:bg-slate-50 cursor-pointer"
                    >
                      <Download className="h-4 w-4 mr-1.5" />
                      Descargar Acta de Cierre PDF
                    </Button>

                    {(effectiveCase?.resolution?.pdfUrl || effectiveCase?.pdfUrl || driveSuccessUrl) && (
                      <Button
                        type="button"
                        onClick={() => {
                          const url = effectiveCase?.resolution?.pdfUrl || effectiveCase?.pdfUrl || driveSuccessUrl;
                          if (url) window.open(url, '_blank');
                        }}
                        className="rounded-xl font-bold text-xs h-10 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
                      >
                        <HardDrive className="h-4 w-4 mr-1.5" />
                        Abrir en Google Drive
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                /* Form to Close the Case */
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 space-y-2 text-xs">
                    <div className="flex items-center gap-2 font-bold text-amber-900">
                      <Sparkles className="h-4 w-4 text-amber-600" />
                      Cierre Formal y Generación de Acta Institucional
                    </div>
                    <p className="text-amber-800 leading-relaxed">
                      Al finalizar y cerrar este caso, el sistema generará automáticamente el <strong>Acta Oficial de Cierre de Obsolescencia Tecnológica (GTE-FOR-OBS-001)</strong>, la archivará en <strong>Google Drive</strong> en la carpeta de Obsolescencia, y recalificará la tecnología para que no siga en estado crítico en la matriz.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700">Modalidad de Cierre Técnico *</Label>
                      <Select
                        value={closureType}
                        onValueChange={(val: any) => setClosureType(val)}
                      >
                        <SelectTrigger className="rounded-xl bg-white border-slate-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="Repotenciación / Actualización Exitosa">Repotenciación / Actualización Exitosa (Superada)</SelectItem>
                          <SelectItem value="Renovación / Reposición Total">Renovación Total por Equipo Nuevo Adquirido</SelectItem>
                          <SelectItem value="Baja y Desincorporación">Baja Definitiva y Retiro de Operación</SelectItem>
                          <SelectItem value="Riesgo Técnico Mitigado">Riesgo Técnico Mitigado y Operación Segura</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700">Estado Operativo Resultante del Equipo *</Label>
                      <Select
                        value={resultingStatus}
                        onValueChange={(val: any) => setResultingStatus(val)}
                      >
                        <SelectTrigger className="rounded-xl bg-white border-slate-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="active">Activo y Operativo (Disponible para el Servicio)</SelectItem>
                          <SelectItem value="out_of_service">Fuera de Servicio (En Espera)</SelectItem>
                          <SelectItem value="baja">Dado de Baja Definitiva</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Dictamen Técnico Final y Conclusiones de Cierre *</Label>
                    <Textarea
                      value={technicalConclusion}
                      onChange={(e) => setTechnicalConclusion(e.target.value)}
                      rows={5}
                      placeholder="Redacte las conclusiones técnicas: detalle las intervenciones ejecutadas, pruebas de funcionamiento aprobadas, calibración conforme, repuestos instalados o datos del equipo nuevo que reemplazó al activo..."
                      className="rounded-xl bg-white border-slate-200 text-xs"
                    />
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">Actualizar Matriz de Obsolescencia automáticamente</span>
                      <span className="text-[11px] text-slate-500">
                        Disminuye el índice de riesgo de {existingEvaluation?.index || 4.2} a 1.85 (Nivel Bajo) reflejando que la criticidad ya fue resuelta.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={recalculateToSafeLevel}
                      onChange={(e) => setRecalculateToSafeLevel(e.target.checked)}
                      className="h-4 w-4 rounded text-primary focus:ring-primary"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      type="button"
                      disabled={loading || !technicalConclusion.trim()}
                      onClick={handleCloseCase}
                      className="rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-11 px-6 shadow-md transition-all hover:scale-105"
                    >
                      {loading ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Procesando Cierre y Drive...</>
                      ) : (
                        <><CheckCircle2 className="h-4 w-4 mr-2" /> Finalizar y Cerrar Caso (Acta PDF + Drive)</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 bg-slate-50 border-t border-slate-100 rounded-b-3xl flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl font-bold text-xs"
          >
            Cerrar Ventana
          </Button>

          {!isClosed && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={handleSaveDraft}
                className="rounded-xl font-bold text-xs border-slate-300 hover:bg-slate-100"
              >
                Guardar Borrador / En Gestión
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
