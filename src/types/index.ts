export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  role: 'ADMIN' | 'USER';
  status: 'active' | 'pending' | 'disabled';
  gender?: 'male' | 'female' | 'other';
  permissions?: {
    [key: string]: {
      view: boolean;
      create: boolean;
      edit: boolean;
      delete: boolean;
    };
  };
  createdAt?: string;
}

export interface Equipment {
  id: string;
  name: string;
  brand: string;
  model: string;
  serial: string;
  originalSerial?: string;
  temporarySerial?: string;
  assetNumber: string;
  serviceId: string;
  serviceName?: string;
  status: 'active' | 'maintenance' | 'out_of_service' | 'paused' | 'reserva' | 'baja_repuestos' | 'baja';
  decommissioningActUrl?: string; // URL for "Acta de Baja" document
  decommissioningDate?: string;
  decommissioningReason?: string;
  riskClass: 'I' | 'IIa' | 'IIb' | 'III';
  biomedicalType: 'diagnostic' | 'treatment' | 'rehabilitation' | 'support';
  acquisitionDate?: string;
  warrantyExpiration?: string;
  manufacturingYear?: number;
  acquisitionYear?: number;
  usefulLifeYears?: number;
  cost?: number;
  lastObsolescenceIndex?: number;
  lastObsolescenceLevel?: 'Bajo' | 'Moderado' | 'Medio' | 'Alto' | 'Crítico';
  lastObsolescenceAction?: string;
  lastObsolescenceHorizon?: string;
  lastObsolescenceDate?: string;
  lastMaintenance?: string;
  nextMaintenance?: string;
  maintenanceFrequency: number; // in months
  lastCalibration?: string;
  nextCalibration?: string;
  calibrationFrequency?: number; // in months
  lastQualification?: string;
  nextQualification?: string;
  qualificationFrequency?: number; // in months
  location: string; // specific room or area
  driveFolderId?: string;
  photoId?: string;
  technicalSheetUrl?: string;
  manualUrl?: string;
  registrationInvima?: string;
  registrationExpiration?: string;
  imageUrl?: string;
  pauseStartDate?: string; // ISO date
  annexes?: { name: string; url: string; driveId?: string }[];
  scheduledMaintenanceMonths?: number[]; // 0-11
  scheduledCalibrationMonths?: number[]; // 0-11
  scheduledQualificationMonths?: number[]; // 0-11
  providerId?: string; // ID del proveedor que lo vendió
  providerName?: string;
  providerCity?: string;
  photoThumbnail?: string; // base64 ligero para listados y pdfs
  
  // --- Detailed Hoja de Vida Fields ---
  accessories?: { description: string; brand: string; model: string; serial: string; reference: string; quantity: number }[];
  physiologicalPrinciple?: string;
  equipmentType?: 'Fijo' | 'Móvil';
  predominantTechnology?: 'Mecánico' | 'Electrónico' | 'Eléctrico' | 'Hidráulico' | 'Neumático' | 'Otro';
  dimensions?: string;
  powerSupply?: string;
  technicalCharacteristics?: {
    voltage?: string;
    amperage?: string;
    temperature?: string;
    power?: string;
    frequency?: string;
    humidity?: string;
    capacity?: string;
    speedRpm?: string;
    pressure?: string;
    lifespan?: string;
    weight?: string;
    other?: string;
  };
  manufacturerInfo?: {
    name?: string;
    address?: string;
    country?: string;
    email?: string;
  };
  biomedicalClassification?: 'Rehabilitación' | 'Prevención' | 'Tratamiento' | 'Diagnóstico' | 'Análisis de Lab' | 'Otro';
  manualsAvailable?: ('Usuario' | 'Servicio' | 'Componentes' | 'Despiece')[];
  manufacturerRecommendations?: string;
}

export interface Provider {
  id: string;
  name: string;
  city?: string;
  address?: string;
  contactName: string;
  phone: string;
  whatsapp?: string;
  email: string;
  specialties: string[];
  createdAt: string;
}

export interface Transfer {
  id: string;
  equipmentId: string;
  equipmentName: string;
  equipmentSerial: string;
  equipmentAsset: string;
  originServiceId: string;
  originServiceName: string;
  destinationServiceId: string;
  destinationServiceName: string;
  destinationLocation?: string;
  isExternal?: boolean;
  externalName?: string;
  temporarySerial?: string;
  date: string;
  technicianId: string;
  technicianName?: string;
  reason: string;
  observations?: string;
  reportNumber: string;
  deliveredBySignature?: string;
  receivedBySignature?: string;
  status: 'completed' | 'pending';
  createdAt?: any;
}

