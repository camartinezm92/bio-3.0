import * as React from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  query, 
  orderBy, 
  deleteDoc, 
  doc, 
  updateDoc,
  where,
  getDocs
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { MinorDevice, MinorDeviceReport, Service } from '@/types';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import SignatureCanvas from 'react-signature-canvas';
import { generateEquipmentCVPDF } from '@/lib/pdfGenerator';
import { 
  Wrench, 
  Plus, 
  Search, 
  Loader2, 
  Trash2, 
  Edit2, 
  Eye, 
  Calendar, 
  Building, 
  Clipboard, 
  Layers, 
  Package, 
  Activity,
  AlertCircle,
  FileText,
  Clock,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Sliders,
  Sparkles,
  Eraser,
  PenTool,
  Download,
  ShieldCheck,
  Cpu,
  Building2,
  Copy,
  MoreVertical
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function MinorDevices() {
  const { user } = useAuth();
  const isAdmin = user?.role?.toUpperCase() === 'ADMIN';

  // State Lists
  const [devices, setDevices] = React.useState<MinorDevice[]>([]);
  const [services, setServices] = React.useState<Service[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [reports, setReports] = React.useState<MinorDeviceReport[]>([]);
  const [loadingReports, setLoadingReports] = React.useState(false);

  // Filter States
  const [activeTab, setActiveTab] = React.useState<'dispositivo_menor' | 'instrumental'>('dispositivo_menor');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedServiceId, setSelectedServiceId] = React.useState('all');
  const [selectedStatus, setSelectedStatus] = React.useState('all');

  // Modals / Selection
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [editingDevice, setEditingDevice] = React.useState<MinorDevice | null>(null);
  const [deviceToDelete, setDeviceToDelete] = React.useState<MinorDevice | null>(null);
  const [selectedDeviceDetails, setSelectedDeviceDetails] = React.useState<MinorDevice | null>(null);
  
  // Report Registration Modals
  const [showAddReportModal, setShowAddReportModal] = React.useState(false);
  const [selectedDeviceForReport, setSelectedDeviceForReport] = React.useState<MinorDevice | null>(null);

  // Form Tab State
  const [formTab, setFormTab] = React.useState<'basico' | 'regulatorio' | 'tecnico' | 'proveedor' | 'mantenimiento'>('basico');

  // New/Edit Form Values
  const [formData, setFormData] = React.useState<Partial<MinorDevice>>({
    name: '',
    type: 'dispositivo_menor',
    brand: '',
    model: '',
    serial: '',
    assetNumber: '',
    quantity: 1,
    serviceId: '',
    location: '',
    status: 'active',
    acquisitionDate: '',
    warrantyExpiration: '',
    
    registrationInvima: '',
    registrationExpiration: '',
    riskClass: 'I',
    biomedicalType: 'support',
    biomedicalClassification: 'Otro',

    physiologicalPrinciple: '',
    equipmentType: 'Móvil',
    predominantTechnology: 'Mecánico',
    dimensions: '',
    powerSupply: '',
    technicalCharacteristics: {
      voltage: '',
      amperage: '',
      temperature: '',
      power: '',
      frequency: '',
      humidity: '',
      capacity: '',
      speedRpm: '',
      pressure: '',
      lifespan: '',
      weight: '',
      other: ''
    },
    manufacturerRecommendations: '',
    accessories: [],

    providerName: '',
    providerCity: '',
    manufacturerInfo: {
      name: '',
      address: '',
      country: '',
      email: ''
    },

    maintenanceFrequency: 6,
    lastMaintenance: '',
    nextMaintenance: '',
    calibrationFrequency: 12,
    lastCalibration: '',
    nextCalibration: '',
    observations: ''
  });

  // Report Form Values
  const [reportFormData, setReportFormData] = React.useState<Partial<MinorDeviceReport>>({
    type: 'preventive',
    origin: 'internal',
    date: new Date().toISOString().split('T')[0],
    technicianName: '',
    providerName: '',
    certificateNumber: '',
    description: '',
    technicalDiagnosis: '',
    observations: '',
    attachmentUrl: ''
  });

  const [savingDevice, setSavingDevice] = React.useState(false);
  const [savingReport, setSavingReport] = React.useState(false);

  // Inventory State Variables
  const [showInventoryModal, setShowInventoryModal] = React.useState(false);
  const [inventoryActiveTab, setInventoryActiveTab] = React.useState<'perform' | 'history'>('perform');
  const [physicalCounts, setPhysicalCounts] = React.useState<Record<string, number>>({});
  const [inventoryObservations, setInventoryObservations] = React.useState('');
  const [inventoryDate, setInventoryDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [performedByName, setPerformedByName] = React.useState('');
  const [approvedByName, setApprovedByName] = React.useState('Coordinador de Servicio / Calidad');
  const [updateSystemStock, setUpdateSystemStock] = React.useState(true);
  const [savingInventory, setSavingInventory] = React.useState(false);
  const [pastInventories, setPastInventories] = React.useState<any[]>([]);
  const [loadingPastInventories, setLoadingPastInventories] = React.useState(false);
  const [selectedPastInventory, setSelectedPastInventory] = React.useState<any | null>(null);
  const [inventoryToDelete, setInventoryToDelete] = React.useState<any | null>(null);

  const inventoryPerformedSigRef = React.useRef<SignatureCanvas>(null);
  const inventoryApprovedSigRef = React.useRef<SignatureCanvas>(null);

  const getSignatureData = (ref: React.RefObject<SignatureCanvas>) => {
    if (!ref.current || ref.current.isEmpty()) return '';
    try {
      return ref.current.getTrimmedCanvas().toDataURL('image/png');
    } catch (e) {
      console.warn('getTrimmedCanvas failed, falling back to raw canvas', e);
      return ref.current.getCanvas().toDataURL('image/png');
    }
  };

  const fetchPastInventories = async () => {
    setLoadingPastInventories(true);
    try {
      const q = query(
        collection(db, 'minor_devices_inventories'),
        orderBy('date', 'desc')
      );
      const snap = await getDocs(q);
      const list: any[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setPastInventories(list);
    } catch (err) {
      console.error("Error fetching past inventories:", err);
      handleFirestoreError(err, OperationType.GET, 'minor_devices_inventories');
    } finally {
      setLoadingPastInventories(false);
    }
  };

  React.useEffect(() => {
    if (showInventoryModal) {
      fetchPastInventories();
    }
  }, [showInventoryModal]);

  const handleOpenInventoryModal = () => {
    const instrumentalItems = devices.filter(d => d.type !== 'dispositivo_menor');
    const initialCounts: Record<string, number> = {};
    instrumentalItems.forEach(item => {
      initialCounts[item.id] = item.quantity;
    });
    setPhysicalCounts(initialCounts);
    setInventoryObservations('');
    setInventoryDate(new Date().toISOString().split('T')[0]);
    setPerformedByName(user?.displayName || user?.email || 'Usuario');
    setApprovedByName('Coordinador de Servicio / Calidad');
    setUpdateSystemStock(true);
    setInventoryActiveTab('perform');
    setShowInventoryModal(true);

    setTimeout(() => {
      if (inventoryPerformedSigRef.current) inventoryPerformedSigRef.current.clear();
      if (inventoryApprovedSigRef.current) inventoryApprovedSigRef.current.clear();
    }, 150);
  };

  const handleSaveInventory = async () => {
    setSavingInventory(true);
    try {
      const instrumentalItems = devices.filter(d => d.type !== 'dispositivo_menor');
      
      const inventoryItems = instrumentalItems.map(item => {
        const physicalQty = physicalCounts[item.id] !== undefined ? Number(physicalCounts[item.id]) : 0;
        const systemQty = item.quantity || 0;
        return {
          id: item.id,
          name: item.name,
          type: item.type,
          serviceName: item.serviceName || 'Sin asignar',
          location: item.location || '',
          systemQuantity: systemQty,
          physicalQuantity: physicalQty,
          difference: physicalQty - systemQty
        };
      });

      const newInventory = {
        date: inventoryDate,
        performedBy: user?.uid || 'Unknown',
        performedByName: performedByName || user?.displayName || user?.email || 'Usuario',
        performedBySignature: getSignatureData(inventoryPerformedSigRef),
        approvedByName: approvedByName || 'Coordinador de Servicio / Calidad',
        approvedBySignature: getSignatureData(inventoryApprovedSigRef),
        observations: inventoryObservations,
        items: inventoryItems,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'minor_devices_inventories'), newInventory);

      if (updateSystemStock) {
        for (const item of instrumentalItems) {
          const physicalQty = physicalCounts[item.id] !== undefined ? Number(physicalCounts[item.id]) : 0;
          if (physicalQty !== item.quantity) {
            const docRef = doc(db, 'minor_devices', item.id);
            await updateDoc(docRef, { quantity: physicalQty });
          }
        }
      }

      await fetchPastInventories();
      setInventoryActiveTab('history');
    } catch (err) {
      console.error("Error saving inventory: ", err);
      handleFirestoreError(err, OperationType.WRITE, 'minor_devices_inventories');
    } finally {
      setSavingInventory(false);
    }
  };

  const handleDeleteInventory = async () => {
    if (!inventoryToDelete) return;
    try {
      await deleteDoc(doc(db, 'minor_devices_inventories', inventoryToDelete.id));
      setPastInventories(prev => prev.filter(inv => inv.id !== inventoryToDelete.id));
      setInventoryToDelete(null);
    } catch (err) {
      console.error("Error deleting past inventory: ", err);
      handleFirestoreError(err, OperationType.WRITE, 'minor_devices_inventories');
    }
  };

  const generateInventoryPDF = (inventory: any) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 10;
    const contentWidth = pageWidth - (margin * 2);

    const c = (val: any) => val ? val : 'N/A';

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
          { content: 'FORMATO CONTROL DE INVENTARIO DE INSTRUMENTAL Y TEXTILES', colSpan: 3, styles: { halign: 'center', fontStyle: 'bold', fontSize: 8 } }
        ],
        [
          { content: 'Macroproceso: Gestión de tecnología', styles: { fontStyle: 'bold' } },
          { content: 'Proceso: Gestión de Tecnología', colSpan: 2, styles: { fontStyle: 'bold' } }
        ],
        [
          { content: 'Responsable: Líder de proceso', styles: { fontStyle: 'bold' } },
          { content: `Fecha de emisión: 2024-01-15`, styles: { fontStyle: 'bold' } },
          { content: 'Código: GTE-FOR-032', styles: { fontStyle: 'bold' } }
        ],
        [
          { content: 'Revisó: Comité de Calidad', styles: { fontStyle: 'bold' } },
          { content: 'Fecha última actualización: 2024-01-15', styles: { fontStyle: 'bold' } },
          { content: 'Versión: 0.1', styles: { fontStyle: 'bold' } }
        ],
        [
          { content: 'Aprobó: Gerente de la institución', styles: { fontStyle: 'bold' } },
          { content: 'Archivo: Archivo de Gestión de la Tecnología', styles: { fontStyle: 'bold' } },
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

    let currentY = (doc as any).lastAutoTable.finalY + 3;

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0,0,0] },
      columnStyles: {
        0: { cellWidth: 40, fillColor: [240, 240, 240], fontStyle: 'bold' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 40, fillColor: [240, 240, 240], fontStyle: 'bold' },
        3: { cellWidth: 'auto' }
      },
      body: [
        [
          'FECHA INVENTARIO', inventory.date,
          'RESPONSABLE', inventory.performedByName
        ],
        [
          'OBSERVACIONES', { content: c(inventory.observations), colSpan: 3 }
        ]
      ]
    });

    currentY = (doc as any).lastAutoTable.finalY + 3;

    const tableHeaders = [['Nº', 'ÍTEM', 'CATEGORÍA', 'SERVICIO / UBICACIÓN', 'CANT. SISTEMA', 'CANT. FÍSICO', 'DIFERENCIA']];
    const tableBody = (inventory.items || []).map((item: any, idx: number) => [
      idx + 1,
      item.name,
      getCategoryLabel(item.type),
      `${item.serviceName}${item.location ? ' - ' + item.location : ''}`,
      item.systemQuantity,
      item.physicalQuantity,
      {
        content: item.difference > 0 ? `+${item.difference}` : item.difference.toString(),
        styles: {
          textColor: item.difference < 0 ? [200, 0, 0] : item.difference > 0 ? [200, 150, 0] : [0, 150, 0],
          fontStyle: item.difference !== 0 ? 'bold' : 'normal'
        }
      }
    ]);

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      tableWidth: contentWidth,
      theme: 'grid',
      head: tableHeaders,
      body: tableBody,
      headStyles: { fillColor: [220, 225, 230], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', fontSize: 7.5 },
      styles: { fontSize: 7, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.1 },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 35 },
        3: { cellWidth: 40 },
        4: { cellWidth: 20, halign: 'center' },
        5: { cellWidth: 20, halign: 'center' },
        6: { cellWidth: 20, halign: 'center' }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 20;

    if (currentY > doc.internal.pageSize.getHeight() - 45) {
      doc.addPage();
      currentY = margin + 20;
    }

    if (inventory.performedBySignature) {
      try {
        doc.addImage(inventory.performedBySignature, 'PNG', margin + 25, currentY - 16, 40, 15);
      } catch (e) {
        console.error("Error drawing performedBySignature in PDF: ", e);
      }
    }
    if (inventory.approvedBySignature) {
      try {
        doc.addImage(inventory.approvedBySignature, 'PNG', pageWidth - margin - 65, currentY - 16, 40, 15);
      } catch (e) {
        console.error("Error drawing approvedBySignature in PDF: ", e);
      }
    }

    doc.line(margin + 15, currentY, margin + 75, currentY);
    doc.line(pageWidth - margin - 75, currentY, pageWidth - margin - 15, currentY);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('RESPONSABLE DEL INVENTARIO', margin + 45, currentY + 4, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text(inventory.performedByName, margin + 45, currentY + 8, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.text('REVISADO Y APROBADO POR', pageWidth - margin - 45, currentY + 4, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text(inventory.approvedByName || 'Coordinador de Servicio / Calidad', pageWidth - margin - 45, currentY + 8, { align: 'center' });

    doc.save(`Inventario_Instrumental_${inventory.date}.pdf`);
  };

  // Fetch Services & Devices on Mount
  React.useEffect(() => {
    // 1. Fetch Services
    const unsubServices = onSnapshot(query(collection(db, 'services'), orderBy('name', 'asc')), (snap) => {
      const servicesList: Service[] = [];
      snap.forEach((doc) => {
        servicesList.push({ id: doc.id, ...doc.data() } as Service);
      });
      setServices(servicesList);
    }, (error) => {
      console.warn("Services snapshot error:", error);
      handleFirestoreError(error, OperationType.GET, 'services');
    });

    // 2. Fetch Minor Devices
    const unsubDevices = onSnapshot(query(collection(db, 'minor_devices'), orderBy('name', 'asc')), (snap) => {
      const devicesList: MinorDevice[] = [];
      snap.forEach((docSnap) => {
        devicesList.push({ id: docSnap.id, ...docSnap.data() } as MinorDevice);
      });
      setDevices(devicesList);
      setLoading(false);
    }, (error) => {
      console.warn("Minor devices snapshot error:", error);
      handleFirestoreError(error, OperationType.GET, 'minor_devices');
    });

    return () => {
      unsubServices();
      unsubDevices();
    };
  }, []);

  // Fetch reports when a specific device is selected
  const fetchReportsForDevice = async (deviceId: string) => {
    setLoadingReports(true);
    try {
      const q = query(
        collection(db, `minor_devices/${deviceId}/reports`),
        orderBy('date', 'desc')
      );
      const snap = await getDocs(q);
      const reportsList: MinorDeviceReport[] = [];
      snap.forEach((doc) => {
        reportsList.push({ id: doc.id, ...doc.data() } as MinorDeviceReport);
      });
      setReports(reportsList);
    } catch (err) {
      console.error("Error fetching minor device reports: ", err);
      handleFirestoreError(err, OperationType.GET, `minor_devices/${deviceId}/reports`);
    } finally {
      setLoadingReports(false);
    }
  };

  React.useEffect(() => {
    if (selectedDeviceDetails) {
      fetchReportsForDevice(selectedDeviceDetails.id);
    }
  }, [selectedDeviceDetails]);

  // Handle Tab Switch
  const handleTabChange = (tab: 'dispositivo_menor' | 'instrumental') => {
    setActiveTab(tab);
    setSearchTerm('');
  };

  // Helper to open Add Modal
  const openAddModal = () => {
    setEditingDevice(null);
    setFormTab('basico');
    setFormData({
      name: '',
      type: activeTab === 'dispositivo_menor' ? 'dispositivo_menor' : 'instrumental',
      brand: '',
      model: '',
      serial: '',
      assetNumber: '',
      quantity: activeTab === 'dispositivo_menor' ? 1 : 10,
      serviceId: services[0]?.id || '',
      location: '',
      status: 'active',
      acquisitionDate: '',
      warrantyExpiration: '',
      
      registrationInvima: '',
      registrationExpiration: '',
      riskClass: 'I',
      biomedicalType: 'support',
      biomedicalClassification: 'Otro',

      physiologicalPrinciple: '',
      equipmentType: 'Móvil',
      predominantTechnology: 'Mecánico',
      dimensions: '',
      powerSupply: '',
      technicalCharacteristics: {
        voltage: '',
        amperage: '',
        temperature: '',
        power: '',
        frequency: '',
        humidity: '',
        capacity: '',
        speedRpm: '',
        pressure: '',
        lifespan: '',
        weight: '',
        other: ''
      },
      manufacturerRecommendations: '',
      accessories: [],

      providerName: '',
      providerCity: '',
      manufacturerInfo: {
        name: '',
        address: '',
        country: '',
        email: ''
      },

      maintenanceFrequency: 6,
      lastMaintenance: '',
      nextMaintenance: '',
      calibrationFrequency: 12,
      lastCalibration: '',
      nextCalibration: '',
      observations: ''
    });
    setShowAddModal(true);
  };

  // Helper to open Edit Modal
  const openEditModal = (device: MinorDevice, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingDevice(device);
    setFormTab('basico');
    setFormData({
      ...device,
      technicalCharacteristics: {
        voltage: '',
        amperage: '',
        temperature: '',
        power: '',
        frequency: '',
        humidity: '',
        capacity: '',
        speedRpm: '',
        pressure: '',
        lifespan: '',
        weight: '',
        other: '',
        ...(device.technicalCharacteristics || {})
      },
      manufacturerInfo: {
        name: '',
        address: '',
        country: '',
        email: '',
        ...(device.manufacturerInfo || {})
      },
      accessories: device.accessories || []
    });
    setShowAddModal(true);
  };

  // Helper to open Duplicate Modal (pre-fills form data from selected device, resetting serial and asset number)
  const openDuplicateModal = (device: MinorDevice, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingDevice(null);
    setFormTab('basico');
    setFormData({
      ...device,
      serial: '',
      assetNumber: '',
      technicalCharacteristics: {
        voltage: '',
        amperage: '',
        temperature: '',
        power: '',
        frequency: '',
        humidity: '',
        capacity: '',
        speedRpm: '',
        pressure: '',
        lifespan: '',
        weight: '',
        other: '',
        ...(device.technicalCharacteristics || {})
      },
      manufacturerInfo: {
        name: '',
        address: '',
        country: '',
        email: '',
        ...(device.manufacturerInfo || {})
      },
      accessories: device.accessories ? device.accessories.map(acc => ({ ...acc })) : []
    });
    setShowAddModal(true);
  };

  // Accessory list helpers
  const handleAddAccessory = () => {
    setFormData(prev => ({
      ...prev,
      accessories: [
        ...(prev.accessories || []),
        { description: '', brand: '', model: '', serial: '', reference: '', quantity: 1 }
      ]
    }));
  };

  const handleRemoveAccessory = (index: number) => {
    setFormData(prev => ({
      ...prev,
      accessories: (prev.accessories || []).filter((_, i) => i !== index)
    }));
  };

  const handleUpdateAccessory = (index: number, field: string, value: any) => {
    setFormData(prev => {
      const updated = [...(prev.accessories || [])];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, accessories: updated };
    });
  };

  // Generate and Download Hoja de Vida PDF (Standard Format GTE-FOR-023)
  const handleDownloadDeviceCV = async (device: MinorDevice, deviceReports?: MinorDeviceReport[], e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    let reportsToUse = deviceReports;
    if (!reportsToUse) {
      try {
        const reportsSnap = await getDocs(
          query(collection(db, `minor_devices/${device.id}/reports`), orderBy('date', 'desc'))
        );
        reportsToUse = reportsSnap.docs.map(d => ({ ...d.data(), id: d.id })) as MinorDeviceReport[];
      } catch (err) {
        console.error("Error fetching reports for CV PDF: ", err);
        reportsToUse = [];
      }
    }

    const mappedEquipment: any = {
      id: device.id,
      name: device.name,
      brand: device.brand || 'N/A',
      model: device.model || 'N/A',
      serial: device.serial || 'N/A',
      assetNumber: device.assetNumber || 'N/A',
      serviceId: device.serviceId,
      serviceName: device.serviceName || 'N/A',
      location: device.location || 'N/A',
      status: device.status || 'active',
      riskClass: device.riskClass || 'I',
      biomedicalType: device.biomedicalType || 'support',
      biomedicalClassification: device.biomedicalClassification || 'Otro',
      registrationInvima: device.registrationInvima || 'NO REQUIERE / REGISTRO GENERAL',
      registrationExpiration: device.registrationExpiration || 'N/A',
      acquisitionDate: device.acquisitionDate || 'N/A',
      warrantyExpiration: device.warrantyExpiration || 'N/A',
      lastMaintenance: device.lastMaintenance || '',
      nextMaintenance: device.nextMaintenance || '',
      maintenanceFrequency: device.maintenanceFrequency || 0,
      lastCalibration: device.lastCalibration || '',
      nextCalibration: device.nextCalibration || '',
      calibrationFrequency: device.calibrationFrequency || 0,
      physiologicalPrinciple: device.physiologicalPrinciple || 'No especificado / Instrumental Quirúrgico',
      equipmentType: device.equipmentType || 'Móvil',
      predominantTechnology: device.predominantTechnology || 'Mecánico',
      dimensions: device.dimensions || 'N/A',
      powerSupply: device.powerSupply || 'N/A',
      technicalCharacteristics: device.technicalCharacteristics || {},
      manufacturerRecommendations: device.manufacturerRecommendations || 'N/A',
      accessories: device.accessories || [],
      providerName: device.providerName || 'N/A',
      providerCity: device.providerCity || 'N/A',
      manufacturerInfo: device.manufacturerInfo || { name: 'N/A', address: 'N/A', country: 'N/A', email: 'N/A' },
      observations: device.observations || '',
    };

    const mappedReports: any[] = (reportsToUse || []).map(r => ({
      id: r.id,
      equipmentId: r.deviceId,
      equipmentName: r.deviceName,
      equipmentSerial: device.serial || '',
      equipmentAsset: device.assetNumber || '',
      serviceId: device.serviceId,
      serviceName: device.serviceName || '',
      date: r.date,
      type: r.type,
      origin: r.origin,
      status: 'completed',
      description: r.description,
      technicalDiagnosis: r.technicalDiagnosis || '',
      observations: r.observations || '',
      technicianName: r.technicianName || r.providerName || '',
      attachmentUrl: r.attachmentUrl,
    }));

    generateEquipmentCVPDF(mappedEquipment, mappedReports, []);
  };

  // Helper to open delete confirmation
  const openDeleteModal = (device: MinorDevice, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeviceToDelete(device);
  };

  // Helper to open report modal
  const openReportModal = (device: MinorDevice, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedDeviceForReport(device);
    setReportFormData({
      type: 'preventive',
      origin: 'internal',
      date: new Date().toISOString().split('T')[0],
      technicianName: '',
      providerName: '',
      certificateNumber: '',
      description: '',
      technicalDiagnosis: '',
      observations: '',
      attachmentUrl: ''
    });
    setShowAddReportModal(true);
  };

  // Helper to remove undefined fields recursively before sending to Firestore
  const cleanObjectForFirestore = (obj: Record<string, any>): Record<string, any> => {
    const clean: Record<string, any> = {};
    Object.keys(obj).forEach(key => {
      const val = obj[key];
      if (val !== undefined && val !== null) {
        if (typeof val === 'object' && !Array.isArray(val)) {
          const nested = cleanObjectForFirestore(val);
          if (Object.keys(nested).length > 0) {
            clean[key] = nested;
          }
        } else {
          clean[key] = val;
        }
      }
    });
    return clean;
  };

  // Save or Update Minor Device
  const handleSaveDevice = async () => {
    if (!formData.name?.trim() || !formData.serviceId) return;

    setSavingDevice(true);
    const serviceObj = services.find(s => s.id === formData.serviceId);
    
    // Construct base fields
    const rawDevice: Record<string, any> = {
      ...formData,
      serviceName: serviceObj ? serviceObj.name : 'Sin asignar',
      quantity: Number(formData.quantity) || 1,
      maintenanceFrequency: formData.maintenanceFrequency ? Number(formData.maintenanceFrequency) : null,
      calibrationFrequency: formData.calibrationFrequency ? Number(formData.calibrationFrequency) : null,
      lastMaintenance: formData.lastMaintenance || '',
      lastCalibration: formData.lastCalibration || '',
      nextMaintenance: '',
      nextCalibration: '',
    };

    // Calculate next maintenance date if last maintenance was provided and frequency exists
    if (rawDevice.lastMaintenance && rawDevice.maintenanceFrequency) {
      const lastDate = new Date(rawDevice.lastMaintenance);
      lastDate.setMonth(lastDate.getMonth() + Number(rawDevice.maintenanceFrequency));
      rawDevice.nextMaintenance = lastDate.toISOString().split('T')[0];
    }

    // Calculate next calibration date if last calibration was provided and frequency exists
    if (rawDevice.lastCalibration && rawDevice.calibrationFrequency) {
      const lastCalDate = new Date(rawDevice.lastCalibration);
      lastCalDate.setMonth(lastCalDate.getMonth() + Number(rawDevice.calibrationFrequency));
      rawDevice.nextCalibration = lastCalDate.toISOString().split('T')[0];
    }

    const resolvedDevice = cleanObjectForFirestore(rawDevice);

    try {
      if (editingDevice) {
        const docRef = doc(db, 'minor_devices', editingDevice.id);
        await updateDoc(docRef, resolvedDevice);
        if (selectedDeviceDetails && selectedDeviceDetails.id === editingDevice.id) {
          setSelectedDeviceDetails({ ...selectedDeviceDetails, ...resolvedDevice } as MinorDevice);
        }
      } else {
        await addDoc(collection(db, 'minor_devices'), {
          ...resolvedDevice,
          createdAt: new Date().toISOString()
        });
      }
      setShowAddModal(false);
    } catch (err) {
      console.error("Error saving minor device: ", err);
    } finally {
      setSavingDevice(false);
    }
  };

  // Delete Minor Device
  const handleDeleteDevice = async () => {
    if (!deviceToDelete) return;
    try {
      await deleteDoc(doc(db, 'minor_devices', deviceToDelete.id));
      if (selectedDeviceDetails && selectedDeviceDetails.id === deviceToDelete.id) {
        setSelectedDeviceDetails(null);
      }
      setDeviceToDelete(null);
    } catch (err) {
      console.error("Error deleting minor device: ", err);
    }
  };

  // Save Maintenance / Calibration Report
  const handleSaveReport = async () => {
    if (!selectedDeviceForReport || !reportFormData.description?.trim()) return;

    setSavingReport(true);
    const rawReport: Record<string, any> = {
      ...reportFormData,
      deviceId: selectedDeviceForReport.id,
      deviceName: selectedDeviceForReport.name,
      createdAt: new Date().toISOString()
    };
    const newReport = cleanObjectForFirestore(rawReport);

    try {
      // 1. Add Report to Subcollection
      await addDoc(collection(db, `minor_devices/${selectedDeviceForReport.id}/reports`), newReport);

      // 2. Update device dates based on this report
      const updatedFields: Record<string, any> = {};

      if (reportFormData.type === 'preventive') {
        if (reportFormData.date) {
          updatedFields.lastMaintenance = reportFormData.date;
        }
        if (selectedDeviceForReport.maintenanceFrequency && reportFormData.date) {
          const nextDate = new Date(reportFormData.date);
          nextDate.setMonth(nextDate.getMonth() + selectedDeviceForReport.maintenanceFrequency);
          updatedFields.nextMaintenance = nextDate.toISOString().split('T')[0];
        }
      } else if (reportFormData.type === 'calibration') {
        if (reportFormData.date) {
          updatedFields.lastCalibration = reportFormData.date;
        }
        if (selectedDeviceForReport.calibrationFrequency && reportFormData.date) {
          const nextDate = new Date(reportFormData.date);
          nextDate.setMonth(nextDate.getMonth() + selectedDeviceForReport.calibrationFrequency);
          updatedFields.nextCalibration = nextDate.toISOString().split('T')[0];
        }
      }

      const cleanUpdatedFields = cleanObjectForFirestore(updatedFields);
      if (Object.keys(cleanUpdatedFields).length > 0) {
        await updateDoc(doc(db, 'minor_devices', selectedDeviceForReport.id), cleanUpdatedFields);
      }

      // Refresh Detail View list if open
      if (selectedDeviceDetails && selectedDeviceDetails.id === selectedDeviceForReport.id) {
        setSelectedDeviceDetails(prev => prev ? ({ ...prev, ...cleanUpdatedFields } as MinorDevice) : null);
        fetchReportsForDevice(selectedDeviceForReport.id);
      }

      setShowAddReportModal(false);
      setSelectedDeviceForReport(null);
    } catch (err) {
      console.error("Error saving report: ", err);
    } finally {
      setSavingReport(false);
    }
  };

  // Filters application
  const filteredDevices = devices.filter((device) => {
    // 1. Filter by Tab
    if (activeTab === 'dispositivo_menor') {
      if (device.type !== 'dispositivo_menor') return false;
    } else {
      // Instrumental, ropa, manta, kit_rotacion
      if (device.type === 'dispositivo_menor') return false;
    }

    // 2. Filter by search term
    const matchesSearch = 
      device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (device.brand || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (device.model || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (device.serial || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (device.assetNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (device.serviceName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (device.location || '').toLowerCase().includes(searchTerm.toLowerCase());

    // 3. Filter by Service
    const matchesService = selectedServiceId === 'all' || device.serviceId === selectedServiceId;

    // 4. Filter by Status
    const matchesStatus = selectedStatus === 'all' || device.status === selectedStatus;

    return matchesSearch && matchesService && matchesStatus;
  });

  // Calculate stats
  const totalTechnology = devices.filter(d => d.type === 'dispositivo_menor').length;
  const totalInstrumentalItems = devices
    .filter(d => d.type !== 'dispositivo_menor')
    .reduce((acc, d) => acc + (d.quantity || 0), 0);

  // Maintenance alarm checks
  const needsMaintenanceSoon = devices.filter(d => {
    if (!d.nextMaintenance || d.status === 'baja') return false;
    const nextDate = new Date(d.nextMaintenance);
    const today = new Date();
    const diffTime = nextDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30; // Within 30 days
  }).length;

  // Calibration alarm checks (mainly for glucometers/thermohygrometers)
  const needsCalibrationSoon = devices.filter(d => {
    if (!d.nextCalibration || d.status === 'baja') return false;
    const nextDate = new Date(d.nextCalibration);
    const today = new Date();
    const diffTime = nextDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30; // Within 30 days
  }).length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-100 rounded-lg">Operativo</Badge>;
      case 'maintenance':
        return <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-100 rounded-lg">Mantenimiento</Badge>;
      case 'out_of_service':
        return <Badge className="bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-100 rounded-lg">Fuera de Servicio</Badge>;
      case 'baja':
        return <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200 rounded-lg">De Baja</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg">{status}</Badge>;
    }
  };

  const getCategoryLabel = (type: string) => {
    switch (type) {
      case 'instrumental': return 'Instrumental Quirúrgico';
      case 'ropa': return 'Ropa de Cirugía';
      case 'manta': return 'Mantas de Esterilización';
      case 'kit_rotacion': return 'Kit de Rotación Rápida';
      case 'dispositivo_menor': return 'Dispositivo Menor / Tec.';
      default: return type;
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Upper Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 uppercase">
            Dispositivos e Instrumental
          </h1>
          <p className="text-slate-500 font-bold mt-1 text-sm md:text-base max-w-3xl">
            Gestión simplificada, hojas de vida y control de mantenimiento de tecnologías menores, instrumental quirúrgico, textiles y kits de rotación.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button 
            onClick={handleOpenInventoryModal}
            className="rounded-[1.25rem] h-12 px-6 font-black tracking-wide shadow-lg shadow-emerald-600/10 bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-2"
          >
            <Clipboard className="h-5 w-5" />
            CONTROL DE INVENTARIO
          </Button>
          <Button 
            onClick={openAddModal}
            className="rounded-[1.25rem] h-12 px-6 font-black tracking-wide shadow-lg shadow-primary/20 bg-primary text-white hover:bg-primary/90 flex items-center gap-2"
          >
            <Plus className="h-5 w-5" />
            AGREGAR REGISTRO
          </Button>
        </div>
      </div>

      {/* Bento Grid Stats Card */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Stat 1 */}
        <Card className="border-none shadow-md shadow-slate-100 rounded-[2rem] overflow-hidden bg-white">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-4 bg-sky-50 text-sky-600 rounded-2xl">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Dispositivos Menores</p>
              <h3 className="text-2xl font-black text-slate-800 mt-1">{totalTechnology} <span className="text-xs text-slate-400 font-normal">unidades</span></h3>
            </div>
          </CardContent>
        </Card>

        {/* Stat 2 */}
        <Card className="border-none shadow-md shadow-slate-100 rounded-[2rem] overflow-hidden bg-white">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Instrumental y Textiles</p>
              <h3 className="text-2xl font-black text-slate-800 mt-1">{totalInstrumentalItems} <span className="text-xs text-slate-400 font-normal">piezas</span></h3>
            </div>
          </CardContent>
        </Card>

        {/* Stat 3 */}
        <Card className={cn(
          "border-none shadow-md shadow-slate-100 rounded-[2rem] overflow-hidden bg-white",
          needsMaintenanceSoon > 0 ? "ring-2 ring-amber-400/50" : ""
        )}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className={cn(
              "p-4 rounded-2xl",
              needsMaintenanceSoon > 0 ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-500"
            )}>
              <Wrench className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Mantenimientos Próximos</p>
              <h3 className="text-2xl font-black text-slate-800 mt-1">{needsMaintenanceSoon} <span className="text-xs text-slate-400 font-normal">alertas</span></h3>
            </div>
          </CardContent>
        </Card>

        {/* Stat 4 */}
        <Card className={cn(
          "border-none shadow-md shadow-slate-100 rounded-[2rem] overflow-hidden bg-white",
          needsCalibrationSoon > 0 ? "ring-2 ring-red-400/50" : ""
        )}>
          <CardContent className="p-6 flex items-center gap-4">
            <div className={cn(
              "p-4 rounded-2xl",
              needsCalibrationSoon > 0 ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-500"
            )}>
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-wider">Calibraciones Próximas</p>
              <h3 className="text-2xl font-black text-slate-800 mt-1">{needsCalibrationSoon} <span className="text-xs text-slate-400 font-normal">alertas</span></h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs and Table Controls */}
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 gap-6">
          <button
            onClick={() => handleTabChange('dispositivo_menor')}
            className={cn(
              "pb-4 font-black text-sm uppercase tracking-wider transition-all relative",
              activeTab === 'dispositivo_menor' 
                ? "text-primary border-b-2 border-primary" 
                : "text-slate-400 hover:text-slate-600"
            )}
          >
            <span className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Glucómetros / Termohigrómetros y Equipos Menores
            </span>
          </button>
          <button
            onClick={() => handleTabChange('instrumental')}
            className={cn(
              "pb-4 font-black text-sm uppercase tracking-wider transition-all relative",
              activeTab === 'instrumental' 
                ? "text-primary border-b-2 border-primary" 
                : "text-slate-400 hover:text-slate-600"
            )}
          >
            <span className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Instrumental, Ropa y Kits de Rotación
            </span>
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
            <Input 
              placeholder={
                activeTab === 'dispositivo_menor' 
                  ? "Buscar por nombre, marca, serial, plaqueta..." 
                  : "Buscar instrumental, ropa, mantas o kits..."
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-12 rounded-2xl border-none pl-11 shadow-sm shadow-slate-100 bg-white placeholder-slate-400 font-medium"
            />
          </div>

          <div className="flex gap-3 flex-wrap">
            <select
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value)}
              className="h-12 px-4 rounded-2xl border-none bg-white font-bold text-slate-700 shadow-sm shadow-slate-100 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            >
              <option value="all">Todos los Servicios</option>
              {services.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-12 px-4 rounded-2xl border-none bg-white font-bold text-slate-700 shadow-sm shadow-slate-100 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            >
              <option value="all">Todos los Estados</option>
              <option value="active">Operativo</option>
              <option value="maintenance">Mantenimiento</option>
              <option value="out_of_service">Fuera de Servicio</option>
              <option value="baja">De Baja</option>
            </select>
          </div>
        </div>

        {/* Content Panel */}
        {loading ? (
          <div className="flex justify-center items-center py-24">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
          </div>
        ) : filteredDevices.length === 0 ? (
          <div className="p-16 bg-white rounded-3xl text-center border border-slate-100 flex flex-col items-center justify-center space-y-4">
            <div className="p-4 bg-slate-50 text-slate-400 rounded-full">
              <Package className="h-10 w-10" />
            </div>
            <div>
              <h4 className="text-lg font-black text-slate-800">No se encontraron registros</h4>
              <p className="text-slate-500 font-semibold text-sm mt-1">Intente cambiando los filtros de búsqueda o cree un nuevo registro.</p>
            </div>
            <Button onClick={openAddModal} variant="outline" className="rounded-xl font-bold">
              Agregar primer registro
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredDevices.map((device, idx) => {
              // Calculate next maintenance alarm details
              const today = new Date();
              const hasMaintAlarm = device.nextMaintenance && new Date(device.nextMaintenance).getTime() - today.getTime() <= 30 * 24 * 60 * 60 * 1000;
              const hasCalAlarm = device.nextCalibration && new Date(device.nextCalibration).getTime() - today.getTime() <= 30 * 24 * 60 * 60 * 1000;

              return (
                <Card 
                  key={`${device.id}-${idx}`}
                  onClick={() => setSelectedDeviceDetails(device)}
                  className="overflow-hidden border-none shadow-md shadow-slate-100 rounded-3xl bg-white hover:shadow-lg hover:shadow-slate-200/50 transition-all group cursor-pointer flex flex-col justify-between"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <Badge variant="outline" className="text-[10px] uppercase font-black tracking-widest text-primary border-primary/20 bg-primary/5 rounded-lg">
                          {getCategoryLabel(device.type)}
                        </Badge>
                        <h3 className="text-lg font-black text-slate-900 leading-tight group-hover:text-primary transition-colors">
                          {device.name}
                        </h3>
                      </div>
                      <div className="flex flex-col items-end shrink-0 gap-1.5">
                        {getStatusBadge(device.status)}
                        {device.quantity > 1 && (
                          <Badge className="bg-slate-100 text-slate-700 font-black border-none text-[10px] rounded-lg">
                            Cant: {device.quantity}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-1">
                    {/* Device core stats */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2 text-xs font-bold text-slate-600">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Servicio:</span>
                        <span className="text-slate-800 flex items-center gap-1">
                          <Building className="h-3 w-3 text-slate-400" />
                          {device.serviceName || 'Sin asignar'}
                        </span>
                      </div>
                      {device.location && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Ubicación específica:</span>
                          <span className="text-slate-800">{device.location}</span>
                        </div>
                      )}
                      {device.brand && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Marca / Modelo:</span>
                          <span className="text-slate-800">{device.brand} {device.model}</span>
                        </div>
                      )}
                      {device.serial && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">Serial:</span>
                          <span className="text-slate-800 font-mono text-[10px]">{device.serial}</span>
                        </div>
                      )}
                      {device.assetNumber && (
                        <div className="flex justify-between">
                          <span className="text-slate-400">No. Plaqueta:</span>
                          <span className="text-slate-800 font-mono text-[10px] bg-slate-200 px-1.5 py-0.5 rounded-md">{device.assetNumber}</span>
                        </div>
                      )}
                    </div>

                    {/* Next Maintenance / Calibration dates */}
                    <div className="space-y-1.5 text-xs">
                      {device.nextMaintenance && (
                        <div className={cn(
                          "flex items-center justify-between p-2 rounded-xl border font-bold",
                          hasMaintAlarm 
                            ? "bg-amber-50 text-amber-700 border-amber-100" 
                            : "bg-slate-50/50 text-slate-600 border-transparent"
                        )}>
                          <span className="flex items-center gap-1">
                            <Wrench className="h-3.5 w-3.5" />
                            Mtto Programado:
                          </span>
                          <span>{device.nextMaintenance}</span>
                        </div>
                      )}

                      {device.nextCalibration && (
                        <div className={cn(
                          "flex items-center justify-between p-2 rounded-xl border font-bold",
                          hasCalAlarm 
                            ? "bg-red-50 text-red-700 border-red-100 animate-pulse" 
                            : "bg-slate-50/50 text-slate-600 border-transparent"
                        )}>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            Calibración:
                          </span>
                          <span>{device.nextCalibration}</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom actions row */}
                    <div className="flex items-center gap-1.5 pt-3 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="flex-1 rounded-xl font-bold h-9 border-slate-200 hover:bg-slate-50 text-[11px] text-slate-700 flex items-center justify-center gap-1 px-2.5"
                        onClick={() => setSelectedDeviceDetails(device)}
                      >
                        <Eye className="h-3.5 w-3.5 text-slate-400" />
                        Ficha
                      </Button>

                      <Button 
                        size="sm"
                        variant="outline"
                        className="rounded-xl font-bold h-9 border-emerald-200 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-100 text-[11px] flex items-center justify-center gap-1 px-2.5"
                        onClick={(e) => handleDownloadDeviceCV(device, undefined, e)}
                        title="Descargar Hoja de Vida PDF"
                      >
                        <Download className="h-3.5 w-3.5" />
                        PDF
                      </Button>

                      <Button 
                        size="sm"
                        className="rounded-xl font-bold h-9 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary-foreground border-none text-[11px] flex items-center justify-center gap-1 px-2.5"
                        onClick={() => openReportModal(device)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Reporte
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger 
                          className="h-9 w-9 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-900 shrink-0 inline-flex items-center justify-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
                          onClick={(e) => e.stopPropagation()}
                          title="Opciones del Equipo"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52 rounded-2xl p-2 shadow-xl border-slate-100 bg-white z-50">
                          <DropdownMenuItem 
                            onClick={(e) => openDuplicateModal(device, e)}
                            className="rounded-xl px-3 py-2.5 font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer flex items-center gap-2.5"
                          >
                            <Copy className="h-4 w-4 text-emerald-600" />
                            <span>Duplicar Equipo</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => openEditModal(device, e)}
                            className="rounded-xl px-3 py-2.5 font-bold text-slate-700 hover:bg-sky-50 hover:text-sky-700 cursor-pointer flex items-center gap-2.5"
                          >
                            <Edit2 className="h-4 w-4 text-sky-600" />
                            <span>Editar Hoja de Vida</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="my-1 bg-slate-100" />
                          <DropdownMenuItem 
                            onClick={(e) => openDeleteModal(device, e)}
                            className="rounded-xl px-3 py-2.5 font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 cursor-pointer flex items-center gap-2.5"
                          >
                            <Trash2 className="h-4 w-4 text-rose-600" />
                            <span>Eliminar Registro</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Device Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-4xl rounded-[2.5rem] p-8 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-slate-900 uppercase flex items-center gap-2">
              <Sliders className="h-6 w-6 text-primary" />
              {editingDevice ? 'EDITAR HOJA DE VIDA Y HOJA TÉCNICA' : 'REGISTRAR NUEVA TECNOLOGÍA / INSTRUMENTAL'}
            </DialogTitle>
            <DialogDescription className="font-bold text-slate-500">
              Complete la información técnica, legal y de mantenimiento para consolidar la Hoja de Vida.
            </DialogDescription>
          </DialogHeader>

          {/* Form Navigation Bar */}
          <div className="flex border-b border-slate-200 overflow-x-auto gap-1 pb-1 pt-2 scrollbar-none">
            <button
              type="button"
              onClick={() => setFormTab('basico')}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-2 text-xs font-black rounded-xl transition-all whitespace-nowrap shrink-0",
                formTab === 'basico' ? "bg-primary text-white shadow-md shadow-primary/20" : "text-slate-500 hover:bg-slate-100"
              )}
            >
              <Package className="h-3.5 w-3.5" />
              1. Identificación
            </button>

            <button
              type="button"
              onClick={() => setFormTab('regulatorio')}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-2 text-xs font-black rounded-xl transition-all whitespace-nowrap shrink-0",
                formTab === 'regulatorio' ? "bg-primary text-white shadow-md shadow-primary/20" : "text-slate-500 hover:bg-slate-100"
              )}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              2. INVIMA & Legal
            </button>

            <button
              type="button"
              onClick={() => setFormTab('tecnico')}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-2 text-xs font-black rounded-xl transition-all whitespace-nowrap shrink-0",
                formTab === 'tecnico' ? "bg-primary text-white shadow-md shadow-primary/20" : "text-slate-500 hover:bg-slate-100"
              )}
            >
              <Cpu className="h-3.5 w-3.5" />
              3. Ficha Técnica
            </button>

            <button
              type="button"
              onClick={() => setFormTab('proveedor')}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-2 text-xs font-black rounded-xl transition-all whitespace-nowrap shrink-0",
                formTab === 'proveedor' ? "bg-primary text-white shadow-md shadow-primary/20" : "text-slate-500 hover:bg-slate-100"
              )}
            >
              <Building2 className="h-3.5 w-3.5" />
              4. Proveedor & Fabricante
            </button>

            <button
              type="button"
              onClick={() => setFormTab('mantenimiento')}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-2 text-xs font-black rounded-xl transition-all whitespace-nowrap shrink-0",
                formTab === 'mantenimiento' ? "bg-primary text-white shadow-md shadow-primary/20" : "text-slate-500 hover:bg-slate-100"
              )}
            >
              <Wrench className="h-3.5 w-3.5" />
              5. Plan de Mtto & Calibración
            </button>
          </div>

          <div className="py-4">
            {/* TAB 1: IDENTIFICACIÓN */}
            {formTab === 'basico' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="font-black text-slate-700 text-xs uppercase tracking-wider">Tipo de Tecnología / Recurso</Label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      type: e.target.value as any,
                      quantity: e.target.value === 'dispositivo_menor' ? 1 : (prev.quantity || 10)
                    }))}
                    className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="dispositivo_menor">Dispositivo Médico Menor (Glucómetro, Tensiómetro, Fonendoscopio, etc.)</option>
                    <option value="instrumental">Instrumental Quirúrgico (Pinzas, Tijeras, Mangos, Separadores, etc.)</option>
                    <option value="ropa">Ropa de Cirugía (Camisones, Sábanas, Campos, etc.)</option>
                    <option value="manta">Mantas para Esterilizar</option>
                    <option value="kit_rotacion">Kit de Cirugía de Rotación Rápida</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="name" className="font-black text-slate-700 text-xs uppercase tracking-wider">Nombre del Recurso / Pieza <span className="text-rose-500">*</span></Label>
                  <Input 
                    id="name" 
                    value={formData.name || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Ej: Glucómetro Accu-Chek, Pinzas Kocher..."
                    className="h-11 rounded-xl border-slate-200 font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="quantity" className="font-black text-slate-700 text-xs uppercase tracking-wider">Cantidad en Inventario <span className="text-rose-500">*</span></Label>
                  <Input 
                    id="quantity" 
                    type="number"
                    min="1"
                    value={formData.quantity || 1}
                    onChange={(e) => setFormData(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                    className="h-11 rounded-xl border-slate-200 font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="brand" className="font-black text-slate-700 text-xs uppercase tracking-wider">Marca</Label>
                  <Input 
                    id="brand" 
                    value={formData.brand || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                    placeholder="Ej: Welch Allyn, Aesculap..."
                    className="h-11 rounded-xl border-slate-200"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="model" className="font-black text-slate-700 text-xs uppercase tracking-wider">Modelo / Referencia</Label>
                  <Input 
                    id="model" 
                    value={formData.model || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                    placeholder="Ej: DS-44, Standard..."
                    className="h-11 rounded-xl border-slate-200"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="serial" className="font-black text-slate-700 text-xs uppercase tracking-wider">Número de Serial / Serie</Label>
                  <Input 
                    id="serial" 
                    value={formData.serial || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, serial: e.target.value }))}
                    placeholder="Ej: SN-234908234"
                    className="h-11 rounded-xl border-slate-200 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="assetNumber" className="font-black text-slate-700 text-xs uppercase tracking-wider">No. Plaqueta / Activo Fijo</Label>
                  <Input 
                    id="assetNumber" 
                    value={formData.assetNumber || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, assetNumber: e.target.value }))}
                    placeholder="Ej: PL-908234"
                    className="h-11 rounded-xl border-slate-200 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="font-black text-slate-700 text-xs uppercase tracking-wider">Servicio Institucional <span className="text-rose-500">*</span></Label>
                  <select
                    value={formData.serviceId}
                    onChange={(e) => setFormData(prev => ({ ...prev, serviceId: e.target.value }))}
                    className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium focus:outline-none"
                  >
                    <option value="">Seleccione un servicio...</option>
                    {services.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="location" className="font-black text-slate-700 text-xs uppercase tracking-wider">Ubicación Física Específica</Label>
                  <Input 
                    id="location" 
                    value={formData.location || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="Ej: Consultorio 3, Vitrina B, Quirófano 1..."
                    className="h-11 rounded-xl border-slate-200"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="font-black text-slate-700 text-xs uppercase tracking-wider">Estado del Recurso</Label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                    className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium focus:outline-none"
                  >
                    <option value="active">Operativo / Disponible</option>
                    <option value="maintenance">En Mantenimiento / Calibración</option>
                    <option value="out_of_service">Fuera de Servicio / Dañado</option>
                    <option value="baja">Dado de Baja / Desechado</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="acquisitionDate" className="font-black text-slate-700 text-xs uppercase tracking-wider">Fecha de Adquisición / Registro</Label>
                  <Input 
                    id="acquisitionDate" 
                    type="date"
                    value={formData.acquisitionDate || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, acquisitionDate: e.target.value }))}
                    className="h-11 rounded-xl border-slate-200 font-bold"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="warrantyExpiration" className="font-black text-slate-700 text-xs uppercase tracking-wider">Vencimiento de Garantía</Label>
                  <Input 
                    id="warrantyExpiration" 
                    type="date"
                    value={formData.warrantyExpiration || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, warrantyExpiration: e.target.value }))}
                    className="h-11 rounded-xl border-slate-200 font-bold"
                  />
                </div>
              </div>
            )}

            {/* TAB 2: INVIMA & REGULATORIO */}
            {formTab === 'regulatorio' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label htmlFor="registrationInvima" className="font-black text-slate-700 text-xs uppercase tracking-wider">Registro Sanitario INVIMA</Label>
                  <Input 
                    id="registrationInvima" 
                    value={formData.registrationInvima || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, registrationInvima: e.target.value }))}
                    placeholder="Ej: INVIMA 2021DM-0021300 o NO REQUIERE"
                    className="h-11 rounded-xl border-slate-200 font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="registrationExpiration" className="font-black text-slate-700 text-xs uppercase tracking-wider">Vencimiento Registro INVIMA</Label>
                  <Input 
                    id="registrationExpiration" 
                    type="date"
                    value={formData.registrationExpiration || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, registrationExpiration: e.target.value }))}
                    className="h-11 rounded-xl border-slate-200 font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="font-black text-slate-700 text-xs uppercase tracking-wider">Clasificación de Riesgo</Label>
                  <select
                    value={formData.riskClass || 'I'}
                    onChange={(e) => setFormData(prev => ({ ...prev, riskClass: e.target.value as any }))}
                    className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium focus:outline-none"
                  >
                    <option value="I">Clase I - Bajo Riesgo (Instrumental, Tensión, Glucómetro)</option>
                    <option value="IIa">Clase IIa - Riesgo Moderado</option>
                    <option value="IIb">Clase IIb - Riesgo Alto</option>
                    <option value="III">Clase III - Muy Alto Riesgo / Vital</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="font-black text-slate-700 text-xs uppercase tracking-wider">Tipo Biomédico</Label>
                  <select
                    value={formData.biomedicalType || 'support'}
                    onChange={(e) => setFormData(prev => ({ ...prev, biomedicalType: e.target.value as any }))}
                    className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium focus:outline-none"
                  >
                    <option value="support">Soporte Vital / Apoyo Diagnóstico</option>
                    <option value="diagnostic">Diagnóstico</option>
                    <option value="treatment">Tratamiento / Quirúrgico</option>
                    <option value="rehabilitation">Rehabilitación</option>
                  </select>
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label className="font-black text-slate-700 text-xs uppercase tracking-wider">Clasificación Biomédica</Label>
                  <select
                    value={formData.biomedicalClassification || 'Otro'}
                    onChange={(e) => setFormData(prev => ({ ...prev, biomedicalClassification: e.target.value as any }))}
                    className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium focus:outline-none"
                  >
                    <option value="Tratamiento">Tratamiento y Quirúrgico</option>
                    <option value="Diagnóstico">Diagnóstico</option>
                    <option value="Prevención">Prevención y Control</option>
                    <option value="Rehabilitación">Rehabilitación</option>
                    <option value="Análisis de Lab">Análisis de Laboratorio</option>
                    <option value="Otro">Otro / Apoyo Clínico</option>
                  </select>
                </div>
              </div>
            )}

            {/* TAB 3: FICHA TÉCNICA */}
            {formTab === 'tecnico' && (
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="physiologicalPrinciple" className="font-black text-slate-700 text-xs uppercase tracking-wider">Principio Fisiológico de Funcionamiento / Uso Clínico</Label>
                  <textarea 
                    id="physiologicalPrinciple" 
                    rows={3}
                    value={formData.physiologicalPrinciple || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, physiologicalPrinciple: e.target.value }))}
                    placeholder="Describa el principio físico/fisiológico o la función clínica (ej: Medición fotométrica de glucosa en sangre capilar, aprehensión y hemostasia de tejidos en quirófano...)"
                    className="flex w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <Label className="font-black text-slate-700 text-xs uppercase tracking-wider">Tipo de Equipo</Label>
                    <select
                      value={formData.equipmentType || 'Móvil'}
                      onChange={(e) => setFormData(prev => ({ ...prev, equipmentType: e.target.value as any }))}
                      className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium focus:outline-none"
                    >
                      <option value="Móvil">Móvil / Portátil</option>
                      <option value="Fijo">Fijo / De Pared o Mesa</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-black text-slate-700 text-xs uppercase tracking-wider">Tecnología Predominante</Label>
                    <select
                      value={formData.predominantTechnology || 'Mecánico'}
                      onChange={(e) => setFormData(prev => ({ ...prev, predominantTechnology: e.target.value as any }))}
                      className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium focus:outline-none"
                    >
                      <option value="Mecánico">Mecánico (Instrumental, Tijeras, Pinzas)</option>
                      <option value="Electrónico">Electrónico (Glucómetro, Digital)</option>
                      <option value="Eléctrico">Eléctrico (110V/220V)</option>
                      <option value="Hidráulico">Hidráulico</option>
                      <option value="Neumático">Neumático</option>
                      <option value="Otro">Otro / Textil</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="powerSupply" className="font-black text-slate-700 text-xs uppercase tracking-wider">Fuente de Alimentación / Energía</Label>
                    <Input 
                      id="powerSupply" 
                      value={formData.powerSupply || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, powerSupply: e.target.value }))}
                      placeholder="Ej: Batería CR2032, Manual/Mecánico, 110V..."
                      className="h-11 rounded-xl border-slate-200"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="dimensions" className="font-black text-slate-700 text-xs uppercase tracking-wider">Dimensiones / Peso</Label>
                    <Input 
                      id="dimensions" 
                      value={formData.dimensions || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, dimensions: e.target.value }))}
                      placeholder="Ej: 14 cm largo, 250 gramos..."
                      className="h-11 rounded-xl border-slate-200"
                    />
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <h4 className="text-xs font-black uppercase text-slate-600 tracking-wider">Especificaciones Técnicas y Operativas (Opcional)</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Voltaje (V)</Label>
                      <Input 
                        value={formData.technicalCharacteristics?.voltage || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, technicalCharacteristics: { ...prev.technicalCharacteristics, voltage: e.target.value } }))}
                        placeholder="Ej: 3V Batería"
                        className="h-9 rounded-lg border-slate-200 bg-white"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Amperaje (A)</Label>
                      <Input 
                        value={formData.technicalCharacteristics?.amperage || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, technicalCharacteristics: { ...prev.technicalCharacteristics, amperage: e.target.value } }))}
                        placeholder="Ej: N/A"
                        className="h-9 rounded-lg border-slate-200 bg-white"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Potencia (W)</Label>
                      <Input 
                        value={formData.technicalCharacteristics?.power || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, technicalCharacteristics: { ...prev.technicalCharacteristics, power: e.target.value } }))}
                        placeholder="Ej: N/A"
                        className="h-9 rounded-lg border-slate-200 bg-white"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Temperatura (ºC)</Label>
                      <Input 
                        value={formData.technicalCharacteristics?.temperature || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, technicalCharacteristics: { ...prev.technicalCharacteristics, temperature: e.target.value } }))}
                        placeholder="Ej: 10ºC - 40ºC"
                        className="h-9 rounded-lg border-slate-200 bg-white"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Frecuencia (Hz)</Label>
                      <Input 
                        value={formData.technicalCharacteristics?.frequency || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, technicalCharacteristics: { ...prev.technicalCharacteristics, frequency: e.target.value } }))}
                        placeholder="Ej: N/A"
                        className="h-9 rounded-lg border-slate-200 bg-white"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Presión (PSI)</Label>
                      <Input 
                        value={formData.technicalCharacteristics?.pressure || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, technicalCharacteristics: { ...prev.technicalCharacteristics, pressure: e.target.value } }))}
                        placeholder="Ej: N/A"
                        className="h-9 rounded-lg border-slate-200 bg-white"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Vida Útil (Años)</Label>
                      <Input 
                        value={formData.technicalCharacteristics?.lifespan || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, technicalCharacteristics: { ...prev.technicalCharacteristics, lifespan: e.target.value } }))}
                        placeholder="Ej: 5 años"
                        className="h-9 rounded-lg border-slate-200 bg-white"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] font-bold text-slate-500 uppercase">Otros Atributos</Label>
                      <Input 
                        value={formData.technicalCharacteristics?.other || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, technicalCharacteristics: { ...prev.technicalCharacteristics, other: e.target.value } }))}
                        placeholder="Ej: Acero Inoxidable"
                        className="h-9 rounded-lg border-slate-200 bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: PROVEEDOR & FABRICANTE */}
            {formTab === 'proveedor' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="providerName" className="font-black text-slate-700 text-xs uppercase tracking-wider">Nombre del Proveedor / Proveedor Comercial</Label>
                    <Input 
                      id="providerName" 
                      value={formData.providerName || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, providerName: e.target.value }))}
                      placeholder="Ej: Tecnomédica S.A.S."
                      className="h-11 rounded-xl border-slate-200 font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="providerCity" className="font-black text-slate-700 text-xs uppercase tracking-wider">Ciudad del Proveedor</Label>
                    <Input 
                      id="providerCity" 
                      value={formData.providerCity || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, providerCity: e.target.value }))}
                      placeholder="Ej: Bogotá D.C."
                      className="h-11 rounded-xl border-slate-200"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="manufacturerName" className="font-black text-slate-700 text-xs uppercase tracking-wider">Fabricante / Importador</Label>
                    <Input 
                      id="manufacturerName" 
                      value={formData.manufacturerInfo?.name || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, manufacturerInfo: { ...prev.manufacturerInfo, name: e.target.value } }))}
                      placeholder="Ej: Aesculap AG / Roche Diagnostics"
                      className="h-11 rounded-xl border-slate-200 font-bold"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="manufacturerCountry" className="font-black text-slate-700 text-xs uppercase tracking-wider">País de Origen del Fabricante</Label>
                    <Input 
                      id="manufacturerCountry" 
                      value={formData.manufacturerInfo?.country || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, manufacturerInfo: { ...prev.manufacturerInfo, country: e.target.value } }))}
                      placeholder="Ej: Alemania, USA, Japón..."
                      className="h-11 rounded-xl border-slate-200"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="manufacturerRecommendations" className="font-black text-slate-700 text-xs uppercase tracking-wider">Recomendaciones del Fabricante (Esterilización / Lavado / Uso)</Label>
                  <textarea 
                    id="manufacturerRecommendations" 
                    rows={3}
                    value={formData.manufacturerRecommendations || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, manufacturerRecommendations: e.target.value }))}
                    placeholder="Ej: Autoclave a 134ºC por 15 minutos. No usar detergentes enzimáticos corrosivos..."
                    className="flex w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                  />
                </div>

                {/* Accessories / Component list */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      Piezas, Repuestos o Componentes Incluidos ({(formData.accessories || []).length})
                    </h4>
                    <Button 
                      type="button" 
                      size="sm" 
                      variant="outline"
                      className="h-8 rounded-lg text-xs font-bold border-primary/30 text-primary hover:bg-primary/5"
                      onClick={handleAddAccessory}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Agregar Componente
                    </Button>
                  </div>

                  {(formData.accessories || []).length === 0 ? (
                    <p className="text-xs font-bold text-slate-400 italic text-center py-3 bg-white rounded-xl border border-dashed border-slate-200">
                      Sin componentes o accesorios adicionales agregados.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {(formData.accessories || []).map((acc, idx) => (
                        <div key={idx} className="p-3 bg-white rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-6 gap-2 text-xs">
                          <Input 
                            placeholder="Descripción" 
                            value={acc.description} 
                            onChange={(e) => handleUpdateAccessory(idx, 'description', e.target.value)}
                            className="sm:col-span-2 h-8 rounded-lg text-xs"
                          />
                          <Input 
                            placeholder="Marca" 
                            value={acc.brand} 
                            onChange={(e) => handleUpdateAccessory(idx, 'brand', e.target.value)}
                            className="h-8 rounded-lg text-xs"
                          />
                          <Input 
                            placeholder="Modelo/Ref" 
                            value={acc.model} 
                            onChange={(e) => handleUpdateAccessory(idx, 'model', e.target.value)}
                            className="h-8 rounded-lg text-xs"
                          />
                          <Input 
                            type="number" 
                            placeholder="Cant." 
                            value={acc.quantity} 
                            onChange={(e) => handleUpdateAccessory(idx, 'quantity', Number(e.target.value))}
                            className="h-8 rounded-lg text-xs font-bold"
                          />
                          <div className="flex items-center justify-end">
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-rose-500 hover:bg-rose-50 rounded-lg"
                              onClick={() => handleRemoveAccessory(idx)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 5: MANTENIMIENTO & CALIBRACIÓN */}
            {formTab === 'mantenimiento' && (
              <div className="space-y-5">
                {/* Mantenimiento preventivo fields */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                  <h4 className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                    <Wrench className="h-4 w-4 text-primary" />
                    Planificación de Mantenimiento Preventivo
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="maintenanceFrequency" className="font-bold text-slate-600 text-[10px] uppercase">
                        Frecuencia de Mtto (Meses)
                      </Label>
                      <Input 
                        id="maintenanceFrequency" 
                        type="number"
                        min="1"
                        value={formData.maintenanceFrequency || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, maintenanceFrequency: e.target.value ? Number(e.target.value) : undefined }))}
                        placeholder="Ej: 6"
                        className="h-10 rounded-xl border-slate-200 bg-white font-bold"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="lastMaintenance" className="font-bold text-slate-600 text-[10px] uppercase">
                        Último Mantenimiento Registrado
                      </Label>
                      <Input 
                        id="lastMaintenance" 
                        type="date"
                        value={formData.lastMaintenance || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, lastMaintenance: e.target.value }))}
                        className="h-10 rounded-xl border-slate-200 bg-white font-bold"
                      />
                    </div>
                  </div>
                </div>

                {/* Calibración fields */}
                <div className="p-4 bg-red-50/20 rounded-2xl border border-red-100/50 space-y-3">
                  <h4 className="text-xs font-black uppercase text-red-700/80 flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-red-500" />
                    Planificación de Calibración o Patrón
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="calibrationFrequency" className="font-bold text-slate-600 text-[10px] uppercase">
                        Frecuencia de Calibración (Meses)
                      </Label>
                      <Input 
                        id="calibrationFrequency" 
                        type="number"
                        min="1"
                        value={formData.calibrationFrequency || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, calibrationFrequency: e.target.value ? Number(e.target.value) : undefined }))}
                        placeholder="Ej: 12"
                        className="h-10 rounded-xl border-slate-200 bg-white font-bold"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="lastCalibration" className="font-bold text-slate-600 text-[10px] uppercase">
                        Última Calibración Registrada
                      </Label>
                      <Input 
                        id="lastCalibration" 
                        type="date"
                        value={formData.lastCalibration || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, lastCalibration: e.target.value }))}
                        className="h-10 rounded-xl border-slate-200 bg-white font-bold"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="observations" className="font-black text-slate-700 text-xs uppercase tracking-wider">Observaciones Generales de la Hoja de Vida</Label>
                  <textarea 
                    id="observations" 
                    rows={3}
                    value={formData.observations || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, observations: e.target.value }))}
                    placeholder="Ingrese detalles técnicos adicionales u observaciones generales..."
                    className="flex w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-3 mt-4 flex flex-wrap justify-between items-center border-t border-slate-100 pt-4">
            <div className="flex gap-1">
              {formTab !== 'basico' && (
                <Button 
                  type="button" 
                  variant="outline" 
                  className="rounded-xl font-bold h-10 text-xs"
                  onClick={() => {
                    const tabs: Array<'basico' | 'regulatorio' | 'tecnico' | 'proveedor' | 'mantenimiento'> = ['basico', 'regulatorio', 'tecnico', 'proveedor', 'mantenimiento'];
                    const idx = tabs.indexOf(formTab);
                    if (idx > 0) setFormTab(tabs[idx - 1]);
                  }}
                >
                  Anterior
                </Button>
              )}
              {formTab !== 'mantenimiento' && (
                <Button 
                  type="button" 
                  variant="outline" 
                  className="rounded-xl font-bold h-10 text-xs border-primary/30 text-primary hover:bg-primary/5"
                  onClick={() => {
                    const tabs: Array<'basico' | 'regulatorio' | 'tecnico' | 'proveedor' | 'mantenimiento'> = ['basico', 'regulatorio', 'tecnico', 'proveedor', 'mantenimiento'];
                    const idx = tabs.indexOf(formTab);
                    if (idx < tabs.length - 1) setFormTab(tabs[idx + 1]);
                  }}
                >
                  Siguiente Sección
                </Button>
              )}
            </div>

            <div className="flex gap-2 ml-auto">
              <Button variant="ghost" className="rounded-xl font-bold h-11" onClick={() => setShowAddModal(false)}>
                CANCELAR
              </Button>
              <Button 
                className="rounded-xl font-black h-11 px-8 shadow-lg shadow-primary/20 bg-primary hover:bg-primary/95 text-white flex items-center gap-2"
                onClick={handleSaveDevice}
                disabled={savingDevice || !formData.name?.trim() || !formData.serviceId}
              >
                {savingDevice ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {editingDevice ? 'GUARDAR CAMBIOS' : 'CREAR REGISTRO'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!deviceToDelete} onOpenChange={() => setDeviceToDelete(null)}>
        <DialogContent className="max-w-md rounded-3xl p-8">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 uppercase flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-rose-500 shrink-0" />
              ¿Confirmar Eliminación?
            </DialogTitle>
            <DialogDescription className="font-medium text-slate-500 pt-2">
              Esta acción eliminará de forma irreversible el registro de <span className="font-black text-slate-800">{deviceToDelete?.name}</span> de la base de datos de inventario.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-3 mt-6">
            <Button variant="ghost" className="rounded-xl font-bold h-11" onClick={() => setDeviceToDelete(null)}>
              CANCELAR
            </Button>
            <Button 
              variant="destructive" 
              className="rounded-xl font-black h-11 px-6 text-white"
              onClick={handleDeleteDevice}
            >
              ELIMINAR AHORA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Inventory Confirmation Modal */}
      <Dialog open={!!inventoryToDelete} onOpenChange={() => setInventoryToDelete(null)}>
        <DialogContent className="max-w-md rounded-3xl p-8">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 uppercase flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-rose-500 shrink-0" />
              ¿Eliminar Inventario?
            </DialogTitle>
            <DialogDescription className="font-medium text-slate-500 pt-2">
              Esta acción eliminará de forma irreversible el registro de inventario físico del{' '}
              <span className="font-black text-slate-800">
                {inventoryToDelete?.date ? inventoryToDelete.date.split('-').reverse().join('/') : ''}
              </span>{' '}
              realizado por <span className="font-bold text-slate-800">{inventoryToDelete?.performedByName}</span>.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-3 mt-6">
            <Button variant="ghost" className="rounded-xl font-bold h-11" onClick={() => setInventoryToDelete(null)}>
              CANCELAR
            </Button>
            <Button 
              variant="destructive" 
              className="rounded-xl font-black h-11 px-6 text-white"
              onClick={handleDeleteInventory}
            >
              ELIMINAR AHORA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Register Report Modal */}
      <Dialog open={showAddReportModal} onOpenChange={(open) => !open && setShowAddReportModal(false)}>
        <DialogContent className="max-w-2xl rounded-[2.5rem] p-8 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-slate-900 uppercase flex items-center gap-2">
              <Clipboard className="h-6 w-6 text-primary" />
              REGISTRAR REPORTE O CALIBRACIÓN
            </DialogTitle>
            <DialogDescription className="font-bold text-slate-500">
              Registrar intervención técnica en <span className="text-slate-800">{selectedDeviceForReport?.name}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-4">
            <div className="space-y-1.5">
              <Label className="font-black text-slate-700 text-xs uppercase tracking-wider">Tipo de Reporte</Label>
              <select
                value={reportFormData.type}
                onChange={(e) => setReportFormData(prev => ({ ...prev, type: e.target.value as any }))}
                className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium focus:outline-none"
              >
                <option value="preventive">Mantenimiento Preventivo</option>
                <option value="corrective">Mantenimiento Correctivo / Reparación</option>
                <option value="calibration">Calibración / Ajuste con Patrón</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="font-black text-slate-700 text-xs uppercase tracking-wider">Ejecutado Por</Label>
              <select
                value={reportFormData.origin}
                onChange={(e) => setReportFormData(prev => ({ 
                  ...prev, 
                  origin: e.target.value as any,
                  technicianName: e.target.value === 'internal' ? user?.displayName || '' : '',
                  providerName: e.target.value === 'external' ? '' : ''
                }))}
                className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium focus:outline-none"
              >
                <option value="internal">Propio (Ingeniería Biomédica Interna)</option>
                <option value="external">Tercero (Empresa Externa / Certificado)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reportDate" className="font-black text-slate-700 text-xs uppercase tracking-wider">Fecha de Intervención</Label>
              <Input 
                id="reportDate" 
                type="date"
                value={reportFormData.date || ''}
                onChange={(e) => setReportFormData(prev => ({ ...prev, date: e.target.value }))}
                className="h-11 rounded-xl border-slate-200 font-bold"
              />
            </div>

            {reportFormData.origin === 'internal' ? (
              <div className="space-y-1.5">
                <Label htmlFor="technicianName" className="font-black text-slate-700 text-xs uppercase tracking-wider">Ingeniero / Técnico Encargado</Label>
                <Input 
                  id="technicianName" 
                  value={reportFormData.technicianName || ''}
                  onChange={(e) => setReportFormData(prev => ({ ...prev, technicianName: e.target.value }))}
                  placeholder="Ej: Ing. de Soporte"
                  className="h-11 rounded-xl border-slate-200 font-bold"
                />
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="providerName" className="font-black text-slate-700 text-xs uppercase tracking-wider">Empresa / Proveedor Externo</Label>
                  <Input 
                    id="providerName" 
                    value={reportFormData.providerName || ''}
                    onChange={(e) => setReportFormData(prev => ({ ...prev, providerName: e.target.value }))}
                    placeholder="Ej: Tecnomédica S.A.S."
                    className="h-11 rounded-xl border-slate-200 font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="certificateNumber" className="font-black text-slate-700 text-xs uppercase tracking-wider">No. Certificado / Protocolo de Calibración</Label>
                  <Input 
                    id="certificateNumber" 
                    value={reportFormData.certificateNumber || ''}
                    onChange={(e) => setReportFormData(prev => ({ ...prev, certificateNumber: e.target.value }))}
                    placeholder="Ej: CERT-2026-908"
                    className="h-11 rounded-xl border-slate-200 font-mono"
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="reportDescription" className="font-black text-slate-700 text-xs uppercase tracking-wider">Descripción detallada del Trabajo Realizado</Label>
              <textarea 
                id="reportDescription" 
                rows={3}
                value={reportFormData.description || ''}
                onChange={(e) => setReportFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Detalle los trabajos, limpieza, ajuste de parámetros, etc..."
                className="flex w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-medium"
              />
            </div>

            {reportFormData.origin === 'internal' && (
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="technicalDiagnosis" className="font-black text-slate-700 text-xs uppercase tracking-wider">Diagnóstico Técnico de Operabilidad</Label>
                <Input 
                  id="technicalDiagnosis" 
                  value={reportFormData.technicalDiagnosis || ''}
                  onChange={(e) => setReportFormData(prev => ({ ...prev, technicalDiagnosis: e.target.value }))}
                  placeholder="Ej: Equipo calibrado dentro del margen de error del fabricante (Operativo)"
                  className="h-11 rounded-xl border-slate-200"
                />
              </div>
            )}

            {reportFormData.origin === 'external' && (
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="attachmentUrl" className="font-black text-slate-700 text-xs uppercase tracking-wider">Enlace del Certificado / Reporte Adjunto (PDF / Drive)</Label>
                <Input 
                  id="attachmentUrl" 
                  value={reportFormData.attachmentUrl || ''}
                  onChange={(e) => setReportFormData(prev => ({ ...prev, attachmentUrl: e.target.value }))}
                  placeholder="Ej: https://drive.google.com/..."
                  className="h-11 rounded-xl border-slate-200 font-mono"
                />
              </div>
            )}

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="reportObservations" className="font-black text-slate-700 text-xs uppercase tracking-wider">Recomendaciones u Observaciones Adicionales</Label>
              <Input 
                id="reportObservations" 
                value={reportFormData.observations || ''}
                onChange={(e) => setReportFormData(prev => ({ ...prev, observations: e.target.value }))}
                placeholder="Ej: Próximo chequeo con simulador en 6 meses."
                className="h-11 rounded-xl border-slate-200"
              />
            </div>
          </div>

          <div className="p-4 bg-sky-50 rounded-2xl border border-sky-100 flex items-start gap-3 mt-2">
            <AlertCircle className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />
            <div className="text-xs font-bold text-sky-800 leading-relaxed">
              <span className="font-black uppercase block mb-1 text-sky-950">Aviso del Sistema</span>
              Al guardar este reporte, el sistema registrará la fecha y actualizará automáticamente la fecha del próximo mantenimiento programado en base a la frecuencia registrada.
            </div>
          </div>

          <DialogFooter className="gap-3 mt-6">
            <Button variant="ghost" className="rounded-xl font-bold h-11" onClick={() => {
              setShowAddReportModal(false);
              setSelectedDeviceForReport(null);
            }}>
              CANCELAR
            </Button>
            <Button 
              className="rounded-xl font-black h-11 px-8 shadow-lg shadow-primary/20 bg-primary text-white hover:bg-primary/95 flex items-center gap-2"
              onClick={handleSaveReport}
              disabled={savingReport || !reportFormData.description?.trim()}
            >
              {savingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              GUARDAR REPORTE
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detailed Hoja de Vida / Resume Modal */}
      <Dialog open={!!selectedDeviceDetails} onOpenChange={(open) => !open && setSelectedDeviceDetails(null)}>
        <DialogContent className="max-w-3xl rounded-[2.5rem] p-8 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-slate-900 uppercase flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Ficha de Hoja de Vida e Historial Técnico
            </DialogTitle>
            <DialogDescription className="font-bold text-slate-500">
              Visualice los atributos del inventario e historial de reportes.
            </DialogDescription>
          </DialogHeader>

          {selectedDeviceDetails && (
            <div className="space-y-6 py-4">
              {/* Header card with core details */}
              <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                  <Badge variant="outline" className="text-[10px] font-black tracking-widest text-primary border-primary/20 bg-primary/5 rounded-lg mb-2 uppercase">
                    {getCategoryLabel(selectedDeviceDetails.type)}
                  </Badge>
                  <h3 className="text-3xl font-black text-slate-900 leading-none">{selectedDeviceDetails.name}</h3>
                  <div className="flex flex-wrap items-center gap-4 mt-3 text-xs font-bold text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <Building className="h-4 w-4 text-slate-400" />
                      {selectedDeviceDetails.serviceName || 'Sin asignar'}
                    </span>
                    {selectedDeviceDetails.location && (
                      <span className="flex items-center gap-1.5">
                        <MapPinIcon className="h-4 w-4 text-slate-400" />
                        {selectedDeviceDetails.location}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {getStatusBadge(selectedDeviceDetails.status)}
                  {selectedDeviceDetails.quantity > 1 && (
                    <span className="text-xs font-black bg-slate-200 text-slate-700 px-3 py-1 rounded-full">
                      Cantidad total: {selectedDeviceDetails.quantity}
                    </span>
                  )}
                </div>
              </div>

              {/* Specs layout grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Specs Box 1: General & INVIMA */}
                <div className="bg-white p-5 rounded-2xl border border-slate-100 space-y-3">
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    1. Identificación y Registro Sanitario
                  </h4>
                  <div className="space-y-2 text-xs font-bold text-slate-700 divide-y divide-slate-50">
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-400 font-medium">Marca / Modelo:</span>
                      <span>{selectedDeviceDetails.brand || 'N/A'} / {selectedDeviceDetails.model || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-400 font-medium">Serial / Serie:</span>
                      <span className="font-mono">{selectedDeviceDetails.serial || 'Sin serial'}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-400 font-medium">Plaqueta / Activo Fijo:</span>
                      <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">{selectedDeviceDetails.assetNumber || 'Sin plaqueta'}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-400 font-medium">Reg. Sanitario INVIMA:</span>
                      <span className="font-bold text-slate-900">{selectedDeviceDetails.registrationInvima || 'NO REQUIERE / REGISTRO GENERAL'}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-400 font-medium">Vigencia INVIMA:</span>
                      <span>{selectedDeviceDetails.registrationExpiration || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-400 font-medium">Clase de Riesgo / Tipo:</span>
                      <span>Clase {selectedDeviceDetails.riskClass || 'I'} / {selectedDeviceDetails.biomedicalType || 'support'}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-400 font-medium">Fecha de Adquisición:</span>
                      <span>{selectedDeviceDetails.acquisitionDate || 'No registrada'}</span>
                    </div>
                  </div>
                </div>

                {/* Specs Box 2: Plan de Aseguramiento y Mantenimiento */}
                <div className="bg-white p-5 rounded-2xl border border-slate-100 space-y-3">
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
                    <Wrench className="h-4 w-4 text-primary" />
                    2. Plan de Aseguramiento
                  </h4>
                  <div className="space-y-2 text-xs font-bold text-slate-700 divide-y divide-slate-50">
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-400 font-medium">Frecuencia Mantenimiento:</span>
                      <span>{selectedDeviceDetails.maintenanceFrequency ? `Cada ${selectedDeviceDetails.maintenanceFrequency} meses` : 'No programado'}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-400 font-medium">Último Mantenimiento:</span>
                      <span className="text-emerald-700 font-bold">{selectedDeviceDetails.lastMaintenance || 'No registrado'}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-400 font-medium">Próximo Mantenimiento:</span>
                      <span className="text-amber-700 font-bold">{selectedDeviceDetails.nextMaintenance || 'No programado'}</span>
                    </div>

                    <div className="flex justify-between py-1.5 pt-2">
                      <span className="text-slate-400 font-medium">Frecuencia Calibración:</span>
                      <span>{selectedDeviceDetails.calibrationFrequency ? `Cada ${selectedDeviceDetails.calibrationFrequency} meses` : 'No aplica'}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-400 font-medium">Última Calibración:</span>
                      <span className="text-emerald-700 font-bold">{selectedDeviceDetails.lastCalibration || 'No registrada'}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-400 font-medium">Próxima Calibración:</span>
                      <span className="text-rose-700 font-bold">{selectedDeviceDetails.nextCalibration || 'No programada'}</span>
                    </div>
                  </div>
                </div>

                {/* Specs Box 3: Ficha Técnica Operativa */}
                <div className="bg-white p-5 rounded-2xl border border-slate-100 space-y-3 md:col-span-2">
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
                    <Cpu className="h-4 w-4 text-primary" />
                    3. Ficha Técnica Operativa y Características
                  </h4>
                  
                  {selectedDeviceDetails.physiologicalPrinciple && (
                    <div className="p-3 bg-slate-50 rounded-xl text-xs font-bold text-slate-700 leading-relaxed">
                      <span className="text-slate-400 font-medium uppercase text-[10px] block mb-1">Principio Fisiológico / Uso Clínico:</span>
                      {selectedDeviceDetails.physiologicalPrinciple}
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                    <div className="p-2.5 bg-slate-50 rounded-xl">
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Tipo Equipo</span>
                      <span className="font-bold text-slate-800">{selectedDeviceDetails.equipmentType || 'Móvil'}</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl">
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Tecnología</span>
                      <span className="font-bold text-slate-800">{selectedDeviceDetails.predominantTechnology || 'Mecánico'}</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl">
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Alimentación</span>
                      <span className="font-bold text-slate-800">{selectedDeviceDetails.powerSupply || 'Manual/N/A'}</span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl">
                      <span className="text-slate-400 text-[10px] uppercase font-bold block">Dimensiones/Peso</span>
                      <span className="font-bold text-slate-800">{selectedDeviceDetails.dimensions || 'N/A'}</span>
                    </div>
                  </div>

                  {selectedDeviceDetails.technicalCharacteristics && Object.values(selectedDeviceDetails.technicalCharacteristics).some(v => Boolean(v)) && (
                    <div className="p-3 bg-slate-50 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-bold text-slate-700">
                      {selectedDeviceDetails.technicalCharacteristics.voltage && <div><span className="text-slate-400">Voltaje:</span> {selectedDeviceDetails.technicalCharacteristics.voltage}</div>}
                      {selectedDeviceDetails.technicalCharacteristics.amperage && <div><span className="text-slate-400">Amperaje:</span> {selectedDeviceDetails.technicalCharacteristics.amperage}</div>}
                      {selectedDeviceDetails.technicalCharacteristics.power && <div><span className="text-slate-400">Potencia:</span> {selectedDeviceDetails.technicalCharacteristics.power}</div>}
                      {selectedDeviceDetails.technicalCharacteristics.temperature && <div><span className="text-slate-400">Temperatura:</span> {selectedDeviceDetails.technicalCharacteristics.temperature}</div>}
                      {selectedDeviceDetails.technicalCharacteristics.pressure && <div><span className="text-slate-400">Presión:</span> {selectedDeviceDetails.technicalCharacteristics.pressure}</div>}
                      {selectedDeviceDetails.technicalCharacteristics.lifespan && <div><span className="text-slate-400">Vida Útil:</span> {selectedDeviceDetails.technicalCharacteristics.lifespan}</div>}
                      {selectedDeviceDetails.technicalCharacteristics.other && <div className="col-span-2"><span className="text-slate-400">Otros:</span> {selectedDeviceDetails.technicalCharacteristics.other}</div>}
                    </div>
                  )}
                </div>

                {/* Specs Box 4: Proveedor y Fabricante */}
                <div className="bg-white p-5 rounded-2xl border border-slate-100 space-y-3 md:col-span-2">
                  <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-primary" />
                    4. Proveedor, Fabricante y Esterilización
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-bold text-slate-700">
                    <div>
                      <span className="text-slate-400 font-medium">Proveedor Comercial:</span> {selectedDeviceDetails.providerName || 'N/A'} ({selectedDeviceDetails.providerCity || 'N/A'})
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium">Fabricante:</span> {selectedDeviceDetails.manufacturerInfo?.name || 'N/A'} ({selectedDeviceDetails.manufacturerInfo?.country || 'N/A'})
                    </div>
                  </div>

                  {selectedDeviceDetails.manufacturerRecommendations && (
                    <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100/50 text-xs font-bold text-amber-900 leading-relaxed">
                      <span className="text-amber-700 font-black uppercase text-[10px] block mb-0.5">Recomendaciones de Esterilización / Limpieza:</span>
                      {selectedDeviceDetails.manufacturerRecommendations}
                    </div>
                  )}

                  {/* Accessories */}
                  {selectedDeviceDetails.accessories && selectedDeviceDetails.accessories.length > 0 && (
                    <div className="space-y-1.5 pt-2">
                      <span className="text-xs font-black text-slate-600 uppercase">Componentes e Instrumental Incluido:</span>
                      <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                        {selectedDeviceDetails.accessories.map((acc, i) => (
                          <div key={i} className="p-2.5 bg-slate-50 flex justify-between items-center font-bold text-slate-700">
                            <span>{acc.description} {acc.brand ? `(${acc.brand} ${acc.model || ''})` : ''}</span>
                            <Badge className="bg-slate-200 text-slate-700 text-[10px]">Cant: {acc.quantity}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* General observations */}
              {selectedDeviceDetails.observations && (
                <div className="bg-slate-50 p-4 rounded-2xl text-xs font-bold text-slate-600 border border-slate-100">
                  <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest block mb-1">Observaciones de la Hoja de Vida</span>
                  {selectedDeviceDetails.observations}
                </div>
              )}

              {/* Section: Historial de reportes y calibración */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black uppercase text-slate-800 tracking-wider">Historial Técnico e Intervenciones ({reports.length})</h4>
                  <Button 
                    size="sm" 
                    className="rounded-xl bg-primary hover:bg-primary/95 text-white text-xs font-bold"
                    onClick={() => openReportModal(selectedDeviceDetails)}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Registrar Reporte
                  </Button>
                </div>

                <div className="max-h-[300px] overflow-y-auto space-y-3 pr-1">
                  {loadingReports ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 text-primary animate-spin" />
                    </div>
                  ) : reports.length === 0 ? (
                    <p className="text-center py-8 text-xs text-slate-400 font-bold italic bg-slate-50 rounded-2xl border border-slate-100/50">
                      No hay intervenciones técnicas o reportes registrados para este equipo.
                    </p>
                  ) : (
                    reports.map((report, idx) => (
                      <div key={`${report.id}-${idx}`} className="p-4 bg-slate-50 rounded-2xl border border-slate-100/80 hover:bg-slate-50/80 transition-colors space-y-2 text-xs">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <Badge className={cn(
                              "text-[10px] font-black rounded-lg uppercase",
                              report.type === 'preventive' ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-50" :
                              report.type === 'calibration' ? "bg-red-50 text-red-700 hover:bg-red-50" : "bg-sky-50 text-sky-700 hover:bg-sky-50"
                            )}>
                              {report.type === 'preventive' ? 'Mantenimiento Preventivo' :
                               report.type === 'calibration' ? 'Calibración / Patrón' : 'Correctivo / Reparación'}
                            </Badge>
                            <Badge className="bg-slate-100 text-slate-600 text-[10px] rounded-lg">
                              {report.origin === 'internal' ? 'Ejecución Propia' : 'Tercero Externo'}
                            </Badge>
                          </div>
                          <span className="font-bold text-slate-500 flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {report.date}
                          </span>
                        </div>

                        <p className="font-bold text-slate-800 leading-relaxed pt-1">
                          <span className="text-slate-400 font-medium">Trabajo Realizado:</span> {report.description}
                        </p>

                        {report.technicalDiagnosis && (
                          <p className="font-bold text-emerald-800 bg-emerald-50/50 p-2 rounded-xl">
                            <span className="text-slate-400 font-medium">Diagnóstico de Operabilidad:</span> {report.technicalDiagnosis}
                          </p>
                        )}

                        <div className="flex items-center justify-between flex-wrap pt-2 border-t border-slate-200/50 text-[10px] text-slate-500 font-bold">
                          <div>
                            {report.origin === 'internal' ? (
                              <span>Técnico: <span className="text-slate-700">{report.technicianName || 'No registrado'}</span></span>
                            ) : (
                              <span>Proveedor: <span className="text-slate-700">{report.providerName || 'No registrado'}</span> ({report.certificateNumber || 'S/N Certificado'})</span>
                            )}
                          </div>
                          
                          {report.attachmentUrl && (
                            <a 
                              href={report.attachmentUrl} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-primary hover:underline flex items-center gap-1.5 bg-primary/5 px-2 py-1 rounded-lg"
                            >
                              Ver Certificado Adjunto
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Actions row */}
              <div className="flex flex-wrap justify-between items-center pt-4 border-t border-slate-100 gap-3">
                <Button 
                  variant="outline" 
                  className="rounded-2xl font-bold h-11 border-emerald-200 bg-emerald-50/50 text-emerald-800 hover:bg-emerald-100"
                  onClick={() => handleDownloadDeviceCV(selectedDeviceDetails, reports)}
                >
                  <Download className="mr-2 h-4 w-4 text-emerald-600" />
                  Descargar Hoja de Vida (PDF)
                </Button>
                
                <div className="flex flex-wrap gap-2 ml-auto">
                  <Button 
                    variant="outline" 
                    className="rounded-2xl font-bold h-11 border-emerald-200 bg-emerald-50/50 text-emerald-800 hover:bg-emerald-100"
                    onClick={() => {
                      const dev = selectedDeviceDetails;
                      setSelectedDeviceDetails(null);
                      openDuplicateModal(dev);
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4 text-emerald-600" />
                    Duplicar Equipo
                  </Button>

                  <Button 
                    variant="outline" 
                    className="rounded-2xl font-bold h-11 border-slate-200"
                    onClick={() => {
                      const dev = selectedDeviceDetails;
                      setSelectedDeviceDetails(null);
                      openEditModal(dev);
                    }}
                  >
                    <Edit2 className="mr-2 h-4 w-4 text-slate-400" />
                    Editar Hoja de Vida
                  </Button>

                  <Button 
                    variant="destructive" 
                    className="rounded-2xl font-bold h-11 text-white bg-rose-600 hover:bg-rose-700"
                    onClick={() => {
                      const dev = selectedDeviceDetails;
                      setSelectedDeviceDetails(null);
                      setDeviceToDelete(dev);
                    }}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Eliminar Equipo
                  </Button>

                  <Button 
                    variant="ghost" 
                    className="rounded-2xl font-bold h-11"
                    onClick={() => setSelectedDeviceDetails(null)}
                  >
                    Cerrar Ficha
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Main Inventory Dialog */}
      <Dialog open={showInventoryModal} onOpenChange={setShowInventoryModal}>
        <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto rounded-[2rem] bg-slate-50 p-6 border-none">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-slate-900 flex items-center gap-2 uppercase tracking-tight">
              <Clipboard className="h-6 w-6 text-emerald-600" />
              Inventarios de Instrumental y Textiles
            </DialogTitle>
            <DialogDescription className="font-semibold text-slate-500">
              Registro y control de inventarios físicos para instrumental quirúrgico, textiles y kits de rotación (Recomendado cada 6 meses).
            </DialogDescription>
          </DialogHeader>

          {/* Tab Switcher inside Modal */}
          <div className="flex border-b border-slate-200 my-4 gap-4">
            <button
              onClick={() => setInventoryActiveTab('perform')}
              className={cn(
                "pb-2 font-black text-xs uppercase tracking-wider transition-all relative",
                inventoryActiveTab === 'perform' 
                  ? "text-emerald-600 border-b-2 border-emerald-600" 
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              Realizar Inventario
            </button>
            <button
              onClick={() => setInventoryActiveTab('history')}
              className={cn(
                "pb-2 font-black text-xs uppercase tracking-wider transition-all relative",
                inventoryActiveTab === 'history' 
                  ? "text-emerald-600 border-b-2 border-emerald-600" 
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              Historial de Inventarios
            </button>
          </div>

          {inventoryActiveTab === 'perform' ? (
            <div className="space-y-6">
              {/* Form Metadata */}
              <div className="grid gap-4 md:grid-cols-3 bg-white p-5 rounded-2xl border border-slate-100">
                <div className="space-y-1.5">
                  <Label className="text-xs font-black text-slate-500 uppercase">Fecha del Inventario</Label>
                  <Input 
                    type="date" 
                    value={inventoryDate} 
                    onChange={(e) => setInventoryDate(e.target.value)}
                    className="h-10 rounded-xl font-bold text-slate-800"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-black text-slate-500 uppercase">Responsable</Label>
                  <Input 
                    type="text" 
                    value={user?.displayName || user?.email || 'Usuario'} 
                    disabled
                    className="h-10 rounded-xl font-bold bg-slate-50 text-slate-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-black text-slate-500 uppercase">Observaciones Generales</Label>
                  <Input 
                    type="text" 
                    placeholder="Ej. Inventario semestral ordinario de instrumental..."
                    value={inventoryObservations} 
                    onChange={(e) => setInventoryObservations(e.target.value)}
                    className="h-10 rounded-xl font-medium"
                  />
                </div>
              </div>

              {/* Action and Settings Bar */}
              <div className="flex flex-wrap justify-between items-center gap-3 bg-slate-100/50 p-3 rounded-2xl border border-slate-200/50">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="updateStock" 
                    checked={updateSystemStock} 
                    onCheckedChange={(checked) => setUpdateSystemStock(!!checked)}
                  />
                  <Label htmlFor="updateStock" className="text-xs font-black text-slate-700 uppercase cursor-pointer selection:bg-transparent">
                    Actualizar automáticamente el stock del sistema con los valores físicos
                  </Label>
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      const instrumentalItems = devices.filter(d => d.type !== 'dispositivo_menor');
                      const copied: Record<string, number> = {};
                      instrumentalItems.forEach(item => {
                        copied[item.id] = item.quantity;
                      });
                      setPhysicalCounts(copied);
                    }}
                    className="h-8 text-xs font-black rounded-lg border-slate-200"
                  >
                    Copiar de Sistema
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      const instrumentalItems = devices.filter(d => d.type !== 'dispositivo_menor');
                      const cleared: Record<string, number> = {};
                      instrumentalItems.forEach(item => {
                        cleared[item.id] = 0;
                      });
                      setPhysicalCounts(cleared);
                    }}
                    className="h-8 text-xs font-black rounded-lg border-slate-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                  >
                    Reiniciar (Ceros)
                  </Button>
                </div>
              </div>

              {/* Scrollable Items List */}
              <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white max-h-[350px] overflow-y-auto shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      <th className="py-3 px-4">Artículos / Detalle</th>
                      <th className="py-3 px-4">Servicio</th>
                      <th className="py-3 px-4 text-center w-28">Cant. Sistema</th>
                      <th className="py-3 px-4 text-center w-32">Cant. Físico</th>
                      <th className="py-3 px-4 text-center w-28">Diferencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                    {devices.filter(d => d.type !== 'dispositivo_menor').length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 font-semibold">
                          No hay instrumental ni textiles registrados en el sistema.
                        </td>
                      </tr>
                    ) : (
                      devices.filter(d => d.type !== 'dispositivo_menor').map((item, idx) => {
                        const physVal = physicalCounts[item.id] !== undefined ? physicalCounts[item.id] : item.quantity;
                        const diff = Number(physVal) - item.quantity;
                        return (
                          <tr key={`${item.id}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3 px-4 space-y-0.5">
                              <span className="text-sm font-black text-slate-800">{item.name}</span>
                              <div className="flex gap-1.5 items-center">
                                <span className="text-[10px] uppercase text-slate-400 font-black">{getCategoryLabel(item.type)}</span>
                                {item.serial && <span className="text-[10px] text-slate-400 font-mono">· S/N: {item.serial}</span>}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-slate-500 font-semibold">
                              {item.serviceName || 'Sin asignar'}
                              {item.location && <span className="block text-[10px] text-slate-400 font-medium">{item.location}</span>}
                            </td>
                            <td className="py-3 px-4 text-center font-black text-slate-800 text-sm">
                              {item.quantity}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <Input 
                                type="number" 
                                min="0"
                                value={physicalCounts[item.id] !== undefined ? physicalCounts[item.id] : item.quantity}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? 0 : Math.max(0, parseInt(e.target.value) || 0);
                                  setPhysicalCounts(prev => ({ ...prev, [item.id]: val }));
                                }}
                                className="w-20 mx-auto h-8 text-center font-black text-sm rounded-lg"
                              />
                            </td>
                            <td className="py-3 px-4 text-center">
                              {diff === 0 ? (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700">OK</span>
                              ) : diff > 0 ? (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-700">+{diff} sobrante</span>
                              ) : (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700">{diff} faltante</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Firmas de Responsables */}
              <div className="space-y-4 pt-4 border-t border-slate-200">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span className="bg-emerald-600 text-white h-5 w-5 rounded-full flex items-center justify-center">
                    <PenTool className="h-3 w-3" />
                  </span>
                  Firmas de los Responsables
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Responsable de Inventario */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-3">
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider text-center border-b pb-1.5">
                      RESPONSABLE DEL INVENTARIO
                    </p>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-slate-500 uppercase">Nombre Completo</Label>
                        <Input 
                          value={performedByName} 
                          onChange={(e) => setPerformedByName(e.target.value)} 
                          placeholder="Nombre de quien realiza el inventario"
                          className="h-9 rounded-xl font-bold text-slate-800"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-slate-500 uppercase">Firma Digital</Label>
                        <div className="border-2 border-slate-100 rounded-xl bg-slate-50/50 overflow-hidden relative group">
                          <SignatureCanvas 
                            ref={inventoryPerformedSigRef}
                            penColor="black"
                            canvasProps={{ className: "w-full h-24 cursor-crosshair" }}
                          />
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="absolute top-2 right-2 rounded-full h-8 w-8 bg-white shadow-sm hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => inventoryPerformedSigRef.current?.clear()}
                            type="button"
                          >
                            <Eraser className="h-4 w-4 text-slate-500" />
                          </Button>
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none">
                            <p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">Dibuje su firma aquí</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Revisado y Aprobado por */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-100 space-y-3">
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-wider text-center border-b pb-1.5">
                      REVISADO Y APROBADO POR
                    </p>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-slate-500 uppercase">Nombre / Cargo</Label>
                        <Input 
                          value={approvedByName} 
                          onChange={(e) => setApprovedByName(e.target.value)} 
                          placeholder="Nombre de quien revisa y aprueba"
                          className="h-9 rounded-xl font-bold text-slate-800"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-slate-500 uppercase">Firma Digital</Label>
                        <div className="border-2 border-slate-100 rounded-xl bg-slate-50/50 overflow-hidden relative group">
                          <SignatureCanvas 
                            ref={inventoryApprovedSigRef}
                            penColor="black"
                            canvasProps={{ className: "w-full h-24 cursor-crosshair" }}
                          />
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="absolute top-2 right-2 rounded-full h-8 w-8 bg-white shadow-sm hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => inventoryApprovedSigRef.current?.clear()}
                            type="button"
                          >
                            <Eraser className="h-4 w-4 text-slate-500" />
                          </Button>
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 pointer-events-none">
                            <p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">Dibuje su firma aquí</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <Button 
                  variant="outline" 
                  onClick={() => setShowInventoryModal(false)}
                  className="rounded-2xl font-black h-11"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSaveInventory}
                  disabled={savingInventory || devices.filter(d => d.type !== 'dispositivo_menor').length === 0}
                  className="rounded-2xl font-black h-11 bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-600/10"
                >
                  {savingInventory && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Guardar Inventario Físico
                </Button>
              </div>
            </div>
          ) : (
            /* History Tab content */
            <div className="space-y-6">
              {loadingPastInventories ? (
                <div className="flex justify-center items-center py-16">
                  <Loader2 className="h-8 w-8 text-emerald-600 animate-spin" />
                </div>
              ) : pastInventories.length === 0 ? (
                <div className="p-12 text-center bg-white border border-slate-100 rounded-3xl flex flex-col items-center">
                  <div className="p-3 bg-slate-50 text-slate-400 rounded-full mb-3">
                    <Clipboard className="h-8 w-8" />
                  </div>
                  <h4 className="text-sm font-black text-slate-700">No hay registros de inventarios</h4>
                  <p className="text-slate-400 text-xs font-semibold mt-1">Los inventarios guardados aparecerán listados aquí.</p>
                </div>
              ) : (
                <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm max-h-[400px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        <th className="py-3 px-4">Fecha</th>
                        <th className="py-3 px-4">Responsable</th>
                        <th className="py-3 px-4">Artículos Registrados</th>
                        <th className="py-3 px-4">Estado / Novedades</th>
                        <th className="py-3 px-4 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                      {pastInventories.map((inv) => {
                        const discCount = (inv.items || []).filter((item: any) => item.difference !== 0).length;
                        return (
                          <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3 px-4 text-sm font-black text-slate-800">
                              {inv.date ? inv.date.split('-').reverse().join('/') : 'Sin fecha'}
                            </td>
                            <td className="py-3 px-4 text-slate-600 font-semibold">
                              {inv.performedByName}
                            </td>
                            <td className="py-3 px-4 text-slate-600 font-semibold">
                              {(inv.items || []).length} items
                            </td>
                            <td className="py-3 px-4">
                              {discCount === 0 ? (
                                <Badge className="bg-emerald-50 text-emerald-700 border-none rounded-lg font-black text-[10px]">Sin discrepancias</Badge>
                              ) : (
                                <Badge className="bg-amber-50 text-amber-700 border-none rounded-lg font-black text-[10px]">{discCount} novedades</Badge>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center flex justify-center gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setSelectedPastInventory(inv)}
                                className="h-8 w-8 p-0 rounded-lg text-slate-400 hover:text-slate-800"
                                title="Ver detalles"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => generateInventoryPDF(inv)}
                                className="h-8 w-8 p-0 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                title="Descargar PDF"
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => setInventoryToDelete(inv)}
                                className="h-8 w-8 p-0 rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                title="Eliminar Inventario"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button 
                  variant="outline" 
                  onClick={() => setShowInventoryModal(false)}
                  className="rounded-2xl font-black h-11"
                >
                  Cerrar Ventana
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Selected Past Inventory Details Dialog */}
      <Dialog open={!!selectedPastInventory} onOpenChange={(open) => !open && setSelectedPastInventory(null)}>
        <DialogContent className="max-w-4xl w-[90vw] max-h-[85vh] overflow-y-auto rounded-[2rem] bg-slate-50 p-6 border-none">
          {selectedPastInventory && (
            <div className="space-y-6">
              <DialogHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <DialogTitle className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                      <Clipboard className="h-5 w-5 text-emerald-600" />
                      Inventario Histórico - {selectedPastInventory.date ? selectedPastInventory.date.split('-').reverse().join('/') : ''}
                    </DialogTitle>
                    <DialogDescription className="font-semibold text-slate-500">
                      Realizado por: <span className="text-slate-800 font-bold">{selectedPastInventory.performedByName}</span>
                    </DialogDescription>
                  </div>
                  <Button 
                    onClick={() => generateInventoryPDF(selectedPastInventory)}
                    className="rounded-xl h-10 px-4 font-black bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-2 shadow-sm text-xs"
                  >
                    <FileText className="h-4 w-4" />
                    DESCARGAR PDF
                  </Button>
                </div>
              </DialogHeader>

              {selectedPastInventory.observations && (
                <div className="bg-white p-4 rounded-xl border border-slate-100 text-xs font-semibold text-slate-600">
                  <span className="block font-black text-[10px] text-slate-400 uppercase tracking-wider mb-1">Observaciones Generales</span>
                  {selectedPastInventory.observations}
                </div>
              )}

              {/* Items Table View */}
              <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm max-h-[300px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      <th className="py-2.5 px-4">Artículos / Detalle</th>
                      <th className="py-2.5 px-4">Servicio</th>
                      <th className="py-2.5 px-4 text-center w-28">Cant. Sistema</th>
                      <th className="py-2.5 px-4 text-center w-28">Cant. Físico</th>
                      <th className="py-2.5 px-4 text-center w-28">Diferencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                    {(selectedPastInventory.items || []).map((item: any) => {
                      return (
                        <tr key={item.id || item.name} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-2.5 px-4 space-y-0.5">
                            <span className="text-sm font-black text-slate-800">{item.name}</span>
                            <div className="flex gap-1.5 items-center">
                              <span className="text-[10px] uppercase text-slate-400 font-black">{getCategoryLabel(item.type)}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-slate-500 font-semibold">
                            {item.serviceName || 'Sin asignar'}
                          </td>
                          <td className="py-2.5 px-4 text-center font-black text-slate-800">
                            {item.systemQuantity}
                          </td>
                          <td className="py-2.5 px-4 text-center font-black text-slate-800">
                            {item.physicalQuantity}
                          </td>
                          <td className="py-2.5 px-4 text-center">
                            {item.difference === 0 ? (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700">OK</span>
                            ) : item.difference > 0 ? (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-700">+{item.difference} sobrante</span>
                            ) : (
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700">{item.difference} faltante</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Signatures display in Detail Modal */}
              {(selectedPastInventory.performedBySignature || selectedPastInventory.approvedBySignature) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-2xl border border-slate-100">
                  {selectedPastInventory.performedBySignature && (
                    <div className="space-y-1 text-center">
                      <span className="block font-black text-[10px] text-slate-400 uppercase tracking-wider mb-1">Responsable del Inventario</span>
                      <div className="border border-slate-100 rounded-xl p-2 bg-slate-50/50 flex justify-center items-center h-24">
                        <img 
                          src={selectedPastInventory.performedBySignature} 
                          alt="Firma Responsable" 
                          className="max-h-20 max-w-full object-contain" 
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <p className="text-xs font-bold text-slate-700 mt-1">{selectedPastInventory.performedByName}</p>
                    </div>
                  )}
                  {selectedPastInventory.approvedBySignature && (
                    <div className="space-y-1 text-center">
                      <span className="block font-black text-[10px] text-slate-400 uppercase tracking-wider mb-1">Revisado y Aprobado por</span>
                      <div className="border border-slate-100 rounded-xl p-2 bg-slate-50/50 flex justify-center items-center h-24">
                        <img 
                          src={selectedPastInventory.approvedBySignature} 
                          alt="Firma Aprobado" 
                          className="max-h-20 max-w-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <p className="text-xs font-bold text-slate-700 mt-1">{selectedPastInventory.approvedByName || 'Coordinador de Servicio / Calidad'}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button 
                  variant="ghost" 
                  onClick={() => setSelectedPastInventory(null)}
                  className="rounded-2xl font-black h-11"
                >
                  Volver al Listado
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Minimal MapPin icon component as fallback
function MapPinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}
