import * as React from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  ClipboardCheck, 
  ArrowLeft, 
  Save, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  User,
  Activity,
  Shield,
  Loader2,
  Laptop,
  Building2,
  Stethoscope
} from 'lucide-react';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { ComplianceResponse, Service } from '@/types';
import { getComplianceItems, getScopeComplianceMeta } from '@/constants/complianceItems';
import { useTechnologyScope } from '@/lib/TechnologyScopeContext';
import { format, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { generateCompliancePDF } from '@/lib/pdfGenerator';

export default function ComplianceChecklistForm() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { scope: globalScope } = useTechnologyScope();

  // Determine active scope from URL param, global scope, or default
  const paramScope = searchParams.get('scope') as 'biomedical' | 'computing' | 'infrastructure' | null;
  const [activeScope, setActiveScope] = React.useState<'biomedical' | 'computing' | 'infrastructure'>(() => {
    if (paramScope && ['biomedical', 'computing', 'infrastructure'].includes(paramScope)) {
      return paramScope;
    }
    if (globalScope === 'computing' || globalScope === 'infrastructure') {
      return globalScope;
    }
    return 'biomedical';
  });

  const scopeMeta = React.useMemo(() => getScopeComplianceMeta(activeScope), [activeScope]);

  const [service, setService] = React.useState<Service | null>(null);

  const filteredItems = React.useMemo(() => {
    return getComplianceItems(activeScope, serviceId);
  }, [activeScope, serviceId]);

  const [responses, setResponses] = React.useState<Record<string, Partial<ComplianceResponse>>>(() => {
    const initial: Record<string, Partial<ComplianceResponse>> = {};
    filteredItems.forEach(item => {
      initial[item.id] = {
        itemId: item.id,
        itemName: item.name,
        category: item.category,
        normReference: item.normReference,
        status: 'compliant',
        observations: ''
      };
    });
    return initial;
  });

  // Reinitialize responses when activeScope changes
  React.useEffect(() => {
    const initial: Record<string, Partial<ComplianceResponse>> = {};
    filteredItems.forEach(item => {
      initial[item.id] = {
        itemId: item.id,
        itemName: item.name,
        category: item.category,
        normReference: item.normReference,
        status: 'compliant',
        observations: ''
      };
    });
    setResponses(initial);
  }, [filteredItems]);

  const [observations, setObservations] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchService = async () => {
      if (!serviceId) return;
      
      // Try to fetch specific service details
      try {
        const docRef = doc(db, 'services', serviceId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setService({ id: docSnap.id, ...docSnap.data() } as Service);
        } else {
          // Fallback if not in DB (legacy or static)
          const fallbackNames: Record<string, string> = {
            'uci': 'UCI',
            'ambulancia': 'Ambulancia',
            'hospitalizacion': 'Hospitalización',
            'cirugia': 'Cirugía',
            'urgencias': 'Urgencias',
            'laboratorio': 'Laboratorio Clínico',
            'imagenes': 'Imágenes Diagnósticas',
            'consulta-externa': 'Consulta Externa'
          };
          setService({ id: serviceId, name: fallbackNames[serviceId] || serviceId });
        }
      } catch (error) {
        console.error("Error fetching service:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchService();
  }, [serviceId]);

  const handleStatusChange = (itemId: string, status: 'compliant' | 'non_compliant' | 'na') => {
    setResponses(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], status }
    }));
  };

  const handleObservationChange = (itemId: string, value: string) => {
    setResponses(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], observations: value }
    }));
  };

  const calculateScore = () => {
    const total = filteredItems.length;
    const compliantCount = Object.values(responses).filter(r => r.status === 'compliant').length;
    const naCount = Object.values(responses).filter(r => r.status === 'na').length;
    
    const relevantTotal = total - naCount;
    if (relevantTotal === 0) return 100;
    return Math.round((compliantCount / relevantTotal) * 100);
  };

  const handleSave = async () => {
    if (!user || !service) return;
    
    setIsSaving(true);
    const score = calculateScore();
    const submissionDate = new Date();
    const nextReview = addMonths(submissionDate, 3);

    const submissionData = {
      serviceId: service.id,
      serviceName: service.name,
      date: submissionDate.toISOString(),
      technicianId: user.uid,
      technicianName: user.displayName || user.email,
      score,
      responses: Object.values(responses),
      nextReviewDate: nextReview.toISOString(),
      observations,
      technologyScope: activeScope,
      standardName: scopeMeta.standardName,
      standardReference: scopeMeta.standardReference,
      formCode: scopeMeta.formCode
    };

    try {
      const docRef = await addDoc(collection(db, 'compliance_submissions'), submissionData);
      
      // 1. Generate local PDF and extract base64
      const fullSubmission = { 
        id: docRef.id, 
        ...submissionData,
        responses: submissionData.responses as ComplianceResponse[] 
      };
      
      try {
        const { generateCompliancePDF } = await import('@/lib/pdfGenerator');
        const pdfBase64 = generateCompliancePDF(fullSubmission, true) as unknown as string;

        // 2. Upload to Drive (Listas de Chequeo organizada por área)
        await fetch('/api/drive/upload-document', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             folderType: 'compliance',
             fileName: `Chequeo_${activeScope.toUpperCase()}_${service.name.replace(/\s+/g, '_')}_${format(submissionDate, 'yyyyMMdd')}.pdf`,
             base64: pdfBase64,
             mimeType: 'application/pdf',
             technologyScope: activeScope
           })
        });

        // 3. Fallback to download local copy for immediate user reference
        generateCompliancePDF(fullSubmission); // without base64 param it downloads

      } catch (pdfErr) {
        console.error('Error in PDF generation/upload:', pdfErr);
      }
      
      navigate('/compliance');
    } catch (error) {
      console.error("Error saving checklist:", error);
      alert("Error al guardar la lista de chequeo.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const groupedItems = filteredItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, typeof filteredItems>);

  const score = calculateScore();

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" onClick={() => navigate('/compliance')} className="-ml-2 text-slate-500">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Normativa
          </Button>
          <div className="flex items-center gap-2">
            <span className={cn(
              "px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border",
              activeScope === 'computing' ? "bg-cyan-50 border-cyan-200 text-cyan-700" :
              activeScope === 'infrastructure' ? "bg-amber-50 border-amber-200 text-amber-700" :
              "bg-blue-50 border-blue-200 text-blue-700"
            )}>
              {scopeMeta.badgeText}
            </span>
            <span className="text-xs font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
              {scopeMeta.formCode}
            </span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <ClipboardCheck className="h-8 w-8 text-primary" /> 
            {scopeMeta.shortTitle}: {service?.name}
          </h1>
          <p className="text-slate-500 font-medium">
            {scopeMeta.standardReference}
          </p>
        </div>
        
        <div className={cn(
          "px-6 py-3 rounded-2xl border-2 flex flex-col items-center justify-center min-w-[120px]",
          score >= 90 ? "bg-emerald-50 border-emerald-200 text-emerald-700" :
          score >= 70 ? "bg-amber-50 border-amber-200 text-amber-700" :
          "bg-red-50 border-red-200 text-red-700"
        )}>
          <span className="text-xs font-black uppercase tracking-widest">Cumplimiento</span>
          <span className="text-3xl font-black">{score}%</span>
        </div>
      </div>

      {/* Scope Switcher / Selector */}
      <div className="bg-slate-100 p-1.5 rounded-2xl flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setActiveScope('biomedical');
            setSearchParams({ scope: 'biomedical' });
          }}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black transition-all",
            activeScope === 'biomedical' 
              ? "bg-white text-blue-700 shadow-sm border border-blue-200" 
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          )}
        >
          <Stethoscope className="h-4 w-4" />
          <span>Biomédica (Dotación Res. 3100)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveScope('computing');
            setSearchParams({ scope: 'computing' });
          }}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black transition-all",
            activeScope === 'computing' 
              ? "bg-white text-cyan-700 shadow-sm border border-cyan-200" 
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          )}
        >
          <Laptop className="h-4 w-4" />
          <span>Sistemas y TIC (Historia Clínica Res. 3100)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveScope('infrastructure');
            setSearchParams({ scope: 'infrastructure' });
          }}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black transition-all",
            activeScope === 'infrastructure' 
              ? "bg-white text-amber-700 shadow-sm border border-amber-200" 
              : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
          )}
        >
          <Building2 className="h-4 w-4" />
          <span>Infraestructura (RETIE & Planta Res. 3100)</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 border-none shadow-xl shadow-slate-200/50 rounded-3xl bg-slate-900 text-white">
          <CardHeader>
            <CardTitle className="text-lg font-black flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Info del Chequeo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-2">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400">Proceso Normativo</Label>
              <div className="text-xs font-bold p-3 rounded-xl bg-white/10 text-slate-200 leading-snug">
                {scopeMeta.proceso}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400">Responsable Auditor</Label>
              <div className="text-xs font-bold p-3 rounded-xl bg-white/10 text-slate-200">
                {scopeMeta.responsable}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400">Fecha de Evaluación</Label>
              <div className="flex items-center gap-2 font-bold p-3 rounded-xl bg-white/10">
                <Clock className="h-4 w-4 text-primary" />
                {format(new Date(), 'dd/MM/yyyy')}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase text-slate-400">Evaluador en Turno</Label>
              <div className="flex items-center gap-2 font-bold p-3 rounded-xl bg-white/10">
                <User className="h-4 w-4 text-primary" />
                {user?.displayName || user?.email}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/10">
              <div className="flex items-start gap-3">
                <div className="mt-1 p-1 bg-primary/20 rounded-lg">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-bold">Frecuencia Trimestral</p>
                  <p className="text-[10px] text-slate-400">Próxima revisión: {format(addMonths(new Date(), 3), 'MMMM yyyy', { locale: es })}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-1 p-1 bg-blue-400/20 rounded-lg">
                  <Activity className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs font-bold">{scopeMeta.shortTitle}</p>
                  <p className="text-[10px] text-slate-400">{filteredItems.length} ítems reglamentarios</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-2 space-y-6">
          {Object.entries(groupedItems).map(([category, items]) => (
            <Card key={category} className="border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">{category}</h3>
                <span className="text-[10px] font-bold text-slate-400">{items.length} verificación(es)</span>
              </div>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <div key={item.id} className="p-6 space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1 flex-1">
                          <p className="font-bold text-slate-900 leading-tight">{item.name}</p>
                          <p className="text-xs text-slate-500 font-medium">{item.description}</p>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-tight">{item.normReference}</p>
                        </div>
                        <div className="flex p-1 bg-slate-100 rounded-xl gap-1">
                          {[
                            { value: 'compliant', label: 'C', color: 'text-emerald-600', bg: 'bg-emerald-100', icon: CheckCircle2, title: 'Cumple' },
                            { value: 'non_compliant', label: 'NC', color: 'text-red-600', bg: 'bg-red-100', icon: AlertCircle, title: 'No Cumple' },
                            { value: 'na', label: 'N/A', color: 'text-slate-500', bg: 'bg-slate-200', icon: Clock, title: 'No Aplica' }
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              title={opt.title}
                              onClick={() => handleStatusChange(item.id, opt.value as any)}
                              className={cn(
                                "flex flex-col items-center justify-center h-10 w-10 rounded-lg transition-all",
                                responses[item.id]?.status === opt.value 
                                  ? cn(opt.bg, opt.color, "shadow-sm font-black") 
                                  : "text-slate-400 hover:bg-white"
                              )}
                            >
                              <span className="text-[10px] font-black">{opt.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <Input 
                        placeholder="Observaciones o hallazgos por ítem..." 
                        value={responses[item.id]?.observations || ''}
                        onChange={(e) => handleObservationChange(item.id, e.target.value)}
                        className="h-9 text-xs rounded-xl border-slate-100 bg-slate-50/50 focus:bg-white"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl">
            <CardHeader>
              <CardTitle className="text-lg font-black text-slate-900">Observaciones Generales y Plan de Acción</CardTitle>
              <CardDescription className="text-xs">
                Registre conclusiones generales, requerimientos al servicio o fechas estimadas de subsanación.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea 
                placeholder="Indique hallazgos generales o planes de acción recomendados..." 
                className="min-h-[120px] rounded-2xl border-slate-200"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button variant="outline" className="rounded-xl h-12 px-8 font-bold" onClick={() => navigate('/compliance')}>
              Cancelar
            </Button>
            <Button 
              className="rounded-xl h-12 px-10 font-black shadow-lg shadow-primary/20" 
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Guardando Chequeo...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-5 w-5" />
                  Finalizar y Guardar Chequeo
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

