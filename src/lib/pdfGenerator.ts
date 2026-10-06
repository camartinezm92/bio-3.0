import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Equipment, MaintenanceReport, ComplianceSubmission, Transfer } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { resolveEquipmentScope, getEquipmentCVHeaders, getMaintenanceReportHeaders } from '@/lib/scopeUtils';

export const generateEquipmentCVPDF = (equipment: Equipment, reports: MaintenanceReport[] = [], transfers: Transfer[] = [], returnBase64?: boolean) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;
  const contentWidth = pageWidth - (margin * 2);

  const chk = (cond: boolean) => cond ? 'X' : '  ';
  const c = (val: any) => val ? val : 'N/A';

  const sectionHeaderStyle = { fillColor: [180, 180, 180], fontStyle: 'bold', halign: 'center', textColor: [0, 0, 0], fontSize: 8 };
  const hStyle = { fillColor: [240, 240, 240], fontStyle: 'bold', halign: 'center', fontSize: 7, valign: 'middle' };
  const dStyle = { halign: 'center', fontSize: 7, valign: 'middle', textColor: [0, 0, 0] };

  // --- 1. HEADER (MEMBRETE) ---
  const scope = resolveEquipmentScope(equipment);
  const isBiomedical = scope === 'biomedical';
  const isComputing = scope === 'computing';
  const isIndustrial = scope === 'infrastructure';
  const isOther = scope === 'other';

  const { cvTitle, cvMacro, cvProceso, cvCodigo, cvArchivo } = getEquipmentCVHeaders(scope);

  autoTable(doc, {
    startY: margin,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0,0,0] },
    columnStyles: {
      0: { cellWidth: 35, halign: 'center', valign: 'middle' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 'auto' }
    },
    body: [
      [
        { content: '', rowSpan: 6 },
        { content: 'MEDICINA INTENSIVA DEL TOLIMA S.A. - UCI HONDA', colSpan: 3, styles: { halign: 'center', fontStyle: 'bold', fontSize: 9 } }
      ],
      [
        { content: cvTitle, colSpan: 3, styles: { halign: 'center', fontStyle: 'bold', fontSize: 8 } }
      ],
      [
        { content: cvMacro, styles: { fontStyle: 'bold' } },
        { content: cvProceso, colSpan: 2, styles: { fontStyle: 'bold' } }
      ],
      [
        { content: 'Responsable: Líder de proceso', styles: { fontStyle: 'bold' } },
        { content: `Fecha de emisión: 2024-01-15`, styles: { fontStyle: 'bold' } },
        { content: cvCodigo, styles: { fontStyle: 'bold' } }
      ],
      [
        { content: 'Revisó: Comité de Calidad', styles: { fontStyle: 'bold' } },
        { content: 'Fecha última actualización: 2024-01-15', styles: { fontStyle: 'bold' } },
        { content: 'Versión: 0,1', styles: { fontStyle: 'bold' } }
      ],
      [
        { content: 'Aprobó: Gerente de la institución', styles: { fontStyle: 'bold' } },
        { content: cvArchivo, styles: { fontStyle: 'bold' } },
        { content: 'Página 1 de 1', styles: { fontStyle: 'bold' } }
      ]
    ],
    didDrawCell: (data) => {
      if (data.row.index === 0 && data.column.index === 0 && data.section === 'body') {
        try {
          doc.addImage('/logo.png', 'PNG', data.cell.x + 2, data.cell.y + 2, 31, 26);
        } catch (e) { }
      }
    }
  });

  let currentY = (doc as any).lastAutoTable.finalY + 0.1;

  // --- 2. IDENTIFICACIÓN DEL EQUIPO ---

  let regLabel = 'REG. SANITARIO';
  let regValue = c(equipment.registrationInvima);
  let impactHeader = 'PRINCIPIO FISIOLÓGICO DE FUNCIONAMIENTO';
  let impactContent = c(equipment.physiologicalPrinciple);

  if (isComputing) {
    regLabel = 'SISTEMA OPERATIVO';
    regValue = c(equipment.operatingSystem || 'N/A');
    impactHeader = 'ROL O FUNCIÓN EN EL SERVICIO ASISTENCIAL (IMPACTO TIC)';
    impactContent = c(equipment.functionalRole || 'Equipo de procesamiento, registro y gestión de datos hospitalarios.');
  } else if (isIndustrial) {
    regLabel = 'NORMA TÉCNICA';
    regValue = c(equipment.technicalNorm || 'RETIE / NTC 2050');
    impactHeader = 'COBERTURA ASISTENCIAL Y OPERACIÓN EN CONTINGENCIA';
    impactContent = c(
      equipment.coverageArea 
        ? `${equipment.coverageArea} | ${equipment.functionalDescription || ''}` 
        : (equipment.functionalDescription || 'Suministro y soporte continuo de infraestructura hospitalaria.')
    );
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0,0,0] },
    columnStyles: {
      0: { cellWidth: 55, halign: 'center', valign: 'middle' },
      1: { cellWidth: 35, ...(hStyle as any) },
      2: { cellWidth: 35, ...(dStyle as any) },
      3: { cellWidth: 30, ...(hStyle as any) },
      4: { cellWidth: 35, ...(dStyle as any) }
    },
    body: [
      [
        { content: 'IDENTIFICACIÓN DEL EQUIPO', colSpan: 5, styles: sectionHeaderStyle as any }
      ],
      [
        { content: '', rowSpan: 4, styles: { minCellHeight: 40 } },
        'NOMBRE', { content: equipment.name, colSpan: 3, styles: { fontStyle: 'bold', halign: 'center' } }
      ],
      [
        'MARCA', c(equipment.brand),
        'MODELO', c(equipment.model)
      ],
      [
        'SERIE', c(equipment.serial),
        'UBICACIÓN', c(equipment.location?.toUpperCase())
      ],
      [
        regLabel, regValue,
        'FECHA DE ADQ.', c(equipment.acquisitionDate)
      ],
      [
        { content: impactHeader, colSpan: 5, styles: hStyle as any }
      ],
      [
        { content: impactContent, colSpan: 5, styles: { halign: 'center', minCellHeight: 15, valign: 'middle' } }
      ]
    ],
    didDrawCell: (data) => {
      if (data.row.index === 1 && data.column.index === 0 && data.section === 'body') {
        // Try multiple sources for the image
        const photoStr = equipment.photoThumbnail || 
                        (equipment.imageUrl?.startsWith('data:') ? equipment.imageUrl : null) ||
                        equipment.imageUrl;
        
        console.log('PDF Render attempt: Photo present?', !!photoStr);

        if (photoStr) {
          try {
             // Detect image format from data URI prefix
             let format = 'JPEG';
             if (photoStr.startsWith('data:image/png')) format = 'PNG';
             else if (photoStr.startsWith('data:image/webp')) format = 'WEBP';
             else if (photoStr.startsWith('data:image/gif')) format = 'GIF';
             
             doc.addImage(photoStr, format, data.cell.x + 2, data.cell.y + 2, 51, 36);
          } catch(e) {
             console.error('Error drawing equipment image:', e);
             try {
                // Second attempt: Let jsPDF try to guess format (alias)
                doc.addImage(photoStr, data.cell.x + 2, data.cell.y + 2, 51, 36);
             } catch (e2) {
                console.error('Final attempt failed:', e2);
                doc.setFontSize(6);
                doc.setTextColor(150,150,150);
                doc.text('ERR_FORMAT', data.cell.x + 15, data.cell.y + 20);
                doc.setTextColor(0,0,0);
             }
          }
        } else {
             doc.setFontSize(8);
             doc.setTextColor(150,150,150);
             doc.text('SIN IMAGEN', data.cell.x + 15, data.cell.y + 20);
             doc.text(`ID: ${equipment.photoId ? 'OK' : 'NO'}`, data.cell.x + 15, data.cell.y + 25);
             doc.setTextColor(0,0,0);
        }
      }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 0.1;

  // --- 3. REPUESTOS, COMPONENTES Y ACCESORIOS ---
  let accRows = (equipment.accessories || []).map(a => [
    a.description, a.brand, a.model, a.serial, a.reference, a.quantity.toString()
  ]);
  if (accRows.length === 0) {
    accRows = [['NO PRESENTA', 'NO PRESENTA', 'NO PRESENTA', 'NO PRESENTA', 'NO PRESENTA', '1']];
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0,0,0], halign: 'center', valign: 'middle' },
    headStyles: hStyle as any,
    body: [
      [
        { content: 'REPUESTOS, COMPONENTES Y ACCESORIOS', colSpan: 6, styles: sectionHeaderStyle as any }
      ],
      [
        { content: 'DESCRIPCIÓN', styles: hStyle as any },
        { content: 'MARCA', styles: hStyle as any },
        { content: 'MODELO', styles: hStyle as any },
        { content: 'SERIE', styles: hStyle as any },
        { content: 'REFERENCIA', styles: hStyle as any },
        { content: 'CANTIDAD', styles: hStyle as any }
      ],
      ...accRows
    ]
  });

  currentY = (doc as any).lastAutoTable.finalY + 0.1;

  const typeFijo = equipment.equipmentType === 'Fijo';
  const typeMovil = equipment.equipmentType === 'Móvil';
  const tm = equipment.predominantTechnology;

  let equipDescBody: any[] = [];
  let equipDescColStyles: any = {
    0: { cellWidth: 35, ...(hStyle as any) },
    1: { cellWidth: 40, halign: 'center', valign: 'middle' },
    2: { cellWidth: 40, halign: 'center', valign: 'middle' },
    3: { cellWidth: 45, ...(hStyle as any) },
    4: { cellWidth: 30, halign: 'center', valign: 'middle' }
  };

  if (isComputing) {
    equipDescBody = [
      [
        { content: 'DESCRIPCIÓN DEL EQUIPO Y ESPECIFICACIONES TIC', colSpan: 5, styles: sectionHeaderStyle as any }
      ],
      [
        'TIPO / CATEGORÍA TIC', 
        c(equipment.itCategory || equipment.equipmentType || 'Estación de Trabajo / PC'), 
        'SISTEMA OPERATIVO', 
        c(equipment.operatingSystem || 'Windows / Linux'), 
        'FRECUENCIA DE MANTENIMIENTO: ' + `${c(equipment.maintenanceFrequency)} MESES`
      ],
      [
        { content: 'ARQUITECTURA\nY HARDWARE', rowSpan: 3, styles: hStyle as any },
        `PROCESADOR: ${c(equipment.processor || 'N/A')}`,
        `MEMORIA RAM: ${c(equipment.ramMemory || 'N/A')}`,
        'CALIBRACIÓN',
        'NO APLICA (ACTIVO TIC)'
      ],
      [
        `DISCO: ${c(equipment.storageCapacity || 'N/A')}`,
        `CONEXIÓN: ${c(equipment.networkConnection || 'LAN Cableada')}`,
        'DIMENSIONES',
        c(equipment.dimensions)
      ],
      [
        `ANTIVIRUS: ${c(equipment.antivirusSoftware || 'Protegido')}`,
        `LICENCIA: ${c(equipment.licenseStatus || 'Activa')}`,
        'FUENTE DE ALIMENTACIÓN',
        c(equipment.powerSupply?.toUpperCase() || 'AC 110V / UPS')
      ]
    ];
  } else if (isIndustrial) {
    equipDescBody = [
      [
        { content: 'DESCRIPCIÓN DEL EQUIPO INDUSTRIAL Y PARÁMETROS OPERATIVOS', colSpan: 5, styles: sectionHeaderStyle as any }
      ],
      [
        'TIPO DE EQUIPO', 
        `FIJO/CENTRAL [ ${chk(typeFijo || !typeMovil)} ]`, 
        `MÓVIL/AUTÓNOMO [ ${chk(typeMovil)} ]`, 
        'FRECUENCIA DE MANTENIMIENTO', 
        `${c(equipment.maintenanceFrequency)} MESES`
      ],
      [
        { content: 'SUBSISTEMA\nINDUSTRIAL', rowSpan: 3, styles: hStyle as any },
        `SUBSISTEMA: ${c(equipment.industrialSystem || 'Generación y Respaldo')}`,
        `CRITICIDAD: ${c(equipment.industrialCriticality || 'Alta Operativa')}`,
        'INSPECCIÓN TÉCNICA / RETIE',
        equipment.calibrationFrequency ? `${c(equipment.calibrationFrequency)} MESES` : 'ANUAL / NORMATIVA'
      ],
      [
        `POTENCIA: ${c(equipment.capacityPower || 'N/A')}`,
        `TENSIÓN: ${c(equipment.operatingVoltage || 'N/A')}`,
        'DIMENSIONES',
        c(equipment.dimensions)
      ],
      [
        `FLUIDO/COMBUSTIBLE: ${c(equipment.fuelOrFluids || 'N/A')}`,
        `NORMA: ${c(equipment.technicalNorm || 'RETIE / NFPA')}`,
        'FUENTE DE ALIMENTACIÓN',
        c(equipment.powerSupply?.toUpperCase() || 'RED ELÉCTRICA / DIESEL')
      ]
    ];
  } else {
    equipDescBody = [
      [
        { content: 'DESCRIPCIÓN DEL EQUIPO', colSpan: 5, styles: sectionHeaderStyle as any }
      ],
      [
        'TIPO DE EQUIPO', 
        `FIJO [ ${chk(typeFijo)} ]`, 
        `MOVIL [ ${chk(typeMovil)} ]`, 
        'FRECUENCIA DE MANTENIMIENTO', 
        `${c(equipment.maintenanceFrequency)} MESES`
      ],
      [
        { content: 'TECNOLOGÍA\nPREDOMINANTE', rowSpan: 3, styles: hStyle as any },
        `MECÁNICO [ ${chk(tm==='Mecánico')} ]`,
        `ELECTRÓNICO [ ${chk(tm==='Electrónico')} ]`,
        'FRECUENCIA DE CALIBRACIÓN',
        `${c(equipment.calibrationFrequency || '12')} MESES`
      ],
      [
        `ELÉCTRICO [ ${chk(tm==='Eléctrico')} ]`,
        `HIDRÁULICO [ ${chk(tm==='Hidráulico')} ]`,
        'DIMENSIONES',
        c(equipment.dimensions)
      ],
      [
        `NEUMÁTICO [ ${chk(tm==='Neumático')} ]`,
        `OTRO: [ ${chk(tm==='Otro')} ]`,
        'FUENTE DE ALIMENTACIÓN',
        c(equipment.powerSupply?.toUpperCase())
      ]
    ];
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0,0,0] },
    columnStyles: equipDescColStyles,
    body: equipDescBody
  });

  currentY = (doc as any).lastAutoTable.finalY + 0.1;

  const tc = equipment.technicalCharacteristics || {};
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0,0,0] },
    columnStyles: {
      0: { ...(hStyle as any), cellWidth: 'auto' }, 1: { ...(dStyle as any), cellWidth: 'auto' },
      2: { ...(hStyle as any), cellWidth: 'auto' }, 3: { ...(dStyle as any), cellWidth: 'auto' },
      4: { ...(hStyle as any), cellWidth: 'auto' }, 5: { ...(dStyle as any), cellWidth: 'auto' }
    },
    body: [
      [
        { content: 'CARACTERÍSTICAS TÉCNICAS', colSpan: 6, styles: sectionHeaderStyle as any }
      ],
      [
        'VOLTAJE', c(tc.voltage),
        'AMPERAJE', c(tc.amperage),
        'TEMP. (ºC)', c(tc.temperature)
      ],
      [
        'POTENCIA', c(tc.power),
        'FRECUENCIA', c(tc.frequency),
        'HUMEDAD', c(tc.humidity)
      ],
      [
        'CAPACIDAD', c(tc.capacity),
        'VEL. (RPM)', c(tc.speedRpm),
        'PRESIÓN (PSI)', c(tc.pressure)
      ],
      [
        'VIDA ÚTIL', c(tc.lifespan),
        'PESO (Kg)', c(tc.weight),
        'OTRO:', c(tc.other)
      ]
    ]
  });

  currentY = (doc as any).lastAutoTable.finalY + 0.1;

  const mf = equipment.manufacturerInfo || {};
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0,0,0] },
    columnStyles: {
      0: { ...(hStyle as any), cellWidth: 'auto' }, 1: dStyle as any,
      2: { ...(hStyle as any), cellWidth: 'auto' }, 3: dStyle as any
    },
    body: [
      [
        { content: 'DATOS DE EMPRESAS FABRICANTES E IMPORTADORAS', colSpan: 4, styles: sectionHeaderStyle as any }
      ],
      [
        'PROVEEDOR', c(equipment.providerName?.toUpperCase()), 
        'FABRICANTE', c(mf.name?.toUpperCase())
      ],
      [
        'DIRECCIÓN', 'N/A',
        'DIRECCIÓN', c(mf.address?.toUpperCase())
      ],
      [
        'TELÉFONO', 'N/A',
        'PAÍS', c(mf.country?.toUpperCase())
      ],
      [
        'EMAIL', 'N/A',
        'EMAIL', c(mf.email)
      ],
      [
        { 
          content: isComputing 
            ? 'GESTIÓN DE RED, SEGURIDAD Y LICENCIAMIENTO TIC' 
            : isIndustrial 
            ? 'CUMPLIMIENTO TÉCNICO Y NORMATIVA INDUSTRIAL' 
            : 'TECNOVIGILANCIA', 
          colSpan: 4, 
          styles: sectionHeaderStyle as any 
        }
      ],
      [
        isComputing 
          ? 'DIRECCIÓN IP / RED' 
          : isIndustrial 
          ? 'NORMATIVA APLICABLE' 
          : 'REGISTRO SANITARIO', 
        isComputing 
          ? c(`${equipment.ipAddress || 'DHCP'} (${equipment.networkConnection || 'LAN'})`)
          : isIndustrial 
          ? c(equipment.technicalNorm || 'RETIE / NFPA 99')
          : c(equipment.registrationInvima),
        isComputing 
          ? 'LICENCIA / ANTIVIRUS' 
          : isIndustrial 
          ? 'DICTAMEN / CERTIFICADO' 
          : 'VIGENCIA DEL REGISTRO', 
        isComputing 
          ? c(`${equipment.licenseStatus || 'Activa'} | ${equipment.antivirusSoftware || 'Instalado'}`)
          : isIndustrial 
          ? c(equipment.certCertificateNumber || 'Dictamen Conforme')
          : c(equipment.registrationExpiration)
      ]
    ]
  });

  currentY = (doc as any).lastAutoTable.finalY + 0.1;

  const clr = equipment.riskClass;
  const cb = equipment.biomedicalClassification;
  
  let classificationBody: any[] = [];
  if (isBiomedical) {
    classificationBody = [
      [
        { content: 'CLASIFICACIÓN DE RIESGO', colSpan: 2, styles: hStyle as any },
        { content: 'CLASIFICACIÓN BIOMÉDICA', colSpan: 3, styles: hStyle as any }
      ],
      [
        `I - RIESGO BAJO [ ${chk(clr==='I')} ]`,
        `IIA - RIESGO MODERADO [ ${chk(clr==='IIa')} ]`,
        `REHABILITACIÓN [ ${chk(cb==='Rehabilitación')} ]`,
        `PREVENCIÓN [ ${chk(cb==='Prevención')} ]`,
        `TRATAMIENTO [ ${chk(cb==='Tratamiento')} ]`
      ],
      [
        `IIB - RIESGO ALTO [ ${chk(clr==='IIb')} ]`,
        `III - RIESGO MUY ALTO [ ${chk(clr==='III')} ]`,
        `ANÁLISIS DE LAB. [ ${chk(cb==='Análisis de Lab')} ]`,
        `DIAGNÓSTICO [ ${chk(cb==='Diagnóstico')} ]`,
        `OTRO: [ ${chk(cb==='Otro')} ]`
      ]
    ];
  } else if (isComputing) {
    classificationBody = [
      [
        { content: 'CATEGORÍA DE ACTIVO TIC', colSpan: 2, styles: hStyle as any },
        { content: 'CRITICIDAD E IMPACTO ASISTENCIAL', colSpan: 3, styles: hStyle as any }
      ],
      [
        `SERVIDOR [ ${chk(equipment.itCategory === 'Servidor')} ]`,
        `ESTACIÓN / PC [ ${chk(equipment.itCategory === 'Estación de Trabajo / PC')} ]`,
        `CRÍTICA (UCI / CORE) [ ${chk(equipment.itCriticality?.includes('Crítica') || false)} ]`,
        `MEDIA (ASISTENCIAL) [ ${chk(equipment.itCriticality?.includes('Media') || false)} ]`,
        `BAJA (ADMIN) [ ${chk(equipment.itCriticality?.includes('Baja') || false)} ]`
      ],
      [
        `PORTÁTIL [ ${chk(equipment.itCategory === 'Portátil / Laptop')} ]`,
        `REDES / OTRO [ ${chk(equipment.itCategory === 'Redes (Switch/Router/AP)' || equipment.itCategory === 'Otro')} ]`,
        `ANTIVIRUS: ${c(equipment.antivirusSoftware || 'VIGENTE')}`,
        `CPU: ${c(equipment.processor || 'N/A')}`,
        `RAM: ${c(equipment.ramMemory || 'N/A')}`
      ]
    ];
  } else {
    // Industrial
    classificationBody = [
      [
        { content: 'SUBSISTEMA INDUSTRIAL', colSpan: 2, styles: hStyle as any },
        { content: 'CRITICIDAD E IMPACTO OPERATIVO', colSpan: 3, styles: hStyle as any }
      ],
      [
        `PLANTA / UPS [ ${chk(equipment.industrialSystem?.includes('Planta') || false)} ]`,
        `ELÉCTRICO / RCI [ ${chk(equipment.industrialSystem?.includes('Distribución') || equipment.industrialSystem?.includes('RCI') || false)} ]`,
        `ALTA (SOPORTE VITAL) [ ${chk(equipment.industrialCriticality?.includes('Alta') || false)} ]`,
        `MEDIA (OPERATIVA) [ ${chk(equipment.industrialCriticality?.includes('Media') || false)} ]`,
        `BAJA (CONFORT) [ ${chk(equipment.industrialCriticality?.includes('Baja') || false)} ]`
      ],
      [
        `GASES / HVAC [ ${chk(equipment.industrialSystem?.includes('Gases') || equipment.industrialSystem?.includes('HVAC') || false)} ]`,
        `VAPOR / OTRO [ ${chk(equipment.industrialSystem?.includes('Vapor') || equipment.industrialSystem === 'Otro')} ]`,
        `POTENCIA: ${c(equipment.capacityPower || 'N/A')}`,
        `VOLTAJE: ${c(equipment.operatingVoltage || 'N/A')}`,
        `FLUIDO: ${c(equipment.fuelOrFluids || 'N/A')}`
      ]
    ];
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0,0,0], valign: 'middle' },
    columnStyles: {
      0: dStyle as any, 1: dStyle as any, 2: dStyle as any, 3: dStyle as any, 4: dStyle as any
    },
    body: classificationBody
  });

  currentY = (doc as any).lastAutoTable.finalY + 0.1;

  const ma = equipment.manualsAvailable || [];
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0,0,0], valign: 'middle', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 47.5 }, 1: { cellWidth: 47.5 }, 2: { cellWidth: 47.5 }, 3: { cellWidth: 47.5 }
    },
    body: [
      [
        { content: 'MANUALES', colSpan: 4, styles: sectionHeaderStyle as any }
      ],
      [
        `USUARIO [ ${chk(ma.includes('Usuario'))} ]`,
        `SERVICIO [ ${chk(ma.includes('Servicio'))} ]`,
        `COMPONENTES [ ${chk(ma.includes('Componentes'))} ]`,
        `DESPIECE [ ${chk(ma.includes('Despiece'))} ]`
      ],
      [
        { content: 'RECOMENDACIONES DEL FABRICANTE', colSpan: 4, styles: sectionHeaderStyle as any }
      ],
      [
        { content: c(equipment.manufacturerRecommendations), colSpan: 4, styles: { minCellHeight: 25, halign: 'left', valign: 'top' } }
      ],
      [
        { content: 'COPIA CONTROLADA', colSpan: 4, styles: { halign: 'center', fontStyle: 'bold', minCellHeight: 10, valign: 'bottom', lineWidth: 0 } }
      ]
    ]
  });

  const fileName = equipment.lastCalibration 
    ? `HV_${equipment.assetNumber}_${equipment.name.replace(/\s+/g, '_')}_Calibrado_${equipment.lastCalibration}.pdf`
    : `HV_${equipment.assetNumber}_${equipment.name.replace(/\s+/g, '_')}.pdf`;

  if (returnBase64) {
    doc.save(fileName); // Save to browser
    const pdfDataUri = doc.output('datauristring');
    return pdfDataUri; // Return base64 for backend upload
  }

  doc.save(fileName);
};

