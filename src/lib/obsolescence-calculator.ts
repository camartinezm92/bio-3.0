/**
 * Motor de Cálculo para el Modelo Institucional de Evaluación y Gestión
 * de Obsolescencia de Tecnologías Biomédicas
 * Código: GTE-GUI-003-V1 / GTE-MTX-001-V1
 * Medicina Intensiva del Tolima S.A. - UCI Honda
 */

import {
  Equipment,
  MaintenanceReport,
  DimensionId,
  DimensionScore,
  DIMENSION_CONFIGS,
  ObsolescenceLevel,
  ObsolescenceAction,
  ObsolescenceHorizon,
  ObsolescenceEvaluation,
  ObsolescenceIndicators
} from '@/types';

/**
 * Calcula los años en servicio de un equipo a partir de su año de adquisición o fecha
 */
export function calculateYearsInService(equipment: Equipment, currentYear = new Date().getFullYear()): number {
  if (equipment.acquisitionYear && equipment.acquisitionYear > 1980) {
    return Math.max(0, currentYear - equipment.acquisitionYear);
  }
  if (equipment.acquisitionDate) {
    const year = new Date(equipment.acquisitionDate).getFullYear();
    if (!isNaN(year) && year > 1980) {
      return Math.max(0, currentYear - year);
    }
  }
  if (equipment.manufacturingYear && equipment.manufacturingYear > 1980) {
    return Math.max(0, currentYear - equipment.manufacturingYear);
  }
  return 3; // Valor conservador por defecto si no hay registro
}

/**
 * Determina la vida útil de referencia en años según el tipo de equipo y clase de riesgo
 */
export function getReferenceUsefulLife(equipment: Equipment): number {
  if (equipment.usefulLifeYears && equipment.usefulLifeYears > 0) {
    return equipment.usefulLifeYears;
  }
  // Vida útil promedio según estándares biomédicos
  switch (equipment.riskClass) {
    case 'III':
      return 7; // Soporte vital crítico: 7 años
    case 'IIb':
      return 8;
    case 'IIa':
      return 10;
    case 'I':
    default:
      return 10;
  }
}

/**
 * Evalúa automáticamente cada una de las 8 dimensiones con base en los datos del equipo e historial
 */
