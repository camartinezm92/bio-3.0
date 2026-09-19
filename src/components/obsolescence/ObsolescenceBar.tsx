import React from 'react';
import {
  Equipment,
  MaintenanceReport,
  ObsolescenceEvaluation,
  DIMENSION_CONFIGS,
  DimensionId
} from '@/types';
import {
  generateFullObsolescenceEvaluation,
  getObsolescenceLevelStyles
} from '@/lib/obsolescence-calculator';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Gauge, Info, ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface ObsolescenceBarProps {
  equipment: Equipment;
  reports?: MaintenanceReport[];
  existingEvaluation?: ObsolescenceEvaluation | null;
  onOpenEvaluationModal?: () => void;
  compact?: boolean;
}

export const ObsolescenceBar: React.FC<ObsolescenceBarProps> = ({
  equipment,
  reports = [],
  existingEvaluation,
  onOpenEvaluationModal,
  compact = false
}) => {
  // Generar evaluación automática si no hay una previa guardada
  const evaluation = React.useMemo(() => {
    if (existingEvaluation) return existingEvaluation;
    return generateFullObsolescenceEvaluation(equipment, reports);
  }, [equipment, reports, existingEvaluation]);

  const styles = getObsolescenceLevelStyles(evaluation.level);

  // Porcentaje visual en la barra de 1 a 5:
  // (index - 1) / (5 - 1) * 100
  const percentage = Math.min(100, Math.max(0, ((evaluation.index - 1) / 4) * 100));

  if (compact) {
    return (
      <div 
        onClick={onOpenEvaluationModal}
        className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity"
        title={`Índice de Obsolescencia: ${evaluation.index} (${evaluation.level})`}
      >
        <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
          <div 
            className={`h-full ${styles.barBg} transition-all duration-500`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <Badge variant="outline" className={`text-[10px] font-black h-5 px-1.5 border ${styles.badgeBg}`}>
          {evaluation.index} - {evaluation.level}
        </Badge>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl ${styles.badgeBg} shrink-0`}>
            <Gauge className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Modelo GTE-MTX-001
              </span>
              <span className="text-[10px] font-semibold text-slate-400">•</span>
              <span className="text-[10px] font-bold text-slate-500">Antigüedad ≠ Obsolescencia</span>
            </div>
            <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
              Índice de Obsolescencia Tecnológica: <span className="text-base text-slate-950 font-black">{evaluation.index} / 5.0</span>
            </h4>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge className={`text-xs font-black px-3 py-1 border shadow-xs ${styles.badgeBg}`}>
            Nivel {evaluation.level}
          </Badge>
          {onOpenEvaluationModal && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenEvaluationModal}
              className="h-8 text-xs font-bold rounded-xl border-slate-300 hover:bg-slate-50 text-slate-700"
            >
              Evaluar / Ajustar
              <ChevronRight className="h-3.5 w-3.5 ml-1 text-slate-400" />
            </Button>
          )}
        </div>
      </div>

      {/* Progress Bar with Color Segments */}
      <div className="space-y-1.5">
        <div className="relative w-full h-3.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
          {/* Background gradient reference */}
          <div className="absolute inset-0 flex">
            <div className="w-[20%] bg-emerald-100/60" title="Bajo (1.0 - 1.8)" />
            <div className="w-[20%] bg-sky-100/60" title="Moderado (1.81 - 2.6)" />
            <div className="w-[20%] bg-amber-100/60" title="Medio (2.61 - 3.4)" />
            <div className="w-[20%] bg-orange-100/60" title="Alto (3.41 - 4.2)" />
            <div className="w-[20%] bg-rose-100/60" title="Crítico (4.21 - 5.0)" />
          </div>

          {/* Active progress indicator */}
          <div
            className={`relative h-full ${styles.barBg} rounded-full transition-all duration-700 shadow-sm`}
            style={{ width: `${Math.max(4, percentage)}%` }}
          />
        </div>

        <div className="flex justify-between items-center text-[10px] font-semibold text-slate-400 px-1">
          <span>1.0 (Favorable)</span>
          <span className="hidden sm:inline">2.0</span>
          <span>3.0</span>
          <span className="hidden sm:inline">4.0</span>
          <span>5.0 (Crítico)</span>
        </div>
      </div>

      {/* Action and Horizon Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
        <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Acción Recomendada
          </span>
          <span className="text-xs font-black text-slate-800 leading-tight">
            {evaluation.action}
          </span>
        </div>

        <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Horizonte de Renovación
          </span>
          <span className="text-xs font-black text-slate-800 leading-tight">
            {evaluation.horizon} Plazo ({evaluation.horizon === 'Corto' ? '0–2 años' : evaluation.horizon === 'Mediano' ? '3–5 años' : '>5 años'})
          </span>
        </div>

        <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 sm:col-span-2 lg:col-span-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Año Proyectado
          </span>
          <span className="text-xs font-black text-slate-800 leading-tight">
            Proyección: {evaluation.projectedYear}
          </span>
        </div>
      </div>

      {/* Mini 8 Dimensions Grid */}
      <div className="pt-2 border-t border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Desglose de las 8 Dimensiones Ponderadas
          </span>
          <span className="text-[10px] text-slate-400">Escala 1 a 5</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(Object.keys(DIMENSION_CONFIGS) as DimensionId[]).map((dimKey) => {
            const dimConfig = DIMENSION_CONFIGS[dimKey];
            const scoreItem = evaluation.scores[dimKey];
            const score = scoreItem?.score || 1;

            let scoreBadgeColor = 'bg-slate-100 text-slate-700';
            if (score <= 1) scoreBadgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
            else if (score === 2) scoreBadgeColor = 'bg-sky-50 text-sky-700 border-sky-200';
            else if (score === 3) scoreBadgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
            else if (score === 4) scoreBadgeColor = 'bg-orange-50 text-orange-700 border-orange-200';
            else if (score >= 5) scoreBadgeColor = 'bg-rose-50 text-rose-700 border-rose-200';

            return (
              <div 
                key={dimKey}
                title={`${dimConfig.name} (${Math.round(dimConfig.weight * 100)}% peso) - ${dimConfig.keyQuestion}\nJustificación: ${scoreItem?.justification || 'Sin justificación'}`}
                className="p-2 rounded-xl bg-slate-50/60 border border-slate-100 hover:border-slate-300 hover:bg-slate-50 transition-colors flex items-center justify-between cursor-help group"
              >
                <div className="truncate pr-1">
                  <span className="text-[11px] font-bold text-slate-700 block truncate group-hover:text-slate-900">
                    {dimConfig.name}
                  </span>
                  <span className="text-[9px] text-slate-400 font-medium">
                    {Math.round(dimConfig.weight * 100)}% peso
                  </span>
                </div>
                <span className={`text-[11px] font-black px-1.5 py-0.5 rounded-md border ${scoreBadgeColor}`}>
                  {score}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