export interface MaintenanceReport {
  id: string;
  equipmentId: string;
  equipmentName: string;
  brand?: string;
  model?: string;
  serial?: string;
  location?: string;
  serviceName?: string;
  registrationInvima?: string;
  technicianId: string;
  technicianName?: string;
  date: string;
  dateReception?: string;
  responsibleReception?: string;
  reportNumber: string;
  type: 'preventive' | 'corrective' | 'calibration';
  subType?: 'plan' | 'revision' | 'reparation' | 'replacement';
  mode?: 'mobile' | 'fixed';
  description: string;
  reporterName?: string;
  reporterRole?: string;
  technicalDiagnosis: string;
  workPerformed: string;
  technologyId?: string;
  technologyName?: string;
  spareParts?: SparePart[];
  verificationItems?: VerificationItem[];
  finalDiagnosis: string;
  equipmentStatus: 'operative' | 'non_operative' | 'retired';
  observations: string;
  deliveredBy: string;
  deliveredByRole: string;
  receivedBy: string;
  receivedByRole: string;
  deliveredBySignature?: string; // base64 image
  receivedBySignature?: string; // base64 image
  photos?: string[]; // base64 photographic evidence images
  pauseDuration?: string; // e.g., "2h 15m"
  calibrationDate?: string;
  nextCalibrationDate?: string;
  status: 'completed' | 'pending';
  driveFileId?: string;
  driveFileUrl?: string;
  attachmentUrl?: string;
  createdAt?: any;
}

export interface SparePart {
  description: string;
  quantity: number;
  provider: string;
  partNumber: string;
  reference: string;
  value: number;
}

export interface VerificationItem {
  name: string;
  status: 'C' | 'CU' | 'NC' | 'NA';
}

export interface Service {
  id: string;
  name: string;
  description?: string;
}

export interface ComplianceItem {
  id: string;
  category: string;
  name: string;
  description?: string;
  normReference: string;
  applicableServices?: string[]; // IDs of services where this item is mandatory
}

export interface Guide {
  id: string;
  title: string;
  url: string;
  type: 'file' | 'link';
  createdAt: string;
}

export interface ComplianceSubmission {
  id: string;
  serviceId: string;
  serviceName: string;
  date: string;
  technicianId: string;
  technicianName: string;
  score: number;
  responses: ComplianceResponse[];
  nextReviewDate: string;
  observations?: string;
}

export interface ComplianceResponse {
  itemId: string;
  itemName: string;
  category: string;
  normReference: string;
  status: 'compliant' | 'non_compliant' | 'na';
  observations: string;
}

export interface AlertConfig {
  invimaLeadDays: number;
  maintenanceLeadDays: number;
  checklistLeadDays: number;
  defaultDismissDays: number;
  emailNotifications: boolean;
}

export interface MinorDevice {
  id: string;
  name: string;
  type: 'instrumental' | 'ropa' | 'manta' | 'kit_rotacion' | 'dispositivo_menor';
  brand?: string;
  model?: string;
  serial?: string;
  assetNumber?: string;
  quantity: number;
  serviceId: string;
  serviceName?: string;
  location?: string;
  status: 'active' | 'maintenance' | 'out_of_service' | 'baja';
  acquisitionDate?: string;
  warrantyExpiration?: string;

  // Regulatory & INVIMA
  registrationInvima?: string;
  registrationExpiration?: string;
  riskClass?: 'I' | 'IIa' | 'IIb' | 'III';
  biomedicalType?: 'diagnostic' | 'treatment' | 'rehabilitation' | 'support';
  biomedicalClassification?: 'Rehabilitación' | 'Prevención' | 'Tratamiento' | 'Diagnóstico' | 'Análisis de Lab' | 'Otro';

  // Technical Specifications
  physiologicalPrinciple?: string;
  equipmentType?: 'Fijo' | 'Móvil';
  predominantTechnology?: 'Mecánico' | 'Electrónico' | 'Eléctrico' | 'Hidráulico' | 'Neumático' | 'Otro';
  dimensions?: string;
  powerSupply?: string;
  technicalCharacteristics?: {
    voltage?: string;
    amperage?: string;
    temperature?: string;
    power?: string;
    frequency?: string;
    humidity?: string;
    capacity?: string;
    speedRpm?: string;
    pressure?: string;
    lifespan?: string;
    weight?: string;
    other?: string;
  };
  manufacturerRecommendations?: string;
  accessories?: { description: string; brand: string; model: string; serial: string; reference: string; quantity: number }[];

  // Provider & Manufacturer
  providerName?: string;
  providerCity?: string;
  manufacturerInfo?: {
    name?: string;
    address?: string;
    country?: string;
    email?: string;
  };

  // Maintenance & Calibration
  maintenanceFrequency?: number; // in months
  lastMaintenance?: string; // date string
  nextMaintenance?: string; // date string
  calibrationFrequency?: number; // in months
  lastCalibration?: string; // date string
  nextCalibration?: string; // date string
  observations?: string;
  createdAt?: string;
}

export interface MinorDeviceReport {
  id: string;
  deviceId: string;
  deviceName: string;
  date: string;
  type: 'preventive' | 'corrective' | 'calibration';
  origin: 'internal' | 'external';
  technicianName?: string; // for internal
  providerName?: string; // for external
  certificateNumber?: string; // for external
  description: string;
  technicalDiagnosis?: string; // for internal
  observations?: string;
  attachmentUrl?: string; // certificate link for external
  createdAt?: any;
}

export * from './obsolescence';
