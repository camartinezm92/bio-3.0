import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTechnologyScope, SCOPES_CONFIG } from '@/lib/TechnologyScopeContext';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { Equipment, MaintenanceReport } from '@/types';
import { 
  Stethoscope, 
  Laptop, 
  Cpu, 
  Layers, 
  ArrowRight, 
  Activity, 
  ShieldCheck, 
  Gauge, 
  Wrench,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function TechHub() {
  const navigate = useNavigate();
  const { setScope, scope: currentScope } = useTechnologyScope();
  const { user } = useAuth();

  const [equipments, setEquipments] = React.useState<Equipment[]>([]);
  const [reports, setReports] = React.useState<MaintenanceReport[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const unsubEq = onSnapshot(collection(db, 'equipment'), (snap) => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as Equipment));
      setEquipments(list);
      setLoading(false);
    });

    const unsubRep = onSnapshot(collection(db, 'reports'), (snap) => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as MaintenanceReport));
      setReports(list);
    });

    return () => {
      unsubEq();
      unsubRep();
    };
  }, []);

  const getScopeStats = (scopeId: 'biomedical' | 'computing' | 'infrastructure') => {
    const scopeEquip = equipments.filter(e => (e.technologyScope || 'biomedical') === scopeId);
    const activeEquip = scopeEquip.filter(e => e.status === 'active');
    const inMaintenance = scopeEquip.filter(e => e.status === 'maintenance');
    const criticalObs = scopeEquip.filter(e => e.lastObsolescenceLevel === 'Crítico' || e.lastObsolescenceLevel === 'Alto');

    return {
      total: scopeEquip.length,
      active: activeEquip.length,
      inMaintenance: inMaintenance.length,
      criticalObs: criticalObs.length
    };
  };

  const biomedicalStats = React.useMemo(() => getScopeStats('biomedical'), [equipments]);
  const computingStats = React.useMemo(() => getScopeStats('computing'), [equipments]);
  const infrastructureStats = React.useMemo(() => getScopeStats('infrastructure'), [equipments]);

  const handleSelectScope = (scopeId: 'biomedical' | 'computing' | 'infrastructure' | 'all') => {
    setScope(scopeId);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-6 md:p-10">
      {/* Header institucional */}
      <div className="max-w-6xl w-full mx-auto space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-white tracking-tight">
                  Hospital / Institución de Salud
                </h1>
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] font-bold">
                  GTE Multitecnológico
                </Badge>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Portal de Selección de Áreas Tecnológicas Hospitalarias
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-bold text-slate-200">{user?.displayName || user?.email || 'Usuario'}</div>
              <div className="text-[11px] text-slate-400">{user?.role === 'ADMIN' ? 'Administrador General' : 'Especialista'}</div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-base">
              {user?.displayName?.[0]?.toUpperCase() || '👤'}
            </div>
          </div>
        </header>

        {/* Bienvenida y Descripción */}
        <div className="text-center max-w-2xl mx-auto space-y-2 py-4">
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Seleccione el Área de Gestión Tecnológica
          </h2>
          <p className="text-sm text-slate-400">
            Acceda de forma independiente al inventario, mantenimientos, cronograma y matriz de obsolescencia según la especialidad técnica.
          </p>
        </div>

        {/* Tarjetas de Áreas Tecnológicas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {/* 1. TECNOLOGÍA BIOMÉDICA */}
          <div 
            onClick={() => handleSelectScope('biomedical')}
            className={cn(
              "group relative rounded-3xl p-6 transition-all duration-300 cursor-pointer border flex flex-col justify-between overflow-hidden",
              "bg-slate-900/90 hover:bg-slate-850 border-emerald-500/30 hover:border-emerald-400 hover:shadow-2xl hover:shadow-emerald-500/10",
              currentScope === 'biomedical' && "ring-2 ring-emerald-500/50"
            )}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />
            
            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-between">
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors shadow-sm">
                  <Stethoscope className="h-7 w-7" />
                </div>
                {currentScope === 'biomedical' && (
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] font-bold">
                    Área Activa
                  </Badge>
                )}
              </div>

              <div>
                <h3 className="text-lg font-black text-white group-hover:text-emerald-300 transition-colors">
                  Tecnología Biomédica
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Equipos médicos, soporte vital, monitoreo fisiológico, diagnóstico clínico y quirófanos.
                </p>
              </div>

              {/* Métricas rápidas */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Equipos</span>
                  <span className="text-base font-black text-white">{biomedicalStats.total}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Activos</span>
                  <span className="text-base font-black text-emerald-400">{biomedicalStats.active}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300">Desfibriladores</span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300">Ventiladores</span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300">Monitores</span>
              </div>
            </div>

            <div className="pt-6 relative z-10">
              <Button 
                type="button"
                className="w-full h-11 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 transition-all group-hover:translate-x-0.5"
              >
                <span>Acceder a Biomédica</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* 2. TECNOLOGÍA DE CÓMPUTO Y SISTEMAS (TIC) */}
          <div 
            onClick={() => handleSelectScope('computing')}
            className={cn(
              "group relative rounded-3xl p-6 transition-all duration-300 cursor-pointer border flex flex-col justify-between overflow-hidden",
              "bg-slate-900/90 hover:bg-slate-850 border-indigo-500/30 hover:border-indigo-400 hover:shadow-2xl hover:shadow-indigo-500/10",
              currentScope === 'computing' && "ring-2 ring-indigo-500/50"
            )}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-all pointer-events-none" />
            
            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-between">
                <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-colors shadow-sm">
                  <Laptop className="h-7 w-7" />
                </div>
                {currentScope === 'computing' && (
                  <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-[10px] font-bold">
                    Área Activa
                  </Badge>
                )}
              </div>

              <div>
                <h3 className="text-lg font-black text-white group-hover:text-indigo-300 transition-colors">
                  Cómputo y Sistemas (TIC)
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Estaciones clínicas, servidores, portátiles, switches, routers, impresoras y periféricos.
                </p>
              </div>

              {/* Métricas rápidas */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Equipos</span>
                  <span className="text-base font-black text-white">{computingStats.total}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Activos</span>
                  <span className="text-base font-black text-indigo-400">{computingStats.active}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300">Servidores</span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300">Estaciones HIS</span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300">Switches</span>
              </div>
            </div>

            <div className="pt-6 relative z-10">
              <Button 
                type="button"
                className="w-full h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/30 transition-all group-hover:translate-x-0.5"
              >
                <span>Acceder a Cómputo y TIC</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* 3. INFRAESTRUCTURA Y OTRAS TECNOLOGÍAS */}
          <div 
            onClick={() => handleSelectScope('infrastructure')}
            className={cn(
              "group relative rounded-3xl p-6 transition-all duration-300 cursor-pointer border flex flex-col justify-between overflow-hidden",
              "bg-slate-900/90 hover:bg-slate-850 border-amber-500/30 hover:border-amber-400 hover:shadow-2xl hover:shadow-amber-500/10",
              currentScope === 'infrastructure' && "ring-2 ring-amber-500/50"
            )}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl group-hover:bg-amber-500/20 transition-all pointer-events-none" />
            
            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-between">
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors shadow-sm">
                  <Cpu className="h-7 w-7" />
                </div>
                {currentScope === 'infrastructure' && (
                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px] font-bold">
                    Área Activa
                  </Badge>
                )}
              </div>

              <div>
                <h3 className="text-lg font-black text-white group-hover:text-amber-300 transition-colors">
                  Infraestructura y Otras Tecnologías
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Plantas eléctricas, UPS industriales, climatización, sistemas de vacío y autoclaves de central.
                </p>
              </div>

              {/* Métricas rápidas */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Equipos</span>
                  <span className="text-base font-black text-white">{infrastructureStats.total}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Activos</span>
                  <span className="text-base font-black text-amber-400">{infrastructureStats.active}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300">UPS</span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300">Generadores</span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300">Gases Medicinales</span>
              </div>
            </div>

            <div className="pt-6 relative z-10">
              <Button 
                type="button"
                className="w-full h-11 rounded-2xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-900/30 transition-all group-hover:translate-x-0.5"
              >
                <span>Acceder a Infraestructura</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* 4. Opción Consolidada Institucional */}
        <div 
          onClick={() => handleSelectScope('all')}
          className="rounded-3xl p-5 bg-slate-900/70 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="p-3 rounded-2xl bg-slate-800 text-slate-300 shrink-0">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <h4 className="text-sm font-black text-white">Vista Consolidada Multitecnológica Institucional</h4>
                <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-700">
                  Gerencia / Auditoría
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Visualice el universo completo del hospital ({equipments.length} equipos registrados) sin filtros de área.
              </p>
            </div>
          </div>

          <Button 
            type="button"
            variant="outline"
            className="rounded-xl h-9 px-4 text-xs font-bold border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white shrink-0"
          >
            Abrir Consolidado Global →
          </Button>
        </div>
      </div>

      {/* Footer informativo */}
      <footer className="max-w-6xl w-full mx-auto pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-slate-500 text-xs text-center">
        <span>GTE Hospitalario • Gestión de Mantenimiento y Obsolescencia</span>
        <span>Al ingresar a cualquier área podrá alternar entre ellas en cualquier momento desde la barra superior</span>
      </footer>
    </div>
  );
}
