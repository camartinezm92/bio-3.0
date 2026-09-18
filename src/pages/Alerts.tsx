import * as React from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, FileWarning, Bell, ClipboardCheck, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, where, doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Equipment, ComplianceSubmission, Service, AlertConfig } from '@/types';
import { differenceInDays, parseISO, isAfter, isBefore, addDays, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Sheet, 
  SheetContent, 
  SheetDescription, 
  SheetHeader, 
  SheetTitle,
  SheetFooter
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface AppAlert {
  id: string;
  type: 'maintenance' | 'invima' | 'checklist';
  severity: 'critical' | 'warning';
  title: string;
  equipment?: string;
  service: string;
  targetId?: string; // equipmentId or serviceId
  daysText: string;
  description: string;
  icon: any;
  color: 'destructive' | 'amber';
}

const DEFAULT_CONFIG: AlertConfig = {
  invimaLeadDays: 30,
  maintenanceLeadDays: 7,
  checklistLeadDays: 5,
  defaultDismissDays: 3,
  emailNotifications: false
};

export default function Alerts() {
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(true);
  const [showConfig, setShowConfig] = React.useState(false);
  const [showOmitted, setShowOmitted] = React.useState(false);
  const [config, setConfig] = React.useState<AlertConfig>(DEFAULT_CONFIG);
  const [alerts, setAlerts] = React.useState<AppAlert[]>([]);
  // Store dismissed alerts as { [id: string]: expirationTimestamp }
  const [dismissedMap, setDismissedMap] = React.useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('dismissed_alerts_map');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [isSavingConfig, setIsSavingConfig] = React.useState(false);

  // Sync dismissed map to localStorage
  React.useEffect(() => {
    localStorage.setItem('dismissed_alerts_map', JSON.stringify(dismissedMap));
  }, [dismissedMap]);

  // Load config
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

  const handleSaveConfig = async () => {
    setIsSavingConfig(true);
    try {
      await setDoc(doc(db, 'config', 'alerts'), config);
      setShowConfig(false);
    } catch (error) {
      console.error("Error saving config:", error);
    } finally {
      setIsSavingConfig(false);
    }
  };

  React.useEffect(() => {
    const now = new Date();

    const unsubEquipment = onSnapshot(collection(db, 'equipment'), (snapshot) => {
      const equipmentData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Equipment[];
      const eqAlerts: AppAlert[] = [];

      equipmentData.forEach(eq => {
        // Skip decommissioned equipment
        if (['baja', 'baja_repuestos'].includes(eq.status)) return;

        // 1. Check INVIMA Expiration
        if (eq.registrationExpiration) {
          const expiration = parseISO(eq.registrationExpiration);
          const diff = differenceInDays(expiration, now);

          if (diff <= (config.invimaLeadDays || 30)) {
            eqAlerts.push({
              id: `invima-${eq.id}`,
              type: 'invima',
              severity: diff <= 5 ? 'critical' : 'warning',
              title: 'Registro INVIMA Vencido o Próximo',
              equipment: `${eq.name} (${eq.brand})`,
              service: eq.serviceName || 'Sin Servicio',
              targetId: eq.id,
              daysText: diff < 0 ? `Vencido hace ${Math.abs(diff)} días` : (diff === 0 ? 'Vence hoy' : `Vence en ${diff} días`),
              description: diff < 0 
                ? 'El registro sanitario ha expirado. El equipo no debe usarse hasta renovar.' 
                : 'El registro sanitario está por vencer. Iniciar trámite de renovación.',
              icon: FileWarning,
              color: diff <= 5 ? 'destructive' : 'amber'
            });
          }
        } else if (!eq.registrationInvima) {
          eqAlerts.push({
            id: `invima-missing-${eq.id}`,
            type: 'invima',
            severity: 'warning',
            title: 'Falta Registro INVIMA',
            equipment: `${eq.name} (${eq.brand})`,
            service: eq.serviceName || 'Sin Servicio',
            targetId: eq.id,
            daysText: 'Pendiente',
            description: 'Este equipo no cuenta con registro INVIMA registrado en el sistema.',
            icon: AlertTriangle,
            color: 'amber'
          });
        }

        // 2. Check Preventive Maintenance
        if (eq.nextMaintenance) {
          const nextManto = parseISO(eq.nextMaintenance);
          const diff = differenceInDays(nextManto, now);

          if (diff <= (config.maintenanceLeadDays || 7)) {
            eqAlerts.push({
              id: `manto-${eq.id}`,
              type: 'maintenance',
              severity: diff < 0 ? 'critical' : 'warning',
              title: 'Mantenimiento Preventivo Pendiente',
              equipment: `${eq.name} (${eq.brand})`,
              service: eq.serviceName || 'Sin Servicio',
              targetId: eq.id,
              daysText: diff < 0 ? `Atrasado ${Math.abs(diff)} días` : (diff === 0 ? 'Hoy' : `En ${diff} días`),
              description: diff < 0 
                ? 'MANTENIMIENTO CRÍTICO ATRASADO. Riesgo de falla técnica.' 
                : 'Mantenimiento preventivo programado para esta semana.',
              icon: Clock,
              color: diff < 0 ? 'destructive' : 'amber'
            });
          }
        }
      });

      setAlerts(prev => {
        const otherAlerts = prev.filter(a => a.type === 'checklist');
        return [...eqAlerts, ...otherAlerts].sort((a, b) => b.severity === 'critical' ? 1 : -1);
      });
      setLoading(false);
    }, (error) => {
      console.warn("Alerts equipment snapshot error:", error);
      setLoading(false);
    });

    // 3. Check Compliance Checklists (Trimestral)
    const unsubServices = onSnapshot(collection(db, 'services'), (servicesSnap) => {
      let services = servicesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Service[];
      
      const setupSubmissions = (resolvedServices: Service[]) => {
        return onSnapshot(collection(db, 'compliance_submissions'), (subsSnap) => {
          const submissions = subsSnap.docs.map(doc => doc.data() as ComplianceSubmission);
          const checklistAlerts: AppAlert[] = [];

          resolvedServices.forEach(service => {
            const serviceSubs = submissions
              .filter(s => s.serviceId === service.id)
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            
            const latestSub = serviceSubs[0];
            let needsChecklist = false;
            let daysText = '';
            let severity: 'critical' | 'warning' = 'warning';

            if (!latestSub) {
              needsChecklist = true;
              daysText = 'Nunca realizado';
              severity = 'critical';
            } else {
              const nextReview = parseISO(latestSub.nextReviewDate);
              const diff = differenceInDays(nextReview, now);
              if (diff <= (config.checklistLeadDays || 5)) {
                needsChecklist = true;
                severity = diff < 0 ? 'critical' : 'warning';
                daysText = diff < 0 ? `Vencido hace ${Math.abs(diff)} días` : (diff === 0 ? 'Vence hoy' : `Vence en ${diff} días`);
              }
            }

            if (needsChecklist) {
              checklistAlerts.push({
                id: `checklist-${service.id}`,
                type: 'checklist',
                severity: severity,
                title: 'Lista de Chequeo Normativa Pendiente',
                service: service.name,
                targetId: service.id,
                daysText: daysText,
                description: `El servicio de ${service.name} requiere su verificación trimestral de estándares de habilitación (Res. 3100).`,
                icon: ClipboardCheck,
                color: severity === 'critical' ? 'destructive' : 'amber'
              });
            }
          });

          setAlerts(prev => {
            const eqAlerts = prev.filter(a => a.type !== 'checklist');
            return [...eqAlerts, ...checklistAlerts].sort((a, b) => (a.severity === 'critical' ? -1 : 1));
          });
        }, (error) => {
          console.warn("Alerts submissions snapshot error:", error);
        });
      };

      let unsubSub: () => void = () => {};

      if (services.length === 0) {
        import('@/services/mockData').then(({ mockServices }) => {
           unsubSub = setupSubmissions(mockServices);
        });
      } else {
        unsubSub = setupSubmissions(services);
      }

      return () => unsubSub();
    }, (error) => {
      console.warn("Alerts services snapshot error:", error);
    });

    return () => {
      unsubEquipment();
      unsubServices();
    };
  }, [config]);

  const now = Date.now();
  const activeAlerts = alerts.filter(a => {
    const expiration = dismissedMap[a.id];
    return !expiration || now > expiration;
  });

  const omittedAlerts = alerts.filter(a => {
    const expiration = dismissedMap[a.id];
    return expiration && now <= expiration;
  });

  const handleAction = (alert: AppAlert) => {
    if (alert.type === 'checklist') {
      navigate(`/compliance/checklist/${alert.targetId}`);
    } else {
      navigate(`/equipment/${alert.targetId}`);
    }
  };

  const handleDismiss = (id: string) => {
    const expiration = Date.now() + (config.defaultDismissDays * 24 * 60 * 60 * 1000);
    setDismissedMap(prev => ({ ...prev, [id]: expiration }));
  };

  const handleRestore = (id: string) => {
    setDismissedMap(prev => {
      const newMap = { ...prev };
      delete newMap[id];
      return newMap;
    });
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-end justify-between border-b pb-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Alertas Activas</h1>
          <p className="text-sm text-slate-500 font-bold mt-1">
            Gestión de vencimientos críticos y estándares técnicos.
          </p>
        </div>
        <div className="flex gap-2">
          {omittedAlerts.length > 0 && (
            <Button 
              variant="outline" 
              className="rounded-xl border-amber-200 bg-amber-50 h-10 font-bold text-xs text-amber-700 hover:bg-amber-100"
              onClick={() => setShowOmitted(true)}
            >
              <Clock className="mr-2 h-4 w-4" />
              Ver Omitidas ({omittedAlerts.length})
            </Button>
          )}
          <Button 
            variant="outline" 
            className="rounded-xl border-slate-200 h-10 font-bold text-xs"
            onClick={() => setShowConfig(true)}
          >
            <Bell className="mr-2 h-4 w-4" />
            Configurar Alertas
          </Button>
          <Badge variant="outline" className="px-3 py-1.5 rounded-xl border-slate-200 text-slate-600 font-black text-[10px]">
            {activeAlerts.length} PENDIENTES
          </Badge>
        </div>
      </div>

      <Sheet open={showConfig} onOpenChange={setShowConfig}>
        <SheetContent side="right" className="w-full sm:max-w-md lg:max-w-lg flex flex-col p-0">
          <div className="flex-1 overflow-y-auto px-8 py-10">
            <SheetHeader className="mb-8">
              <SheetTitle className="text-3xl font-black text-slate-900 leading-tight">Configuración de Alertas</SheetTitle>
              <SheetDescription className="font-bold text-slate-500 text-sm mt-2">
                Define con cuánta antelación quieres que el sistema te notifique sobre vencimientos.
              </SheetDescription>
            </SheetHeader>
            
            <div className="space-y-8 pr-2">
              <div className="grid gap-8">
                <div className="space-y-3">
                  <Label htmlFor="invima" className="font-black text-slate-800 text-sm tracking-tight">Lead Time INVIMA (Días)</Label>
                  <Input 
                    id="invima"
                    type="number" 
                    value={config.invimaLeadDays} 
                    onChange={(e) => setConfig(prev => ({ ...prev, invimaLeadDays: parseInt(e.target.value) || 0 }))}
                    className="rounded-2xl h-12 border-slate-200 focus:ring-primary shadow-sm"
                  />
                  <p className="text-[11px] text-slate-400 font-bold leading-relaxed">
                    Aviso previo al vencimiento del Registro Sanitario INVIMA.
                  </p>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="manto" className="font-black text-slate-800 text-sm tracking-tight">Lead Time Mantenimiento (Días)</Label>
                  <Input 
                    id="manto"
                    type="number" 
                    value={config.maintenanceLeadDays} 
                    onChange={(e) => setConfig(prev => ({ ...prev, maintenanceLeadDays: parseInt(e.target.value) || 0 }))}
                    className="rounded-2xl h-12 border-slate-200 focus:ring-primary shadow-sm"
                  />
                   <p className="text-[11px] text-slate-400 font-bold leading-relaxed">Aviso previo para mantenimientos preventivos programados.</p>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="checklist" className="font-black text-slate-800 text-sm tracking-tight">Lead Time Listas de Chequeo (Días)</Label>
                  <Input 
                    id="checklist"
                    type="number" 
                    value={config.checklistLeadDays} 
                    onChange={(e) => setConfig(prev => ({ ...prev, checklistLeadDays: parseInt(e.target.value) || 0 }))}
                    className="rounded-2xl h-12 border-slate-200 focus:ring-primary shadow-sm"
                  />
                  <p className="text-[11px] text-slate-400 font-bold leading-relaxed">Aviso previo al vencimiento del estándar trimestral obligatorio.</p>
                </div>

                <div className="pt-6 border-t border-slate-100">
                  <div className="bg-amber-50/50 p-5 rounded-[2rem] border border-amber-100/50 space-y-4">
                    <div className="space-y-3">
                      <Label htmlFor="dismiss" className="font-black text-amber-900 text-sm tracking-tight flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Días para reaparecer omitidas
                      </Label>
                      <Input 
                        id="dismiss"
                        type="number" 
                        value={config.defaultDismissDays} 
                        onChange={(e) => setConfig(prev => ({ ...prev, defaultDismissDays: parseInt(e.target.value) || 0 }))}
                        className="rounded-2xl h-12 border-amber-200/60 focus:ring-amber-500 bg-white"
                      />
                      <p className="text-[11px] text-amber-700/70 font-bold italic leading-tight">
                        Al darle "Omitir por ahora", la alerta se silenciará por este número de días.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 bg-white border-t border-slate-100 shadow-[0_-10px_40px_rgba(0,0,0,0.02)]">
            <div className="flex gap-4 w-full">
              <Button 
                variant="ghost" 
                onClick={() => setShowConfig(false)} 
                className="rounded-2xl font-black flex-1 h-12 text-slate-500 hover:bg-slate-50"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleSaveConfig} 
                disabled={isSavingConfig} 
                className="rounded-2xl font-black flex-[2] h-12 shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {isSavingConfig ? 'Guardando...' : 'Aplicar Cambios'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={showOmitted} onOpenChange={setShowOmitted}>
        <SheetContent side="right" className="w-full sm:max-w-md lg:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-2xl font-black flex items-center gap-2">
              <Clock className="h-6 w-6 text-amber-600" />
              Alertas Omitidas
            </SheetTitle>
            <SheetDescription className="font-medium">
              Estas alertas han sido silenciadas temporalmente. Puedes restaurarlas aquí.
            </SheetDescription>
          </SheetHeader>
          
          <div className="space-y-4 py-8">
            {omittedAlerts.map((alert) => (
              <div key={alert.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-xl text-slate-400">
                    <alert.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm leading-tight">{alert.title}</h4>
                    <p className="text-[10px] text-slate-500 font-bold uppercase truncate max-w-[200px]">
                      {alert.equipment || alert.service}
                    </p>
                    <p className="text-[10px] text-amber-600 font-black mt-1 uppercase tracking-tighter">
                      Oculta hasta: {new Date(dismissedMap[alert.id]).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="rounded-xl h-8 px-3 text-[10px] font-black border-slate-200 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleRestore(alert.id)}
                >
                  RESTAURAR
                </Button>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {activeAlerts.length === 0 ? (
        <Card className="border-none shadow-xl shadow-slate-200/50 rounded-[2rem] p-16 text-center bg-slate-50/50">
          <div className="bg-emerald-100/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Bell className="h-10 w-10 text-emerald-600" />
          </div>
          <h3 className="text-2xl font-black text-slate-900">¡Todo al día!</h3>
          <p className="text-slate-500 font-medium mt-1">
            No tienes alertas pendientes por gestionar.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {activeAlerts.map((alert) => (
            <Card key={alert.id} className="overflow-hidden border-none shadow-md shadow-slate-200/20 rounded-2xl transition-all hover:shadow-lg hover:shadow-slate-300/30 group relative">
              <div className={cn(
                "absolute left-0 top-0 bottom-0 w-1.5",
                alert.color === 'destructive' ? "bg-red-500" : "bg-amber-400"
              )} />
              <CardHeader className="py-3 px-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2 rounded-xl",
                      alert.color === 'destructive' ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
                    )}>
                      <alert.icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-0">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-black text-slate-900 tracking-tight">{alert.title}</CardTitle>
                        <Badge variant={alert.color === 'destructive' ? 'destructive' : 'secondary'} className="rounded-md px-1.5 py-0 text-[8px] font-black uppercase tracking-wider h-4">
                          {alert.severity === 'critical' ? 'URGENTE' : 'PRÓXIMO'}
                        </Badge>
                      </div>
                      <CardDescription className="text-slate-500 font-bold text-xs">
                        {alert.equipment ? (
                          <><span className="text-slate-700">{alert.equipment}</span> <span className="mx-1 text-slate-300">•</span> {alert.service}</>
                        ) : (
                          <span className="text-primary">{alert.service}</span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={cn(
                      "px-2.5 py-0.5 rounded-lg font-black text-[9px] border uppercase tracking-wider",
                      alert.color === 'destructive' ? "bg-red-50 border-red-100 text-red-700" : "bg-amber-50 border-amber-100 text-amber-700"
                    )}>
                      {alert.daysText}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-3 pt-0">
                <div className="bg-slate-50/50 rounded-xl p-2 px-3 mb-3 border border-slate-100 text-[11px] font-semibold text-slate-600 leading-tight">
                  {alert.description}
                </div>
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="ghost" 
                    className="rounded-lg h-7 px-3 text-[10px] text-slate-400 font-bold hover:text-slate-900 hover:bg-slate-100"
                    onClick={() => handleDismiss(alert.id)}
                  >
                    Omitir
                  </Button>
                  <Button 
                    className="rounded-lg h-7 px-4 font-black text-[10px] shadow-sm transition-all flex items-center gap-1.5"
                    onClick={() => handleAction(alert)}
                  >
                    {alert.type === 'checklist' ? 'Iniciar' : 'Gestionar'}
                    <ExternalLink className="h-2.5 w-2.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
