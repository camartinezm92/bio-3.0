import { ComplianceItem } from '@/types';

export const DEFAULT_COMPLIANCE_ITEMS: ComplianceItem[] = [
  // --- GENERAL ITEMS (Apply to all services) ---
  {
    id: 'gen-1',
    category: 'Habilitación (General)',
    name: 'Registro detallado de equipos (1.1-1.4)',
    description: 'Relación con Nombre, Marca, Modelo y Serie.',
    normReference: 'Resolución 3100 de 2019'
  },
  {
    id: 'gen-2',
    category: 'Habilitación (General)',
    name: 'Documentación Legal (1.5-1.6)',
    description: 'Registro Sanitario/Permiso y Clasificación por Riesgo.',
    normReference: 'Resolución 3100 de 2019'
  },
  {
    id: 'gen-3',
    category: 'Habilitación (General)',
    name: 'Programa de Mantenimiento Preventivo (2.1)',
    description: 'Cumplimiento de recomendaciones del fabricante o protocolo definido.',
    normReference: 'Resolución 3100 de 2019'
  },
  {
    id: 'gen-4',
    category: 'Habilitación (General)',
    name: 'Historias de Vida Técnica (2.2)',
    description: 'Hojas de vida con registros de preventivos y correctivos.',
    normReference: 'Resolución 3100 de 2019'
  },
  {
    id: 'gen-5',
    category: 'Habilitación (General)',
    name: 'Programa de Capacitación (3)',
    description: 'Capacitación en uso de dispositivos por fabricante o prestador.',
    normReference: 'Resolución 3100 de 2019'
  },
  {
    id: 'gen-6',
    category: 'Habilitación (General)',
    name: 'Mantenimiento por Talento Humano (6)',
    description: 'Ejecutado por profesional, tecnólogo o técnico en áreas relacionadas.',
    normReference: 'Resolución 3100 de 2019'
  },

  // --- GASES MEDICINALES Y ESTERILIZACIÓN ---
  {
    id: 'gas-1',
    category: 'Gases Medicinales',
    name: 'Mantenimiento de Sistemas Centralizados',
    description: 'Oxígeno, aire medicinal y vacío mantenidos por personal capacitado.',
    normReference: 'Resolución 3100 de 2019'
  },
  {
    id: 'est-1',
    category: 'Esterilización',
    name: 'Equipos de Esterilización por Vapor',
    description: 'Cuenta con indicadores químicos, físicos y biológicos.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['esterilizacion']
  },

  // --- CARRO DE PARO (Sección 8) ---
  {
    id: 'cp-1',
    category: 'Carro de Paro',
    name: 'Desfibrilador Bifásico (8.1)',
    description: 'Con visualización integrado, cardioversión, marcapaso transcutáneo y paletas A/P.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['hospitalizacion', 'uci-adultos', 'uci-intermedio', 'cirugia', 'ambulancia']
  },
  {
    id: 'cp-2',
    category: 'Carro de Paro',
    name: 'Resucitador Pulmonar Manual (8.2)',
    description: 'Ambu adulto/pediátrico según aplique.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['hospitalizacion', 'uci-adultos', 'uci-intermedio', 'cirugia', 'ambulancia']
  },
  {
    id: 'cp-3',
    category: 'Carro de Paro',
    name: 'Aspirador o Sistema de Vacío (8.3)',
    description: 'Funcionamiento óptimo de succión.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['hospitalizacion', 'uci-adultos', 'uci-intermedio', 'cirugia', 'ambulancia']
  },
  {
    id: 'cp-4',
    category: 'Carro de Paro',
    name: 'Monitor de Signos Vitales (8.4)',
    description: 'ECG, PNI, Saturación O2 y Batería.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['hospitalizacion', 'uci-adultos', 'uci-intermedio', 'cirugia', 'ambulancia']
  },
  {
    id: 'cp-5',
    category: 'Carro de Paro',
    name: 'Laringoscopio (8.5)',
    description: 'Hojas rectas y curvas para adultos y pediátricas.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['hospitalizacion', 'uci-adultos', 'uci-intermedio', 'cirugia', 'ambulancia']
  },

  // --- CONSULTA EXTERNA (Sección 19) ---
  {
    id: 'cons-1',
    category: 'Consulta Externa',
    name: 'Camilla Fija (19.1)',
    description: 'Estado estructural y limpieza.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['consulta-externa']
  },
  {
    id: 'cons-2',
    category: 'Consulta Externa',
    name: 'Escalerilla (19.2)',
    description: 'De dos pasos, antideslizante.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['consulta-externa', 'odontologia']
  },
  {
    id: 'cons-3',
    category: 'Consulta Externa',
    name: 'Tensiómetro A/P (19.3)',
    description: 'Funcionamiento de manómetro y brazaletes.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['consulta-externa', 'hospitalizacion', 'uci-adultos', 'uci-intermedio', 'ambulancia']
  },
  {
    id: 'cons-4',
    category: 'Consulta Externa',
    name: 'Fonendoscopio A/P (19.4)',
    description: 'Integridad de mangueras y olivas.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['consulta-externa', 'hospitalizacion', 'uci-adultos', 'uci-intermedio', 'ambulancia']
  },
  {
    id: 'cons-5',
    category: 'Consulta Externa',
    name: 'Equipo de Órganos de los Sentidos (19.5)',
    description: 'Oftalmoscopio y otoscopio funcionales.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['consulta-externa', 'hospitalizacion', 'uci-adultos', 'uci-intermedio']
  },
  {
    id: 'cons-6',
    category: 'Consulta Externa',
    name: 'Martillo de Reflejos (19.6)',
    description: 'Verificación de integridad.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['consulta-externa']
  },
  {
    id: 'cons-7',
    category: 'Consulta Externa',
    name: 'Tallímetro o Infantómetro (19.7)',
    description: 'Según oferta del servicio.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['consulta-externa']
  },
  {
    id: 'cons-8',
    category: 'Consulta Externa',
    name: 'Cinta Métrica (19.8)',
    description: 'Estado y legibilidad.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['consulta-externa']
  },
  {
    id: 'cons-9',
    category: 'Consulta Externa',
    name: 'Báscula Grado Médico / Pesa Bebé (19.9)',
    description: 'Calibración y funcionamiento.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['consulta-externa']
  },
  {
    id: 'cons-10',
    category: 'Consulta Externa',
    name: 'Termómetro (19.10)',
    description: 'Integridad y precisión.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['consulta-externa']
  },
  {
    id: 'cons-11',
    category: 'Consulta Externa',
    name: 'Negatoscopio o Sistema de Visualización (19.11)',
    description: 'Iluminación uniforme o visualización digital.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['consulta-externa', 'odontologia']
  },

  // --- ODONTOLOGÍA (Sección 23) ---
  {
    id: 'odon-1',
    category: 'Odontología',
    name: 'Unidad Odontológica Fija (23.1)',
    description: 'Funcionamiento de movimientos y mandos.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['odontologia']
  },
  {
    id: 'odon-2',
    category: 'Odontología',
    name: 'Lámpara de Fotocurado o Amalgamador (23.2)',
    description: 'Intensidad lumínica o vibración según aplique.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['odontologia']
  },
  {
    id: 'odon-3',
    category: 'Odontología',
    name: 'Sistema de Succión (23.4)',
    description: 'Incorporado a la unidad o externo.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['odontologia']
  },
  {
    id: 'odon-4',
    category: 'Odontología',
    name: 'Compresor de Aire (23.5)',
    description: 'Para uso odontológico.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['odontologia']
  },
  {
    id: 'odon-5',
    category: 'Odontología',
    name: 'Instrumental Básico (23.6)',
    description: 'Exploradores, espejos, pinzas, etc.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['odontologia']
  },

  // --- IMÁGENES DIAGNÓSTICAS ---
  {
    id: 'img-1',
    category: 'Imágenes Diagnósticas',
    name: 'Generador de Radiación Ionizante (19.1)',
    description: 'Equipo de Rx, Tomógrafo, etc.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['imagenes-diagnosticas']
  },
  {
    id: 'img-2',
    category: 'Imágenes Diagnósticas',
    name: 'Monitor Grado Médico (19.2)',
    description: 'Para imágenes radiológicas.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['imagenes-diagnosticas']
  },
  {
    id: 'img-3',
    category: 'Protección Radiológica',
    name: 'Delantal Plomado (19.3.1)',
    description: 'Estado de blindaje.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['imagenes-diagnosticas']
  },
  {
    id: 'img-4',
    category: 'Protección Radiológica',
    name: 'Protector de Tiroides (19.3.2)',
    description: 'Integridad del elemento.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['imagenes-diagnosticas']
  },
  {
    id: 'img-5',
    category: 'Protección Radiológica',
    name: 'Protector de Gónadas (19.3.3)',
    description: 'Integridad del elemento.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['imagenes-diagnosticas']
  },
  {
    id: 'img-6',
    category: 'Protección Radiológica',
    name: 'Gafas Plomadas (19.3.4)',
    description: 'Si se requiere según procedimientos.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['imagenes-diagnosticas']
  },

  // --- HOSPITALIZACIÓN ---
  {
    id: 'hosp-1',
    category: 'Hospitalización',
    name: 'Camas Hospitalarias (25.1)',
    description: 'Estado de planos y barandas.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['hospitalizacion']
  },
  {
    id: 'hosp-2',
    category: 'Hospitalización',
    name: 'Bomba de Infusión (26.1)',
    description: 'Exactitud y batería.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['hospitalizacion', 'uci-adultos', 'uci-intermedio', 'cirugia']
  },
  {
    id: 'hosp-3',
    category: 'Hospitalización',
    name: 'Glucómetro (26.2)',
    description: 'Tiras vigentes y precisión.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['hospitalizacion', 'uci-adultos', 'uci-intermedio', 'ambulancia']
  },
  {
    id: 'hosp-4',
    category: 'Hospitalización',
    name: 'Silla de Ruedas (26.3)',
    description: 'Frenos y desplazamiento.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['hospitalizacion', 'uci-adultos', 'uci-intermedio']
  },
  {
    id: 'hosp-5',
    category: 'Hospitalización',
    name: 'Electrocardiógrafo (26.7)',
    description: 'Calidad de trazado.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['hospitalizacion', 'uci-adultos', 'uci-intermedio', 'cirugia']
  },
  {
    id: 'hosp-6',
    category: 'Hospitalización',
    name: 'Oxigeno Medicinal (26.8)',
    description: 'Salida de red o cilindro portátil.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['hospitalizacion', 'uci-adultos', 'uci-intermedio']
  },
  {
    id: 'hosp-7',
    category: 'Dotación Habitación (32.1)',
    name: 'Monitor de Signos Vitales (Habitación)',
    description: 'ECG, PNI, Saturación.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['hospitalizacion']
  },
  {
    id: 'hosp-8',
    category: 'Dotación Habitación (32.1)',
    name: 'Oxímetro (Habitación)',
    description: 'Si no está incorporado en el monitor.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['hospitalizacion']
  },
  {
    id: 'hosp-9',
    category: 'Dotación Habitación (32.1)',
    name: 'Aspirador de Secreciones (Habitación)',
    description: 'Succionador o punto de red central.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['hospitalizacion']
  },

  // --- CUIDADO INTERMEDIO / ADULTO ---
  {
    id: 'uci-1',
    category: 'UCI / Intermedio',
    name: 'Cama de Dos o Tres Planos (10.1)',
    description: 'Funcionalidad mecánica/eléctrica.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['uci']
  },
  {
    id: 'uci-2',
    category: 'UCI / Intermedio',
    name: 'Monitor con Presión Invasiva (10.3)',
    description: 'Trazado ECG, PNI, PI, SPO2.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['uci']
  },
  {
    id: 'uci-3',
    category: 'UCI / Intermedio',
    name: 'Ventilador de Transporte (12.4)',
    description: 'Batería y suministro O2.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['uci']
  },
  {
    id: 'uci-4',
    category: 'UCI / Intermedio',
    name: 'Monitor de Transporte (12.5)',
    description: 'Portátil con accesorios básicos.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['uci']
  },
  {
    id: 'uci-5',
    category: 'UCI / Intermedio',
    name: 'Marcapaso Externo no Invasivo (12.6)',
    description: 'Si no está incluido en desfibrilador.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['uci']
  },
  {
    id: 'uci-6',
    category: 'UCI / Intermedio',
    name: 'Electro de Gases Arteriales (13.2)',
    description: 'Disponibilidad según criterios.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['uci', 'cirugia']
  },
  {
    id: 'uci-7',
    category: 'UCI / Intermedio',
    name: 'Rayos X Portátil (13.1)',
    description: 'Disponibilidad inmediata.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['uci', 'cirugia']
  },
  {
    id: 'uci-8',
    category: 'UCI Crítico',
    name: 'Ventilador Adulto (14.1)',
    description: 'CPAP, Modos Controlados/Asistidos, Alarmas, Batería.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['uci']
  },
  {
    id: 'uci-9',
    category: 'UCI Crítico',
    name: 'Ecógrafo (15.1)',
    description: 'Disponibilidad en servicio.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['uci']
  },
  {
    id: 'uci-10',
    category: 'UCI Crítico',
    name: 'Monitoreo Gasto Cardiaco (15.2)',
    description: 'Sistema de monitoreo funcional.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['uci']
  },

  // --- CIRUGÍA ---
  {
    id: 'cir-1',
    category: 'Cirugía',
    name: 'Mesa Quirúrgica (17.1)',
    description: 'Eléctrica, neumática o hidráulica.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['cirugia']
  },
  {
    id: 'cir-2',
    category: 'Cirugía',
    name: 'Mesa para Instrumental (17.2)',
    description: 'Superficie lisa y fácil limpieza.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['cirugia']
  },
  {
    id: 'cir-3',
    category: 'Cirugía',
    name: 'Monitor con Capnografía y Temperatura (17.3)',
    description: 'ECG, PNI, SPO2, ETCO2, T.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['cirugia']
  },
  {
    id: 'cir-4',
    category: 'Cirugía',
    name: 'Máquina de Anestesia (17.4)',
    description: 'Alarmas, seguro mezcla hipóxica, monitoreo O2, ventilador.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['cirugia']
  },
  {
    id: 'cir-5',
    category: 'Cirugía',
    name: 'Lámpara Quirúrgica (17.5)',
    description: 'Intensidad lumínica y movilidad.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['cirugia']
  },
  {
    id: 'cir-6',
    category: 'Cirugía',
    name: 'Electrobisturí (17.7)',
    description: 'Cable tierra, accesorios y pedales.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['cirugia']
  },
  {
    id: 'cir-7',
    category: 'Vía Aérea',
    name: 'Tubos Endotraqueales y Máscaras (18)',
    description: 'Diferentes calibres y tipos.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['cirugia']
  },
  {
    id: 'cir-8',
    category: 'Vía Aérea',
    name: 'Equipo Cricotiroidotomía (18.4)',
    description: 'Integridad del kit.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['cirugia']
  },
  {
    id: 'cir-9',
    category: 'Especiales Cirugía',
    name: 'Analizador Gases Anestésicos (19.6)',
    description: 'Inspirados y expirados.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['cirugia']
  },
  {
    id: 'cir-10',
    category: 'Especiales Cirugía',
    name: 'Sistema Calentamiento Líquidos (19.12)',
    description: 'Control de temperatura.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['cirugia']
  },

  // --- AMBULANCIA (Sección 31) ---
  {
    id: 'amb-1',
    category: 'Ambulancia',
    name: 'DEA con Electrodos A/P (31.1)',
    description: 'Fecha de vencimiento vigente.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['ambulancia']
  },
  {
    id: 'amb-2',
    category: 'Ambulancia',
    name: 'Equipo Eléctrico de Aspiración (31.4)',
    description: 'Mangueras y sondas de varios tamaños.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['ambulancia']
  },
  {
    id: 'amb-3',
    category: 'Ambulancia',
    name: 'Aspirador Nasal Manual (31.5)',
    description: 'Funcionalidad.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['ambulancia']
  },
  {
    id: 'amb-4',
    category: 'Ambulancia',
    name: 'Torniquetes Control Hemorragias (31.7)',
    description: 'Estado del material.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['ambulancia']
  },
  {
    id: 'amb-5',
    category: 'Ambulancia',
    name: 'Camilla Principal con Anclaje (31.8)',
    description: 'Cinturones de seguridad.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['ambulancia']
  },
  {
    id: 'amb-6',
    category: 'Ambulancia',
    name: 'Camilla Secundaria Espinal (31.9)',
    description: 'Correas de sujeción.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['ambulancia']
  },
  {
    id: 'amb-7',
    category: 'Ambulancia',
    name: 'Tabla Espinal Corta / Chaleco (31.10)',
    description: 'Extracción vehicular.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['ambulancia']
  },
  {
    id: 'amb-8',
    category: 'Ambulancia',
    name: 'Atril Portasuero (31.11)',
    description: 'Dos ganchos.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['ambulancia']
  },
  {
    id: 'amb-9',
    category: 'Ambulancia',
    name: 'Pinzas de Magill (31.13)',
    description: 'Integridad del instrumental.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['ambulancia']
  },
  {
    id: 'amb-10',
    category: 'Ambulancia',
    name: 'Riñonera y Patos M/H (31.15-31.17)',
    description: 'Limpieza e integridad.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['ambulancia']
  },
  {
    id: 'amb-11',
    category: 'Ambulancia',
    name: 'Lámpara de Mano / Linterna (31.18)',
    description: 'Baterías de repuesto.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['ambulancia']
  },
  {
    id: 'amb-12',
    category: 'Ambulancia',
    name: 'Manta Térmica Aluminizada (31.19)',
    description: 'Estado del material.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['ambulancia']
  },
  {
    id: 'amb-13',
    category: 'Ambulancia',
    name: 'O2 Medicinal 3m3 (31.20)',
    description: 'Almacenamiento permanente.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['ambulancia']
  },
  {
    id: 'amb-14',
    category: 'Ambulancia',
    name: 'O2 Medicinal Portátil 0.5m3 (31.21)',
    description: 'Traslado de camillas.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['ambulancia']
  },
  {
    id: 'amb-15',
    category: 'Ambulancia',
    name: 'Conjunto Inmovilizadores (31.22)',
    description: 'Cervicales A/P, Laterales cabeza, Extremidades S/I.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['ambulancia']
  },
  {
    id: 'amb-16',
    category: 'Ambulancia',
    name: 'Fijación de Equipos (31.24)',
    description: 'Sistemas al vehículo sin detrimento operación.',
    normReference: 'Resolución 3100 de 2019',
    applicableServices: ['ambulancia']
  }
];

