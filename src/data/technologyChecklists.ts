export interface TechnologyCategory {
  category: string;
  technologies: TechnologyItem[];
}

export interface TechnologyItem {
  id: string;
  name: string;
  category: string;
  items: string[];
}

// Items predeterminados para la categoría "Otros equipos biomédicos" (Formato actual)
export const DEFAULT_OTHER_ITEMS: string[] = [
  'VERIFICACIÓN DE FUNCIONAMIENTO GENERAL',
  'VERIFICACIÓN DE ESTADO FÍSICO Y CHASIS',
  'VERIFICACIÓN DE CONTACTOS Y CABLES',
  'VERIFICACIÓN DE BATERÍA / ALIMENTACIÓN',
  'VERIFICACIÓN DE CONTROLES E INDICADORES',
  'LIMPIEZA Y DESINFECCIÓN',
  'PRUEBA DE SEGURIDAD ELÉCTRICA / CARGA',
  'VERIFICACIÓN DE ACCESORIOS Y SENSORES'
];

// Lista de verificación para CAMA HOSPITALARIA ELÉCTRICA
export const ELECTRIC_HOSPITAL_BED_ITEMS: string[] = [
  'Estado general de la estructura',
  'Cabecera y piecero',
  'Barandas laterales',
  'Funcionamiento del control de paciente',
  'Funcionamiento del control de enfermería',
  'Elevación y descenso de la cama',
  'Elevación de respaldo',
  'Elevación de piernas',
  'Posición Trendelenburg',
  'Posición anti-Trendelenburg',
  'Funcionamiento de motores/actuadores',
  'Ruedas y sistema de rodamiento',
  'Sistema de freno',
  'Estado del colchón',
  'Estado del cable de alimentación',
  'Estado del enchufe',
  'Limpieza y desinfección',
  'Prueba de funcionamiento general'
];

