import * as React from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  FileText, 
  ShieldCheck, 
  AlertCircle, 
  ExternalLink, 
  Plus, 
  Link as LinkIcon, 
  Paperclip, 
  ClipboardCheck,
  Laptop,
  Building2,
  Stethoscope,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, orderBy, limit, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Service, ComplianceSubmission, Guide } from '@/types';
import { useTechnologyScope } from '@/lib/TechnologyScopeContext';
import { getScopeComplianceMeta } from '@/constants/complianceItems';
import { FeedbackModal } from '@/components/ui/ConfirmModal';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function Compliance() {
  const navigate = useNavigate();
  const { scope, scopeConfig } = useTechnologyScope();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [showAddLink, setShowAddLink] = React.useState(false);
  const [newLink, setNewLink] = React.useState({ title: '', url: '' });
  const [isSaving, setIsSaving] = React.useState(false);
  const [services, setServices] = React.useState<Service[]>([]);
  const [submissions, setSubmissions] = React.useState<ComplianceSubmission[]>([]);
  const [guides, setGuides] = React.useState<Guide[]>([]);
  const [feedback, setFeedback] = React.useState<{ title: string; message: string; type: 'success' | 'error' } | null>(null);
  const [techEquipmentCount, setTechEquipmentCount] = React.useState(0);
  const [stats, setStats] = React.useState({
    habilitation: 0,
    invimaPending: 0,
    guidesCount: 0
  });

  // Local scope selection for checklists when viewing in consolidated 'all' mode
  const [selectedChecklistScope, setSelectedChecklistScope] = React.useState<'biomedical' | 'computing' | 'infrastructure'>('biomedical');

  React.useEffect(() => {
    if (scope === 'computing' || scope === 'infrastructure') {
      setSelectedChecklistScope(scope);
    } else {
      setSelectedChecklistScope('biomedical');
    }
  }, [scope]);

  const activeChecklistScope = scope === 'all' ? selectedChecklistScope : (scope as 'biomedical' | 'computing' | 'infrastructure');
  const scopeMeta = React.useMemo(() => getScopeComplianceMeta(activeChecklistScope), [activeChecklistScope]);

  const handleSaveLink = async () => {
    if (!newLink.title || !newLink.url) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'guides'), {
        title: newLink.title,
        url: newLink.url,
        type: 'link',
        technologyScope: scope === 'all' ? 'biomedical' : scope,
        createdAt: new Date().toISOString()
      });
      setNewLink({ title: '', url: '' });
      setShowAddLink(false);
    } catch (error) {
      console.error("Error saving link:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSaving(true);
    try {
      await addDoc(collection(db, 'guides'), {
        title: file.name,
        url: '#',
        type: 'file',
        technologyScope: scope === 'all' ? 'biomedical' : scope,
        createdAt: new Date().toISOString(),
        fileSize: `${(file.size / 1024).toFixed(1)} KB`
      });
      setFeedback({
        title: 'Archivo Registrado',
        message: `El archivo "${file.name}" fue registrado exitosamente en el sistema de cumplimiento.`,
        type: 'success'
      });
    } catch (error) {
      console.error("Error 'uploading' file:", error);
      setFeedback({
        title: 'Error al Registrar',
        message: 'No fue posible subir el archivo. Intente de nuevo.',
        type: 'error'
      });
    } finally {
      setIsSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  React.useEffect(() => {
    // Load services from Firestore
    const unsubServices = onSnapshot(collection(db, 'services'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Service[];
      import('@/services/mockData').then(({ mockServices }) => {
        setServices(data.length > 0 ? data : mockServices);
      });
    }, (error) => {
      console.warn("Compliance services snapshot error:", error);
    });

    // Load submissions for compliance calculation
    const qSubmissions = query(collection(db, 'compliance_submissions'), orderBy('date', 'desc'));
    const unsubSubmissions = onSnapshot(qSubmissions, (snapshot) => {
      const allSubmissions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ComplianceSubmission[];
      setSubmissions(allSubmissions);

      const scopedSubs = allSubmissions.filter(s => {
        if (scope === 'all') return true;
        const sScope = s.technologyScope || 'biomedical';
        return sScope === scope;
      });

      if (scopedSubs.length > 0) {
        const latestByService: Record<string, number> = {};
        scopedSubs.forEach(sub => {
          if (latestByService[sub.serviceId] === undefined) {
            latestByService[sub.serviceId] = sub.score;
          }
        });

        const scores = Object.values(latestByService);
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        setStats(prev => ({ ...prev, habilitation: Math.round(avg) }));
      } else {
        setStats(prev => ({ ...prev, habilitation: 100 }));
      }
    }, (error) => {
      console.warn("Compliance submissions snapshot error:", error);
    });

    // Calculate equipment counts and INVIMA pending
    const unsubEquip = onSnapshot(collection(db, 'equipment'), (snapshot) => {
      const now = new Date();
      const allEq = snapshot.docs.map(d => d.data());

      if (scope === 'biomedical') {
        const pendingCount = allEq.filter(eq => {
          const eqScope = eq.technologyScope || 'biomedical';
          if (eqScope !== 'biomedical') return false;

          const hasNoInvima = !eq.registrationInvima || eq.registrationInvima.trim() === '';
          let isExpired = false;
          if (eq.registrationExpiration) {
            const expirationDate = new Date(eq.registrationExpiration);
            isExpired = expirationDate <= now;
          }
          return hasNoInvima || isExpired;
        }).length;
        setStats(prev => ({ ...prev, invimaPending: pendingCount }));
      } else if (scope === 'computing') {
        const count = allEq.filter(eq => eq.technologyScope === 'computing' && !['baja', 'baja_repuestos'].includes(eq.status)).length;
        setTechEquipmentCount(count);
      } else if (scope === 'infrastructure') {
        const count = allEq.filter(eq => eq.technologyScope === 'infrastructure' && !['baja', 'baja_repuestos'].includes(eq.status)).length;
        setTechEquipmentCount(count);
      } else {
        // all
        const pendingCount = allEq.filter(eq => {
          const eqScope = eq.technologyScope || 'biomedical';
          if (eqScope !== 'biomedical') return false;
          return !eq.registrationInvima || (eq.registrationExpiration && new Date(eq.registrationExpiration) <= now);
        }).length;
        setStats(prev => ({ ...prev, invimaPending: pendingCount }));
      }
    }, (error) => {
      console.warn("Compliance equipment snapshot error:", error);
    });

    // Count Guías Rápidas scoped to the active area
    const unsubGuides = onSnapshot(collection(db, 'guides'), (snapshot) => {
      const allGuides = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Guide[];
      const scopedGuides = allGuides.filter(g => {
        if (scope === 'all') return true;
        const gScope = g.technologyScope || 'biomedical';
        return gScope === scope || gScope === 'all';
      });
      setGuides(scopedGuides);
      setStats(prev => ({ ...prev, guidesCount: scopedGuides.length }));
    }, (error) => {
      console.warn("Compliance guides snapshot error:", error);
    });

    return () => {
      unsubServices();
      unsubSubmissions();
      unsubEquip();
      unsubGuides();
    };
  }, [scope]);

  // Map latest submission per service for the active checklist scope
  const latestSubmissionsByService = React.useMemo(() => {
    const map: Record<string, ComplianceSubmission> = {};
    submissions
      .filter(s => (s.technologyScope || 'biomedical') === activeChecklistScope)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .forEach(s => {
        if (!map[s.serviceId]) {
          map[s.serviceId] = s;
        }
      });
    return map;
  }, [submissions, activeChecklistScope]);

  // Normas legales y estándares específicos por Área Tecnológica
  const regulations = React.useMemo(() => {
    if (scope === 'computing') {
      return [
        {
          title: 'Resolución 3100 de 2019 (Historia Clínica y Registros)',
          description: 'Habilitación en salud: Estándar obligatorio de Historia Clínica y Registros asistenciales, sistemas de información 24/7 y seguridad digital.',
          status: 'Vigente',
          type: 'Resolución MinSalud',
          url: 'https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/DIJ/resolucion-3100-de-2019.pdf'
        },
        {
          title: 'Ley 1581 de 2012',
          description: 'Régimen General de Protección de Datos Personales (Habeas Data) y custodia de Historia Clínica Digital de pacientes.',
          status: 'Vigente',
          type: 'Ley de la República',
          url: 'http://www.secretariasenado.gov.co/senado/basedoc/ley_1581_2012.html'
        },
        {
          title: 'Ley 1273 de 2009',
          description: 'Protección de la Información y de los Datos - Tipificación de Delitos Informáticos y Ciberseguridad Hospitalaria.',
          status: 'Vigente',
          type: 'Ley de la República',
          url: 'http://www.secretariasenado.gov.co/senado/basedoc/ley_1273_2009.html'
        },
        {
          title: 'Resolución 521 y Estándares SISPRO / MinTIC',
          description: 'Lineamientos técnicos de interoperabilidad, seguridad en telemedicina y confidencialidad en sistemas de salud.',
          status: 'Vigente',
          type: 'Resolución MinSalud',
          url: 'https://www.minsalud.gov.co'
        }
      ];
    }

    if (scope === 'infrastructure') {
      return [
        {
          title: 'Resolución 3100 de 2019 (Estándar de Infraestructura)',
          description: 'Habilitación de servicios de salud: Instalaciones físicas, sistemas de respaldo energético, gases medicinales e hidrosanitarias.',
          status: 'Vigente',
          type: 'Norma Técnica',
          url: 'https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/DIJ/resolucion-3100-de-2019.pdf'
        },
        {
          title: 'RETIE (Res. 90708 de 2013)',
          description: 'Reglamento Técnico de Instalaciones Eléctricas en Áreas Críticas Hospitalarias y sistemas de respaldo de energía.',
          status: 'Vigente',
          type: 'Reglamento Técnico',
          url: 'https://www.minenergia.gov.co'
        },
        {
          title: 'Resolución 4445 de 1996',
          description: 'Condiciones sanitarias y físicas de la infraestructura en instituciones prestadoras de salud.',
          status: 'Vigente',
          type: 'Norma Sanitaria',
          url: 'https://www.minsalud.gov.co'
        },
        {
          title: 'Norma NTC 4410 / NFPA 99',
          description: 'Instalaciones y sistemas de distribución de Gases Medicinales, vacío y aire comprimido medicinal.',
          status: 'Vigente',
          type: 'Norma Técnica Hospitalaria',
          url: 'https://www.minsalud.gov.co'
        }
      ];
    }

    if (scope === 'all') {
      return [
        {
          title: 'Resolución 3100 de 2019 (Habilitación Integral)',
          description: 'Manual de inscripción de prestadores y habilitación: Estándares de Dotación Biomédica, TIC e Infraestructura Hospitalaria.',
          status: 'Vigente',
          type: 'Norma Técnica',
          url: 'https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/DIJ/resolucion-3100-de-2019.pdf'
        },
        {
          title: 'Decreto 4725 de 2005 (Biomédica)',
          description: 'Régimen de registros sanitarios y vigilancia sanitaria de dispositivos médicos.',
          status: 'Vigente',
          type: 'Decreto Presidencial',
          url: 'https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/DIJ/Decreto-4725-de-2005.pdf'
        },
        {
          title: 'Ley 1581 de 2012 (TIC y Habeas Data)',
          description: 'Seguridad digital y protección de datos sensibles en sistemas de información clínica.',
          status: 'Vigente',
          type: 'Ley de la República',
          url: 'http://www.secretariasenado.gov.co/senado/basedoc/ley_1581_2012.html'
        },
        {
          title: 'RETIE & NTC 4410 (Infraestructura)',
          description: 'Reglamento de instalaciones eléctricas hospitalarias y redes de gases medicinales.',
          status: 'Vigente',
          type: 'Reglamento Técnico',
          url: 'https://www.minenergia.gov.co'
        }
      ];
    }

    // Default: Biomedical
    return [
      {
        title: 'Resolución 3100 de 2019 (Estándar de Dotación)',
        description: 'Habilitación de servicios de salud y estándares obligatorios de dotación y mantenimiento biomédico.',
        status: 'Vigente',
        type: 'Norma Técnica',
        url: 'https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/DIJ/resolucion-3100-de-2019.pdf'
      },
      {
        title: 'Decreto 4725 de 2005',
        description: 'Régimen de registros sanitarios, permiso de comercialización y vigilancia sanitaria de dispositivos médicos.',
        status: 'Vigente',
        type: 'Norma Técnica',
        url: 'https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/DIJ/Decreto-4725-de-2005.pdf'
      },
      {
        title: 'Manual Único de Acreditación en Salud',
        description: 'Estándares superiores de calidad y mejoramiento continuo para instituciones prestadoras de servicios de salud.',
        status: 'Vigente',
        type: 'Manual Técnico',
        url: 'https://www.minsalud.gov.co/sites/rid/Lists/BibliotecaDigital/RIDE/DE/CA/manual-acreditacion-salud-ambulatorio-hospitalario.pdf'
      }
    ];
  }, [scope]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className={cn("px-2.5 py-0.5 rounded-lg text-xs font-black uppercase tracking-wider border", scopeConfig.badgeBg, scopeConfig.badgeBorder, scopeConfig.textColor)}>
              {scopeConfig.shortLabel}
            </span>
            <span className="text-xs font-mono font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
              Res. 3100 de 2019
            </span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            Normativa y Cumplimiento - <span className="text-primary">{scopeConfig.label}</span>
          </h1>
          <p className="text-slate-500 font-medium">
            Listas de chequeo de habilitación (Res. 3100), marco legal y auditoría técnica para {scopeConfig.shortLabel.toLowerCase()}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate('/compliance/history')} className="rounded-xl border-slate-200">
            <ClipboardCheck className="mr-2 h-4 w-4" />
            Histórico de Chequeos
          </Button>
          <Button variant="outline" onClick={() => setShowAddLink(!showAddLink)} className="rounded-xl border-slate-200">
            <LinkIcon className="mr-2 h-4 w-4" />
            Adjuntar Link
          </Button>
          <Button 
            className="rounded-xl shadow-lg shadow-primary/20" 
            onClick={() => fileInputRef.current?.click()}
            disabled={isSaving}
          >
            <Plus className="mr-2 h-4 w-4" />
            {isSaving ? 'Subiendo...' : 'Subir Archivo'}
          </Button>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleFileUpload}
            accept=".pdf,.doc,.docx,.jpg,.png"
          />
        </div>
      </div>

      {showAddLink && (
        <Card className="bg-slate-50 border-none shadow-inner rounded-3xl animate-in slide-in-from-top-4 duration-300">
          <CardContent className="pt-6 flex gap-4">
            <div className="flex-1 space-y-2">
              <Input 
                placeholder="Título del documento o link" 
                className="rounded-xl border-slate-200" 
                value={newLink.title}
                onChange={(e) => setNewLink(prev => ({ ...prev, title: e.target.value }))}
              />
              <Input 
                placeholder="URL (Google Drive, Excel Online, etc.)" 
                className="rounded-xl border-slate-200" 
                value={newLink.url}
                onChange={(e) => setNewLink(prev => ({ ...prev, url: e.target.value }))}
              />
            </div>
            <Button 
              className="self-end rounded-xl font-black px-8" 
              onClick={handleSaveLink}
              disabled={isSaving || !newLink.title || !newLink.url}
            >
              {isSaving ? 'Guardando...' : 'Guardar'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="bg-blue-50 border-none shadow-xl shadow-blue-200/20 rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-700 font-black">
              <ShieldCheck className="h-5 w-5" />
              Estado de Habilitación
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-blue-900">{stats.habilitation}%</div>
            <p className="text-xs text-blue-600 font-bold uppercase tracking-wider mt-2">
              Cumplimiento Res. 3100 ({scopeConfig.shortLabel})
            </p>
          </CardContent>
        </Card>

        {scope === 'computing' ? (
          <Card className="bg-cyan-50 border-none shadow-xl shadow-cyan-200/20 rounded-3xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-cyan-800 font-black text-lg">
                <Laptop className="h-5 w-5 text-cyan-600" />
                Estaciones y Servidores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-black text-cyan-950">{techEquipmentCount}</div>
              <p className="text-xs text-cyan-700 font-bold uppercase tracking-wider mt-2">
                Equipos TIC bajo custodia
              </p>
            </CardContent>
          </Card>
        ) : scope === 'infrastructure' ? (
          <Card className="bg-amber-50 border-none shadow-xl shadow-amber-200/20 rounded-3xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-800 font-black text-lg">
                <Building2 className="h-5 w-5 text-amber-600" />
                Sistemas Críticos RETIE
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-black text-amber-950">{techEquipmentCount}</div>
              <p className="text-xs text-amber-700 font-bold uppercase tracking-wider mt-2">
                Equipos de infraestructura activos
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-amber-50 border-none shadow-xl shadow-amber-200/20 rounded-3xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-700 font-black text-lg">
                <AlertCircle className="h-5 w-5" />
                Pendientes INVIMA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-black text-amber-900">{stats.invimaPending}</div>
              <p className="text-xs text-amber-600 font-bold uppercase tracking-wider mt-2">
                Registros por vencer o sin registro
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-3xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-black text-lg">
              <FileText className="h-5 w-5 text-slate-400" />
              Guías Rápidas y Manuales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-slate-900">{stats.guidesCount}</div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-2">
              Protocolos de {scopeConfig.shortLabel.toLowerCase()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Section: Listas de Chequeo de Obligatoriedad (Trimestral) */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              {scopeMeta.title} (Trimestral)
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {scopeMeta.standardReference} • Formato oficial: <span className="font-mono font-bold text-slate-700">{scopeMeta.formCode}</span>
            </p>
          </div>

          {/* Scope switch when in 'all' view */}
          {scope === 'all' && (
            <div className="bg-slate-100 p-1 rounded-xl flex gap-1 self-start">
              <button
                type="button"
                onClick={() => setSelectedChecklistScope('biomedical')}
                className={cn(
                  "flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-black transition-all",
                  selectedChecklistScope === 'biomedical' ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
                )}
              >
                <Stethoscope className="h-3.5 w-3.5" />
                <span>Biomédica</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedChecklistScope('computing')}
                className={cn(
                  "flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-black transition-all",
                  selectedChecklistScope === 'computing' ? "bg-white text-cyan-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
                )}
              >
                <Laptop className="h-3.5 w-3.5" />
                <span>TIC / Sistemas</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedChecklistScope('infrastructure')}
                className={cn(
                  "flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-black transition-all",
                  selectedChecklistScope === 'infrastructure' ? "bg-white text-amber-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
                )}
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>Infraestructura</span>
              </button>
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {services.map((service) => {
            const latest = latestSubmissionsByService[service.id];
            return (
              <Card 
                key={service.id} 
                className="hover:bg-slate-50 transition-all cursor-pointer border-slate-100 rounded-3xl group shadow-sm hover:shadow-md hover:border-primary/30"
                onClick={() => navigate(`/compliance/checklist/${service.id}?scope=${activeChecklistScope}`)}
              >
                <CardHeader className="p-6 pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm font-black flex items-center gap-2 text-slate-900">
                      <ClipboardCheck className="h-4 w-4 text-primary" />
                      {service.name}
                    </CardTitle>
                    <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                      {scopeMeta.formCode}
                    </span>
                  </div>
                  <CardDescription className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 line-clamp-1">
                    {scopeMeta.standardName}
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-6 pb-6 pt-0 space-y-2">
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 font-medium">Estado Trimestral:</span>
                    {latest ? (
                      <span className={cn(
                        "font-black px-2 py-0.5 rounded-md text-[10px]",
                        latest.score >= 90 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                        latest.score >= 70 ? "bg-amber-50 text-amber-700 border border-amber-200" :
                        "bg-red-50 text-red-700 border border-red-200"
                      )}>
                        {latest.score}% • {format(new Date(latest.date), 'dd/MM/yy')}
                      </span>
                    ) : (
                      <span className="font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md text-[10px]">
                        Pendiente
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Frecuencia: Cada 3 meses
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Guías Rápidas */}
      <div className="space-y-4">
        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <FileText className="h-5 w-5 text-slate-400" />
          Guías Rápidas y Protocolos ({scopeConfig.shortLabel})
        </h2>
        {guides.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {guides.map((guide) => (
              <Card key={guide.id} className="bg-white border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow group">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-100 rounded-xl group-hover:bg-primary/10 transition-colors">
                      <Paperclip className="h-4 w-4 text-slate-500 group-hover:text-primary" />
                    </div>
                    <span className="font-bold text-slate-700 text-sm">{guide.title}</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-lg"
                    onClick={() => window.open(guide.url, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 text-slate-400" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center">
            <Paperclip className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 font-bold text-sm">No hay protocolos registrados aún para {scopeConfig.shortLabel.toLowerCase()}.</p>
            <p className="text-slate-400 text-xs mt-1">Usa los botones superiores para añadir links o subir archivos.</p>
          </div>
        )}
      </div>

      {/* Marco Normativo Vigente */}
      <div className="space-y-4">
        <h2 className="text-xl font-black text-slate-900">Marco Normativo Vigente - {scopeConfig.label}</h2>
        <div className="grid gap-4">
          {regulations.map((reg) => (
            <Card key={reg.title} className="border-none shadow-lg shadow-slate-200/50 rounded-3xl overflow-hidden hover:shadow-xl transition-shadow">
              <CardHeader className="pb-4 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-black text-slate-900">{reg.title}</CardTitle>
                    <div className="flex gap-2 mt-1">
                      <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">{reg.type}</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">{reg.status}</span>
                    </div>
                  </div>
                  <Button 
                    variant="default" 
                    size="lg" 
                    className="rounded-2xl font-black px-6 shadow-md shadow-primary/20"
                    onClick={() => window.open(reg.url, '_blank')}
                  >
                    <ExternalLink className="h-5 w-5 mr-2" />
                    Ver PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-sm text-slate-600 leading-relaxed font-medium">{reg.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* In-app feedback modal */}
      {feedback && (
        <FeedbackModal
          isOpen={!!feedback}
          onClose={() => setFeedback(null)}
          title={feedback.title}
          message={feedback.message}
          type={feedback.type}
        />
      )}
    </div>
  );
}