export const generateMaintenancePDF = (report: MaintenanceReport, returnBase64?: boolean) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;
  const contentWidth = pageWidth - (margin * 2);
  
  // --- LOGO AND TITLE (Standalone header) ---
  try {
    doc.addImage('/logo.png', 'PNG', margin, margin, 31, 26);
  } catch (e) {
    doc.setFontSize(10);
    doc.text('UCI HONDA', margin + 15, margin + 15, { align: 'center' });
  }

  const repScope = resolveEquipmentScope({
    technologyScope: report.technologyScope,
    name: report.equipmentName,
    registrationInvima: report.registrationInvima
  });
  const { reportTitle, macroproceso, proceso, codigo } = getMaintenanceReportHeaders(repScope);

  // --- HEADER TABLE (Simplified) ---
  autoTable(doc, {
    startY: margin,
    margin: { left: margin + 35, right: margin },
    tableWidth: contentWidth - 35,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1 },
    body: [
      [
        { content: 'MEDICINA INTENSIVA DEL TOLIMA S.A. - UCI HONDA', colSpan: 2, styles: { halign: 'center', fontStyle: 'bold', fontSize: 9 } }
      ],
      [
        { content: reportTitle, colSpan: 2, styles: { halign: 'center', fontStyle: 'bold', fontSize: 8 } }
      ],
      [
        { content: macroproceso, styles: { cellWidth: (contentWidth - 35) / 2 } },
        { content: proceso, styles: { cellWidth: (contentWidth - 35) / 2 } }
      ],
      [
        { content: 'Responsable: Líder de proceso' },
        { content: 'Fecha de emisión: 2017-08-30' },
        { content: codigo }
      ],
      [
        { content: 'Revisó: Comité de Calidad' },
        { content: 'Fecha última actualización: 2024-01-15' },
        { content: 'Versión: 0.3' }
      ],
      [
        { content: 'Aprobó: Gerente de la institución' },
        { content: repScope === 'computing' ? 'Archivo: Gestión de Infraestructura y Redes TIC' : repScope === 'infrastructure' ? 'Archivo: Gestión de Mantenimiento e Infraestructura' : 'Archivo: Gestión Tecnología Biomédica' },
        { content: 'Página 1 de 1' }
      ]
    ]
  });

  let currentY = Math.max((doc as any).lastAutoTable.finalY, margin + 28);

  const labelWidth = contentWidth * 0.2;
  const valueWidth = contentWidth * 0.3;

  // --- RECEPTION INFO ---
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.2 },
    body: [
      [
        { content: 'FECHA RECEPCIÓN', styles: { fillColor: [240, 240, 240], fontStyle: 'bold', cellWidth: labelWidth } },
        { content: report.dateReception ? format(new Date(report.dateReception), 'dd/MM/yyyy') : 'N/A', styles: { cellWidth: valueWidth, halign: 'center' } },
        { content: 'FECHA SERVICIO', styles: { fillColor: [240, 240, 240], fontStyle: 'bold', cellWidth: labelWidth } },
        { content: report.date ? format(new Date(report.date), 'dd/MM/yyyy') : 'N/A', styles: { cellWidth: valueWidth, halign: 'center' } }
      ],
      [
        { content: 'RESPONSABLE RECEPCIÓN', styles: { fillColor: [240, 240, 240], fontStyle: 'bold' } },
        { content: report.responsibleReception || 'N/A', styles: { halign: 'center' } },
        { content: 'N° DE REPORTE', styles: { fillColor: [240, 240, 240], fontStyle: 'bold' } },
        { content: report.reportNumber || 'N/A', styles: { halign: 'center', textColor: [200, 0, 0], fontStyle: 'bold' } }
      ]
    ]
  });

  currentY = (doc as any).lastAutoTable.finalY;

  // --- 1. DATOS EQUIPO ---
  doc.setFillColor(200, 220, 240);
  doc.rect(margin, currentY, contentWidth, 5, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('1. DATOS EQUIPO', pageWidth / 2, currentY + 3.5, { align: 'center' });
  
  autoTable(doc, {
    startY: currentY + 5,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.2 },
    body: [
      [
        { content: 'EQUIPO', styles: { fillColor: [240, 240, 240], fontStyle: 'bold', cellWidth: labelWidth } },
        { content: report.equipmentName || 'N/A', styles: { cellWidth: valueWidth } },
        { content: 'MODELO', styles: { fillColor: [240, 240, 240], fontStyle: 'bold', cellWidth: labelWidth } },
        { content: report.model || 'N/A', styles: { cellWidth: valueWidth } }
      ],
      [
        { content: 'MARCA', styles: { fillColor: [240, 240, 240], fontStyle: 'bold' } },
        { content: report.brand || 'N/A' },
        { content: 'SERIE', styles: { fillColor: [240, 240, 240], fontStyle: 'bold' } },
        { content: report.serial || 'N/A' }
      ]
    ]
  });

  currentY = (doc as any).lastAutoTable.finalY;

  // --- 2. DATOS GENERALES ---
  doc.setFillColor(200, 220, 240);
  doc.rect(margin, currentY, contentWidth, 5, 'F');
  doc.text('2. DATOS GENERALES', pageWidth / 2, currentY + 3.5, { align: 'center' });

  autoTable(doc, {
    startY: currentY + 5,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.2 },
    body: [
      [
        { 
          content: repScope === 'computing' ? 'RED / SISTEMA' : repScope === 'infrastructure' ? 'NORMA / SISTEMA' : 'INVIMA', 
          styles: { fillColor: [240, 240, 240], fontStyle: 'bold', cellWidth: labelWidth } 
        },
        { 
          content: repScope === 'computing' ? (report.technologyName || 'TIC / Cómputo') : repScope === 'infrastructure' ? (report.technologyName || 'Infraestructura') : (report.registrationInvima || 'N/A'), 
          styles: { cellWidth: valueWidth } 
        },
        { content: 'MODO', styles: { fillColor: [240, 240, 240], fontStyle: 'bold', cellWidth: labelWidth } },
        { content: `MÓVIL  [ ${report.mode === 'mobile' ? 'X' : ' '} ]      FIJO  [ ${report.mode === 'fixed' ? 'X' : ' '} ]`, styles: { cellWidth: valueWidth, halign: 'center' } }
      ],
      [
        { content: 'UBICACIÓN', styles: { fillColor: [240, 240, 240], fontStyle: 'bold' } },
        { content: `${report.serviceName || ''} - ${report.location || ''}`.trim() || 'N/A', colSpan: 3 }
      ]
    ]
  });

  currentY = (doc as any).lastAutoTable.finalY;

  // --- 3. TIPO DE MANTENIMIENTO ---
  doc.setFillColor(200, 220, 240);
  doc.rect(margin, currentY, contentWidth, 5, 'F');
  doc.text('3. TIPO DE MANTENIMIENTO', pageWidth / 2, currentY + 3.5, { align: 'center' });

  autoTable(doc, {
    startY: currentY + 5,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.2 },
    body: [
      [
        { content: `MANTENIMIENTO PREVENTIVO    [ ${report.type === 'preventive' ? 'X' : ' '} ]`, styles: { halign: 'center', cellWidth: contentWidth / 2 } },
        { content: `MANTENIMIENTO CORRECTIVO    [ ${report.type === 'corrective' ? 'X' : ' '} ]`, styles: { halign: 'center', cellWidth: contentWidth / 2 } }
      ],
      [
        { 
          content: `PLAN DE MANTENIMIENTO [ ${report.subType === 'plan' ? 'X' : ' '} ]     REVISIÓN [ ${report.subType === 'revision' ? 'X' : ' '} ]     REPARACIÓN [ ${report.subType === 'reparation' ? 'X' : ' '} ]     REPOSICIÓN [ ${report.subType === 'replacement' ? 'X' : ' '} ]`, 
          colSpan: 2, 
          styles: { halign: 'center' } 
        }
      ]
    ]
  });

  currentY = (doc as any).lastAutoTable.finalY;

  // --- 4. DESCRIPCIÓN ---
  doc.setFillColor(200, 220, 240);
  doc.rect(margin, currentY, contentWidth, 5, 'F');
  doc.setFontSize(7);
  doc.text('4. DESCRIPCIÓN DEL REPORTE DE MANTENIMIENTO (PROGRAMADO O AVERÍA DEL EQUIPO SEGÚN CORRESPONDA)', pageWidth / 2, currentY + 3.5, { align: 'center' });

  autoTable(doc, {
    startY: currentY + 5,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2 },
    body: [
      [{ content: report.description || 'N/A', colSpan: 4, styles: { minCellHeight: 15 } }],
      [
        { content: 'NOMBRE REPORTANTE', styles: { fillColor: [240, 240, 240], fontStyle: 'bold', cellWidth: labelWidth } },
        { content: report.reporterName || 'NA', styles: { cellWidth: valueWidth } },
        { content: 'CARGO DEL REPORTANTE', styles: { fillColor: [240, 240, 240], fontStyle: 'bold', cellWidth: labelWidth } },
        { content: report.reporterRole || 'NA', styles: { cellWidth: valueWidth } }
      ]
    ]
  });

  currentY = (doc as any).lastAutoTable.finalY;

  // --- 5. DIAGNÓSTICO TÉCNICO ---
  doc.setFillColor(200, 220, 240);
  doc.rect(margin, currentY, contentWidth, 5, 'F');
  doc.setFontSize(8);
  doc.text('5. DIAGNÓSTICO TÉCNICO', pageWidth / 2, currentY + 3.5, { align: 'center' });

  autoTable(doc, {
    startY: currentY + 5,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2 },
    body: [[{ content: report.technicalDiagnosis || 'N/A', styles: { minCellHeight: 15 } }]]
  });

  currentY = (doc as any).lastAutoTable.finalY;

  // --- 6. TRABAJO REALIZADO ---
  doc.setFillColor(200, 220, 240);
  doc.rect(margin, currentY, contentWidth, 5, 'F');
  doc.text('6. TRABAJO REALIZADO', pageWidth / 2, currentY + 3.5, { align: 'center' });

  autoTable(doc, {
    startY: currentY + 5,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2 },
    body: [[{ content: report.workPerformed || 'N/A', styles: { minCellHeight: 20 } }]]
  });

  currentY = (doc as any).lastAutoTable.finalY;

  // --- 7. REPUESTOS UTILIZADOS ---
  doc.setFillColor(200, 220, 240);
  doc.rect(margin, currentY, contentWidth, 5, 'F');
  doc.text('7. REPUESTOS UTILIZADOS', pageWidth / 2, currentY + 3.5, { align: 'center' });

  const sparePartsBody = report.spareParts && report.spareParts.length > 0 
    ? report.spareParts.map(p => [p.description, p.quantity, p.provider || 'N/A', p.partNumber || 'N/A', p.reference || 'N/A', p.value || 'N/A'])
    : [['NO APLICA', 'NO APLICA', 'NO APLICA', 'NO APLICA', 'NO APLICA', 'NO APLICA']];

  autoTable(doc, {
    startY: currentY + 5,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'grid',
    head: [['DESCRIPCIÓN', 'CANTIDAD', 'PROVEEDOR', 'SERIE/N° DE PARTE', 'REFERENCIA', 'VALOR']],
    body: sparePartsBody,
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
    styles: { fontSize: 7, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.2, halign: 'center' }
  });

  currentY = (doc as any).lastAutoTable.finalY;

  // --- 8. VERIFICACIÓN ---
  doc.setFillColor(200, 220, 240);
  doc.rect(margin, currentY, contentWidth, 5, 'F');
  const verifTitle = report.technologyName 
    ? `8. VERIFICACIÓN DE FUNCIONAMIENTO Y ESTADO (${report.technologyName.toUpperCase()})`
    : '8. VERIFICACIÓN DE FUNCIONAMIENTO Y ESTADO';
  doc.text(verifTitle, pageWidth / 2, currentY + 3.5, { align: 'center' });

  const verificationItems = report.verificationItems || [];
  const verificationRows = [];
  for (let i = 0; i < Math.max(verificationItems.length, 2); i += 2) {
    const item1 = verificationItems[i];
    const item2 = verificationItems[i + 1];

    const isC1 = item1?.status === 'C' || item1?.status === 'CU';
    const isNC1 = item1?.status === 'NC';
    const isNA1 = item1?.status === 'NA';

    const isC2 = item2?.status === 'C' || item2?.status === 'CU';
    const isNC2 = item2?.status === 'NC';
    const isNA2 = item2?.status === 'NA';

    verificationRows.push([
      item1?.name || '', 
      { content: isC1 ? 'X' : '', styles: { fillColor: isC1 ? [220, 245, 230] : [255, 255, 255], fontStyle: isC1 ? 'bold' : 'normal', textColor: isC1 ? [22, 101, 52] : [0, 0, 0] } },
      { content: isNC1 ? 'X' : '', styles: { fillColor: isNC1 ? [254, 226, 226] : [255, 255, 255], fontStyle: isNC1 ? 'bold' : 'normal', textColor: isNC1 ? [153, 27, 27] : [0, 0, 0] } },
      { content: isNA1 ? 'X' : '', styles: { fillColor: isNA1 ? [241, 245, 249] : [255, 255, 255], fontStyle: isNA1 ? 'bold' : 'normal', textColor: isNA1 ? [71, 85, 105] : [0, 0, 0] } },
      item2?.name || '',
      { content: isC2 ? 'X' : '', styles: { fillColor: isC2 ? [220, 245, 230] : [255, 255, 255], fontStyle: isC2 ? 'bold' : 'normal', textColor: isC2 ? [22, 101, 52] : [0, 0, 0] } },
      { content: isNC2 ? 'X' : '', styles: { fillColor: isNC2 ? [254, 226, 226] : [255, 255, 255], fontStyle: isNC2 ? 'bold' : 'normal', textColor: isNC2 ? [153, 27, 27] : [0, 0, 0] } },
      { content: isNA2 ? 'X' : '', styles: { fillColor: isNA2 ? [241, 245, 249] : [255, 255, 255], fontStyle: isNA2 ? 'bold' : 'normal', textColor: isNA2 ? [71, 85, 105] : [0, 0, 0] } }
    ]);
  }

  const verifOptionWidth = 6.5;
  const verifTextWidth = (contentWidth - (verifOptionWidth * 6)) / 2;

  autoTable(doc, {
    startY: currentY + 5,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'grid',
    head: [['ÍTEM DE VERIFICACIÓN', 'C', 'NC', 'NA', 'ÍTEM DE VERIFICACIÓN', 'C', 'NC', 'NA']],
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', fontSize: 6.5, cellPadding: 1 },
    styles: { fontSize: 6.5, cellPadding: 0.8, lineColor: [0, 0, 0], lineWidth: 0.2 },
    body: verificationRows,
    columnStyles: {
      0: { cellWidth: verifTextWidth, fontStyle: 'bold' },
      1: { cellWidth: verifOptionWidth, halign: 'center' },
      2: { cellWidth: verifOptionWidth, halign: 'center' },
      3: { cellWidth: verifOptionWidth, halign: 'center' },
      4: { cellWidth: verifTextWidth, fontStyle: 'bold' },
      5: { cellWidth: verifOptionWidth, halign: 'center' },
      6: { cellWidth: verifOptionWidth, halign: 'center' },
      7: { cellWidth: verifOptionWidth, halign: 'center' }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY;

  // --- 9. DIAGNÓSTICO FINAL ---
  doc.setFillColor(200, 220, 240);
  doc.rect(margin, currentY, contentWidth, 5, 'F');
  doc.text('9. DIAGNÓSTICO FINAL', pageWidth / 2, currentY + 3.5, { align: 'center' });

  autoTable(doc, {
    startY: currentY + 5,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2 },
    body: [[{ content: report.finalDiagnosis || 'N/A', styles: { minCellHeight: 10 } }]]
  });

  currentY = (doc as any).lastAutoTable.finalY;

  // --- 10. ESTADO DEL EQUIPO ---
  doc.setFillColor(200, 220, 240);
  doc.rect(margin, currentY, contentWidth, 5, 'F');
  doc.text('10. ESTADO DEL EQUIPO', pageWidth / 2, currentY + 3.5, { align: 'center' });

  autoTable(doc, {
    startY: currentY + 5,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.2 },
    body: [[
      { content: `OPERATIVO   [ ${report.equipmentStatus === 'operative' ? 'X' : ' '} ]`, styles: { halign: 'center' } },
      { content: `NO OPERATIVO   [ ${report.equipmentStatus === 'non_operative' ? 'X' : ' '} ]`, styles: { halign: 'center' } },
      { content: `DAR DE BAJA   [ ${report.equipmentStatus === 'retired' ? 'X' : ' '} ]`, styles: { halign: 'center' } }
    ]]
  });

  currentY = (doc as any).lastAutoTable.finalY;

  // --- 11. OBSERVACIONES ---
  doc.setFillColor(200, 220, 240);
  doc.rect(margin, currentY, contentWidth, 5, 'F');
  doc.text('11. OBSERVACIONES', pageWidth / 2, currentY + 3.5, { align: 'center' });

  autoTable(doc, {
    startY: currentY + 5,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2 },
    body: [[{ content: report.observations || 'N/A', styles: { minCellHeight: 15 } }]]
  });

  currentY = (doc as any).lastAutoTable.finalY;

  // --- 12. EVIDENCIA FOTOGRÁFICA ---
  if (report.photos && report.photos.length > 0) {
    if (currentY > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      currentY = margin;
    } else {
      currentY += 2;
    }

    doc.setFillColor(200, 220, 240);
    doc.rect(margin, currentY, contentWidth, 5, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('12. EVIDENCIA FOTOGRÁFICA', pageWidth / 2, currentY + 3.5, { align: 'center' });

    currentY += 7;

    const gap = 4;
    const imgWidth = (contentWidth - gap) / 2;
    const imgHeight = 52;
    const pageHeight = doc.internal.pageSize.getHeight();

    for (let i = 0; i < report.photos.length; i += 2) {
      if (currentY + imgHeight > pageHeight - 20) {
        doc.addPage();
        currentY = margin + 5;
      }

      const photo1 = report.photos[i];
      const photo2 = report.photos[i + 1];

      if (photo1) {
        const x1 = margin;
        try {
          doc.setDrawColor(200, 200, 200);
          doc.rect(x1, currentY, imgWidth, imgHeight);
          doc.addImage(photo1, 'JPEG', x1 + 1, currentY + 1, imgWidth - 2, imgHeight - 2);
        } catch (e) {
          try {
            doc.addImage(photo1, x1 + 1, currentY + 1, imgWidth - 2, imgHeight - 2);
          } catch (err) {
            console.error('Error adding photo1 to PDF:', err);
          }
        }
      }

      if (photo2) {
        const x2 = margin + imgWidth + gap;
        try {
          doc.setDrawColor(200, 200, 200);
          doc.rect(x2, currentY, imgWidth, imgHeight);
          doc.addImage(photo2, 'JPEG', x2 + 1, currentY + 1, imgWidth - 2, imgHeight - 2);
        } catch (e) {
          try {
            doc.addImage(photo2, x2 + 1, currentY + 1, imgWidth - 2, imgHeight - 2);
          } catch (err) {
            console.error('Error adding photo2 to PDF:', err);
          }
        }
      }

      currentY += imgHeight + gap;
    }
  }

  // Si queda poco espacio (menos de 60px), saltamos de página antes de poner las firmas para evitar que se corten/sobrepongan.
  if (currentY > doc.internal.pageSize.getHeight() - 60) {
    doc.addPage();
    currentY = margin;
  } else {
    currentY += 2;
  }

  // --- 13. ENTREGA DEL EQUIPO ---
  doc.setFillColor(200, 220, 240);
  doc.rect(margin, currentY, contentWidth, 5, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('13. ENTREGA DEL EQUIPO', pageWidth / 2, currentY + 3.5, { align: 'center' });

  autoTable(doc, {
    startY: currentY + 5,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'grid',
    pageBreak: 'avoid',
    styles: { fontSize: 8, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.2 },
    body: [
      [
        { content: '', styles: { minCellHeight: 20, cellWidth: contentWidth / 2 } },
        { content: '', styles: { minCellHeight: 20, cellWidth: contentWidth / 2 } }
      ],
      [
        { content: `CARGO: ${report.deliveredByRole || 'INGENIERO BIOMÉDICO'}`, styles: { fillColor: [240, 240, 240], fontStyle: 'bold' } },
        { content: `CARGO: ${report.receivedByRole || 'COORDINADORA DE TERAPIA RESPIRATORIA'}`, styles: { fillColor: [240, 240, 240], fontStyle: 'bold' } }
      ],
      [
        { content: `QUIEN ENTREGA: ${report.deliveredBy || ''}`, styles: { halign: 'center', fontStyle: 'bold' } },
        { content: `QUIEN RECIBE: ${report.receivedBy || ''}`, styles: { halign: 'center', fontStyle: 'bold' } }
      ]
    ],
    didDrawCell: (data) => {
      if (data.row.index === 0) {
        if (data.column.index === 0 && report.deliveredBySignature) {
          doc.addImage(report.deliveredBySignature, 'PNG', data.cell.x + 5, data.cell.y + 2, 80, 16);
        }
        if (data.column.index === 1 && report.receivedBySignature) {
          doc.addImage(report.receivedBySignature, 'PNG', data.cell.x + 5, data.cell.y + 2, 80, 16);
        }
      }
    }
  });

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text('COPIA CONTROLADA', pageWidth / 2, doc.internal.pageSize.getHeight() - 5, { align: 'center' });

  if (returnBase64) {
    return doc.output('datauristring');
  } else {
    doc.save(`Reporte_${report.reportNumber || report.id}.pdf`);
  }
};

export const generateCompliancePDF = (submission: ComplianceSubmission, returnBase64?: boolean) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;
  const contentWidth = pageWidth - (margin * 2);
  
  const scope = submission.technologyScope || 'biomedical';
  let reportTitle = 'REPORTE DE CHEQUEO DE OBLIGATORIEDAD Y HABILITACIÓN (RES. 3100)';
  let macroproceso = 'Macroproceso: Calidad y Mejora Continua';
  let proceso = 'Proceso: Gestión de Tecnología Biomédica';
  let responsable = 'Responsable: Líder de Calidad / Biomédico';
  let codigo = submission.formCode || 'Código: CAL-FOR-088-V1';
  let referencia = submission.standardReference || 'Referencia: Res 3100 de 2019 (Dotación) / Dec 4725 de 2005';

  if (scope === 'computing') {
    reportTitle = 'REPORTE DE CHEQUEO DE OBLIGATORIEDAD TIC Y SISTEMAS (RES. 3100)';
    macroproceso = 'Macroproceso: Gestión Estratégica y Soporte Tecnológico';
    proceso = 'Proceso: Gestión de Tecnologías de la Información y TIC';
    responsable = 'Responsable: Líder de Sistemas / Coordinador TIC';
    codigo = submission.formCode || 'Código: TIC-FOR-015-V1';
    referencia = submission.standardReference || 'Referencia: Res 3100 de 2019 (HC y Registros) / Ley 1581 / Ley 1273';
  } else if (scope === 'infrastructure') {
    reportTitle = 'REPORTE DE CHEQUEO DE OBLIGATORIEDAD INFRAESTRUCTURA (RES. 3100)';
    macroproceso = 'Macroproceso: Gestión de Infraestructura y Soporte';
    proceso = 'Proceso: Gestión de Infraestructura y Mantenimiento Hospitalario';
    responsable = 'Responsable: Líder de Mantenimiento / Infraestructura';
    codigo = submission.formCode || 'Código: INF-FOR-022-V1';
    referencia = submission.standardReference || 'Referencia: Res 3100 de 2019 (Infraestructura) / RETIE / NTC 4410';
  }

  // --- LOGO AND TITLE (Standalone header to avoid rowspan issues) ---
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  
  try {
    doc.addImage('/logo.png', 'PNG', margin, margin, 30, 25);
  } catch (e) {
    doc.text('UCI HONDA', margin + 15, margin + 15, { align: 'center' });
  }

  // --- HEADER TABLE (Simplified) ---
  autoTable(doc, {
    startY: margin,
    margin: { left: margin + 35, right: margin },
    tableWidth: contentWidth - 35,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1 },
    body: [
      [
        { content: 'MEDICINA INTENSIVA DEL TOLIMA S.A. - UCI HONDA', colSpan: 3, styles: { halign: 'center', fontStyle: 'bold', fontSize: 9 } }
      ],
      [
        { content: reportTitle, colSpan: 3, styles: { halign: 'center', fontStyle: 'bold', fontSize: 8 } }
      ],
      [
        { content: macroproceso, styles: { cellWidth: (contentWidth - 35) / 3 } },
        { content: proceso, colSpan: 2 }
      ],
      [
        { content: responsable },
        { content: 'Fecha emisión: 2024-04-17' },
        { content: codigo }
      ],
      [
        { content: 'Frecuencia: Trimestral' },
        { content: referencia, colSpan: 2 }
      ],
      [
        { content: 'Página 1 de 1' },
        { content: `Puntaje de Cumplimiento: ${submission.score}%`, colSpan: 2, styles: { fontStyle: 'bold', fontSize: 8, textColor: submission.score >= 90 ? [0, 100, 0] : [200, 0, 0] } }
      ]
    ]
  });

  let currentY = (doc as any).lastAutoTable.finalY + 5;
  if (currentY < margin + 28) currentY = margin + 28; // Ensure we are below the logo

  // --- GENERAL INFO ---
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1 },
    body: [
      [
        { content: 'SERVICIO EVALUADO', styles: { fillColor: [240, 240, 240], fontStyle: 'bold', cellWidth: 35 } },
        { content: submission.serviceName || 'N/A', styles: { cellWidth: (contentWidth / 2) - 35 } },
        { content: 'FECHA EVALUACIÓN', styles: { fillColor: [240, 240, 240], fontStyle: 'bold', cellWidth: 35 } },
        { content: format(new Date(submission.date), 'dd/MM/yyyy'), styles: { cellWidth: (contentWidth / 2) - 35 } }
      ],
      [
        { content: 'EVALUADOR', styles: { fillColor: [240, 240, 240], fontStyle: 'bold' } },
        { content: submission.technicianName || 'N/A' },
        { content: 'PRÓXIMA REVISIÓN', styles: { fillColor: [240, 240, 240], fontStyle: 'bold' } },
        { content: format(new Date(submission.nextReviewDate), 'dd/MM/yyyy'), styles: { fontStyle: 'bold', textColor: [0, 0, 255] } }
      ]
    ]
  });

  currentY = (doc as any).lastAutoTable.finalY + 5;

  // --- CHECKLIST ITEMS ---
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, currentY, contentWidth, 6, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('VERIFICACIÓN DE ESTÁNDARES Y OBLIGATORIEDAD', pageWidth / 2, currentY + 4, { align: 'center' });
  doc.setTextColor(0, 0, 0);

  const tableBody = submission.responses.map(r => [
    r.itemName,
    r.category,
    r.status === 'compliant' ? 'C' : r.status === 'non_compliant' ? 'NC' : 'N/A',
    r.observations || ''
  ]);

  autoTable(doc, {
    startY: currentY + 6,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'grid',
    head: [['ÍTEM DE VERIFICACIÓN', 'CATEGORÍA / NORMA', 'ESTADO', 'OBSERVACIONES']],
    body: tableBody,
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
    styles: { fontSize: 7, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.1 },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.35 },
      1: { cellWidth: contentWidth * 0.2, halign: 'center' },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 'auto' } // Let observations fill the remaining space of contentWidth
    },
    didDrawCell: (data) => {
      // Color state cells
      if (data.column.index === 2 && data.cell.section === 'body') {
        if (data.cell.text[0] === 'C') data.cell.styles.textColor = [0, 150, 0];
        if (data.cell.text[0] === 'NC') data.cell.styles.textColor = [200, 0, 0];
      }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY + 5;

  // --- FINAL OBSERVATIONS ---
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2 },
    body: [
      [{ content: 'OBSERVACIONES GENERALES Y PLAN DE ACCIÓN', styles: { fillColor: [240, 240, 240], fontStyle: 'bold' } }],
      [{ content: submission.observations || 'Sin observaciones adicionales.', styles: { minCellHeight: 15 } }]
    ]
  });

  currentY = (doc as any).lastAutoTable.finalY + 15;

  // --- SIGNATURES ---
  doc.line(margin + 20, currentY, margin + 80, currentY);
  doc.line(pageWidth - margin - 80, currentY, pageWidth - margin - 20, currentY);
  
  doc.setFontSize(8);
  doc.text('EVALUADOR RESPONSABLE', margin + 50, currentY + 4, { align: 'center' });
  doc.text(submission.technicianName || '', margin + 50, currentY + 8, { align: 'center' });
  
  doc.text('COORDINACIÓN DE SERVICIO', pageWidth - margin - 50, currentY + 4, { align: 'center' });
  doc.text('Firma y Sello', pageWidth - margin - 50, currentY + 8, { align: 'center' });

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text('Generado automáticamente por BioMed CRM - Reporte de Cumplimiento Trimestral', pageWidth / 2, doc.internal.pageSize.getHeight() - 5, { align: 'center' });

  if (returnBase64) {
    return doc.output('datauristring');
  } else {
    doc.save(`Chequeo_${submission.serviceName}_${format(new Date(submission.date), 'yyyy-MM-dd')}.pdf`);
  }
};