export const COMPLIANCE_ITEMS_BIOMEDICAL = DEFAULT_COMPLIANCE_ITEMS;

// --- LISTA DE CHEQUEO TIC / SISTEMAS (Resolución 3100 de 2019) ---
// Estándar de Historia Clínica y Registros, Dotación TIC y Sistemas de Información
export const COMPLIANCE_ITEMS_COMPUTING: ComplianceItem[] = [
  // 1. Historia Clínica Electrónica y Sistemas de Información Asistencial
  {
    id: 'tic-hce-1',
    category: 'Historia Clínica y Registros (Res. 3100)',
    name: 'Disponibilidad de Historia Clínica Digital 24/7',
    description: 'El software de HCE se encuentra en funcionamiento continuo, con tiempos de respuesta óptimos y sin caídas no programadas en el servicio.',
    normReference: 'Resolución 3100 de 2019 - Estándar HC y Registros'
  },
  {
    id: 'tic-hce-2',
    category: 'Historia Clínica y Registros (Res. 3100)',
    name: 'Integridad e Inalterabilidad de Registros Médicos',
    description: 'El sistema garantiza que cada registro guarde fecha, hora, nombre y rol del profesional, impidiendo modificaciones posteriores sin trazabilidad ni versionado.',
    normReference: 'Resolución 3100 de 2019 / Ley 1438 de 2011'
  },
  {
    id: 'tic-hce-3',
    category: 'Historia Clínica y Registros (Res. 3100)',
    name: 'Firma Digital y Mecanismos de Autenticación',
    description: 'Los profesionales de salud del servicio cuentan con firma digital o electrónica funcional para el aval legal de historias, evoluciones y órdenes médicas.',
    normReference: 'Ley 527 de 1999 / Resolución 3100 de 2019'
  },
  {
    id: 'tic-hce-4',
    category: 'Historia Clínica y Registros (Res. 3100)',
    name: 'Trazabilidad y Logs de Auditoría',
    description: 'El sistema registra pistas de auditoría activas (consultas, ingresos, modificaciones y descargas) sobre datos sensibles de pacientes.',
    normReference: 'Resolución 3100 de 2019'
  },

  // 2. Equipos de Cómputo y Periféricos
  {
    id: 'tic-eq-1',
    category: 'Equipos de Cómputo y Periféricos',
    name: 'Estaciones de Trabajo y Computadores Operativos',
    description: 'Terminales suficientes para la demanda asistencial del servicio, con hardware operativo, pantalla sin fallas, teclado y ratón limpios y funcionales.',
    normReference: 'Resolución 3100 de 2019 - Estándar Dotación'
  },
  {
    id: 'tic-eq-2',
    category: 'Equipos de Cómputo y Periféricos',
    name: 'Programa de Mantenimiento Preventivo de Hardware',
    description: 'Cumplimiento del cronograma institucional de limpieza interna, soplado, lubricación térmica y verificación de voltajes en equipos TIC del servicio.',
    normReference: 'Resolución 3100 de 2019 / Protocolo Institucional TIC'
  },
  {
    id: 'tic-eq-3',
    category: 'Equipos de Cómputo y Periféricos',
    name: 'Impresoras y Escáneres Asistenciales Operativos',
    description: 'Impresoras para órdenes médicas, fórmulas, consentimientos informados y etiquetas con nivel de tóner adecuado y sin atascos continuos.',
    normReference: 'Resolución 3100 de 2019'
  },
  {
    id: 'tic-eq-4',
    category: 'Equipos de Cómputo y Periféricos',
    name: 'Identificación y Hoja de Vida de Equipos TIC',
    description: 'Terminales debidamente inventariadas con placa de activo, serial, modelo y registro técnico en la base de datos de sistemas.',
    normReference: 'Resolución 3100 de 2019 - Gestión Tecnológica'
  },

  // 3. Redes, Conectividad y Telecomunicaciones
  {
    id: 'tic-red-1',
    category: 'Redes, Conectividad y Telefonía',
    name: 'Puntos de Red Cableada y Conectividad LAN',
    description: 'Puntos de red estructurados operativos y certificados en cada puesto médico o de enfermería, sin cables sueltos o en mal estado.',
    normReference: 'Resolución 3100 de 2019'
  },
  {
    id: 'tic-red-2',
    category: 'Redes, Conectividad y Telefonía',
    name: 'Cobertura y Estabilidad de Red WiFi Institucional',
    description: 'Señal inalámbrica segura y con ancho de banda suficiente para tabletas, monitores interconectados y personal en ronda clínica.',
    normReference: 'Resolución 3100 de 2019'
  },
  {
    id: 'tic-red-3',
    category: 'Redes, Conectividad y Telefonía',
    name: 'Telefonía IP y Comunicación Asistencial',
    description: 'Teléfonos y extensiones internas comunicadas y funcionales para interconsultas y llamadas de emergencia médica.',
    normReference: 'Resolución 3100 de 2019'
  },

  // 4. Seguridad Digital, Ciberseguridad y Habeas Data
  {
    id: 'tic-seg-1',
    category: 'Seguridad de la Información y Habeas Data',
    name: 'Control de Acceso y Cuentas Nominales Únicas',
    description: 'Cada funcionario accede con su usuario nominal personal; no se observan credenciales compartidas ni anotadas en adhesivos.',
    normReference: 'Ley 1581 de 2012 / Resolución 3100 de 2019'
  },
  {
    id: 'tic-seg-2',
    category: 'Seguridad de la Información y Habeas Data',
    name: 'Bloqueo Automático de Pantalla por Inactividad',
    description: 'Configuración activa de bloqueo tras máximo 5-10 minutos de inactividad para evitar exposición de historias clínicas a terceros.',
    normReference: 'Ley 1581 de 2012 (Protección de Datos Personales)'
  },
  {
    id: 'tic-seg-3',
    category: 'Seguridad de la Información y Habeas Data',
    name: 'Protección Endpoint y Antivirus Corporativo',
    description: 'Software antivirus activo con firmas actualizadas en todas las estaciones de trabajo, y restricción de almacenamiento masivo USB no autorizado.',
    normReference: 'Ley 1273 de 2009 (Delitos Informáticos)'
  },
  {
    id: 'tic-seg-4',
    category: 'Seguridad de la Información y Habeas Data',
    name: 'Licenciamiento de Software y Sistemas Operativos',
    description: 'Sistemas operativos y programas ofimáticos debidamente licenciados conforme a la normativa legal colombiana vigente.',
    normReference: 'Ley 603 de 2000'
  },

  // 5. Respaldo de Energía y Contingencia Informática
  {
    id: 'tic-resp-1',
    category: 'Respaldo de Energía y Plan de Contingencia',
    name: 'Respaldo Eléctrico Ininterrumpido (UPS para TIC)',
    description: 'Equipos de cómputo del servicio conectados a circuito regulado con respaldo de UPS ante cortes repentinos de energía.',
    normReference: 'Resolución 3100 de 2019'
  },
  {
    id: 'tic-resp-2',
    category: 'Respaldo de Energía y Plan de Contingencia',
    name: 'Copias de Seguridad (Backups) y Restauración',
    description: 'Políticas de copia de seguridad periódica comprobada sobre bases de datos asistenciales con almacenamiento redundante o en la nube.',
    normReference: 'Resolución 3100 de 2019'
  },
  {
    id: 'tic-resp-3',
    category: 'Respaldo de Energía y Plan de Contingencia',
    name: 'Plan de Contingencia ante Caída de Sistemas',
    description: 'El servicio cuenta con protocolo documentado y formatos de contingencia en papel conocidos por el personal ante caídas de software o red.',
    normReference: 'Resolución 3100 de 2019'
  }
];

