import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  Stethoscope, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  ClipboardList,
  ArrowRight,
  Info,
  X
} from 'lucide-react';
import { collection, onSnapshot, query, where, limit, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Equipment, MaintenanceReport, Service, ComplianceSubmission, AlertConfig } from '@/types';
import { parseISO, differenceInDays } from 'date-fns';

const DEFAULT_CONFIG: AlertConfig = {
  invimaLeadDays: 30,
  maintenanceLeadDays: 7,
  checklistLeadDays: 5,
  defaultDismissDays: 3,
  emailNotifications: false
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [showOpDetail, setShowOpDetail] = React.useState(false);
  const [equipment, setEquipment] = React.useState<Equipment[]>([]);
  const [services, setServices] = React.useState<Service[]>([]);
  const [submissions, setSubmissions] = React.useState<ComplianceSubmission[]>([]);
  const [pendingMaintenance, setPendingMaintenance] = React.useState<Equipment[]>([]);
  const [recentReports, setRecentReports] = React.useState<MaintenanceReport[]>([]);
  const [config, setConfig] = React.useState<AlertConfig>(DEFAULT_CONFIG);
  const [totalAlertCount, setTotalAlertCount] = React.useState(0);

  // Load config and alerts dismissed map from localStorage
  const [dismissedMap] = React.useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('dismissed_alerts_map');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  React.useEffect(() => {
    const loadConfig = async () => {
      const docRef = doc(db, 'config', 'alerts');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setConfig(docSnap.data() as AlertConfig);
      }
    };
    loadConfig();
  }, []);

  React.useEffect(() => {
    const now = new Date();

    // 1. Real-time equipment
    const unsubEquip = onSnapshot(collection(db, 'equipment'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Equipment[];
      setEquipment(data);
      
      const pendingManto = data.filter(e => {
        if (!e.nextMaintenance) return false;
        if (['baja', 'baja_repuestos'].includes(e.status)) return false;
        const nextDate = new Date(e.nextMaintenance);
        const diffDays = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays < 7;
      });
      setPendingMaintenance(pendingManto);
    }, (error) => {
      console.warn("Dashboard equipment snapshot error:", error);
    });

    // 2. Real-time services
    const unsubServices = onSnapshot(collection(db, 'services'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Service[];
      setServices(data);
    }, (error) => {
      console.warn("Dashboard services snapshot error:", error);
    });

    // 3. Real-time checklist submissions
    const unsubSubs = onSnapshot(collection(db, 'compliance_submissions'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data() })) as ComplianceSubmission[];
      setSubmissions(data);
    }, (error) => {
      console.warn("Dashboard submissions snapshot error:", error);
    });

    // 4. Recent reports
    const qReports = query(
      collection(db, 'reports'), 
      orderBy('date', 'desc'), 
      limit(5)
    );
    const unsubReports = onSnapshot(qReports, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as MaintenanceReport[];
      setRecentReports(data);
    }, (error) => {
      console.warn("Dashboard reports snapshot error:", error);
    });

    return () => {
      unsubEquip();
      unsubServices();
      unsubSubs();
      unsubReports();
    };
  }, []);

  // Compute total alert count matching Alerts page cards
  React.useEffect(() => {
    const now = new Date();
    const currentTime = now.getTime();
    let count = 0;

    // A. Equipment Alerts
    equipment.forEach(eq => {
      // Skip decommissioned equipment
      if (['baja', 'baja_repuestos'].includes(eq.status)) return;

      // INVIMA
      if (eq.registrationExpiration) {
        const expiration = parseISO(eq.registrationExpiration);
        const diff = differenceInDays(expiration, now);
        if (diff <= (config.invimaLeadDays || 30)) {
          const alertId = `invima-${eq.id}`;
          if (!dismissedMap[alertId] || currentTime > dismissedMap[alertId]) count++;
        }
      } else if (!eq.registrationInvima) {
        const alertId = `invima-missing-${eq.id}`;
        if (!dismissedMap[alertId] || currentTime > dismissedMap[alertId]) count++;
      }

      // Maintenance
      if (eq.nextMaintenance) {
        const nextManto = parseISO(eq.nextMaintenance);
        const diff = differenceInDays(nextManto, now);
        if (diff <= (config.maintenanceLeadDays || 7)) {
          const alertId = `manto-${eq.id}`;
          if (!dismissedMap[alertId] || currentTime > dismissedMap[alertId]) count++;
        }
      }
    });

    // B. Checklist Alerts
    services.forEach(service => {
      const serviceSubs = submissions
        .filter(s => s.serviceId === service.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      const latestSub = serviceSubs[0];
      let needsChecklist = false;

      if (!latestSub) {
        needsChecklist = true;
      } else {
        const nextReview = parseISO(latestSub.nextReviewDate);
        const diff = differenceInDays(nextReview, now);
        if (diff <= (config.checklistLeadDays || 5)) {
          needsChecklist = true;
        }
      }

      if (needsChecklist) {
        const alertId = `checklist-${service.id}`;
        if (!dismissedMap[alertId] || currentTime > dismissedMap[alertId]) count++;
      }
    });

    setTotalAlertCount(count);
  }, [equipment, services, submissions, config, dismissedMap]);

  const totalEquip = equipment.length;
  const outOfService = equipment.filter(e => e.status === 'out_of_service' || e.status === 'maintenance' || e.status === 'paused');
  const decommissioned = equipment.filter(e => e.status === 'baja' || e.status === 'baja_repuestos');
  const activeEquipCount = totalEquip - decommissioned.length;
  const operationalPercent = activeEquipCount > 0 ? Math.round(((activeEquipCount - outOfService.length) / activeEquipCount) * 100) : 100;

  const stats = [
    {
      title: 'Total Equipos',
      value: totalEquip.toString(),
      description: 'Equipos registrados',
      icon: Stethoscope,
      color: 'text-sky-600',
      bg: 'bg-sky-50',
      href: '/inventory'
    },
    {
      title: 'Mantenimientos Pendientes',
      value: pendingMaintenance.length.toString(),
      description: 'Próximos 7 días',
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      href: '/schedule'
    },
    {
      title: 'Alertas Críticas',
      value: totalAlertCount.toString(),
      description: 'Total alertas activas',
      icon: AlertCircle,
      color: 'text-destructive',
      bg: 'bg-destructive/10',
      href: '/alerts'
    },
    {
      title: 'Operativos',
      value: `${operationalPercent}%`,
      description: 'Disponibilidad actual',
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      onClick: () => setShowOpDetail(!showOpDetail)
    },
  ];

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div className="flex items-end justify-between border-b pb-6">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">Tablero de Control</h1>
          <p className="text-lg text-slate-500 mt-2">
            Resumen del estado tecnológico y operativo de la institución.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card 
            key={stat.title} 
            className={cn(
              "cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/60 hover:-translate-y-1 border-none shadow-lg shadow-slate-200/50 rounded-2xl overflow-hidden group relative",
              stat.title === 'Operativos' && showOpDetail && "ring-2 ring-primary"
            )}
            onClick={() => stat.href ? navigate(stat.href) : stat.onClick?.()}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 pt-6">
              <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                {stat.title}
              </CardTitle>
              <div className={cn("p-2.5 rounded-xl shadow-inner transition-transform group-hover:scale-110", stat.bg)}>
                <stat.icon className={cn("h-5 w-5", stat.color)} />
              </div>
            </CardHeader>
            <CardContent className="pb-6">
              <div className="text-4xl font-black text-slate-900 tracking-tight">{stat.value}</div>
              <p className="text-xs font-medium text-slate-400 mt-1 flex items-center gap-1">
                {stat.description}
                {stat.title === 'Operativos' && <Info className="h-3 w-3" />}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {showOpDetail && (
        <Card className="border-none shadow-xl shadow-amber-100/50 bg-amber-50/30 rounded-3xl animate-in slide-in-from-top-4 duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg font-bold text-amber-900">Detalle de Operatividad</CardTitle>
              <CardDescription className="text-amber-700">Equipos que afectan la disponibilidad actual ({100 - operationalPercent}%)</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setShowOpDetail(false)} className="rounded-full hover:bg-amber-100 text-amber-900">
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="pb-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {outOfService.length > 0 ? outOfService.map(e => (
                <div key={e.id} className="bg-white p-4 rounded-2xl shadow-sm border border-amber-100 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm text-slate-900">{e.name}</p>
                    <p className="text-xs text-slate-500">{e.brand} - {e.model}</p>
                  </div>
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 capitalize">
                    {e.status.replace('_', ' ')}
                  </Badge>
                </div>
              )) : (
                <p className="text-sm text-amber-700 font-medium">Todos los equipos están operativos.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b px-8 py-6 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold text-slate-900">
                {pendingMaintenance.length > 0 ? 'Mantenimientos Pendientes' : 'Mantenimientos Recientes'}
              </CardTitle>
              <CardDescription className="text-slate-500">
                {pendingMaintenance.length > 0 
                  ? 'Equipos que requieren atención técnica inmediata.' 
                  : 'Últimos reportes generados por el equipo técnico.'}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/schedule')} className="text-primary font-bold">
              Ver Todo <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-8">
            <div className="space-y-4">
              {pendingMaintenance.length > 0 ? (
                pendingMaintenance.slice(0, 5).map((e) => (
                  <div key={e.id} className="flex items-center gap-5 rounded-2xl border border-amber-100 bg-amber-50/20 p-5 transition-colors hover:bg-amber-50/40">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 shadow-inner">
                      <Clock className="h-6 w-6 text-amber-600" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-base font-bold text-slate-900 leading-none">{e.name}</p>
                      <p className="text-sm text-slate-500 font-medium">
                        Próximo: {e.nextMaintenance} <span className="mx-1 text-slate-300">•</span> {e.location}
                      </p>
                    </div>
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 rounded-lg px-3 py-1 text-xs font-bold">
                      Pendiente
                    </Badge>
                  </div>
                ))
              ) : recentReports.length > 0 ? (
                recentReports.map((r) => (
                  <div key={r.id} className="flex items-center gap-5 rounded-2xl border border-slate-100 p-5 transition-colors hover:bg-slate-50/50">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 shadow-inner">
                      <ClipboardList className="h-6 w-6 text-sky-600" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-base font-bold text-slate-900 leading-none">
                        {r.equipmentName || `Reporte #${r.reportNumber}`}
                      </p>
                      <p className="text-sm text-slate-500 font-medium capitalize">
                        {r.type === 'preventive' ? 'Preventivo' : 'Correctivo'} <span className="mx-1 text-slate-300">•</span> {new Date(r.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }).toUpperCase()}
                      </p>
                    </div>
                    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 rounded-lg px-3 py-1 text-xs font-bold">
                      Completado
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-slate-400">No hay registros para mostrar.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3 border-none shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b px-8 py-6 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl font-bold text-slate-900">Resumen de Alertas</CardTitle>
              <CardDescription className="text-slate-500">
                Alertas activas que requieren atención.
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/alerts')} className="text-destructive font-bold">
              Ir a Alertas
            </Button>
          </CardHeader>
          <CardContent className="p-8">
            <div className="space-y-4">
               {totalAlertCount > 0 ? (
                 <div className="flex items-center gap-5 rounded-2xl border border-red-50 bg-red-50/10 p-5 transition-colors hover:bg-red-50/20">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 shadow-inner">
                      <AlertCircle className="h-6 w-6 text-destructive" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-base font-bold text-slate-900 leading-none">Alertas Pendientes</p>
                      <p className="text-xs text-destructive font-bold uppercase tracking-tighter">
                        Hay {totalAlertCount} notificaciones activas en el sistema.
                      </p>
                    </div>
                  </div>
               ) : (
                <div className="text-center py-10 text-slate-400">Sin alertas activas.</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