export const generateGOServicePDF = (data: any, returnBase64?: boolean) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 10;
  const contentWidth = pageWidth - (margin * 2);
  
  // Header with custom layout - Professional and clear
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(38);
  doc.text('GO', margin + 5, margin + 18);
  doc.setLineWidth(0.7);
  doc.line(margin + 28, margin + 5, margin + 28, margin + 23);
  
  doc.setFontSize(20);
  doc.text('SERVITECNICO SAS', margin + 33, margin + 11);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text('RUT. 79.147.475-4 | CHIA, CUNDINAMARCA', margin + 33, margin + 16);
  doc.text('TELÉFONO CEL.: 300 311 0571', margin + 33, margin + 21);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('VENTA - REPARACION - MANTENIMIENTO - CALIBRACION', pageWidth - margin, margin + 10, { align: 'right' });
  doc.text('EQUIPOS BIOMEDICOS E INDUSTRIALES', pageWidth - margin, margin + 16, { align: 'right' });

  // TABLE: INFORMACION CLIENTE
  autoTable(doc, {
    startY: margin + 28,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1 },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], halign: 'center', fontStyle: 'bold', fontSize: 8.5 },
    head: [['INFORMACION CLIENTE']],
    body: [
      [
        {
          content: `NOMBRE CLIENTE: ${data.clienteNombre}\nDIRECCIÓN: ${data.clienteDireccion}\nCIUDAD: ${data.clienteCiudad}\nENCARGADO: ${data.clienteEncargado}`,
          styles: { cellWidth: contentWidth / 2 }
        },
        {
          content: `CARGO: ${data.clienteCargo}\nFECHA SOLICITUD: ${data.fechaSolicitud}\nTELÉFONO: ${data.clienteTelefono}`,
          styles: { cellWidth: contentWidth / 2 }
        }
      ]
    ]
  });

  // TABLE: INFORMACION EQUIPO
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 3,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1 },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], halign: 'center', fontStyle: 'bold', fontSize: 8.5 },
    head: [['INFORMACION EQUIPO']],
    body: [
      [
        {
          content: `EQUIPO: ${data.equipoNombre}\nMARCA: ${data.equipoMarca}\nMODELO: ${data.equipoModelo}`,
          styles: { cellWidth: contentWidth / 2 }
        },
        {
          content: `SERIAL: ${data.equipoSerial}\nHORAS FUNC.: ${data.equipoHoras || 'N/A'}\nUBICACIÓN: ${data.equipoUbicacion}`,
          styles: { cellWidth: contentWidth / 2 }
        }
      ]
    ]
  });

  // TIPO DE SERVICIO
  const svc = data.tipoServicio;
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 3,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.5, lineColor: [0, 0, 0], lineWidth: 0.1 },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], halign: 'center', fontStyle: 'bold', fontSize: 8.5 },
    head: [['TIPO DE SERVICIO']],
    body: [
      [
        { content: `${svc.predictivo ? '[X]' : '[ ]'} Manto. Predictivo       ${svc.preventivo ? '[X]' : '[ ]'} Manto. Preventivo       ${svc.corrective ? '[X]' : '[ ]'} Manto. Correctivo       ${svc.reparacion ? '[X]' : '[ ]'} Daño Reporte`, styles: { halign: 'center' } }
      ],
      [
        { content: `FECHA SERVICIO: ${data.fechaServicio}`, styles: { halign: 'right', fontStyle: 'bold' } }
      ]
    ]
  });

  // ACTIVIDADES REALIZADAS
  const act = data.actividades;
  const activitiesBody = [
    [`[${act.limpieza ? 'X' : ' '}] Limpieza`, `[${act.revisionParteElectrica ? 'X' : ' '}] Revisión Parte Eléctrica`],
    [`[${act.pruebaInicio ? 'X' : ' '}] Prueba de Inicio`, `[${act.revisionFuentes ? 'X' : ' '}] Revisión fuentes eléctricas`],
    [`[${act.revisionEstructural ? 'X' : ' '}] Revisión Estructural`, `[${act.medicionVoltaje ? 'X' : ' '}] Medición de Voltaje`],
    [`[${act.revisionFugas ? 'X' : ' '}] Revisión de Fugas`, `[${act.lubricacion ? 'X' : ' '}] Lubricación`],
    [`[${act.revisionHidraulica ? 'X' : ' '}] Revisión Hidráulica`, `[${act.calibracion ? 'X' : ' '}] Calibración`],
    [`[${act.revisionMecanica ? 'X' : ' '}] Revisión Mecánica`, `[${act.testFuncionamiento ? 'X' : ' '}] Test de funcionamiento`],
  ];

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 3,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.1 },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], halign: 'center', fontStyle: 'bold', fontSize: 8.5 },
    head: [['ACTIVIDADES REALIZADAS']],
    body: activitiesBody
  });

  // PROCESO REALIZADO Y OBSERVACIONES
  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 3,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.5, lineColor: [0, 0, 0], lineWidth: 0.1 },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], halign: 'center', fontStyle: 'bold', fontSize: 8.5 },
    head: [['PROCESO REALIZADO Y OBSERVACIONES']],
    body: [
      [{ content: data.observaciones || 'Se realiza mantenimiento preventivo según protocolo del fabricante, verificando estado físico, limpieza interna y externa, ajustes mecánicos y pruebas de funcionamiento.', styles: { minCellHeight: 35 } }]
    ]
  });

  // CONCLUSIONES
  const con = data.conclusiones;
  const conclusionsBody = [
    ['El servicio concluye satisfactoriamente', con.satisfactorio ? 'SI [X] NO [ ]' : 'SI [ ] NO [X]'],
    ['El equipo se entrega dentro de los parámetros requeridos', con.dentroParametros ? 'SI [X] NO [ ]' : 'SI [ ] NO [X]'],
    ['El equipo queda fuera de servicio', con.fueraServicio ? 'SI [X] NO [ ]' : 'SI [ ] NO [X]'],
    ['El equipo requiere ser retirado para evaluación en laboratorio', con.retiroLaboratorio ? 'SI [X] NO [ ]' : 'SI [ ] NO [X]'],
    ['El equipo requiere cotización de repuestos', con.cotizacionRepuestos ? 'SI [X] NO [ ]' : 'SI [ ] NO [X]'],
  ];

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 3,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.2, lineColor: [0, 0, 0], lineWidth: 0.1 },
    columnStyles: { 1: { halign: 'center', fontStyle: 'bold', cellWidth: 35 } },
    body: conclusionsBody
  });

  // FOOTER / SIGNATURES
  const footerY = (doc as any).lastAutoTable.finalY + 5;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('ENTREGA DE SERVICIO', pageWidth / 2, footerY, { align: 'center' });
  
  const boxWidth = contentWidth / 3;
  const boxHeight = 28; // Reduced height to fit
  
  doc.rect(margin, footerY + 2, boxWidth, boxHeight);
  doc.rect(margin + boxWidth, footerY + 2, boxWidth, boxHeight);
  doc.rect(margin + (2 * boxWidth), footerY + 2, boxWidth, boxHeight);

  doc.setFontSize(7.5);
  doc.text('Servicio prestado por técnico:', margin + 2, footerY + 6);
  doc.text('FECHA FINALIZACIÓN:', margin + boxWidth + 2, footerY + 6);
  
  doc.setFontSize(10);
  doc.text(data.fechaFinalizacion || '', margin + boxWidth + (boxWidth / 2), footerY + 20, { align: 'center' });
  
  doc.setFontSize(7.5);
  doc.text('Recibido conforme:', margin + (2 * boxWidth) + 2, footerY + 6);

  // Signatures - centered and scaled
  if (data.tecnicoFirma) {
    doc.addImage(data.tecnicoFirma, 'PNG', margin + 2, footerY + 7, boxWidth - 4, boxHeight - 8);
  }
  
  if (data.recibidoFirma) {
    doc.addImage(data.recibidoFirma, 'PNG', margin + (2 * boxWidth) + 2, footerY + 7, boxWidth - 4, boxHeight - 8);
  }

  // Names under signatures
  doc.setFontSize(7.5);
  doc.text(`Nombre: ${data.tecnicoNombre || 'GO SERVITECNICO SAS'}`, margin + 2, footerY + boxHeight + 6);
  doc.text(`Nombre: ${data.recibidoNombre || ''}`, margin + (2 * boxWidth) + 2, footerY + boxHeight + 6);
  doc.text(`Cargo: ${data.recibidoCargo || ''}`, margin + (2 * boxWidth) + 2, footerY + boxHeight + 10);

  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text('CHIA: CARRERA 1C No. 13 - 10 | CEL.: 300 311 0571', pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
  // Removed GOS-TEC-001 text as requested

  if (returnBase64) {
    return doc.output('datauristring');
  } else {
    doc.save(`GOS_Reporte_${data.equipoSerial}_${data.fechaServicio}.pdf`);
  }
};
