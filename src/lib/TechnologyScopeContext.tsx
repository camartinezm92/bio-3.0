import React, { createContext, useContext, useState, useEffect } from 'react';
import { TechnologyScope } from '@/types';
import { Stethoscope, Laptop, Cpu, Layers, LucideIcon } from 'lucide-react';
import { collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { resolveEquipmentScope } from '@/lib/scopeUtils';

export interface ScopeInfo {
  id: TechnologyScope;
  label: string;
  shortLabel: string;
  subtitle: string;
  description: string;
  icon: LucideIcon;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  activeBg: string;
  textColor: string;
  accentColor: string;
  headerGradient: string;
}

export const SCOPES_CONFIG: Record<TechnologyScope, ScopeInfo> = {
  biomedical: {
    id: 'biomedical',
    label: 'Tecnología Biomédica',
    shortLabel: 'Biomédica',
    subtitle: 'Equipos Médicos y Clínicos',
    description: 'Soporte de vida, monitoreo, quirófano, diagnóstico clínico y rehabilitación.',
    icon: Stethoscope,
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-700',
    badgeBorder: 'border-emerald-200',
    activeBg: 'bg-emerald-600',
    textColor: 'text-emerald-700',
    accentColor: 'emerald',
    headerGradient: 'from-emerald-950 via-teal-900 to-slate-900'
  },
  computing: {
    id: 'computing',
    label: 'Tecnología de Cómputo y Sistemas (TIC)',
    shortLabel: 'Cómputo y TIC',
    subtitle: 'Sistemas e Infraestructura Digital',
    description: 'Computadores, servidores, portátiles, switches, routers, impresoras y periféricos.',
    icon: Laptop,
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-indigo-700',
    badgeBorder: 'border-indigo-200',
    activeBg: 'bg-indigo-600',
    textColor: 'text-indigo-700',
    accentColor: 'indigo',
    headerGradient: 'from-indigo-950 via-slate-900 to-slate-900'
  },
  infrastructure: {
    id: 'infrastructure',
    label: 'Infraestructura y Otras Tecnologías',
    shortLabel: 'Infraestructura',
    subtitle: 'Equipos Críticos de Soporte Hospitalario',
    description: 'Plantas eléctricas, UPS industriales, climatización, redes de gases y autoclaves.',
    icon: Cpu,
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-200',
    activeBg: 'bg-amber-600',
    textColor: 'text-amber-800',
    accentColor: 'amber',
    headerGradient: 'from-amber-950 via-slate-900 to-slate-900'
  },
  other: {
    id: 'other',
    label: 'Otras Tecnologías Institucionales',
    shortLabel: 'Otros Activos',
    subtitle: 'Tecnologías y Equipos de Apoyo',
    description: 'Mobiliario técnico, instrumentación auxiliar y tecnologías de soporte general.',
    icon: Layers,
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-800',
    badgeBorder: 'border-purple-200',
    activeBg: 'bg-purple-600',
    textColor: 'text-purple-800',
    accentColor: 'purple',
    headerGradient: 'from-purple-950 via-slate-900 to-slate-900'
  },
  all: {
    id: 'all',
    label: 'Consolidado General Institucional',
    shortLabel: 'Consolidado Global',
    subtitle: 'Parque Tecnológico Completo',
    description: 'Vista unificada y transversal de todas las tecnologías hospitalarias.',
    icon: Layers,
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-800',
    badgeBorder: 'border-slate-300',
    activeBg: 'bg-slate-800',
    textColor: 'text-slate-800',
    accentColor: 'slate',
    headerGradient: 'from-slate-900 via-slate-800 to-slate-950'
  }
};

interface TechnologyScopeContextType {
  scope: TechnologyScope;
  setScope: (scope: TechnologyScope) => void;
  scopeConfig: ScopeInfo;
  allScopes: ScopeInfo[];
  filterByScope: <T extends { technologyScope?: 'biomedical' | 'computing' | 'infrastructure' | string }>(items: T[]) => T[];
  isScopeItem: (item: { technologyScope?: 'biomedical' | 'computing' | 'infrastructure' | string }) => boolean;
}

const STORAGE_KEY = 'hospital_active_tech_scope';

const TechnologyScopeContext = createContext<TechnologyScopeContextType | undefined>(undefined);

export function TechnologyScopeProvider({ children }: { children: React.ReactNode }) {
  const [scope, setScopeState] = useState<TechnologyScope>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && (saved === 'biomedical' || saved === 'computing' || saved === 'infrastructure' || saved === 'other' || saved === 'all')) {
        return saved as TechnologyScope;
      }
    } catch (e) {
      console.warn('Could not read scope from localStorage', e);
    }
    return 'biomedical';
  });

  const setScope = (newScope: TechnologyScope) => {
    setScopeState(newScope);
    try {
      localStorage.setItem(STORAGE_KEY, newScope);
    } catch (e) {
      console.warn('Could not save scope to localStorage', e);
    }
  };

  // Migración transparente y en segundo plano de registros existentes sin technologyScope
  useEffect(() => {
    const runMigration = async () => {
      try {
        const migratedKey = 'hospital_migrated_scopes_v4';
        if (localStorage.getItem(migratedKey)) return;

        const collectionsToMigrate = ['equipment', 'minor_devices', 'transfers', 'providers', 'reports'];
        for (const colName of collectionsToMigrate) {
          try {
            const snap = await getDocs(collection(db, colName));
            let batch = writeBatch(db);
            let count = 0;
            let total = 0;

            for (const d of snap.docs) {
              const data = d.data();
              const nameLower = String(data.name || data.equipmentName || '').toLowerCase();
              const isMedical = 
                !data.technologyScope ||
                data.registrationInvima ||
                data.biomedicalType ||
                data.riskClass ||
                nameLower.includes('nervio') ||
                nameLower.includes('estimulador') ||
                nameLower.includes('rx ') ||
                nameLower.includes('rx-') ||
                nameLower.includes('rayos x');

              if (isMedical && data.technologyScope !== 'biomedical') {
                batch.update(d.ref, { technologyScope: 'biomedical' });
                count++;
                total++;
                if (count >= 400) {
                  await batch.commit();
                  batch = writeBatch(db);
                  count = 0;
                }
              }
            }

            if (count > 0) {
              await batch.commit();
            }

            if (total > 0) {
              console.log(`[Migration] Migrated ${total} records in '${colName}' to 'biomedical' scope.`);
            }
          } catch (colErr) {
            console.warn(`Migration notice for ${colName}:`, colErr);
          }
        }

        localStorage.setItem(migratedKey, 'true');
      } catch (err) {
        console.warn('Silent scope migration check notice:', err);
      }
    };
    runMigration();
  }, []);

  const scopeConfig = SCOPES_CONFIG[scope] || SCOPES_CONFIG.biomedical;
  const allScopes = Object.values(SCOPES_CONFIG);

  const isScopeItem = (item: any): boolean => {
    if (scope === 'all') return true;
    const itemScope = resolveEquipmentScope(item);
    return itemScope === scope;
  };

  const filterByScope = <T extends any>(items: T[]): T[] => {
    if (scope === 'all') return items;
    return items.filter(item => {
      const itemScope = resolveEquipmentScope(item);
      return itemScope === scope;
    });
  };

  return (
    <TechnologyScopeContext.Provider
      value={{
        scope,
        setScope,
        scopeConfig,
        allScopes,
        filterByScope,
        isScopeItem
      }}
    >
      {children}
    </TechnologyScopeContext.Provider>
  );
}

export function useTechnologyScope() {
  const context = useContext(TechnologyScopeContext);
  if (!context) {
    throw new Error('useTechnologyScope must be used within a TechnologyScopeProvider');
  }
  return context;
}
