import React from 'react';
import {
  Equipment,
  MaintenanceReport,
  DimensionId,
  DimensionScore,
  DIMENSION_CONFIGS,
  ObsolescenceEvaluation
} from '@/types';
import {
  generateFullObsolescenceEvaluation,
  calculateObsolescenceIndex,
  classifyObsolescence,
  getObsolescenceLevelStyles,
  autoEvaluateDimensions
} from '@/lib/obsolescence-calculator';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs';
import {
  Gauge,
  Save,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle2
} from 'lucide-react';

interface ObsolescenceEvaluationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment;
  reports?: MaintenanceReport[];
  existingEvaluation?: ObsolescenceEvaluation | null;
  onSaved?: (evaluation: ObsolescenceEvaluation) => void;
}

const SCORE_LABELS: Record<number, { title: string; desc: string }> = {
  1: { title: '1 - Favorable', desc: 'Condición adecuada sin novedades' },
  2: { title: '2 - Seguimiento', desc: 'Oportunidad de monitoreo' },
  3: { title: '3 - Intermedia', desc: 'Condición moderada a vigilar' },
  4: { title: '4 - Desfavorable', desc: 'Requiere intervención programada' },
  5: { title: '5 - Crítica', desc: 'Condición crítica o alto riesgo' },
};

