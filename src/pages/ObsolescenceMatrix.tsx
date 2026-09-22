import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Equipment,
  MaintenanceReport,
  Service,
  ObsolescenceEvaluation,
  DimensionId,
  DIMENSION_CONFIGS,
  ObsolescenceLevel,
  ObsolescenceHorizon
} from '@/types';
import {
  generateFullObsolescenceEvaluation,
  getObsolescenceLevelStyles,
  calculateInstitutionalIndicators,
  calculateObsolescenceIndex,
  classifyObsolescence
} from '@/lib/obsolescence-calculator';
import { db, cleanFirestoreData } from '@/lib/firebase';
import { collection, onSnapshot, query, doc, setDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { ObsolescenceEvaluationModal } from '@/components/obsolescence/ObsolescenceEvaluationModal';
import { ConfirmModal, FeedbackModal } from '@/components/ui/ConfirmModal';
import {
  Gauge,
  Search,
  Filter,
  Download,
  Printer,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpDown,
  ExternalLink,
  PlusCircle,
  FileSpreadsheet,
  Building2,
  TrendingUp,
  DollarSign,
  Layers,
  BookOpen,
  X,
  Trash2,
  Calendar,
  User,
  History as HistoryIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function ObsolescenceMatrix() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [equipments, setEquipments] = React.useState<Equipment[]>([]);
  const [reports, setReports] = React.useState<MaintenanceReport[]>([]);
  const [services, setServices] = React.useState<Service[]>([]);
  const [savedEvaluations, setSavedEvaluations] = React.useState<Record<string, ObsolescenceEvaluation>>({});
  const [loading, setLoading] = React.useState(true);

  // Filtros de búsqueda
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedService, setSelectedService] = React.useState<string>('all');
  const [selectedLevel, setSelectedLevel] = React.useState<string>('all');
  const [selectedHorizon, setSelectedHorizon] = React.useState<string>('all');
  const [sortBy, setSortBy] = React.useState<'index_desc' | 'index_asc' | 'name' | 'service'>('index_desc');

  // Modal de evaluación
  const [selectedEquipmentForEval, setSelectedEquipmentForEval] = React.useState<Equipment | null>(null);
  const [isEvaluationModalOpen, setIsEvaluationModalOpen] = React.useState(false);

  // Estado para nuevo seguimiento (Pág. 3)
  const [newFollowUpEquipmentId, setNewFollowUpEquipmentId] = React.useState('');
  const [followUpSearchQuery, setFollowUpSearchQuery] = React.useState('');
  const [isFollowUpSearchOpen, setIsFollowUpSearchOpen] = React.useState(false);
  const [followUpFilterPriorityOnly, setFollowUpFilterPriorityOnly] = React.useState(false);
  const followUpDropdownRef = React.useRef<HTMLDivElement>(null);

  const [newFollowUpActivity, setNewFollowUpActivity] = React.useState('');
  const [newFollowUpResult, setNewFollowUpResult] = React.useState('');
  const [newFollowUpAction, setNewFollowUpAction] = React.useState('');
  const [submittingFollowUp, setSubmittingFollowUp] = React.useState(false);
  const [followUpTableSearch, setFollowUpTableSearch] = React.useState('');

  // Modales in-app de confirmación y retroalimentación (evitando window.alert y window.confirm)
  const [deleteConfirmTarget, setDeleteConfirmTarget] = React.useState<{
    equipmentId: string;
    followUpId: string;
    equipmentName: string;
  } | null>(null);
  const [isDeletingFollowUp, setIsDeletingFollowUp] = React.useState(false);

  const [feedbackModal, setFeedbackModal] = React.useState<{
    isOpen: boolean;
    title: string;
    description: string;
    type: 'success' | 'error' | 'warning' | 'info';
  } | null>(null);

  const showFeedback = (
    title: string,
    description: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'info'
  ) => {
    setFeedbackModal({ isOpen: true, title, description, type });
  };

  // Cerrar desplegable de búsqueda al hacer clic por fuera
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (followUpDropdownRef.current && !followUpDropdownRef.current.contains(event.target as Node)) {
        setIsFollowUpSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cargar datos en tiempo real de Firestore
  React.useEffect(() => {
    const unsubEq = onSnapshot(collection(db, 'equipment'), (snap) => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as Equipment));
      setEquipments(list);
    });

    const unsubRep = onSnapshot(collection(db, 'reports'), (snap) => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as MaintenanceReport));
      setReports(list);
    });

    const unsubSvc = onSnapshot(collection(db, 'services'), (snap) => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as Service));
      setServices(list);
    });

    const unsubObs = onSnapshot(collection(db, 'obsolescence_evaluations'), (snap) => {
      const map: Record<string, ObsolescenceEvaluation> = {};
      snap.docs.forEach(d => {
        const data = d.data() as ObsolescenceEvaluation;
        map[data.equipmentId] = { ...data, id: d.id };
      });
      setSavedEvaluations(map);
      setLoading(false);
    });

    return () => {
      unsubEq();
      unsubRep();
      unsubSvc();
      unsubObs();
    };
  }, []);

  // Consolidar todas las evaluaciones (guardadas o auto-calculadas dinámicamente)
  const allEvaluations: ObsolescenceEvaluation[] = React.useMemo(() => {
    return equipments.map(eq => {
      if (savedEvaluations[eq.id]) {
        return savedEvaluations[eq.id];
      }
      const eqReports = reports.filter(r => r.equipmentId === eq.id);
      return generateFullObsolescenceEvaluation(eq, eqReports, {
        id: user?.uid || 'sys',
        name: user?.displayName || 'Ingeniero Biomédico'
      });
    });
  }, [equipments, reports, savedEvaluations, user]);

  // Indicadores institucionales de gestión GTE-GUI-003
  const indicators = React.useMemo(() => {
    return calculateInstitutionalIndicators(allEvaluations, equipments.length);
  }, [allEvaluations, equipments.length]);

  // Filtrado y ordenamiento de la lista
  const filteredEvaluations = React.useMemo(() => {
    return allEvaluations
      .filter(ev => {
        // Filtro por texto
        const search = searchTerm.toLowerCase();
        const matchesText = 
          ev.equipmentName.toLowerCase().includes(search) ||
          ev.equipmentCode.toLowerCase().includes(search) ||
          ev.serial.toLowerCase().includes(search) ||
          ev.brand.toLowerCase().includes(search) ||
          ev.model.toLowerCase().includes(search);

        // Filtro por servicio
        const matchesService = selectedService === 'all' || ev.serviceId === selectedService;

        // Filtro por nivel
        const matchesLevel = selectedLevel === 'all' || ev.level === selectedLevel;

        // Filtro por horizonte
        const matchesHorizon = selectedHorizon === 'all' || ev.horizon === selectedHorizon;

        return matchesText && matchesService && matchesLevel && matchesHorizon;
      })
      .sort((a, b) => {
        if (sortBy === 'index_desc') return b.index - a.index;
        if (sortBy === 'index_asc') return a.index - b.index;
        if (sortBy === 'name') return a.equipmentName.localeCompare(b.equipmentName);
        if (sortBy === 'service') return a.serviceName.localeCompare(b.serviceName);
        return 0;
      });
  }, [allEvaluations, searchTerm, selectedService, selectedLevel, selectedHorizon, sortBy]);

  // Evaluaciones con plan de renovación (Página 2: Alto y Crítico)
  const renewalEvaluations = React.useMemo(() => {
    return allEvaluations.filter(ev => ev.level === 'Alto' || ev.level === 'Crítico');
  }, [allEvaluations]);

  // Seguimientos consolidados (Página 3)
  const followUpItems = React.useMemo(() => {
    const list: {
      evaluationId: string;
      equipmentId: string;
      equipmentName: string;
      equipmentCode: string;
      serial: string;
      serviceName: string;
      index: number;
      level: ObsolescenceLevel;
      action: string;
      followUp: any;
    }[] = [];

    allEvaluations.forEach(ev => {
      if (ev.followUps && ev.followUps.length > 0) {
        ev.followUps.forEach(f => {
          list.push({
            evaluationId: ev.id,
            equipmentId: ev.equipmentId,
            equipmentName: ev.equipmentName,
            equipmentCode: ev.equipmentCode,
            serial: ev.serial || 'S/N',
            serviceName: ev.serviceName,
            index: ev.index,
            level: ev.level,
            action: ev.action,
            followUp: f
          });
        });
      }
    });

    return list.sort((a, b) => new Date(b.followUp.date).getTime() - new Date(a.followUp.date).getTime());
  }, [allEvaluations]);

  // Seguimientos filtrados por búsqueda rápida
  const filteredFollowUpItems = React.useMemo(() => {
    if (!followUpTableSearch.trim()) return followUpItems;
    const q = followUpTableSearch.toLowerCase();
    return followUpItems.filter(item =>
      (item.equipmentName || '').toLowerCase().includes(q) ||
      (item.equipmentCode || '').toLowerCase().includes(q) ||
      (item.serial || '').toLowerCase().includes(q) ||
      (item.serviceName || '').toLowerCase().includes(q) ||
      (item.followUp.activity || '').toLowerCase().includes(q) ||
      (item.followUp.result || '').toLowerCase().includes(q) ||
      (item.followUp.responsibleName || '').toLowerCase().includes(q) ||
      ((item.followUp.newAction || item.action) || '').toLowerCase().includes(q)
    );
  }, [followUpItems, followUpTableSearch]);

  // Equipo seleccionado para seguimiento en Página 3
  const selectedFollowUpEval = React.useMemo(() => {
    return allEvaluations.find(ev => ev.equipmentId === newFollowUpEquipmentId);
  }, [allEvaluations, newFollowUpEquipmentId]);

  // Lista de tecnologías ordenadas alfabéticamente (A-Z) y filtradas para el seguimiento
  const sortedAndFilteredFollowUpEvaluations = React.useMemo(() => {
    let list = [...allEvaluations];

    // Orden alfabético estricto por nombre de equipo y serial
    list.sort((a, b) => {
      const cmp = (a.equipmentName || '').localeCompare(b.equipmentName || '', 'es', { sensitivity: 'base' });
      if (cmp !== 0) return cmp;
      return (a.serial || '').localeCompare(b.serial || '', 'es');
    });

    if (followUpFilterPriorityOnly) {
      list = list.filter(ev => ev.level === 'Alto' || ev.level === 'Crítico');
    }

    const q = followUpSearchQuery.trim().toLowerCase();
    if (!q) return list;

    return list.filter(ev => {
      const name = (ev.equipmentName || '').toLowerCase();
      const serial = (ev.serial || '').toLowerCase();
      const code = (ev.equipmentCode || '').toLowerCase();
      const service = (ev.serviceName || '').toLowerCase();
      const brand = (ev.brand || '').toLowerCase();
      const model = (ev.model || '').toLowerCase();
      return name.includes(q) || serial.includes(q) || code.includes(q) || service.includes(q) || brand.includes(q) || model.includes(q);
    });
  }, [allEvaluations, followUpSearchQuery, followUpFilterPriorityOnly]);

  // Abrir modal de evaluación para un equipo específico
  const handleOpenEvalModal = (equipmentId: string) => {
    const targetEq = equipments.find(e => e.id === equipmentId);
    if (targetEq) {
      setSelectedEquipmentForEval(targetEq);
      setIsEvaluationModalOpen(true);
    }
  };

  // Registrar un nuevo seguimiento institucional
  const handleCreateFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFollowUpEquipmentId || !newFollowUpActivity || !newFollowUpResult) {
      showFeedback(
        'Campos Incompletos',
        'Por favor seleccione una tecnología biomédica e ingrese tanto la actividad realizada como el resultado obtenido.',
        'warning'
      );
      return;
    }

    setSubmittingFollowUp(true);
    try {
      const evalId = `obs-${newFollowUpEquipmentId}`;
      const targetEval = allEvaluations.find(ev => ev.equipmentId === newFollowUpEquipmentId);
      if (!targetEval) return;

      const newEntry = {
        id: `fu-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        responsibleName: user?.displayName || 'Ingeniero Biomédico',
        activity: newFollowUpActivity,
        result: newFollowUpResult,
        newAction: newFollowUpAction || targetEval.action
      };

      const updatedFollowUps = [...(targetEval.followUps || []), newEntry];

      await setDoc(doc(db, 'obsolescence_evaluations', evalId), cleanFirestoreData({
        ...targetEval,
        followUps: updatedFollowUps,
        updatedAt: new Date().toISOString()
      }), { merge: true });

      setNewFollowUpEquipmentId('');
      setFollowUpSearchQuery('');
      setIsFollowUpSearchOpen(false);
      setNewFollowUpActivity('');
      setNewFollowUpResult('');
      setNewFollowUpAction('');
      showFeedback(
        'Seguimiento Registrado',
        'La gestión y sus acuerdos han sido guardados exitosamente en la bitácora institucional (GTE-MTX-001).',
        'success'
      );
    } catch (err) {
      console.error('Error guardando seguimiento:', err);
      showFeedback(
        'Error al Guardar',
        'Ocurrió un error al intentar registrar el seguimiento. Por favor intente nuevamente.',
        'error'
      );
    } finally {
      setSubmittingFollowUp(false);
    }
  };

  // Ejecutar eliminación confirmada in-app
  const handleExecuteDeleteFollowUp = async () => {
    if (!deleteConfirmTarget) return;
    setIsDeletingFollowUp(true);
    try {
      const { equipmentId, followUpId, equipmentName } = deleteConfirmTarget;
      const evalId = `obs-${equipmentId}`;
      const targetEval = allEvaluations.find(ev => ev.equipmentId === equipmentId);
      if (!targetEval) return;

      const updatedFollowUps = (targetEval.followUps || []).filter((fu: any) => fu.id !== followUpId);

      await setDoc(doc(db, 'obsolescence_evaluations', evalId), cleanFirestoreData({
        ...targetEval,
        followUps: updatedFollowUps,
        updatedAt: new Date().toISOString()
      }), { merge: true });

      setDeleteConfirmTarget(null);
      showFeedback(
        'Registro Eliminado',
        `El registro de seguimiento para "${equipmentName || 'la tecnología'}" fue eliminado exitosamente.`,
        'success'
      );
    } catch (err) {
      console.error('Error eliminando seguimiento:', err);
      showFeedback(
        'Error al Eliminar',
        'No fue posible eliminar el registro de seguimiento. Por favor intente de nuevo.',
        'error'
      );
    } finally {
      setIsDeletingFollowUp(false);
    }
  };

  // Exportar a CSV compatible con Excel en Español (con BOM \uFEFF)
  const handleExportCSV = () => {
    const headers = [
      'Número de Serie',
      'Tecnología Biomédica',
      'Servicio Asignado',
      'Marca',
      'Modelo',
      'Código / Placa',
      'Años en Servicio',
      'Vida Útil (Años)',
      'Clase Riesgo',
      'Clínica (20%)',
      'Técnica (20%)',
      'Mantenimiento (15%)',
      'Riesgo y Seguridad (15%)',
      'Económica (10%)',
      'Soporte Tecnológico (10%)',
      'Ambiental (5%)',
      'Regulatoria (5%)',
      'Índice de Obsolescencia (IO)',
      'Nivel de Obsolescencia',
      'Acción Definida',
      'Prioridad',
      'Horizonte',
      'Año Proyectado Renovación',
      'Costo Estimado Reposición',
      'Fuente Financiación',
      'Estado Plan'
    ];

    const rows = filteredEvaluations.map(ev => [
      `"${(ev.serial || 'S/N').replace(/"/g, '""')}"`,
      `"${ev.equipmentName.replace(/"/g, '""')}"`,
      `"${ev.serviceName.replace(/"/g, '""')}"`,
      `"${ev.brand.replace(/"/g, '""')}"`,
      `"${ev.model.replace(/"/g, '""')}"`,
      `"${(ev.equipmentCode || '').replace(/"/g, '""')}"`,
      ev.yearsInService,
      ev.usefulLifeYears,
      ev.riskClass,
      ev.scores.clinical?.score || 1,
      ev.scores.technical?.score || 1,
      ev.scores.maintenance?.score || 1,
      ev.scores.risk?.score || 1,
      ev.scores.economic?.score || 1,
      ev.scores.support?.score || 1,
      ev.scores.environmental?.score || 1,
      ev.scores.regulatory?.score || 1,
      ev.index,
      `"${ev.level}"`,
      `"${ev.action}"`,
      `"${ev.priority}"`,
      `"${ev.horizon}"`,
      ev.projectedYear,
      ev.renewalPlan?.estimatedCost || 0,
      `"${ev.renewalPlan?.fundingSource || ''}"`,
      `"${ev.renewalPlan?.status || 'No aplica'}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `GTE-MTX-001_Matriz_Obsolescencia_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Generar Informe PDF Institucional con jsPDF y autoTable
  const handleGeneratePDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // Encabezado institucional
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 297, 24, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('MEDICINA INTENSIVA DEL TOLIMA S.A. - UCI HONDA', 14, 10);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('GTE-MTX-001-V1 | MATRIZ DE EVALUACIÓN Y GESTIÓN DE OBSOLESCENCIA BIOMÉDICA', 14, 16);

    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-CO')} | Evaluadas: ${indicators.totalEvaluated}/${indicators.totalScheduled}`, 210, 16);

    // Resumen de Indicadores
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`Cumplimiento de Evaluación: ${indicators.complianceRate}% | Tecnologías con Renovación Priorizada: ${indicators.totalPrioritizedRenewal} (${indicators.renewalRate}%) | Presupuesto Total: $${indicators.totalEstimatedRenewalBudget.toLocaleString('es-CO')} COP`, 14, 32);

    const tableData = filteredEvaluations.map(ev => [
      ev.serial || 'S/N',
      ev.equipmentName,
      ev.serviceName,
      `${ev.brand} ${ev.model}`,
      ev.riskClass,
      `${ev.yearsInService}a / ${ev.usefulLifeYears}a`,
      `${ev.scores.clinical?.score || 1}`,
      `${ev.scores.technical?.score || 1}`,
      `${ev.scores.maintenance?.score || 1}`,
      `${ev.scores.risk?.score || 1}`,
      `${ev.scores.economic?.score || 1}`,
      `${ev.scores.support?.score || 1}`,
      `${ev.scores.environmental?.score || 1}`,
      `${ev.scores.regulatory?.score || 1}`,
      `${ev.index}`,
      ev.level,
      ev.action,
      `${ev.horizon} (${ev.projectedYear})`
    ]);

    autoTable(doc, {
      startY: 36,
      head: [[
        'N° Serie',
        'Tecnología',
        'Servicio',
        'Marca/Modelo',
        'Riesgo',
        'Uso/Vida',
        'Clín.',
        'Técn.',
        'Mant.',
        'Riesg.',
        'Econ.',
        'Sop.',
        'Amb.',
        'Reg.',
        'IO',
        'Nivel',
        'Acción',
        'Horizonte'
      ]],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: 255,
        fontSize: 7,
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 6.5,
        cellPadding: 1.5
      },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 28 },
        2: { cellWidth: 20 },
        3: { cellWidth: 22 },
        4: { cellWidth: 12, halign: 'center' },
        5: { cellWidth: 15, halign: 'center' },
        6: { cellWidth: 8, halign: 'center' },
        7: { cellWidth: 8, halign: 'center' },
        8: { cellWidth: 8, halign: 'center' },
        9: { cellWidth: 8, halign: 'center' },
        10: { cellWidth: 8, halign: 'center' },
        11: { cellWidth: 8, halign: 'center' },
        12: { cellWidth: 8, halign: 'center' },
        13: { cellWidth: 8, halign: 'center' },
        14: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
        15: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
        16: { cellWidth: 42 },
        17: { cellWidth: 18, halign: 'center' }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 15) {
          const val = data.cell.raw as string;
          if (val === 'Crítico') data.cell.styles.textColor = [225, 29, 72];
          else if (val === 'Alto') data.cell.styles.textColor = [234, 88, 12];
          else if (val === 'Medio') data.cell.styles.textColor = [217, 119, 6];
          else if (val === 'Moderado') data.cell.styles.textColor = [2, 132, 199];
          else if (val === 'Bajo') data.cell.styles.textColor = [5, 150, 105];
        }
      }
    });

    doc.save(`Informe_GTE-MTX-001_Obsolescencia_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500 max-w-7xl mx-auto">
      {/* HEADER INSTITUCIONAL */}
      <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                GTE-GUI-003-V1 / GTE-MTX-001-V1
              </span>
              <span className="text-xs text-slate-400 font-medium">Medicina Intensiva del Tolima S.A.</span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-400 font-bold">UCI Honda</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Matriz de Evaluación y Gestión de la Obsolescencia Biomédica
            </h1>
            <p className="text-sm text-slate-300 max-w-3xl leading-relaxed">
              Sistema de soporte a la planeación de reposición, renovación tecnológica e intervención técnica basada en 8 dimensiones ponderadas con trazabilidad de mantenimiento, calibración y seguridad del paciente.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              onClick={handleExportCSV}
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-xl text-xs font-bold h-11 px-4"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-400" />
              Exportar Matriz (.CSV / Excel)
            </Button>
            <Button
              onClick={handleGeneratePDF}
              className="bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-black h-11 px-4 shadow-md"
            >
              <Printer className="h-4 w-4 mr-2" />
              Generar Informe Oficial PDF
            </Button>
          </div>
        </div>
      </div>

      {/* 4 KPIS INSTITUCIONALES (GTE-GUI-003 Pág. 4) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cumplimiento de Evaluación */}
        <Card className="rounded-2xl border border-slate-200/80 shadow-xs">
          <CardHeader className="p-5 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Cumplimiento Evaluación
              </span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{indicators.complianceRate}%</span>
              <span className="text-xs text-slate-400 font-semibold">Meta: ≥ 95%</span>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              {indicators.totalEvaluated} de {indicators.totalScheduled} tecnologías evaluadas
            </p>
          </CardContent>
        </Card>

        {/* Tasa de Renovación Priorizada */}
        <Card className="rounded-2xl border border-slate-200/80 shadow-xs">
          <CardHeader className="p-5 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Renovación Priorizada
              </span>
              <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-rose-600">{indicators.renewalRate}%</span>
              <span className="text-xs text-slate-400 font-semibold">{indicators.totalPrioritizedRenewal} equipos</span>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Niveles Alto o Crítico proyectados a corto plazo
            </p>
          </CardContent>
        </Card>

        {/* Distribución por Niveles */}
        <Card className="rounded-2xl border border-slate-200/80 shadow-xs">
          <CardHeader className="p-5 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Estado Tecnológico
              </span>
              <div className="p-2 rounded-xl bg-sky-50 text-sky-600">
                <Gauge className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md" title="Bajo">
                {indicators.byLevelCount.Bajo} B
              </span>
              <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md" title="Moderado">
                {indicators.byLevelCount.Moderado} Mo
              </span>
              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md" title="Medio">
                {indicators.byLevelCount.Medio} Me
              </span>
              <span className="text-xs font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-md" title="Alto">
                {indicators.byLevelCount.Alto} A
              </span>
              <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md" title="Crítico">
                {indicators.byLevelCount.Crítico} C
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-2 font-medium">
              Segmentación en 5 niveles GTE-MTX-001
            </p>
          </CardContent>
        </Card>

        {/* Presupuesto Estimado de Reposición */}
        <Card className="rounded-2xl border border-slate-200/80 shadow-xs">
          <CardHeader className="p-5 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Presupuesto Estimado
              </span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-slate-900">
                ${(indicators.totalEstimatedRenewalBudget / 1000000).toFixed(1)}M
              </span>
              <span className="text-xs text-slate-400 font-bold">COP</span>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Proyección total para planes de reposición
            </p>
          </CardContent>
        </Card>
      </div>

      {/* PESTAÑAS OFICIALES DE LA MATRIZ */}
      <Tabs defaultValue="matrix" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <TabsList className="bg-slate-100 p-1 rounded-2xl h-12">
            <TabsTrigger value="matrix" className="rounded-xl font-bold text-xs px-4">
              Página 1: Matriz de Evaluación ({filteredEvaluations.length})
            </TabsTrigger>
            <TabsTrigger value="renewal" className="rounded-xl font-bold text-xs px-4">
              Página 2: Plan de Renovación ({renewalEvaluations.length})
            </TabsTrigger>
            <TabsTrigger value="followup" className="rounded-xl font-bold text-xs px-4">
              Página 3: Seguimiento a Planes ({followUpItems.length})
            </TabsTrigger>
            <TabsTrigger value="methodology" className="rounded-xl font-bold text-xs px-4">
              Criterios & Metodología (GTE-FCH)
            </TabsTrigger>
          </TabsList>

          <span className="text-xs text-slate-500 font-medium">
            Última sincronización automática en tiempo real
          </span>
        </div>

        {/* PESTAÑA 1: MATRIZ DE EVALUACIÓN */}
        <TabsContent value="matrix" className="space-y-4 focus-visible:outline-none">
          {/* Barra de Filtros */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por equipo, placa, serial, marca o modelo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 rounded-xl text-xs bg-slate-50/60 border-slate-200"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <Select value={selectedService} onValueChange={setSelectedService}>
                <SelectTrigger className="h-10 rounded-xl text-xs w-[160px] bg-slate-50/60 border-slate-200 font-medium">
                  <SelectValue placeholder="Servicio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Servicios</SelectItem>
                  {services.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                <SelectTrigger className="h-10 rounded-xl text-xs w-[140px] bg-slate-50/60 border-slate-200 font-medium">
                  <SelectValue placeholder="Nivel IO" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Niveles</SelectItem>
                  <SelectItem value="Bajo">Bajo (1.0 - 1.8)</SelectItem>
                  <SelectItem value="Moderado">Moderado (1.81 - 2.6)</SelectItem>
                  <SelectItem value="Medio">Medio (2.61 - 3.4)</SelectItem>
                  <SelectItem value="Alto">Alto (3.41 - 4.2)</SelectItem>
                  <SelectItem value="Crítico">Crítico (4.21 - 5.0)</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedHorizon} onValueChange={setSelectedHorizon}>
                <SelectTrigger className="h-10 rounded-xl text-xs w-[130px] bg-slate-50/60 border-slate-200 font-medium">
                  <SelectValue placeholder="Horizonte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Horizontes</SelectItem>
                  <SelectItem value="Corto">Corto (0–2 años)</SelectItem>
                  <SelectItem value="Mediano">Mediano (3–5 años)</SelectItem>
                  <SelectItem value="Largo">Largo (&gt;5 años)</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger className="h-10 rounded-xl text-xs w-[160px] bg-slate-50/60 border-slate-200 font-medium">
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="index_desc">Mayor Obsolescencia</SelectItem>
                  <SelectItem value="index_asc">Menor Obsolescencia</SelectItem>
                  <SelectItem value="name">Nombre Equipo</SelectItem>
                  <SelectItem value="service">Servicio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tabla Maestra */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto max-w-full">
              <Table>
                <TableHeader className="bg-slate-900 text-white">
                  <TableRow className="hover:bg-slate-900 border-b border-slate-800 text-[11px] font-black uppercase tracking-wider">
                    <TableHead className="text-white">Código</TableHead>
                    <TableHead className="text-white min-w-[200px]">Tecnología Biomédica</TableHead>
                    <TableHead className="text-white">Servicio</TableHead>
                    <TableHead className="text-white">Uso / Vida</TableHead>
                    <TableHead className="text-white text-center" title="Clínica (20%)">Clín (20%)</TableHead>
                    <TableHead className="text-white text-center" title="Técnica (20%)">Técn (20%)</TableHead>
                    <TableHead className="text-white text-center" title="Mantenimiento (15%)">Mant (15%)</TableHead>
                    <TableHead className="text-white text-center" title="Riesgo (15%)">Riesg (15%)</TableHead>
                    <TableHead className="text-white text-center" title="Económica (10%)">Econ (10%)</TableHead>
                    <TableHead className="text-white text-center" title="Soporte (10%)">Sop (10%)</TableHead>
                    <TableHead className="text-white text-center" title="Ambiental (5%)">Amb (5%)</TableHead>
                    <TableHead className="text-white text-center" title="Regulatoria (5%)">Reg (5%)</TableHead>
                    <TableHead className="text-white text-center">Índice (IO)</TableHead>
                    <TableHead className="text-white text-center">Nivel</TableHead>
                    <TableHead className="text-white">Acción Definida</TableHead>
                    <TableHead className="text-white text-center">Horizonte</TableHead>
                    <TableHead className="text-white text-right">Gestión</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvaluations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={17} className="text-center py-12 text-slate-400 text-sm">
                        No se encontraron tecnologías que coincidan con los filtros seleccionados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEvaluations.map(ev => {
                      const styles = getObsolescenceLevelStyles(ev.level);
                      return (
                        <TableRow key={ev.equipmentId} className="hover:bg-slate-50/80 transition-colors text-xs border-b border-slate-100">
                          <TableCell className="font-bold text-slate-800 whitespace-nowrap">
                            {ev.equipmentCode}
                          </TableCell>
                          <TableCell>
                            <div className="font-bold text-slate-900 leading-tight">
                              {ev.equipmentName}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium">
                              {ev.brand} {ev.model} • S/N: {ev.serial}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium text-slate-600 whitespace-nowrap">
                            {ev.serviceName}
                          </TableCell>
                          <TableCell className="whitespace-nowrap font-medium text-slate-600">
                            {ev.yearsInService}a / {ev.usefulLifeYears}a
                          </TableCell>
                          
                          {/* 8 Dimensiones */}
                          <TableCell className="text-center font-bold text-slate-700">{ev.scores.clinical?.score || 1}</TableCell>
                          <TableCell className="text-center font-bold text-slate-700">{ev.scores.technical?.score || 1}</TableCell>
                          <TableCell className="text-center font-bold text-slate-700">{ev.scores.maintenance?.score || 1}</TableCell>
                          <TableCell className="text-center font-bold text-slate-700">{ev.scores.risk?.score || 1}</TableCell>
                          <TableCell className="text-center font-bold text-slate-700">{ev.scores.economic?.score || 1}</TableCell>
                          <TableCell className="text-center font-bold text-slate-700">{ev.scores.support?.score || 1}</TableCell>
                          <TableCell className="text-center font-bold text-slate-700">{ev.scores.environmental?.score || 1}</TableCell>
                          <TableCell className="text-center font-bold text-slate-700">{ev.scores.regulatory?.score || 1}</TableCell>

                          {/* Índice y Nivel */}
                          <TableCell className="text-center font-black text-slate-950 text-sm whitespace-nowrap">
                            {ev.index}
                          </TableCell>
                          <TableCell className="text-center whitespace-nowrap">
                            <Badge className={`text-[10px] font-black border ${styles.badgeBg}`}>
                              {ev.level}
                            </Badge>
                          </TableCell>

                          {/* Acción y Horizonte */}
                          <TableCell className="text-slate-700 font-semibold max-w-xs truncate">
                            {ev.action}
                          </TableCell>
                          <TableCell className="text-center font-bold text-slate-600 whitespace-nowrap">
                            {ev.horizon} ({ev.projectedYear})
                          </TableCell>

                          {/* Botones de acción */}
                          <TableCell className="text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenEvalModal(ev.equipmentId)}
                                className="h-7 text-[11px] font-bold rounded-lg border-slate-300 hover:bg-slate-100"
                              >
                                Evaluar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => navigate(`/equipment/${ev.equipmentId}`)}
                                className="h-7 w-7 p-0 rounded-lg text-slate-500 hover:text-slate-900"
                                title="Ver Hoja de Vida"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* PESTAÑA 2: PLAN DE RENOVACIÓN TECNOLÓGICA */}
        <TabsContent value="renewal" className="space-y-4 focus-visible:outline-none">
          <div className="bg-orange-50/80 border border-orange-200 p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-black text-orange-950 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                Tecnologías Priorizadas para Renovación Tecnológica (GTE-MTX-001 Pág. 2)
              </h3>
              <p className="text-xs text-orange-800 mt-1">
                Equipos con nivel de obsolescencia Alto o Crítico. Base para estructuración del presupuesto de inversión y proyectos institucionales.
              </p>
            </div>
            <div className="bg-white px-4 py-2 rounded-xl border border-orange-200 shadow-xs shrink-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Presupuesto Estimado</span>
              <span className="text-lg font-black text-slate-900">
                ${indicators.totalEstimatedRenewalBudget.toLocaleString('es-CO')} COP
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-900 text-white">
                  <TableRow className="hover:bg-slate-900 border-b border-slate-800 text-[11px] font-black uppercase tracking-wider">
                    <TableHead className="text-white">Código</TableHead>
                    <TableHead className="text-white">Tecnología Biomédica</TableHead>
                    <TableHead className="text-white">Servicio</TableHead>
                    <TableHead className="text-white text-center">Índice / Nivel</TableHead>
                    <TableHead className="text-white text-center">Horizonte / Año</TableHead>
                    <TableHead className="text-white text-right">Costo Estimado</TableHead>
                    <TableHead className="text-white">Justificación</TableHead>
                    <TableHead className="text-white">Fuente Financiación</TableHead>
                    <TableHead className="text-white text-center">Estado</TableHead>
                    <TableHead className="text-white text-right">Ajustar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {renewalEvaluations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-12 text-slate-400 text-sm">
                        No hay tecnologías que requieran renovación priorizada en este momento.
                      </TableCell>
                    </TableRow>
                  ) : (
                    renewalEvaluations.map(ev => {
                      const styles = getObsolescenceLevelStyles(ev.level);
                      return (
                        <TableRow key={ev.equipmentId} className="hover:bg-slate-50/80 transition-colors text-xs border-b border-slate-100">
                          <TableCell className="font-bold text-slate-800">
                            {ev.equipmentCode}
                          </TableCell>
                          <TableCell>
                            <div className="font-bold text-slate-900">{ev.equipmentName}</div>
                            <div className="text-[10px] text-slate-400">{ev.brand} {ev.model}</div>
                          </TableCell>
                          <TableCell className="font-medium text-slate-600">
                            {ev.serviceName}
                          </TableCell>
                          <TableCell className="text-center whitespace-nowrap">
                            <span className="font-black text-slate-900 mr-1.5">{ev.index}</span>
                            <Badge className={`text-[10px] font-black border ${styles.badgeBg}`}>
                              {ev.level}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-bold text-slate-700 whitespace-nowrap">
                            {ev.horizon} ({ev.projectedYear})
                          </TableCell>
                          <TableCell className="text-right font-black text-slate-900 whitespace-nowrap">
                            ${(ev.renewalPlan?.estimatedCost || 0).toLocaleString('es-CO')}
                          </TableCell>
                          <TableCell className="text-slate-600 max-w-xs truncate">
                            {ev.renewalPlan?.justification || ev.observations}
                          </TableCell>
                          <TableCell className="text-slate-600 whitespace-nowrap font-medium">
                            {ev.renewalPlan?.fundingSource || 'Inversión Institucional'}
                          </TableCell>
                          <TableCell className="text-center whitespace-nowrap">
                            <Badge variant="outline" className="text-[10px] font-bold bg-slate-50 border-slate-200 text-slate-700">
                              {ev.renewalPlan?.status || 'En planeación'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenEvalModal(ev.equipmentId)}
                              className="h-7 text-[11px] font-bold rounded-lg border-slate-300"
                            >
                              Editar Plan
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* PESTAÑA 3: SEGUIMIENTO A PLANES */}
        <TabsContent value="followup" className="space-y-6 focus-visible:outline-none">
          {/* Formulario para registrar seguimiento */}
          <Card className="rounded-2xl border border-slate-200 shadow-xs">
            <CardHeader className="p-5 pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-black text-slate-900 flex items-center gap-2">
                <PlusCircle className="h-4 w-4 text-primary" />
                Registrar Actividad de Seguimiento (GTE-MTX-001 Pág. 3)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Documente las acciones realizadas (cotizaciones recibidas, intervenciones técnicas extraordinarias, comités técnicos o bajas).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5">
              <form onSubmit={handleCreateFollowUp} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Selector de Tecnología Biomédica con Barra de Búsqueda y Orden Alfabético A-Z */}
                  <div className="space-y-1.5 md:col-span-1 relative" ref={followUpDropdownRef}>
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Search className="h-3.5 w-3.5 text-indigo-600" />
                        Tecnología Biomédica *
                      </label>
                      <button
                        type="button"
                        onClick={() => setFollowUpFilterPriorityOnly(prev => !prev)}
                        className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded transition-colors",
                          followUpFilterPriorityOnly
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                        )}
                        title="Alternar entre todas las tecnologías y sólo las que requieren renovación prioritaria"
                      >
                        {followUpFilterPriorityOnly ? "★ Solo Priorizados" : "Ver Priorizados"}
                      </button>
                    </div>

                    {selectedFollowUpEval ? (
                      <div className="flex items-center justify-between p-2.5 bg-indigo-50/60 border border-indigo-200 rounded-xl">
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-black text-slate-900 truncate">
                              {selectedFollowUpEval.equipmentName}
                            </p>
                            <span className={cn(
                              "text-[9px] font-bold px-1.5 py-0.2 rounded border shrink-0",
                              getObsolescenceLevelStyles(selectedFollowUpEval.level).badgeBg
                            )}>
                              {selectedFollowUpEval.level} (IO: {selectedFollowUpEval.index.toFixed(2)})
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            Serial: <span className="font-mono font-bold text-slate-700">{selectedFollowUpEval.serial || 'S/N'}</span>
                            {selectedFollowUpEval.equipmentCode && (
                              <> · Placa: <span className="font-mono text-slate-600">{selectedFollowUpEval.equipmentCode}</span></>
                            )}
                            {selectedFollowUpEval.serviceName && (
                              <> · <span className="text-slate-600">{selectedFollowUpEval.serviceName}</span></>
                            )}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setNewFollowUpEquipmentId('');
                            setFollowUpSearchQuery('');
                            setIsFollowUpSearchOpen(true);
                          }}
                          className="h-7 px-2 text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg shrink-0"
                          title="Cambiar tecnología"
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Cambiar
                        </Button>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                          <Input
                            value={followUpSearchQuery}
                            onChange={(e) => {
                              setFollowUpSearchQuery(e.target.value);
                              setIsFollowUpSearchOpen(true);
                            }}
                            onFocus={() => setIsFollowUpSearchOpen(true)}
                            placeholder="Escribe nombre, serial, placa o servicio..."
                            className="rounded-xl h-10 pl-9 pr-8 text-xs bg-slate-50/70 border-slate-200 focus:bg-white transition-all shadow-xs"
                          />
                          {followUpSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setFollowUpSearchQuery('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Desplegable de búsqueda ordenado alfabéticamente A-Z */}
                        {isFollowUpSearchOpen && (
                          <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden max-h-72 flex flex-col animate-in fade-in slide-in-from-top-1 duration-150">
                            <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-semibold">
                              <span>Ordenado alfabéticamente (A-Z)</span>
                              <span>{sortedAndFilteredFollowUpEvaluations.length} tecnologías</span>
                            </div>
                            <div className="overflow-y-auto divide-y divide-slate-100 max-h-60">
                              {sortedAndFilteredFollowUpEvaluations.length === 0 ? (
                                <div className="p-4 text-center text-xs text-slate-400">
                                  No se encontraron tecnologías para &quot;{followUpSearchQuery}&quot;
                                </div>
                              ) : (
                                sortedAndFilteredFollowUpEvaluations.map((ev) => {
                                  const styles = getObsolescenceLevelStyles(ev.level);
                                  return (
                                    <button
                                      key={ev.equipmentId}
                                      type="button"
                                      onClick={() => {
                                        setNewFollowUpEquipmentId(ev.equipmentId);
                                        setIsFollowUpSearchOpen(false);
                                        setFollowUpSearchQuery('');
                                      }}
                                      className="w-full text-left p-3 hover:bg-indigo-50/70 transition-colors flex items-center justify-between gap-2 group cursor-pointer"
                                    >
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                          <p className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                                            {ev.equipmentName}
                                          </p>
                                          <span className={cn(
                                            "text-[9px] font-bold px-1.5 py-0.2 rounded border shrink-0",
                                            styles.badgeBg
                                          )}>
                                            {ev.level}
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                          Serial: <span className="font-mono font-bold text-slate-700">{ev.serial || 'S/N'}</span>
                                          {ev.equipmentCode && (
                                            <> · Placa: <span className="font-mono text-slate-600">{ev.equipmentCode}</span></>
                                          )}
                                          {ev.serviceName && (
                                            <> · <span className="text-slate-600">{ev.serviceName}</span></>
                                          )}
                                        </p>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <span className="text-[10px] font-bold text-slate-400 group-hover:text-indigo-600 transition-colors">
                                          IO: {ev.index.toFixed(2)}
                                        </span>
                                      </div>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Actividad de Seguimiento *</label>
                    <Input
                      value={newFollowUpActivity}
                      onChange={(e) => setNewFollowUpActivity(e.target.value)}
                      placeholder="Ej: Solicitud de cotización a proveedor oficial..."
                      className="rounded-xl h-10 text-xs bg-slate-50/50 border-slate-200"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Resultado Obtenido *</label>
                    <Input
                      value={newFollowUpResult}
                      onChange={(e) => setNewFollowUpResult(e.target.value)}
                      placeholder="Ej: Cotización aprobada por gerencia / Repuesto descontinuado..."
                      className="rounded-xl h-10 text-xs bg-slate-50/50 border-slate-200"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <div className="flex-1">
                    <Input
                      value={newFollowUpAction}
                      onChange={(e) => setNewFollowUpAction(e.target.value)}
                      placeholder="Nueva acción o ajuste a la decisión (opcional)..."
                      className="rounded-xl h-10 text-xs bg-slate-50/50 border-slate-200"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={submittingFollowUp}
                    className="rounded-xl h-10 px-6 font-black text-xs bg-slate-900 hover:bg-slate-800 text-white shrink-0"
                  >
                    {submittingFollowUp ? 'Guardando...' : 'Guardar Seguimiento'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Listado de Seguimientos */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Header con búsqueda rápida en la bitácora */}
            <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-slate-900 text-white">
                  <HistoryIcon className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">
                    Bitácora de Seguimiento a Decisiones y Renovación
                  </h4>
                  <p className="text-xs text-slate-500 font-medium">
                    Trazabilidad de gestiones, cotizaciones y acuerdos de Comité Técnico
                  </p>
                </div>
                <Badge variant="outline" className="ml-1 bg-white text-slate-700 font-black text-xs px-2 py-0.5 border-slate-300">
                  {filteredFollowUpItems.length} {filteredFollowUpItems.length === 1 ? 'registro' : 'registros'}
                </Badge>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <Input
                  value={followUpTableSearch}
                  onChange={(e) => setFollowUpTableSearch(e.target.value)}
                  placeholder="Filtrar bitácora por texto..."
                  className="rounded-xl h-9 pl-8.5 pr-7 text-xs bg-white border-slate-200"
                />
                {followUpTableSearch && (
                  <button
                    type="button"
                    onClick={() => setFollowUpTableSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Tabla con anchos definidos y texto normal multilínea sin superposiciones */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1250px]">
                <thead>
                  <tr className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider select-none">
                    <th className="w-[110px] min-w-[110px] px-4 py-3.5 border-r border-slate-800">Fecha</th>
                    <th className="w-[230px] min-w-[220px] px-4 py-3.5 border-r border-slate-800">Tecnología Biomédica</th>
                    <th className="w-[160px] min-w-[140px] px-4 py-3.5 border-r border-slate-800">Servicio</th>
                    <th className="min-w-[300px] px-4 py-3.5 border-r border-slate-800">Actividad Realizada</th>
                    <th className="min-w-[300px] px-4 py-3.5 border-r border-slate-800">Resultado Obtenido</th>
                    <th className="w-[160px] min-w-[140px] px-4 py-3.5 border-r border-slate-800">Responsable</th>
                    <th className="w-[170px] min-w-[150px] px-4 py-3.5 border-r border-slate-800">Nueva Acción</th>
                    <th className="w-[65px] min-w-[65px] px-2 py-3.5 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredFollowUpItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <HistoryIcon className="h-8 w-8 text-slate-300" />
                          <p className="font-semibold text-slate-600">
                            {followUpTableSearch ? 'No se encontraron registros con ese criterio.' : 'No hay actividades de seguimiento registradas.'}
                          </p>
                          <p className="text-xs text-slate-400">
                            {followUpTableSearch ? 'Intente con otra palabra clave.' : 'Utilice el formulario superior para registrar la primera gestión.'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredFollowUpItems.map((item, idx) => {
                      const levelStyle = getObsolescenceLevelStyles(item.level);
                      return (
                        <tr key={item.followUp.id || idx} className="hover:bg-slate-50/80 transition-colors">
                          {/* Fecha */}
                          <td className="px-4 py-3.5 align-top border-r border-slate-100 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 font-bold text-slate-800">
                              <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span>{item.followUp.date}</span>
                            </div>
                          </td>

                          {/* Tecnología Biomédica */}
                          <td className="px-4 py-3.5 align-top border-r border-slate-100 whitespace-normal">
                            <div className="space-y-1">
                              <div className="flex items-start justify-between gap-1.5">
                                <span className="font-bold text-slate-900 leading-snug">
                                  {item.equipmentName}
                                </span>
                                <span className={cn(
                                  "text-[9px] font-bold px-1.5 py-0.2 rounded border shrink-0",
                                  levelStyle.badgeBg
                                )}>
                                  {item.level}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono space-y-0.5">
                                <div>Serial: <span className="font-bold text-slate-700">{item.serial}</span></div>
                                {item.equipmentCode && (
                                  <div>Placa: <span className="text-slate-600">{item.equipmentCode}</span></div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Servicio */}
                          <td className="px-4 py-3.5 align-top border-r border-slate-100 whitespace-normal font-medium text-slate-700">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span>{item.serviceName}</span>
                            </div>
                          </td>

                          {/* Actividad Realizada */}
                          <td className="px-4 py-3.5 align-top border-r border-slate-100 whitespace-normal break-words">
                            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-900 font-medium leading-relaxed">
                              {item.followUp.activity}
                            </div>
                          </td>

                          {/* Resultado Obtenido */}
                          <td className="px-4 py-3.5 align-top border-r border-slate-100 whitespace-normal break-words">
                            <div className="p-2.5 rounded-xl bg-indigo-50/40 border border-indigo-100 text-slate-800 font-normal leading-relaxed">
                              {item.followUp.result}
                            </div>
                          </td>

                          {/* Responsable */}
                          <td className="px-4 py-3.5 align-top border-r border-slate-100 whitespace-normal">
                            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                              <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span>{item.followUp.responsibleName}</span>
                            </div>
                          </td>

                          {/* Nueva Acción */}
                          <td className="px-4 py-3.5 align-top border-r border-slate-100 whitespace-normal">
                            <span className="inline-block px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-900 border border-emerald-200/80 break-words leading-tight">
                              {item.followUp.newAction || item.action}
                            </span>
                          </td>

                          {/* Eliminar */}
                          <td className="px-2 py-3.5 align-top text-center">
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmTarget({
                                equipmentId: item.equipmentId,
                                followUpId: item.followUp.id,
                                equipmentName: item.equipmentName
                              })}
                              className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Eliminar registro de seguimiento"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* PESTAÑA 4: CRITERIOS & METODOLOGÍA (GTE-FCH-TCH) */}
        <TabsContent value="methodology" className="space-y-6 focus-visible:outline-none">
          <div className="bg-slate-50 border border-slate-200 p-6 rounded-3xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
                <BookOpen className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Modelo Institucional de Evaluación de Obsolescencia (GTE-GUI-003-V1)
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Guía oficial para la toma de decisiones basada en evidencia técnica, clínica, económica y de seguridad.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 leading-relaxed font-medium">
              <span className="font-black uppercase tracking-wider block text-amber-950 mb-1">
                Principio Rector: Antigüedad ≠ Obsolescencia
              </span>
              Una tecnología biomédica puede haber superado su vida útil contable o teórica y continuar operando con total seguridad, precisión y disponibilidad si cuenta con adecuado soporte técnico y disponibilidad de repuestos. A la inversa, una tecnología relativamente nueva puede ser obsoleta si el fabricante descontinuó el soporte, si presenta fallas críticas recurrentes o si ya no cumple con los estándares clínicos de habilitación.
            </div>
          </div>

          {/* 8 Dimensiones */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(Object.keys(DIMENSION_CONFIGS) as DimensionId[]).map(dimKey => {
              const cfg = DIMENSION_CONFIGS[dimKey];
              return (
                <div key={dimKey} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-slate-900">{cfg.name}</h4>
                    <Badge className="text-xs font-black bg-slate-100 text-slate-800 border-slate-200">
                      Peso: {Math.round(cfg.weight * 100)}%
                    </Badge>
                  </div>
                  <p className="text-xs font-bold text-primary">{cfg.keyQuestion}</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{cfg.description}</p>
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1">
                    {cfg.sources.map((src, i) => (
                      <span key={i} className="text-[10px] bg-slate-50 text-slate-500 px-2 py-0.5 rounded-md border border-slate-100">
                        {src}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Escala de Calificación */}
          <Card className="rounded-2xl border border-slate-200 shadow-xs">
            <CardHeader className="p-5 pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-black text-slate-900">
                Rangos de Interpretación del Índice de Obsolescencia (IO)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1">
                  <span className="text-[10px] font-black uppercase text-emerald-800 block">1.00 – 1.80</span>
                  <span className="text-sm font-black text-emerald-950 block">Bajo</span>
                  <p className="text-emerald-800 text-[11px] leading-tight">Tecnología adecuada. Continuar operación normal.</p>
                </div>
                <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 space-y-1">
                  <span className="text-[10px] font-black uppercase text-sky-800 block">1.81 – 2.60</span>
                  <span className="text-sm font-black text-sky-950 block">Moderado</span>
                  <p className="text-sky-800 text-[11px] leading-tight">Requiere seguimiento periódico.</p>
                </div>
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
                  <span className="text-[10px] font-black uppercase text-amber-800 block">2.61 – 3.40</span>
                  <span className="text-sm font-black text-amber-950 block">Medio</span>
                  <p className="text-amber-800 text-[11px] leading-tight">Requiere planificación de intervención.</p>
                </div>
                <div className="p-4 rounded-xl bg-orange-50 border border-orange-200 space-y-1">
                  <span className="text-[10px] font-black uppercase text-orange-800 block">3.41 – 4.20</span>
                  <span className="text-sm font-black text-orange-950 block">Alto</span>
                  <p className="text-orange-800 text-[11px] leading-tight">Programar renovación o actualización.</p>
                </div>
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-1">
                  <span className="text-[10px] font-black uppercase text-rose-800 block">4.21 – 5.00</span>
                  <span className="text-sm font-black text-rose-950 block">Crítico</span>
                  <p className="text-rose-800 text-[11px] leading-tight">Priorizar intervención, renovación o retiro.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal para evaluar cualquier equipo seleccionado */}
      {selectedEquipmentForEval && (
        <ObsolescenceEvaluationModal
          open={isEvaluationModalOpen}
          onOpenChange={(open) => {
            setIsEvaluationModalOpen(open);
            if (!open) setSelectedEquipmentForEval(null);
          }}
          equipment={selectedEquipmentForEval}
          reports={reports.filter(r => r.equipmentId === selectedEquipmentForEval.id)}
          existingEvaluation={savedEvaluations[selectedEquipmentForEval.id]}
          onSaved={(saved) => {
            setSavedEvaluations(prev => ({ ...prev, [saved.equipmentId]: saved }));
          }}
        />
      )}

      {/* Modal In-App de Confirmación para Eliminar (evita confirm de navegador) */}
      <ConfirmModal
        isOpen={!!deleteConfirmTarget}
        onClose={() => setDeleteConfirmTarget(null)}
        onConfirm={handleExecuteDeleteFollowUp}
        title="¿Eliminar registro de seguimiento?"
        description={`Está a punto de eliminar este registro de la bitácora de seguimiento para "${deleteConfirmTarget?.equipmentName || 'la tecnología'}". Esta acción actualizará la matriz GTE-MTX-001.`}
        confirmText="Sí, Eliminar"
        cancelText="Cancelar"
        variant="danger"
        icon="trash"
        isLoading={isDeletingFollowUp}
      />

      {/* Modal In-App de Retroalimentación / Alertas (evita alert de navegador) */}
      {feedbackModal && (
        <FeedbackModal
          isOpen={feedbackModal.isOpen}
          onClose={() => setFeedbackModal(null)}
          title={feedbackModal.title}
          description={feedbackModal.description}
          type={feedbackModal.type}
        />
      )}
    </div>
  );
}