export function autoEvaluateDimensions(
  equipment: Equipment,
  reports: MaintenanceReport[] = [],
  existingScores?: Record<DimensionId, DimensionScore>
): Record<DimensionId, DimensionScore> {
  const currentYear = new Date().getFullYear();
  const yearsInService = calculateYearsInService(equipment, currentYear);
  const usefulLife = getReferenceUsefulLife(equipment);
  const lifeRatio = usefulLife > 0 ? (yearsInService / usefulLife) * 100 : 50;

  // Filtrar reportes de los últimos 12 meses
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const recentReports = reports.filter(r => {
    if (!r.date) return false;
    const d = new Date(r.date);
    return !isNaN(d.getTime()) && d >= oneYearAgo;
  });

  const correctivesCount = recentReports.filter(r => r.type === 'corrective').length;
  const preventivesCount = recentReports.filter(r => r.type === 'preventive').length;
  const isOperative = equipment.status === 'active' || equipment.status === 'reserva';
  const isOutOfService = equipment.status === 'out_of_service' || equipment.status === 'baja';

  // Costo acumulado de repuestos
  const totalSparePartsCost = reports.reduce((acc, r) => {
    if (!r.spareParts || !Array.isArray(r.spareParts)) return acc;
    const partsSum = r.spareParts.reduce((pAcc, p) => pAcc + (Number(p.value) * (p.quantity || 1) || 0), 0);
    return acc + partsSum;
  }, 0);

  // 1. CLÍNICA (20%): Criticidad de la atención y soporte vital
  let autoClinical = 2;
  const service = (equipment.serviceName || '').toLowerCase();
  const isCriticalArea = service.includes('uci') || service.includes('intensiv') || service.includes('cirug') || service.includes('quir');
  
  if (equipment.riskClass === 'III' && isCriticalArea) {
    autoClinical = 5;
  } else if (equipment.riskClass === 'III' || (equipment.riskClass === 'IIb' && isCriticalArea)) {
    autoClinical = 4;
  } else if (equipment.riskClass === 'IIb' || (equipment.riskClass === 'IIa' && isCriticalArea)) {
    autoClinical = 3;
  } else if (equipment.riskClass === 'IIa') {
    autoClinical = 2;
  } else {
    autoClinical = 1;
  }

  // 2. TÉCNICA (20%): Estado funcional y metrología
  let autoTechnical = 2;
  if (isOutOfService) {
    autoTechnical = 5;
  } else if (equipment.status === 'maintenance') {
    autoTechnical = 4;
  } else if (equipment.status === 'baja_repuestos') {
    autoTechnical = 5;
  } else {
    // Si tiene calibración vencida o sin calibrar requiriéndola
    if (equipment.calibrationFrequency && equipment.nextCalibration) {
      const nextCal = new Date(equipment.nextCalibration);
      if (!isNaN(nextCal.getTime()) && nextCal < new Date()) {
        autoTechnical = 3; // Calibración vencida
      } else {
        autoTechnical = 1;
      }
    } else {
      autoTechnical = 1;
    }
  }

  // 3. MANTENIMIENTO (15%): Fallas y correctivos en los últimos 12 meses
  let autoMaintenance = 1;
  if (isOutOfService || correctivesCount >= 5) {
    autoMaintenance = 5; // Fallas recurrentes críticas
  } else if (correctivesCount >= 3) {
    autoMaintenance = 4; // Fallas frecuentes
  } else if (correctivesCount === 2) {
    autoMaintenance = 3; // Incremento moderado
  } else if (correctivesCount === 1) {
    autoMaintenance = 2; // Fallas ocasionales
  } else {
    autoMaintenance = 1; // Sin tendencia significativa de fallas
  }

  // 4. RIESGO Y SEGURIDAD (15%): Seguridad del paciente y alertas
  let autoRisk = 1;
  if (equipment.status === 'out_of_service') {
    autoRisk = 4;
  } else if (equipment.riskClass === 'III' && correctivesCount >= 2) {
    autoRisk = 3;
  } else if (equipment.riskClass === 'III') {
    autoRisk = 2;
  } else {
    autoRisk = 1;
  }

  // 5. ECONÓMICA (10%): Costos acumulados de reparación
  let autoEconomic = 1;
  if (equipment.cost && equipment.cost > 0) {
    const costRatio = (totalSparePartsCost / equipment.cost) * 100;
    if (costRatio > 60) autoEconomic = 5;
    else if (costRatio > 40) autoEconomic = 4;
    else if (costRatio > 25) autoEconomic = 3;
    else if (costRatio > 10) autoEconomic = 2;
    else autoEconomic = 1;
  } else {
    if (totalSparePartsCost > 10000000) autoEconomic = 4;
    else if (totalSparePartsCost > 4000000) autoEconomic = 3;
    else if (totalSparePartsCost > 1000000) autoEconomic = 2;
    else autoEconomic = 1;
  }

  // 6. SOPORTE TECNOLÓGICO (10%): Antigüedad y disponibilidad de repuestos
  let autoSupport = 1;
  if (lifeRatio > 120) {
    autoSupport = 5; // Equipo superó vida útil y soporte comprometido
  } else if (lifeRatio > 100) {
    autoSupport = 4; // Superó vida útil
  } else if (lifeRatio > 75) {
    autoSupport = 3; // Entre 75% y 100% de vida útil
  } else if (lifeRatio > 50) {
    autoSupport = 2; // Entre 50% y 75%
  } else {
    autoSupport = 1; // <= 50% de vida útil
  }

  // 7. AMBIENTAL / ECONOMÍA CIRCULAR (5%): Posibilidad de repotenciación y reuso
  let autoEnvironmental = 2; // Estándar: reparable con repuestos estándar
  if (lifeRatio > 100) {
    autoEnvironmental = 3;
  }

  // 8. REGULATORIA (5%): Registro INVIMA y normatividad
  let autoRegulatory = 1;
  if (!equipment.registrationInvima || equipment.registrationInvima.trim() === '') {
    autoRegulatory = 3; // Sin registro documentado en ficha
  } else if (equipment.registrationExpiration) {
    const expDate = new Date(equipment.registrationExpiration);
    if (!isNaN(expDate.getTime()) && expDate < new Date()) {
      autoRegulatory = 4; // Registro INVIMA vencido
    }
  }

  // Armar scores respetando si el usuario ya hizo un override manual
  const buildScore = (dim: DimensionId, autoScore: number, defaultJust: string): DimensionScore => {
    const existing = existingScores?.[dim];
    if (existing && existing.manualOverride) {
      return {
        ...existing,
        autoScore
      };
    }
    return {
      dimension: dim,
      score: existing?.score ?? autoScore,
      autoScore,
      manualOverride: existing?.manualOverride ?? false,
      justification: existing?.justification ?? defaultJust
    };
  };

  return {
    clinical: buildScore(
      'clinical', 
      autoClinical, 
      `Criticidad basada en clasificación de riesgo ${equipment.riskClass} y servicio ${equipment.serviceName || 'General'}.`
    ),
    technical: buildScore(
      'technical', 
      autoTechnical, 
      isOperative ? 'Equipo operativo en condiciones técnicas adecuadas.' : 'Equipo con novedades técnicas o fuera de servicio.'
    ),
    maintenance: buildScore(
      'maintenance', 
      autoMaintenance, 
      `${correctivesCount} correctivo(s) y ${preventivesCount} preventivo(s) en los últimos 12 meses.`
    ),
    risk: buildScore(
      'risk', 
      autoRisk, 
      'Sin incidentes adversos graves reportados en tecnovigilancia.'
    ),
    economic: buildScore(
      'economic', 
      autoEconomic, 
      `Costo acumulado en repuestos: $${totalSparePartsCost.toLocaleString('es-CO')}.`
    ),
    support: buildScore(
      'support', 
      autoSupport, 
      `${yearsInService} años en servicio de ${usefulLife} años de vida útil estimada (${Math.round(lifeRatio)}%).`
    ),
    environmental: buildScore(
      'environmental', 
      autoEnvironmental, 
      'Tecnología reparable con posibilidades de sustitución de componentes y economía circular.'
    ),
    regulatory: buildScore(
      'regulatory', 
      autoRegulatory, 
      equipment.registrationInvima ? `Registro INVIMA: ${equipment.registrationInvima}` : 'Pendiente verificar vigencia en base INVIMA.'
    )
  };
}