// Todas las tecnologías estructuradas por áreas
export const TECHNOLOGY_CATEGORIES: TechnologyCategory[] = [
  {
    category: 'Hospitalización y Cuidados Críticos',
    technologies: [
      {
        id: 'camas_electricas',
        name: 'Camas hospitalarias eléctricas',
        category: 'Hospitalización y Cuidados Críticos',
        items: ELECTRIC_HOSPITAL_BED_ITEMS
      },
      {
        id: 'camillas_transporte',
        name: 'Camillas de transporte',
        category: 'Hospitalización y Cuidados Críticos',
        items: [
          'Estado general de la estructura y chasis',
          'Barandas laterales de seguridad',
          'Colchoneta y tapicería',
          'Ruedas y sistema de rodamiento',
          'Sistema central de frenado',
          'Atril portasuero',
          'Soporte de cilindro de oxígeno',
          'Mecanismos de articulación / inclinación',
          'Limpieza y desinfección',
          'Prueba de desplazamiento y funcionamiento'
        ]
      },
      {
        id: 'monitores_signos_basicos',
        name: 'Monitores de signos vitales básicos',
        category: 'Hospitalización y Cuidados Críticos',
        items: [
          'Inspección visual del chasis y pantalla',
          'Cable de alimentación eléctrica y enchufe',
          'Batería interna y autonomía',
          'Manguera y brazalete de PNI (Presión No Invasiva)',
          'Sensor y cable de SpO2 (Oximetría)',
          'Sensor de temperatura',
          'Alarmas visuales y sonoras',
          'Prueba de medición y respuesta',
          'Limpieza y desinfección',
          'Prueba de funcionamiento general'
        ]
      },
      {
        id: 'monitores_multiparametro_uci',
        name: 'Monitores multiparámetro UCI',
        category: 'Hospitalización y Cuidados Críticos',
        items: [
          'Chasis, pantalla táctil y teclas de acceso rápido',
          'Cable de alimentación y toma de tierra',
          'Batería de respaldo y estado de carga',
          'Módulo y cable paciente ECG (3/5 puntas)',
          'Módulo y sensor de SpO2',
          'Módulo de PNI (Manguera, conectores y brazaletes)',
          'Módulo de Presión Invasiva (PI)',
          'Módulo de Capnografía (EtCO2)',
          'Módulo de Temperatura (T1/T2)',
          'Sistema de alarmas visuales y acústicas',
          'Conectividad de red / Central de monitoreo',
          'Limpieza, desinfección y verificación funcional'
        ]
      },
      {
        id: 'ventiladores_mecanicos',
        name: 'Ventiladores mecánicos',
        category: 'Hospitalización y Cuidados Críticos',
        items: [
          'Estado físico general, pedestal y brazos',
          'Cables de poder, enchufe y puesta a tierra',
          'Baterías internas y tiempo de respaldo',
          'Conexiones de gases medicinales (O2 y Aire)',
          'Filtros de aire y trampa de agua',
          'Válvula exhalatoria y diafragma',
          'Sensor de flujo y cable conector',
          'Sensor/celda de oxígeno',
          'Pantalla táctil, perillas y encoder',
          'Autotest / Calibración de circuito de paciente',
          'Alarmas de alta/baja presión, apnea y desconexión',
          'Limpieza, desinfección y prueba funcional'
        ]
      },
      {
        id: 'bombas_infusion',
        name: 'Bombas de infusión',
        category: 'Hospitalización y Cuidados Críticos',
        items: [
          'Estructura exterior, clamp de fijación y puerta',
          'Mecanismo de bombeo peristáltico y sensores de flujo',
          'Sensor de aire en línea (burbujas)',
          'Sensor de presión / oclusión aguas arriba y abajo',
          'Cable de poder y contactos de carga',
          'Batería interna y autonomía',
          'Teclado, display y selección de librerías',
          'Alarmas audibles y visuales de infusión',
          'Prueba de precisión volumétrica',
          'Limpieza y desinfección'
        ]
      },
      {
        id: 'bombas_jeringa',
        name: 'Bombas de jeringa',
        category: 'Hospitalización y Cuidados Críticos',
        items: [
          'Chasis, garra de fijación y abrazadera de jeringa',
          'Mecanismo de empuje / émbolo y tornillo sin fin',
          'Detección automática de tamaño y marca de jeringa',
          'Sensor de oclusión y fuerza',
          'Cable de alimentación y batería interna',
          'Pantalla, panel de control y teclado',
          'Alarmas de fin de infusión, oclusión y desalojo',
          'Prueba de flujo y volumen',
          'Limpieza y desinfección'
        ]
      },
      {
        id: 'desfibriladores',
        name: 'Desfibriladores',
        category: 'Hospitalización y Cuidados Críticos',
        items: [
          'Inspección física del equipo y soporte de palas',
          'Cable de alimentación y batería interna principal',
          'Palas adulto/pediátrico y contactos metálicos',
          'Cable de ECG de monitoreo',
          'Prueba de descarga de prueba (50J / Test de rutina)',
          'Funcionamiento en modo DEA / Manual',
          'Función de marcapasos externo (si aplica)',
          'Registrador térmico / Impresora y papel',
          'Alarmas y mensajes en pantalla',
          'Limpieza, desinfección y prueba de encendido'
        ]
      },
      {
        id: 'electrocardiografos',
        name: 'Electrocardiógrafos',
        category: 'Hospitalización y Cuidados Críticos',
        items: [
          'Estructura exterior, teclado y pantalla',
          'Cable paciente de 10 puntas / latiguillos',
          'Electrodos tipo chupeta y pinzas de extremidades',
          'Cable de poder y batería de respaldo',
          'Mecanismo de arrastre e impresión térmica',
          'Filtros de línea (50/60Hz, muscular, línea de base)',
          'Adquisición de las 12 derivaciones estándar',
          'Limpieza, desinfección y prueba de registro'
        ]
      },
      {
        id: 'aspiradores_secreciones',
        name: 'Aspiradores de secreciones',
        category: 'Hospitalización y Cuidados Críticos',
        items: [
          'Chasis, asa de transporte y pedestal rodante',
          'Cable de alimentación y batería (si aplica)',
          'Motor / bomba de vacío y nivel de ruido',
          'Regulador de vacío y manómetro / vacuómetro',
          'Frascos de recolección y tapas con sello hermético',
          'Válvula de sobreflujo / trampa hidrofóbica',
          'Filtro antibacteriano',
          'Mangueras y conexiones de silicona',
          'Limpieza, desinfección y prueba de succión máxima'
        ]
      }
    ]
  },
  {
    category: 'Cirugía y Quirófano',
    technologies: [
      {
        id: 'maquinas_anestesia',
        name: 'Máquinas de anestesia',
        category: 'Cirugía y Quirófano',
        items: [
          'Chasis, frenos, cajones y brazo de monitor',
          'Suministro y manómetros de gases (O2, N2O, Aire)',
          'Yugos de cilindros de reserva y conexiones centrales',
          'Vaporizadores e interbloqueos de seguridad',
          'Flujómetros / Mezclador electrónico de gases',
          'Circuito respiratorio y absorbedor de CO2 (Canister)',
          'Fuelles / Pistón del ventilador de anestesia',
          'Válvula APL y conmutador Bolsa/Ventilador',
          'Sistema de evacuación activa de gases anestésicos (AGSS)',
          'Sensor de O2, volumen y presión de vías aéreas',
          'Autotest de fugas y cumplimiento de circuitos',
          'Limpieza, desinfección y prueba funcional'
        ]
      },
      {
        id: 'mesas_quirurgicas',
        name: 'Mesas quirúrgicas',
        category: 'Cirugía y Quirófano',
        items: [
          'Estructura de acero inoxidable y base',
          'Sistema electrohidráulico / electromecánico',
          'Control de mano y panel auxiliar en columna',
          'Movimiento de elevación y descenso',
          'Movimiento Trendelenburg y anti-Trendelenburg',
          'Inclinación lateral izquierda y derecha',
          'Articulación de respaldo, cabecero y pierneras',
          'Sistema de freno central y bloqueo de base',
          'Colchonetas antiestáticas y fijaciones',
          'Cable de poder y batería de emergencia',
          'Limpieza, desinfección y lubricación'
        ]
      },
      {
        id: 'lamparas_quirurgicas',
        name: 'Lámparas quirúrgicas',
        category: 'Cirugía y Quirófano',
        items: [
          'Brazos articulados, balance y freno de giro',
          'Cúpulas / satélites ópticos y mangos esterilizables',
          'Módulos LED / bombillos halógenos',
          'Regulación de intensidad lumínica y temperatura de color',
          'Ajuste de campo y enfoque',
          'Panel de control de pared o cúpula',
          'Sistema de alimentación eléctrica y respaldo',
          'Limpieza, desinfección y prueba funcional'
        ]
      },
      {
        id: 'electrobisturi',
        name: 'Electrobisturí',
        category: 'Cirugía y Quirófano',
        items: [
          'Chasis, conectores y panel frontal',
          'Cable de poder y puesta a tierra hospitalaria',
          'Pedal de corte y coagulación (monopolar / bipolar)',
          'Lápiz monopolar y electrodos activos',
          'Placa paciente / electrodo de retorno y sistema REM/CQM',
          'Pinzas y cables bipolares',
          'Prueba de modos de corte (Puro, Blend)',
          'Prueba de modos de coagulación (Spray, Fulgurate, Desiccate)',
          'Alarmas de seguridad y desconexión de placa',
          'Limpieza, desinfección y verificación de salida RF'
        ]
      },
      {
        id: 'aspiradores_quirurgicos',
        name: 'Aspiradores quirúrgicos',
        category: 'Cirugía y Quirófano',
        items: [
          'Estructura de alto flujo, ruedas y frenos',
          'Motor de vacío de alto rendimiento continuo',
          'Frascos recolectores de policarbonato / vidrio con válvula',
          'Filtro hidrófobo y antibacteriano de alta eficiencia',
          'Manómetro regulador de vacío',
          'Pedal de accionamiento neumático / eléctrico',
          'Mangueras de succión y sellos de goma',
          'Limpieza, desinfección y prueba de vacío máximo'
        ]
      },
      {
        id: 'monitorizacion',
        name: 'Monitorización',
        category: 'Cirugía y Quirófano',
        items: [
          'Montaje en brazo / riel de quirófano',
          'Cables de conexión y módulos de parámetros',
          'Monitoreo hemodinámico avanzado (Gasto cardíaco, BIS)',
          'Integración con central y registro quirúrgico',
          'Pruebas de visualización y alarmas de seguridad',
          'Limpieza y desinfección'
        ]
      }
    ]
  },
  {
    category: 'Esterilización',
    technologies: [
      {
        id: 'autoclaves',
        name: 'Autoclaves',
        category: 'Esterilización',
        items: [
          'Cámara de esterilización en acero inox y chaqueta',
          'Puerta, volante/mecanismo de cierre y empaque de silicona',
          'Generador de vapor / resistencias de calentamiento',
          'Bomba de vacío y condensador',
          'Válvula de seguridad y presostatos',
          'Transductores de presión y sensores de temperatura (PT100)',
          'Filtro de aire estéril (0.2 micras)',
          'Microcontrolador, pantalla y selección de ciclos (121°C/134°C)',
          'Impresora de tickets de validación',
          'Prueba de vacío (Bowie & Dick / Fugas)',
          'Limpieza, desincrustación y verificación'
        ]
      },
      {
        id: 'selladoras',
        name: 'Selladoras',
        category: 'Esterilización',
        items: [
          'Chasis, guías de entrada y mesa de trabajo',
          'Resistencias de calentamiento y barras de sellado',
          'Controlador digital de temperatura',
          'Banda transportadora / rodillos de presión',
          'Cuchilla de corte (si aplica)',
          'Impresora de fecha y lote (si aplica)',
          'Prueba de sellado hermético en papel grado médico',
          'Limpieza y calibración de temperatura'
        ]
      },
      {
        id: 'lavadoras_ultrasonicas',
        name: 'Lavadoras ultrasónicas',
        category: 'Esterilización',
        items: [
          'Tina de acero inoxidable y tapa',
          'Transductores piezoeléctricos de ultrasonido',
          'Sistema de calefacción / control de temperatura',
          'Temporizador digital y selector de frecuencia/desgasificado',
          'Válvula de drenaje y filtros',
          'Prueba de cavitación con papel aluminio',
          'Limpieza y desinfección'
        ]
      },
      {
        id: 'incubadoras_indicadores',
        name: 'Incubadoras de indicadores biológicos',
        category: 'Esterilización',
        items: [
          'Bloque térmico de incubación y pocillos',
          'Sensor y control de temperatura (56°C - 60°C)',
          'Lector de fluorescencia / óptico (lectura rápida)',
          'Display digital y temporizadores individuales por pocillo',
          'Alarma de finalización de incubación',
          'Limpieza y verificación de temperatura'
        ]
      }
    ]
  },
  {
    category: 'Laboratorio Clínico',
    technologies: [
      {
        id: 'analizadores_hematologicos',
        name: 'Analizadores hematológicos',
        category: 'Laboratorio Clínico',
        items: [
          'Módulo hidráulico, mangueras, jeringas y válvulas de paso',
          'Cámara de recuento y aperturas de impedancia',
          'Sistema óptico / láser de dispersión',
          'Aguja de aspiración de muestra y lavado',
          'Líneas de reactivos (Diluyente, Lisante, Limpiador)',
          'Sensores de nivel de residuos y reactivos',
          'Software, pantalla y calibración de parámetros',
          'Limpieza de cámaras y verificación de fondos'
        ]
      },
      {
        id: 'analizadores_quimica',
        name: 'Analizadores de química',
        category: 'Laboratorio Clínico',
        items: [
          'Rueda de reactivos con refrigeración',
          'Rueda de muestras y cubetas de reacción',
          'Brazo de pipeteo y sensores de nivel capacitivo',
          'Sistema fotométrico (Lámpara halógena/LED, filtros)',
          'Sistema de lavado automático de cubetas',
          'Control de temperatura de incubación (37°C)',
          'Líneas de agua desionizada y drenaje',
          'Limpieza, lubricación y corrida de blanco/control'
        ]
      },
      {
        id: 'analizadores_gases',
        name: 'Analizadores de gases',
        category: 'Laboratorio Clínico',
        items: [
          'Módulo de electrodos (pH, pO2, pCO2, electrolitos)',
          'Cartucho de calibración / reactivos',
          'Bomba peristáltica y vías de fluidos',
          'Cámara de medición y control térmico a 37°C',
          'Mecanismo de aspiración de jeringa/capilar',
          'Calibración automática en 1 y 2 puntos',
          'Limpieza y verificación de lecturas'
        ]
      },
      {
        id: 'centrifugas',
        name: 'Centrífugas',
        category: 'Laboratorio Clínico',
        items: [
          'Tapa, bisagras y seguro electromecánico de tapa',
          'Rotor, camisas y adaptadores de tubos',
          'Motor sin escobillas (Brushless) y rodamientos',
          'Tacómetro digital / control de RPM',
          'Temporizador y freno eléctrico',
          'Sensor de desbalance de carga',
          'Limpieza, desinfección y prueba de velocidad'
        ]
      },
      {
        id: 'microscopios',
        name: 'Microscopios',
        category: 'Laboratorio Clínico',
        items: [
          'Oculares y objetivos (4x, 10x, 40x, 100x inmersión)',
          'Revólver portaobjetivos con tope mecánico',
          'Platina móvil y pinza sujeta-portaobjetos',
          'Condensador Abbe y diafragma iris',
          'Mandos de enfoque macro y micrométrico',
          'Fuente de iluminación LED/halógena y reóstato',
          'Limpieza óptica y lubricación mecánica'
        ]
      },
      {
        id: 'incubadoras_lab',
        name: 'Incubadoras',
        category: 'Laboratorio Clínico',
        items: [
          'Cámara interna en acero inoxidable y puerta de vidrio',
          'Empaque perimetral de puerta y cierre hermético',
          'Resistencias calefactoras y ventilador de convección',
          'Controlador digital PID de temperatura',
          'Termostato de seguridad de sobretemperatura',
          'Sensor de CO2 / O2 y filtros (si aplica)',
          'Limpieza, desinfección y verificación con termómetro patrón'
        ]
      },
      {
        id: 'banos_serologicos',
        name: 'Baños serológicos',
        category: 'Laboratorio Clínico',
        items: [
          'Cuba de acero inoxidable y gradilla para tubos',
          'Resistencia de inmersión y sensor de nivel de agua',
          'Control digital de temperatura y agitación',
          'Termostato de seguridad contra trabajo en seco',
          'Aislamiento térmico exterior',
          'Limpieza, descalcificación y prueba térmica'
        ]
      },
      {
        id: 'neveras_congeladores',
        name: 'Neveras/congeladores',
        category: 'Laboratorio Clínico',
        items: [
          'Gabinete exterior, estantes y empaques de puerta',
          'Compresor, condensador y evaporador de refrigeración',
          'Termostato digital y alarma de temperatura alta/baja',
          'Registrador de temperatura / Data logger',
          'Batería de respaldo del sistema de alarma',
          'Sistema de descongelamiento automático',
          'Limpieza del condensador y prueba de rango térmico'
        ]
      }
    ]
  },
  {
    category: 'Imágenes Diagnósticas',
    technologies: [
      {
        id: 'tomografo',
        name: 'Tomógrafo',
        category: 'Imágenes Diagnósticas',
        items: [
          'Gantry, sistema de rotación y rodamientos',
          'Tubo de rayos X y generador de alta tensión',
          'Detector multicanal y sistema de adquisición (DAS)',
          'Mesa de paciente, desplazamiento y límites de carrera',
          'Láseres de posicionamiento sagital, coronal y axial',
          'Consola de control, estación de trabajo y monitores',
          'Sistema de intercomunicación y parada de emergencia',
          'Sistema de enfriamiento del tubo (chiller / intercambiador)',
          'Calibración diaria de aire/agua y prueba de calidad de imagen'
        ]
      },
      {
        id: 'rx_portatil',
        name: 'Equipo de RX portátil',
        category: 'Imágenes Diagnósticas',
        items: [
          'Chasis rodante, motor de tracción y frenos de mano',
          'Columna articulada y contrapeso del brazo portatubo',
          'Colimador manual/luminoso y temporizador de luz',
          'Tubo de rayos X y generador monobloque',
          'Baterías de potencia y cargador incorporado',
          'Pulsador de disparo de dos tiempos y cable extensible',
          'Panel detector plano (Flat Panel) y receptor Wi-Fi',
          'Consola táctil con parámetros kV, mA y mAs',
          'Limpieza y prueba de disparo con dosímetro'
        ]
      },
      {
        id: 'ecografo',
        name: 'Ecógrafo',
        category: 'Imágenes Diagnósticas',
        items: [
          'Consola, teclado, trackball y pantalla LCD articulada',
          'Conectores de transductores y seguros de acople',
          'Transductores (Convexo, Lineal, Sectorial, Endocavitario)',
          'Membrana acústica y cable de transductores',
          'Modos de imagen (2D, Doppler Color, Power, Pulsado, CW)',
          'Controles TGC (Time Gain Compensation)',
          'Impresora térmica de video o grabador',
          'Filtros de polvo y ventiladores de refrigeración',
          'Limpieza, desinfección y prueba de resolución'
        ]
      }
    ]
  },
  {
    category: 'Urgencias y Ambulancia',
    technologies: [
      {
        id: 'camilla_ambulancia',
        name: 'Camilla de ambulancia',
        category: 'Urgencias y Ambulancia',
        items: [
          'Estructura tubular de aleación ligera',
          'Sistema de patas retráctiles para carga vehicular',
          'Mecanismo de anclaje y traba en piso de ambulancia',
          'Barandas laterales abatibles y cinturones de sujeción',
          'Respaldo reclinable multiposición',
          'Colchón impermeable y fácil de desinfectar',
          'Ruedas giratorias con frenos',
          'Limpieza, lubricación de ejes y prueba de carga'
        ]
      },
      {
        id: 'monitor_desfibrilador_transporte',
        name: 'Monitor/desfibrilador',
        category: 'Urgencias y Ambulancia',
        items: [
          'Chasis robusto con protección contra impactos',
          'Baterías recargables principales y cargador de vehículo (12V/110V)',
          'Palas externas / parches multifunción',
          'Cable de monitoreo ECG de 3/5/12 derivaciones',
          'Módulo de pulsioximetría (SpO2)',
          'Módulo de PNI con brazalete',
          'Capnografía de transporte (EtCO2)',
          'Autotest de descarga y marcapasos',
          'Registrador de eventos en papel térmico',
          'Limpieza y verificación funcional'
        ]
      },
      {
        id: 'ventilador_transporte',
        name: 'Ventilador de transporte',
        category: 'Urgencias y Ambulancia',
        items: [
          'Chasis compacto, asa de transporte y soporte de fijación',
          'Batería interna de larga duración y cargador vehicular',
          'Manguera de suministro de oxígeno a alta presión',
          'Circuito respiratorio de paciente y válvula de exhalación',
          'Selector de modos ventilatorios (CMV, SIMV, CPAP)',
          'Manómetro de presión en vía aérea y alarmas audibles',
          'Válvula de alivio de sobrepresión',
          'Limpieza, desinfección y prueba funcional'
        ]
      },
      {
        id: 'aspirador_transporte',
        name: 'Aspirador',
        category: 'Urgencias y Ambulancia',
        items: [
          'Carcasa portátil con batería recargable',
          'Conexión a toma de 12V vehicular y 110V AC',
          'Bomba de succión y regulador de vacío con manómetro',
          'Frasco colector con válvula de sobreflujo',
          'Filtro bacteriológico hidrofóbico',
          'Mangueras de succión y cánulas',
          'Limpieza y prueba de vacío'
        ]
      },
      {
        id: 'bomba_infusion_transporte',
        name: 'Bomba de infusión',
        category: 'Urgencias y Ambulancia',
        items: [
          'Carcasa liviana de transporte y pinza para atril/camilla',
          'Batería interna de alta autonomía',
          'Mecanismo de bombeo y detección de aire/oclusión',
          'Alarmas audibles y visuales de alta visibilidad',
          'Limpieza y prueba de infusión'
        ]
      },
      {
        id: 'pulsioximetro',
        name: 'Pulsioxímetro',
        category: 'Urgencias y Ambulancia',
        items: [
          'Carcasa, display OLED/LED y compartimiento de baterías',
          'Sensor tipo dedal adulto/pediátrico',
          'Medición de %SpO2 y frecuencia de pulso (PR)',
          'Onda pletismográfica e indicador de perfusión',
          'Alarmas de límite superior e inferior de SpO2',
          'Limpieza y desinfección'
        ]
      },
      {
        id: 'tensiometro',
        name: 'Tensiómetro',
        category: 'Urgencias y Ambulancia',
        items: [
          'Manómetro aneroide / módulo digital',
          'Brazalete con velcro de alta resistencia',
          'Pera insufladora de goma y válvula de escape regulable',
          'Mangueras de conexión sin fugas ni cuarteaduras',
          'Verificación del cero en el manómetro',
          'Limpieza y calibración funcional'
        ]
      }
    ]
  },
  {
    category: 'Otros',
    technologies: [
      {
        id: 'otros_biomedicos',
        name: 'Otros equipos biomédicos',
        category: 'Otros',
        items: DEFAULT_OTHER_ITEMS
      }
    ]
  }
];