// --- LISTA DE CHEQUEO INFRAESTRUCTURA (Resolución 3100 de 2019) ---
// Estándar de Infraestructura, Redes Eléctricas RETIE, Gases Medicinales y Condiciones Locativas
export const COMPLIANCE_ITEMS_INFRASTRUCTURE: ComplianceItem[] = [
  // 1. Instalaciones Eléctricas y Respaldo Energético
  {
    id: 'inf-elec-1',
    category: 'Instalaciones Eléctricas y Respaldo (RETIE / Res. 3100)',
    name: 'Planta Eléctrica de Emergencia y Transferencia Automática',
    description: 'Planta de emergencia con transferencia automática comprobada en menos de 8 segundos, tanque de combustible con autonomía y bitácora de pruebas semanales al día.',
    normReference: 'Resolución 3100 de 2019 / RETIE Res. 90708'
  },
  {
    id: 'inf-elec-2',
    category: 'Instalaciones Eléctricas y Respaldo (RETIE / Res. 3100)',
    name: 'Respaldo Continuo por UPS para Áreas Críticas',
    description: 'Sistemas de energía ininterrumpida (UPS) operativos para áreas de soporte vital (UCI, Quirófanos, Urgencias) con autonomía verificada.',
    normReference: 'Resolución 3100 de 2019 / RETIE'
  },
  {
    id: 'inf-elec-3',
    category: 'Instalaciones Eléctricas y Respaldo (RETIE / Res. 3100)',
    name: 'Tomacorrientes Grado Hospitalario y Polo a Tierra',
    description: 'Tomas eléctricas con identificación de circuito (normal / emergencia / regulado), polaridad correcta y medición de puesta a tierra reglamentaria sin sobrecalentamiento.',
    normReference: 'RETIE / Código Eléctrico NTC 2050 Sección 517'
  },
  {
    id: 'inf-elec-4',
    category: 'Instalaciones Eléctricas y Respaldo (RETIE / Res. 3100)',
    name: 'Iluminación General y Lámparas de Emergencia',
    description: 'Iluminación uniforme sin parpadeos en zonas de atención y lámparas autónomas de emergencia operativas en pasillos, accesos y cubículos.',
    normReference: 'Resolución 3100 de 2019'
  },

  // 2. Redes Centralizadas de Gases Medicinales
  {
    id: 'inf-gas-1',
    category: 'Gases Medicinales y Redes de Soporte',
    name: 'Tomas Murales de Oxígeno, Aire Medicinal y Vacío',
    description: 'Tomas de gases herméticas, sin fugas audibles, con conectores no intercambiables identificados por color normativo y presión adecuada.',
    normReference: 'Resolución 3100 de 2019 / Norma NTC 4410'
  },
  {
    id: 'inf-gas-2',
    category: 'Gases Medicinales y Redes de Soporte',
    name: 'Paneles de Alarma y Monitoreo de Presión de Gases',
    description: 'Tableros de alarma visual y sonora visibles en la estación de enfermería del servicio, calibrados y en estado normal de operación.',
    normReference: 'Resolución 3100 de 2019 / NFPA 99'
  },
  {
    id: 'inf-gas-3',
    category: 'Gases Medicinales y Redes de Soporte',
    name: 'Almacenamiento y Sujeción Segura de Cilindros',
    description: 'Cilindros de gas con capuchón protector colocado, sujetados firmemente con cadenas o en carros portacilindros, separados los llenos de los vacíos.',
    normReference: 'Resolución 3100 de 2019'
  },

  // 3. Redes Hidrosanitarias y Suministro de Agua
  {
    id: 'inf-hidro-1',
    category: 'Redes Hidrosanitarias y Agua Potable',
    name: 'Suministro y Autonomía de Agua Potable',
    description: 'Red hidráulica continua con presión óptima, tanques de reserva con autonomía mínima de 48-72 horas, lavado semestral y prueba microbiológica vigente.',
    normReference: 'Resolución 3100 de 2019 / Resolución 4445 de 1996'
  },
  {
    id: 'inf-hidro-2',
    category: 'Redes Hidrosanitarias y Agua Potable',
    name: 'Lavamanos con Accionamiento No Manual',
    description: 'Lavamanos asistenciales con grifería de pedal, codo o sensor electrónico en áreas de procedimientos y preparación de medicamentos, con jabón y toallas.',
    normReference: 'Resolución 3100 de 2019'
  },
  {
    id: 'inf-hidro-3',
    category: 'Redes Hidrosanitarias y Agua Potable',
    name: 'Desagües, Sifones y Trampas Hidráulicas',
    description: 'Sifones con rejilla asegurada, sin estancamientos ni malos olores, tuberías de evacuación y bajantes en óptimo estado.',
    normReference: 'Resolución 4445 de 1996'
  },

  // 4. Climatización, Aire Acondicionado y Ventilación
  {
    id: 'inf-aire-1',
    category: 'Climatización y Ventilación Hospitalaria',
    name: 'Control de Temperatura y Confort Térmico',
    description: 'Equipos de aire acondicionado funcionales manteniendo temperatura entre 18°C y 24°C según el área clínica y registros de mantenimiento de filtros.',
    normReference: 'Resolución 3100 de 2019'
  },
  {
    id: 'inf-aire-2',
    category: 'Climatización y Ventilación Hospitalaria',
    name: 'Presiones de Aire Diferenciales y Renovación',
    description: 'Presión positiva en áreas quirúrgicas/asépticas y presión negativa en áreas de aislamiento respiratorio, con extracción mecánica adecuada.',
    normReference: 'Resolución 3100 de 2019'
  },

  // 5. Condiciones Físicas y Acabados Locativos
  {
    id: 'inf-loc-1',
    category: 'Condiciones Físicas y Locativas',
    name: 'Pisos Hospitalarios y Uniones de Media Caña',
    description: 'Pisos uniformes, continuos, impermeables, lavables, antideslizantes, sin grietas y uniones entre piso y pared con curva sanitaria (media caña) intacta.',
    normReference: 'Resolución 3100 de 2019'
  },
  {
    id: 'inf-loc-2',
    category: 'Condiciones Físicas y Locativas',
    name: 'Paredes y Cielorrasos Lavables',
    description: 'Paredes con pintura epóxica o antibacterial lavable, cielorrasos fijos o continuos sin desprendimiento de partículas ni manchas de humedad.',
    normReference: 'Resolución 3100 de 2019'
  },
  {
    id: 'inf-loc-3',
    category: 'Condiciones Físicas y Locativas',
    name: 'Puertas, Pasillos y Accesos Asistenciales',
    description: 'Anchos libres reglamentarios para circulación de camillas, puertas con visores transparentes y protectores contra golpes en buen estado.',
    normReference: 'Resolución 3100 de 2019 / Ley 361 de 1997'
  },

  // 6. Seguridad Humana, Emergencias y Residuos
  {
    id: 'inf-seg-1',
    category: 'Seguridad Humana, Evacuación y Residuos',
    name: 'Rutas de Evacuación y Señalización de Emergencia',
    description: 'Señales fotoluminiscentes visibles de salida y evacuación, pasillos despejados sin obstáculos y plano de emergencias visible en el servicio.',
    normReference: 'Resolución 3100 de 2019 / NSR-10'
  },
  {
    id: 'inf-seg-2',
    category: 'Seguridad Humana, Evacuación y Residuos',
    name: 'Extintores y Protección Contra Incendios',
    description: 'Extintores reglamentarios (Multipropósito ABC / Solkaflam / CO2) a altura normativa, con manómetro en verde, precinto e inspección vigente.',
    normReference: 'Resolución 3100 de 2019 / NFPA 10'
  },
  {
    id: 'inf-seg-3',
    category: 'Seguridad Humana, Evacuación y Residuos',
    name: 'Gestión y Segregación de Residuos Hospitalarios',
    description: 'Recipientes con accionamiento de pedal y bolsas según código de colores normativo (Verde, Blanco, Negro, Rojo) y cuarto de almacenamiento temporal de residuos señalizado.',
    normReference: 'Resolución 2184 de 2019 / Resolución 3100 de 2019'
  }
];