/**
 * Calcula el Índice Ponderado de Obsolescencia (IO)
 * IO = Sum(Puntaje * Peso)
 */
export function calculateObsolescenceIndex(scores: Record<DimensionId, DimensionScore>): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const key of Object.keys(DIMENSION_CONFIGS) as DimensionId[]) {
    const config = DIMENSION_CONFIGS[key];
    const scoreItem = scores[key];
    const scoreVal = scoreItem ? scoreItem.score : 1;
    weightedSum += scoreVal * config.weight;
    totalWeight += config.weight;
  }

  if (totalWeight === 0) return 1.0;
  const rawIndex = weightedSum / totalWeight;
  return Number(rawIndex.toFixed(2));
}

/**
 * Clasifica el índice en Nivel, Acción, Prioridad y Horizonte según la matriz institucional GTE-MTX-001
 */
export function classifyObsolescence(index: number, currentYear = new Date().getFullYear()): {
  level: ObsolescenceLevel;
  action: ObsolescenceAction;
  priority: 'Baja' | 'Media' | 'Alta' | 'Crítica';
  horizon: ObsolescenceHorizon;
  projectedYear: number;
} {
  if (index <= 1.80) {
    return {
      level: 'Bajo',
      action: 'Continuar operación',
      priority: 'Baja',
      horizon: 'Largo',
      projectedYear: currentYear + 5
    };
  }
  if (index <= 2.60) {
    return {
      level: 'Moderado',
      action: 'Continuar + seguimiento',
      priority: 'Media',
      horizon: 'Largo',
      projectedYear: currentYear + 4
    };
  }
  if (index <= 3.40) {
    return {
      level: 'Medio',
      action: 'Planificar intervención',
      priority: 'Media',
      horizon: 'Mediano',
      projectedYear: currentYear + 3
    };
  }
  if (index <= 4.20) {
    return {
      level: 'Alto',
      action: 'Programar renovación / actualización',
      priority: 'Alta',
      horizon: 'Corto',
      projectedYear: currentYear + 1
    };
  }
  return {
    level: 'Crítico',
    action: 'Priorizar intervención / renovación o retiro',
    priority: 'Crítica',
    horizon: 'Corto',
    projectedYear: currentYear
  };
}

/**
 * Construye una evaluación completa para un equipo
 */
export function generateFullObsolescenceEvaluation(
  equipment: Equipment,
  reports: MaintenanceReport[] = [],
  evaluator = { id: 'sys', name: 'Ingeniería Biomédica' },
  existingScores?: Record<DimensionId, DimensionScore>
): ObsolescenceEvaluation {
  const currentYear = new Date().getFullYear();
  const yearsInService = calculateYearsInService(equipment, currentYear);
  const usefulLife = getReferenceUsefulLife(equipment);
  const scores = autoEvaluateDimensions(equipment, reports, existingScores);
  const index = calculateObsolescenceIndex(scores);
  const classification = classifyObsolescence(index, currentYear);

  return {
    id: `obs-${equipment.id}`,
    equipmentId: equipment.id,
    equipmentName: equipment.name,
    equipmentCode: equipment.assetNumber || equipment.serial || equipment.id,
    serviceId: equipment.serviceId || 'NA',
    serviceName: equipment.serviceName || 'No asignado',
    brand: equipment.brand || 'N/A',
    model: equipment.model || 'N/A',
    serial: equipment.serial || 'N/A',
    manufacturingYear: equipment.manufacturingYear,
    acquisitionYear: equipment.acquisitionYear,
    yearsInService,
    usefulLifeYears: usefulLife,
    riskClass: equipment.riskClass || 'IIa',
    scores,
    index,
    level: classification.level,
    action: classification.action,
    priority: classification.priority,
    horizon: classification.horizon,
    projectedYear: classification.projectedYear,
    evaluatorId: evaluator.id,
    evaluatorName: evaluator.name,
    evaluationDate: new Date().toISOString(),
    observations: classification.level === 'Crítico' || classification.level === 'Alto'
      ? 'Tecnología priorizada para inclusión en el plan de renovación y gestión presupuestal.'
      : 'Tecnología funcional; continuar seguimiento periódico según cronograma.',
    renewalPlan: (classification.level === 'Alto' || classification.level === 'Crítico') ? {
      estimatedCost: equipment.cost ? equipment.cost * 1.2 : 0,
      currency: 'COP',
      justification: 'Fallas recurrentes, evolución tecnológica o pérdida de soporte de fabricante.',
      fundingSource: 'Presupuesto de inversión institucional',
      status: 'En planeación'
    } : undefined
  };
}