// Lista plana de todas las tecnologías
export const ALL_TECHNOLOGIES: TechnologyItem[] = TECHNOLOGY_CATEGORIES.flatMap(
  (cat) => cat.technologies
);

// Mapeo rápido por ID
export const TECHNOLOGY_BY_ID: Record<string, TechnologyItem> = ALL_TECHNOLOGIES.reduce(
  (acc, tech) => {
    acc[tech.id] = tech;
    return acc;
  },
  {} as Record<string, TechnologyItem>
);

// Función para detectar la tecnología más apropiada según el nombre del equipo
export function detectTechnology(equipmentName?: string, equipmentType?: string): TechnologyItem {
  if (!equipmentName && !equipmentType) {
    return TECHNOLOGY_BY_ID['otros_biomedicos'];
  }

  const query = `${equipmentName || ''} ${equipmentType || ''}`.toLowerCase();

  // Camas eléctricas
  if (query.includes('cama') && (query.includes('elect') || query.includes('hosp') || query.includes('uci') || query.includes('fowler'))) {
    return TECHNOLOGY_BY_ID['camas_electricas'];
  }
  if (query.includes('cama')) {
    return TECHNOLOGY_BY_ID['camas_electricas'];
  }

  // Camillas
  if (query.includes('camilla') && query.includes('ambulan')) {
    return TECHNOLOGY_BY_ID['camilla_ambulancia'];
  }
  if (query.includes('camilla')) {
    return TECHNOLOGY_BY_ID['camillas_transporte'];
  }

  // Ventiladores
  if (query.includes('ventilador') && (query.includes('trans') || query.includes('portatil'))) {
    return TECHNOLOGY_BY_ID['ventilador_transporte'];
  }
  if (query.includes('ventilador') || query.includes('respirador')) {
    return TECHNOLOGY_BY_ID['ventiladores_mecanicos'];
  }

  // Monitores
  if (query.includes('monitor') && (query.includes('uci') || query.includes('multi') || query.includes('parametro'))) {
    return TECHNOLOGY_BY_ID['monitores_multiparametro_uci'];
  }
  if (query.includes('monitor') && query.includes('desfib')) {
    return TECHNOLOGY_BY_ID['monitor_desfibrilador_transporte'];
  }
  if (query.includes('monitor') && query.includes('signo')) {
    return TECHNOLOGY_BY_ID['monitores_signos_basicos'];
  }
  if (query.includes('monitor')) {
    return TECHNOLOGY_BY_ID['monitores_multiparametro_uci'];
  }

  // Bombas
  if (query.includes('bomba') && (query.includes('jeringa') || query.includes('infusora de jeringa'))) {
    return TECHNOLOGY_BY_ID['bombas_jeringa'];
  }
  if (query.includes('bomba') && (query.includes('infusion') || query.includes('volumetrica'))) {
    return TECHNOLOGY_BY_ID['bombas_infusion'];
  }

  // Desfibrilador
  if (query.includes('desfibrilador') || query.includes('dea') || query.includes('cardioversor')) {
    return TECHNOLOGY_BY_ID['desfibriladores'];
  }

  // ECG
  if (query.includes('electrocardio') || query.includes('ecg') || query.includes('ekg')) {
    return TECHNOLOGY_BY_ID['electrocardiografos'];
  }

  // Aspiradores
  if (query.includes('aspirador') && (query.includes('quirurg') || query.includes('quirofano'))) {
    return TECHNOLOGY_BY_ID['aspiradores_quirurgicos'];
  }
  if (query.includes('aspirador') || query.includes('succionador')) {
    return TECHNOLOGY_BY_ID['aspiradores_secreciones'];
  }

  // Anestesia
  if (query.includes('anestesia')) {
    return TECHNOLOGY_BY_ID['maquinas_anestesia'];
  }

  // Mesas y lámparas
  if (query.includes('mesa') && (query.includes('quirurg') || query.includes('cirugia'))) {
    return TECHNOLOGY_BY_ID['mesas_quirurgicas'];
  }
  if (query.includes('lampara') && (query.includes('quirurg') || query.includes('cielitica') || query.includes('cirugia'))) {
    return TECHNOLOGY_BY_ID['lamparas_quirurgicas'];
  }

  // Electrobisturi
  if (query.includes('electrobisturi') || query.includes('electroquirurg') || query.includes('bisturi electro')) {
    return TECHNOLOGY_BY_ID['electrobisturi'];
  }

  // Esterilizacion
  if (query.includes('autoclave') || query.includes('esterilizador')) {
    return TECHNOLOGY_BY_ID['autoclaves'];
  }
  if (query.includes('selladora')) {
    return TECHNOLOGY_BY_ID['selladoras'];
  }
  if (query.includes('ultrasonica') || query.includes('ultrasonido lavado')) {
    return TECHNOLOGY_BY_ID['lavadoras_ultrasonicas'];
  }

  // Laboratorio
  if (query.includes('hematolog') || query.includes('hemograma') || query.includes('cuadro hematico')) {
    return TECHNOLOGY_BY_ID['analizadores_hematologicos'];
  }
  if (query.includes('quimica') || query.includes('bioquimic')) {
    return TECHNOLOGY_BY_ID['analizadores_quimica'];
  }
  if (query.includes('gases') || query.includes('gasometria')) {
    return TECHNOLOGY_BY_ID['analizadores_gases'];
  }
  if (query.includes('centrifuga')) {
    return TECHNOLOGY_BY_ID['centrifugas'];
  }
  if (query.includes('microscopio')) {
    return TECHNOLOGY_BY_ID['microscopios'];
  }
  if (query.includes('incubadora')) {
    return TECHNOLOGY_BY_ID['incubadoras_lab'];
  }
  if (query.includes('bano') || query.includes('baño maria') || query.includes('serologico')) {
    return TECHNOLOGY_BY_ID['banos_serologicos'];
  }
  if (query.includes('nevera') || query.includes('refrigerador') || query.includes('congelador')) {
    return TECHNOLOGY_BY_ID['neveras_congeladores'];
  }

  // Imagenes
  if (query.includes('tomografo') || query.includes('tac') || query.includes('ct scanner')) {
    return TECHNOLOGY_BY_ID['tomografo'];
  }
  if (query.includes('rx') || query.includes('rayos x')) {
    return TECHNOLOGY_BY_ID['rx_portatil'];
  }
  if (query.includes('ecografo') || query.includes('ultrasonido diagn')) {
    return TECHNOLOGY_BY_ID['ecografo'];
  }

  // Pulsioxímetro / Tensiómetro
  if (query.includes('pulsioximetro') || query.includes('oximetro')) {
    return TECHNOLOGY_BY_ID['pulsioximetro'];
  }
  if (query.includes('tensiometro') || query.includes('esfigmo')) {
    return TECHNOLOGY_BY_ID['tensiometro'];
  }

  return TECHNOLOGY_BY_ID['otros_biomedicos'];
}
