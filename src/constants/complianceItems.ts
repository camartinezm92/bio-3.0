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