export const ObsolescenceEvaluationModal: React.FC<ObsolescenceEvaluationModalProps> = ({
  open,
  onOpenChange,
  equipment,
  reports = [],
  existingEvaluation,
  onSaved
}) => {
  const { user } = useAuth();
  const [saving, setSaving] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'dimensions' | 'plan' | 'summary'>('dimensions');

  // Inicializar estado de evaluación
  const [evaluation, setEvaluation] = React.useState<ObsolescenceEvaluation>(() => {
    if (existingEvaluation) return existingEvaluation;
    return generateFullObsolescenceEvaluation(equipment, reports, {
      id: user?.uid || 'sys',
      name: user?.displayName || 'Ingeniero Biomédico'
    });
  });

  // Re-sincronizar si cambia el equipo o la evaluación existente
  React.useEffect(() => {
    if (open) {
      if (existingEvaluation) {
        setEvaluation(existingEvaluation);
      } else {
        const auto = generateFullObsolescenceEvaluation(equipment, reports, {
          id: user?.uid || 'sys',
          name: user?.displayName || 'Ingeniero Biomédico'
        });
        setEvaluation(auto);
      }
    }
  }, [open, equipment, existingEvaluation, reports, user]);

  // Actualizar un puntaje de dimensión
  const handleScoreChange = (dim: DimensionId, newScore: number) => {
    setEvaluation(prev => {
      const updatedScores: Record<DimensionId, DimensionScore> = {
        ...prev.scores,
        [dim]: {
          ...prev.scores[dim],
          score: newScore,
          manualOverride: true
        }
      };
      const newIndex = calculateObsolescenceIndex(updatedScores);
      const classification = classifyObsolescence(newIndex);

      return {
        ...prev,
        scores: updatedScores,
        index: newIndex,
        level: classification.level,
        action: classification.action,
        priority: classification.priority,
        horizon: classification.horizon,
        projectedYear: classification.projectedYear,
        // Inicializar plan si sube a Alto o Crítico y no existe
        renewalPlan: (classification.level === 'Alto' || classification.level === 'Crítico')
          ? prev.renewalPlan || {
              estimatedCost: equipment.cost ? equipment.cost * 1.2 : 0,
              currency: 'COP',
              justification: 'Fallas recurrentes, evolución tecnológica o fin de soporte.',
              fundingSource: 'Presupuesto de inversión institucional',
              status: 'En planeación'
            }
          : prev.renewalPlan
      };
    });
  };

  // Actualizar justificación de una dimensión
  const handleJustificationChange = (dim: DimensionId, text: string) => {
    setEvaluation(prev => ({
      ...prev,
      scores: {
        ...prev.scores,
        [dim]: {
          ...prev.scores[dim],
          justification: text,
          manualOverride: true
        }
      }
    }));
  };

  // Restablecer todas las dimensiones al cálculo automático algorítmico
  const handleResetToAuto = () => {
    const autoScores = autoEvaluateDimensions(equipment, reports);
    const newIndex = calculateObsolescenceIndex(autoScores);
    const classification = classifyObsolescence(newIndex);

    setEvaluation(prev => ({
      ...prev,
      scores: autoScores,
      index: newIndex,
      level: classification.level,
      action: classification.action,
      priority: classification.priority,
      horizon: classification.horizon,
      projectedYear: classification.projectedYear
    }));
  };

  // Guardar en Firestore
  const handleSave = async () => {
    setSaving(true);
    try {
      const evalId = `obs-${equipment.id}`;
      const finalEval: ObsolescenceEvaluation = {
        ...evaluation,
        id: evalId,
        equipmentId: equipment.id,
        equipmentName: equipment.name,
        equipmentCode: equipment.assetNumber || equipment.serial || equipment.id,
        serviceId: equipment.serviceId || 'NA',
        serviceName: equipment.serviceName || 'No asignado',
        brand: equipment.brand || 'N/A',
        model: equipment.model || 'N/A',
        serial: equipment.serial || 'N/A',
        evaluatorId: user?.uid || 'sys',
        evaluatorName: user?.displayName || 'Ingeniero Biomédico',
        evaluationDate: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // 1. Guardar en colección obsolescence_evaluations
      await setDoc(doc(db, 'obsolescence_evaluations', evalId), finalEval);

      // 2. Actualizar campos de obsolescencia en el documento de equipment
      await updateDoc(doc(db, 'equipment', equipment.id), {
        lastObsolescenceIndex: finalEval.index,
        lastObsolescenceLevel: finalEval.level,
        lastObsolescenceAction: finalEval.action,
        lastObsolescenceHorizon: finalEval.horizon,
        lastObsolescenceDate: finalEval.evaluationDate
      });

      if (onSaved) onSaved(finalEval);
      onOpenChange(false);
    } catch (error) {
      console.error('Error al guardar evaluación de obsolescencia:', error);
      alert('Error al guardar la evaluación. Por favor intente nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  const styles = getObsolescenceLevelStyles(evaluation.level);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 rounded-3xl border-slate-200">
        <DialogHeader className="p-6 pb-4 bg-slate-900 text-white rounded-t-3xl border-b border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/70 px-2 py-0.5 rounded-md border border-emerald-500/30">
                  GTE-GUI-003-V1 / GTE-MTX-001
                </span>
                <span className="text-xs text-slate-400">UCI Honda</span>
              </div>
              <DialogTitle className="text-xl font-black text-white flex items-center gap-2">
                Evaluación de Obsolescencia Tecnológica
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-300">
                {equipment.name} • Serie: <span className="font-semibold text-white">{equipment.serial || 'N/A'}</span> • Placa: <span className="font-semibold text-white">{equipment.assetNumber || 'N/A'}</span>
              </DialogDescription>
            </div>

            {/* Score pill preview */}
            <div className="bg-white/10 border border-white/15 p-3 rounded-2xl flex items-center gap-3 shrink-0">
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Índice Calculado
                </span>
                <span className="text-2xl font-black text-white leading-none">
                  {evaluation.index} <span className="text-xs text-slate-400 font-normal">/ 5.0</span>
                </span>
              </div>
              <Badge className={`text-xs font-black px-2.5 py-1.5 border shadow-sm ${styles.badgeBg}`}>
                {evaluation.level}
              </Badge>
            </div>
          </div>

          {/* Action & Horizon Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800 text-xs">
            <div>
              <span className="text-slate-400 text-[10px] block uppercase font-bold">Acción Recomendada:</span>
              <span className="font-bold text-slate-200">{evaluation.action}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block uppercase font-bold">Horizonte:</span>
              <span className="font-bold text-slate-200">{evaluation.horizon} Plazo (Año {evaluation.projectedYear})</span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block uppercase font-bold">Prioridad:</span>
              <span className="font-bold text-slate-200">{evaluation.priority}</span>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-6">
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <TabsList className="bg-slate-100 p-1 rounded-xl">
                <TabsTrigger value="dimensions" className="rounded-lg text-xs font-bold px-3">
                  8 Dimensiones Ponderadas
                </TabsTrigger>
                {(evaluation.level === 'Alto' || evaluation.level === 'Crítico') && (
                  <TabsTrigger value="plan" className="rounded-lg text-xs font-bold px-3 text-orange-700 data-[state=active]:text-orange-950">
                    Plan de Renovación (GTE-MTX-001 Pág. 2)
                  </TabsTrigger>
                )}
                <TabsTrigger value="summary" className="rounded-lg text-xs font-bold px-3">
                  Resumen y Observaciones
                </TabsTrigger>
              </TabsList>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetToAuto}
                className="h-8 text-xs font-bold rounded-xl text-slate-600 border-slate-200 hover:bg-slate-50"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                Restablecer a Cálculo Automático
              </Button>
            </div>

            {/* TAB 1: 8 DIMENSIONES */}
            <TabsContent value="dimensions" className="space-y-4 pt-3 focus-visible:outline-none">
              <p className="text-xs text-slate-500">
                Califique cada dimensión en escala de 1 a 5 con base en la evidencia objetiva institucional (reportes, calibraciones, fallas e INVIMA):
              </p>

              <div className="space-y-3">
                {(Object.keys(DIMENSION_CONFIGS) as DimensionId[]).map((dimKey) => {
                  const config = DIMENSION_CONFIGS[dimKey];
                  const currentScore = evaluation.scores[dimKey];
                  const scoreValue = currentScore?.score || 1;

                  return (
                    <div 
                      key={dimKey} 
                      className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-slate-300 transition-all shadow-xs space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-black text-slate-900">{config.name}</h4>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              Peso: {Math.round(config.weight * 100)}%
                            </span>
                            {currentScore?.autoScore !== undefined && (
                              <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                                <Sparkles className="h-3 w-3 text-amber-500" />
                                Sugerido: {currentScore.autoScore}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {config.keyQuestion}
                          </p>
                        </div>

                        {/* Score selector 1-5 */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {[1, 2, 3, 4, 5].map((val) => {
                            const isSelected = scoreValue === val;
                            let activeClass = 'bg-slate-900 text-white';
                            if (val === 1) activeClass = 'bg-emerald-600 text-white';
                            if (val === 2) activeClass = 'bg-sky-600 text-white';
                            if (val === 3) activeClass = 'bg-amber-600 text-white';
                            if (val === 4) activeClass = 'bg-orange-600 text-white';
                            if (val === 5) activeClass = 'bg-rose-600 text-white';

                            return (
                              <button
                                key={val}
                                type="button"
                                onClick={() => handleScoreChange(dimKey, val)}
                                title={SCORE_LABELS[val]?.desc}
                                className={`w-9 h-9 rounded-xl text-xs font-black transition-all flex flex-col items-center justify-center ${
                                  isSelected 
                                    ? `${activeClass} shadow-md scale-105 ring-2 ring-slate-900/10` 
                                    : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                <span>{val}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Justification input */}
                      <div>
                        <Input
                          value={currentScore?.justification || ''}
                          onChange={(e) => handleJustificationChange(dimKey, e.target.value)}
                          placeholder="Justificación basada en evidencia..."
                          className="h-8 text-xs font-medium rounded-xl border-slate-200 bg-slate-50/50 focus-visible:bg-white"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            {/* TAB 2: PLAN DE RENOVACIÓN */}
            {(evaluation.level === 'Alto' || evaluation.level === 'Crítico') && (
              <TabsContent value="plan" className="space-y-4 pt-3 focus-visible:outline-none">
                <div className="bg-orange-50/80 border border-orange-200 p-4 rounded-2xl space-y-1">
                  <h4 className="text-sm font-black text-orange-900 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    Tecnología Priorizada para Renovación (Nivel {evaluation.level})
                  </h4>
                  <p className="text-xs text-orange-700">
                    Según la matriz GTE-MTX-001 (Página 2), las tecnologías con calificación Alta o Crítica deben estructurarse con proyección presupuestal.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-700">Costo Estimado de Reposición (COP)</Label>
                    <Input
                      type="number"
                      value={evaluation.renewalPlan?.estimatedCost || ''}
                      onChange={(e) => setEvaluation(prev => ({
                        ...prev,
                        renewalPlan: {
                          ...prev.renewalPlan,
                          estimatedCost: Number(e.target.value),
                          status: prev.renewalPlan?.status || 'En planeación'
                        }
                      }))}
                      placeholder="Ej: 35000000"
                      className="rounded-xl h-10 font-bold"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-700">Fuente de Financiación</Label>
                    <Input
                      value={evaluation.renewalPlan?.fundingSource || ''}
                      onChange={(e) => setEvaluation(prev => ({
                        ...prev,
                        renewalPlan: {
                          ...prev.renewalPlan,
                          fundingSource: e.target.value,
                          status: prev.renewalPlan?.status || 'En planeación'
                        }
                      }))}
                      placeholder="Ej: Presupuesto de inversión / Concurrencia"
                      className="rounded-xl h-10 text-xs"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-xs font-bold text-slate-700">Justificación Técnica y Operativa</Label>
                    <Textarea
                      rows={3}
                      value={evaluation.renewalPlan?.justification || ''}
                      onChange={(e) => setEvaluation(prev => ({
                        ...prev,
                        renewalPlan: {
                          ...prev.renewalPlan,
                          justification: e.target.value,
                          status: prev.renewalPlan?.status || 'En planeación'
                        }
                      }))}
                      placeholder="Detalle la justificación basada en fallas, costo acumulado de repuestos o fin de soporte..."
                      className="rounded-xl text-xs"
                    />
                  </div>
                </div>
              </TabsContent>
            )}

            {/* TAB 3: RESUMEN */}
            <TabsContent value="summary" className="space-y-4 pt-3 focus-visible:outline-none">
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 font-bold block uppercase text-[10px]">Años en Servicio:</span>
                    <span className="text-sm font-black text-slate-800">{evaluation.yearsInService} años</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block uppercase text-[10px]">Vida Útil Estándar:</span>
                    <span className="text-sm font-black text-slate-800">{evaluation.usefulLifeYears} años</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block uppercase text-[10px]">Horizonte de Intervención:</span>
                    <span className="text-sm font-black text-slate-800">{evaluation.horizon} Plazo</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block uppercase text-[10px]">Año Proyectado:</span>
                    <span className="text-sm font-black text-slate-800">{evaluation.projectedYear}</span>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <Label className="text-xs font-bold text-slate-700">Observaciones Generales de la Evaluación</Label>
                  <Textarea
                    rows={4}
                    value={evaluation.observations || ''}
                    onChange={(e) => setEvaluation(prev => ({ ...prev, observations: e.target.value }))}
                    placeholder="Conclusiones de la evaluación para el Comité de Tecnovigilancia y Gerencia..."
                    className="rounded-xl text-xs bg-white"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="p-4 px-6 bg-slate-50 rounded-b-3xl border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-[11px] text-slate-400 font-medium">
            Evaluador: <span className="font-bold text-slate-700">{user?.displayName || 'Ingeniero Biomédico'}</span>
          </p>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs font-bold h-10 px-4"
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl text-xs font-black h-10 px-5 bg-slate-900 hover:bg-slate-800 text-white shadow-md flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Guardando...' : 'Guardar Evaluación Oficial'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
