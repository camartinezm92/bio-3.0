import { Equipment, TechnologyScope } from '@/types';

/**
 * Robust scope detector that ensures TIC, Industrial, and Other technologies
 * are accurately classified even if legacy records lack technologyScope or were misclassified.
 */
export function resolveEquipmentScope(equipment: Partial<Equipment> | any | null | undefined): 'biomedical' | 'computing' | 'infrastructure' | 'other' {
  if (!equipment) return 'biomedical';

  // 1. Strict priority for clinical / biomedical indicators:
  // If an equipment has INVIMA registration, biomedical type, or medical risk classification,
  // it is 100% biomedical technology (e.g. "RX PORTATIL", "ESTIMULADOR DE NERVIO PERIFERICO", etc.)
  if (
    equipment.registrationInvima ||
    equipment.biomedicalType ||
    (equipment.riskClass && ['I', 'IIA', 'IIB', 'III', 'IIa', 'IIb'].includes(equipment.riskClass))
  ) {
    return 'biomedical';
  }

  // Clinical equipment names should never be placed in TIC or Industrial
  const nameLower = String(equipment.name || '').toLowerCase();
  if (
    nameLower.includes('nervio') ||
    nameLower.includes('estimulador') ||
    nameLower.includes('rx ') ||
    nameLower.includes('rx-') ||
    nameLower.includes('rayos x') ||
    nameLower.includes('desfibrilador') ||
    nameLower.includes('ventilador') ||
    nameLower.includes('electrocardiog') ||
    nameLower.includes('monitor de signos') ||
    nameLower.includes('bomba de infusion') ||
    nameLower.includes('oximetro') ||
    nameLower.includes('succionador')
  ) {
    return 'biomedical';
  }

  const raw = String(equipment.technologyScope || '').trim().toLowerCase();

  // Strict check on the explicit technologyScope (segmento)
  if (raw === 'computing' || raw === 'tic' || raw === 'sistemas' || raw === 'it') {
    return 'computing';
  }
  if (raw === 'infrastructure' || raw === 'infraestructura' || raw === 'industrial') {
    return 'infrastructure';
  }
  if (raw === 'other' || raw === 'otros') {
    return 'other';
  }
  if (raw === 'biomedical' || raw === 'biomedico' || raw === 'biomédico') {
    return 'biomedical';
  }

  // All legacy records and equipment without technologyScope are strictly biomedical
  return 'biomedical';
}

/**
 * Returns the exact titles, macroproceso, proceso, and código for the Hoja de Vida PDF
 */
export function getEquipmentCVHeaders(scope: 'biomedical' | 'computing' | 'infrastructure' | 'other' | string) {
  switch (scope) {
    case 'computing':
      return {
        cvTitle: 'FORMATO HOJA DE VIDA TIC',
        cvMacro: 'Macroproceso: Gestión de tecnología y sistemas',
        cvProceso: 'Proceso: Gestión de Tecnología e Información (TIC)',
        cvCodigo: 'Código: TIC-FOR-023',
        cvArchivo: 'Archivo: Gestión de Infraestructura y Redes TIC'
      };
    case 'infrastructure':
      return {
        cvTitle: 'FORMATO HOJA DE VIDA EQUIPO INDUSTRIAL',
        cvMacro: 'Macroproceso: Gestión de infraestructura y mantenimiento',
        cvProceso: 'Proceso: Gestión de Infraestructura Hospitalaria y Mantenimiento',
        cvCodigo: 'Código: IND-FOR-023',
        cvArchivo: 'Archivo: Gestión de Mantenimiento e Infraestructura'
      };
    case 'other':
      return {
        cvTitle: 'FORMATO HOJA DE VIDA OTROS',
        cvMacro: 'Macroproceso: Gestión de tecnología',
        cvProceso: 'Proceso: Gestión de Tecnología Institucional',
        cvCodigo: 'Código: GTE-FOR-023-GEN',
        cvArchivo: 'Archivo: Gestión Institucional de Activos'
      };
    case 'biomedical':
    default:
      return {
        cvTitle: 'FORMATO HOJA DE VIDA DE DISPOSITIVOS MÉDICOS',
        cvMacro: 'Macroproceso: Gestión de tecnología',
        cvProceso: 'Proceso: Gestión de Tecnología',
        cvCodigo: 'Código: GTE-FOR-023',
        cvArchivo: 'Archivo: Archivo de Gestión de la Tecnología'
      };
  }
}

/**
 * Returns the exact titles, macroproceso, proceso, and código for Maintenance Report PDFs
 */
export function getMaintenanceReportHeaders(scope: 'biomedical' | 'computing' | 'infrastructure' | 'other' | string) {
  switch (scope) {
    case 'computing':
      return {
        reportTitle: 'FORMATO REPORTE TÉCNICO MANTENIMIENTO TIC',
        macroproceso: 'Macroproceso: Gestión de tecnología y sistemas',
        proceso: 'Proceso: Gestión de Tecnología e Información (TIC)',
        codigo: 'Código: TIC-FOR-015'
      };
    case 'infrastructure':
      return {
        reportTitle: 'FORMATO REPORTE TÉCNICO MANTENIMIENTO EQUIPO INDUSTRIAL',
        macroproceso: 'Macroproceso: Gestión de infraestructura y mantenimiento',
        proceso: 'Proceso: Gestión de Infraestructura Hospitalaria y Mantenimiento',
        codigo: 'Código: IND-FOR-015'
      };
    case 'other':
      return {
        reportTitle: 'FORMATO REPORTE TÉCNICO MANTENIMIENTO OTROS',
        macroproceso: 'Macroproceso: Gestión de tecnología',
        proceso: 'Proceso: Gestión de Tecnología Institucional',
        codigo: 'Código: GTE-FOR-015-GEN'
      };
    case 'biomedical':
    default:
      return {
        reportTitle: 'FORMATO REPORTE TÉCNICO MANTENIMIENTO DE DISPOSITIVOS MÉDICOS',
        macroproceso: 'Macroproceso: Gestión de tecnología',
        proceso: 'Proceso: Gestión de Tecnología',
        codigo: 'Código: GTE-FOR-015-V3'
      };
  }
}