export function getComplianceItems(scope: 'biomedical' | 'computing' | 'infrastructure' | 'all', serviceId?: string): ComplianceItem[] {
  if (scope === 'computing') {
    return COMPLIANCE_ITEMS_COMPUTING.filter(item => 
      !item.applicableServices || (serviceId ? item.applicableServices.includes(serviceId) : true)
    );
  }

  if (scope === 'infrastructure') {
    return COMPLIANCE_ITEMS_INFRASTRUCTURE.filter(item => 
      !item.applicableServices || (serviceId ? item.applicableServices.includes(serviceId) : true)
    );
  }

  // biomedical or default
  return DEFAULT_COMPLIANCE_ITEMS.filter(item => 
    !item.applicableServices || (serviceId ? item.applicableServices.includes(serviceId) : true)
  );
}

export interface ScopeComplianceMeta {
  title: string;
  shortTitle: string;
  standardName: string;
  standardReference: string;
  macroproceso: string;
  proceso: string;
  responsable: string;
  formCode: string;
  badgeText: string;
}

export function getScopeComplianceMeta(scope: 'biomedical' | 'computing' | 'infrastructure' | 'all'): ScopeComplianceMeta {
  switch (scope) {
    case 'computing':
      return {
        title: 'Lista de Chequeo: Historia Clínica y Sistemas TIC',
        shortTitle: 'Chequeo Trimestral TIC',
        standardName: 'Estándar de Historia Clínica, Registros y Tecnologías TIC',
        standardReference: 'Res. 3100 de 2019 (HC y Registros) / Ley 1581 de 2012 / Ley 1273 de 2009',
        macroproceso: 'Gestión Estratégica y Soporte Tecnológico',
        proceso: 'Gestión de Tecnologías de la Información y Comunicaciones (TIC)',
        responsable: 'Líder de Sistemas / Coordinador TIC',
        formCode: 'TIC-FOR-015-V1',
        badgeText: 'TIC / SISTEMAS'
      };
    case 'infrastructure':
      return {
        title: 'Lista de Chequeo: Infraestructura y Redes Hospitalarias',
        shortTitle: 'Chequeo Trimestral Infraestructura',
        standardName: 'Estándar de Infraestructura, Redes Eléctricas RETIE y Gases',
        standardReference: 'Res. 3100 de 2019 (Infraestructura) / RETIE Res. 90708 / Res. 4445 de 1996 / NTC 4410',
        macroproceso: 'Gestión de Infraestructura y Soporte Operativo',
        proceso: 'Gestión de Infraestructura y Mantenimiento Hospitalario',
        responsable: 'Líder de Mantenimiento / Infraestructura',
        formCode: 'INF-FOR-022-V1',
        badgeText: 'INFRAESTRUCTURA'
      };
    case 'all':
      return {
        title: 'Lista de Chequeo: Habilitación Institucional Integral',
        shortTitle: 'Chequeo Integral Res. 3100',
        standardName: 'Estándares Integrales de Habilitación de Servicios de Salud',
        standardReference: 'Resolución 3100 de 2019 (Dotación, TIC e Infraestructura)',
        macroproceso: 'Calidad, Mejora Continua y Gestión Integral',
        proceso: 'Auditoría Institucional y Gestión Tecnológica Multidisciplinaria',
        responsable: 'Dirección Médica / Calidad / Líderes de Área',
        formCode: 'INST-FOR-100-V1',
        badgeText: 'GENERAL'
      };
    case 'biomedical':
    default:
      return {
        title: 'Lista de Chequeo: Dotación y Equipamiento Biomédico',
        shortTitle: 'Chequeo Trimestral Biomédica',
        standardName: 'Estándar de Dotación Biomédica y Dispositivos Médicos',
        standardReference: 'Res. 3100 de 2019 (Dotación) / Decreto 4725 de 2005',
        macroproceso: 'Calidad y Mejora Continua',
        proceso: 'Gestión de Tecnología Biomédica',
        responsable: 'Líder de Calidad / Ingeniero Biomédico',
        formCode: 'CAL-FOR-088-V1',
        badgeText: 'BIOMÉDICA'
      };
  }
}
