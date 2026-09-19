/**
 * Tipos e interfaces para el Modelo Institucional de Evaluación y Gestión
 * de Obsolescencia de Tecnologías Biomédicas
 * Códigos Institucionales: GTE-GUI-003-V1 / GTE-MTX-001-V1 / GTE-FCH-TCH
 * Medicina Intensiva del Tolima S.A. - UCI Honda
 */

export type DimensionId = 
  | 'clinical'
  | 'technical'
  | 'maintenance'
  | 'risk'
  | 'economic'
  | 'support'
  | 'environmental'
  | 'regulatory';

export interface DimensionConfig {
  id: DimensionId;
  name: string;
  weight: number; // Porcentaje decimal (e.g. 0.20 para 20%)
  description: string;
  keyQuestion: string;
  sources: string[];
}

export const DIMENSION_CONFIGS: Record<DimensionId, DimensionConfig> = {
  clinical: {
    id: 'clinical',
    name: 'Clínica',
    weight: 0.20,
    description: 'Criticidad e impacto asistencial en la atención médica y seguridad del paciente',
    keyQuestion: '¿Qué tan importante es para la atención?',
    sources: ['Servicio clínico asignado', 'Clasificación de riesgo biomédico', 'Impacto en soporte vital']
  },
  technical: {
    id: 'technical',
    name: 'Técnica',
    weight: 0.20,
    description: 'Desempeño funcional, precisión metrológica, evolución técnica y estado operativo',
    keyQuestion: '¿Cómo está y qué tan actualizada está?',
    sources: ['Certificados de calibración', 'Calificación metrológica', 'Pruebas de funcionamiento C/NC']
  },
  maintenance: {
    id: 'maintenance',
    name: 'Mantenimiento',
    weight: 0.15,
    description: 'Tendencia y frecuencia de fallas correctivas, tiempo fuera de servicio y costos de mantenimiento',
    keyQuestion: '¿Cuánto falla y cuánto cuesta mantenerla?',
    sources: ['Historial de correctivos (12 meses)', 'Tasa de fallas', 'Costos de repuestos e intervenciones']
  },
  risk: {
    id: 'risk',
    name: 'Riesgo y Seguridad',
    weight: 0.15,
    description: 'Antecedentes de eventos adversos, alertas sanitarias, seguridad eléctrica y del paciente',
    keyQuestion: '¿Representa algún riesgo para el paciente?',
    sources: ['Reportes de tecnovigilancia', 'Alertas sanitarias INVIMA', 'Pruebas de seguridad eléctrica']
  },
  economic: {
    id: 'economic',
    name: 'Económica',
    weight: 0.10,
    description: 'Sostenibilidad financiera: costo de continuar reparando vs. costo de reposición del activo',
    keyQuestion: '¿Es sostenible continuar utilizándola?',
    sources: ['Costo acumulado de repuestos', 'Valor comercial / reposición', 'Relación costo/beneficio']
  },
  support: {
    id: 'support',
    name: 'Soporte Tecnológico',
    weight: 0.10,
    description: 'Disponibilidad de repuestos originales, servicio técnico del fabricante y estado EOL/EOS',
    keyQuestion: '¿Hay repuestos, servicio y actualizaciones?',
    sources: ['Disponibilidad del fabricante', 'Antigüedad vs. vida útil estimada', 'Declaración de soporte']
  },
  environmental: {
    id: 'environmental',
    name: 'Ambiental / Economía Circular',
    weight: 0.05,
    description: 'Capacidad de repotenciación, reuso de partes, eficiencia energética y disposición final',
    keyQuestion: '¿Se puede reparar, actualizar o reutilizar?',
    sources: ['Viabilidad de cambio de partes', 'Reutilización de componentes', 'Consumo y residuos']
  },
  regulatory: {
    id: 'regulatory',
    name: 'Regulatoria',
    weight: 0.05,
    description: 'Vigencia de registro sanitario INVIMA, habilitación en salud y estándares de acreditación',
    keyQuestion: '¿Cumple las condiciones aplicables?',
    sources: ['Registro Sanitario INVIMA', 'Estándares de habilitación', 'Normativa vigente']
  }
};

export type ObsolescenceLevel = 'Bajo' | 'Moderado' | 'Medio' | 'Alto' | 'Crítico';

export type ObsolescenceAction = 
  | 'Continuar operación'
  | 'Continuar + seguimiento'
  | 'Planificar intervención'
  | 'Programar renovación / actualización'
  | 'Priorizar intervención / renovación o retiro';

export type ObsolescenceHorizon = 'Corto' | 'Mediano' | 'Largo';

export interface DimensionScore {
  dimension: DimensionId;
  score: number; // 1 to 5
  autoScore: number; // 1 to 5 (sugerido por el algoritmo)
  manualOverride: boolean;
  justification: string;
}

export interface ObsolescenceEvaluation {
  id: string;
  equipmentId: string;
  equipmentName: string;
  equipmentCode: string;
  serviceId: string;
  serviceName: string;
  brand: string;
  model: string;
  serial: string;
  manufacturingYear?: number;
  acquisitionYear?: number;
  yearsInService: number;
  usefulLifeYears: number;
  riskClass: string;
  
  // 8 Dimensiones
  scores: Record<DimensionId, DimensionScore>;
  
  // Resultados calculados
  index: number; // 1.00 a 5.00
  level: ObsolescenceLevel;
  action: ObsolescenceAction;
  priority: 'Baja' | 'Media' | 'Alta' | 'Crítica';
  horizon: ObsolescenceHorizon;
  projectedYear: number;
  
  // Datos de auditoría y gestión
  evaluatorId: string;
  evaluatorName: string;
  evaluationDate: string; // ISO date
  observations: string;
  evidenceNotes?: string;
  
  // Plan de Renovación (si aplica nivel Alto o Crítico)
  renewalPlan?: {
    estimatedCost?: number;
    currency?: string;
    justification?: string;
    fundingSource?: string;
    status: 'En planeación' | 'Cotización' | 'Aprobado' | 'Ejecutado' | 'Descartado';
  };
  
  // Seguimiento a planes (Página 3 de la matriz)
  followUps?: ObsolescenceFollowUp[];
  
  createdAt?: any;
  updatedAt?: any;
}

export interface ObsolescenceFollowUp {
  id: string;
  date: string;
  responsibleName: string;
  activity: string;
  result: string;
  evidenceUrl?: string;
  evidenceName?: string;
  newAction?: string;
}

export interface ObsolescenceIndicators {
  totalScheduled: number;
  totalEvaluated: number;
  complianceRate: number; // Porcentaje evaluado / programado (Meta >= 95%)
  totalPrioritizedRenewal: number; // Nivel Alto o Crítico
  renewalRate: number; // (Priorizados / Evaluados) * 100
  byLevelCount: Record<ObsolescenceLevel, number>;
  byHorizonCount: Record<ObsolescenceHorizon, number>;
  totalEstimatedRenewalBudget: number;
}