/**
 * Devuelve clases Tailwind y configuraciones de color según el nivel de obsolescencia
 */
export function getObsolescenceLevelStyles(level: ObsolescenceLevel) {
  switch (level) {
    case 'Bajo':
      return {
        badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        barBg: 'bg-emerald-500',
        text: 'text-emerald-700',
        border: 'border-emerald-500',
        hex: '#10b981',
        description: 'Tecnología adecuada - Continuar operación'
      };
    case 'Moderado':
      return {
        badgeBg: 'bg-sky-100 text-sky-800 border-sky-300',
        barBg: 'bg-sky-500',
        text: 'text-sky-700',
        border: 'border-sky-500',
        hex: '#0ea5e9',
        description: 'Requiere seguimiento - Continuar + seguimiento'
      };
    case 'Medio':
      return {
        badgeBg: 'bg-amber-100 text-amber-800 border-amber-300',
        barBg: 'bg-amber-500',
        text: 'text-amber-700',
        border: 'border-amber-500',
        hex: '#f59e0b',
        description: 'Requiere planificación - Planificar intervención'
      };
    case 'Alto':
      return {
        badgeBg: 'bg-orange-100 text-orange-800 border-orange-300',
        barBg: 'bg-orange-500',
        text: 'text-orange-700',
        border: 'border-orange-500',
        hex: '#f97316',
        description: 'Requiere intervención - Programar renovación / actualización'
      };
    case 'Crítico':
    default:
      return {
        badgeBg: 'bg-rose-100 text-rose-800 border-rose-300',
        barBg: 'bg-rose-600',
        text: 'text-rose-700',
        border: 'border-rose-600',
        hex: '#e11d48',
        description: 'Prioridad de intervención - Priorizar renovación o retiro'
      };
  }
}

/**
 * Calcula los indicadores institucionales de la guía GTE-GUI-003-V1
 */
export function calculateInstitutionalIndicators(
  evaluations: ObsolescenceEvaluation[],
  totalScheduledInventory = 0
): ObsolescenceIndicators {
  const totalEvaluated = evaluations.length;
  const totalScheduled = totalScheduledInventory > 0 ? totalScheduledInventory : totalEvaluated;
  const complianceRate = totalScheduled > 0 ? Math.min(100, (totalEvaluated / totalScheduled) * 100) : 100;

  const byLevelCount: Record<ObsolescenceLevel, number> = {
    Bajo: 0,
    Moderado: 0,
    Medio: 0,
    Alto: 0,
    Crítico: 0
  };

  const byHorizonCount: Record<ObsolescenceHorizon, number> = {
    Corto: 0,
    Mediano: 0,
    Largo: 0
  };

  let totalEstimatedRenewalBudget = 0;

  for (const ev of evaluations) {
    if (byLevelCount[ev.level] !== undefined) {
      byLevelCount[ev.level]++;
    }
    if (byHorizonCount[ev.horizon] !== undefined) {
      byHorizonCount[ev.horizon]++;
    }
    if (ev.renewalPlan?.estimatedCost) {
      totalEstimatedRenewalBudget += Number(ev.renewalPlan.estimatedCost);
    }
  }

  const totalPrioritizedRenewal = byLevelCount['Alto'] + byLevelCount['Crítico'];
  const renewalRate = totalEvaluated > 0 ? (totalPrioritizedRenewal / totalEvaluated) * 100 : 0;

  return {
    totalScheduled,
    totalEvaluated,
    complianceRate: Number(complianceRate.toFixed(1)),
    totalPrioritizedRenewal,
    renewalRate: Number(renewalRate.toFixed(1)),
    byLevelCount,
    byHorizonCount,
    totalEstimatedRenewalBudget
  };
}
