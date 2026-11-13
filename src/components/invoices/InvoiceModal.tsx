import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Receipt,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  HardDrive,
  Download,
  ExternalLink,
  FolderOpen,
  Building2,
  CheckSquare,
  DollarSign,
  Cpu,
  BookOpen
} from 'lucide-react';
import {
  CatalogItem,
  Equipment,
  Invoice,
  InvoiceItem,
  Provider,
  TechnologyScope
} from '@/types';
import { collection, addDoc, doc, setDoc, getDocs } from 'firebase/firestore';
import { db, auth, cleanFirestoreData } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { useTechnologyScope } from '@/lib/TechnologyScopeContext';
import { generateInvoiceReportPDF } from '@/lib/pdfGenerator';
import {
  COMMON_TECHNOLOGIES,
  EXPENSE_CATEGORIES,
  formatCOP,
  syncInvoiceItemsToCatalog
} from '@/lib/financialUtils';
import { cn } from '@/lib/utils';

interface InvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingInvoice?: Invoice | null;
  providers: Provider[];
  onSaved?: (savedInvoice: Invoice, generatedCompletePdf: boolean) => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  open,
  onOpenChange,
  existingInvoice,
  providers,
  onSaved
}) => {
  const { user } = useAuth();
  const { scope } = useTechnologyScope();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Reference data for technologies, specific equipment, and cost catalog
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [catalogList, setCatalogList] = useState<CatalogItem[]>([]);

  // Form fields
  const [providerId, setProviderId] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [expenseCategory, setExpenseCategory] = useState<string>('Repuestos e Insumos');
  const [notes, setNotes] = useState<string>('');
  const [items, setItems] = useState<InvoiceItem[]>([]);

  // Financial fields
  const [ivaAmountStr, setIvaAmountStr] = useState<string>('0');
  const [manualTotalEnabled, setManualTotalEnabled] = useState<boolean>(false);
  const [manualTotalStr, setManualTotalStr] = useState<string>('');
  const [syncToCatalog, setSyncToCatalog] = useState<boolean>(true);

  // Quick provider creation inline
  const [showNewProvider, setShowNewProvider] = useState(false);
  const [newProvName, setNewProvName] = useState('');
  const [newProvEmail, setNewProvEmail] = useState('');
  const [newProvPhone, setNewProvPhone] = useState('');
  const [creatingProvider, setCreatingProvider] = useState(false);

  // File attachment
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileBase64, setSelectedFileBase64] = useState<string>('');

  // New item inputs
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>('__none__');
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState<string>('1');
  const [newItemUnitPrice, setNewItemUnitPrice] = useState<string>('');
  const [newItemTech, setNewItemTech] = useState<string>('');
  const [newItemEquipmentId, setNewItemEquipmentId] = useState<string>('__none__');
  const [newItemObs, setNewItemObs] = useState('');

  // Upload partial PDF toggle
  const [savePartialPdfToDrive, setSavePartialPdfToDrive] = useState(true);

  // Load inventory equipment & catalog items when modal opens
  useEffect(() => {
    if (!open) return;
    let active = true;

    const loadRefData = async () => {
      try {
        const [eqSnap, catSnap] = await Promise.all([
          getDocs(collection(db, 'equipment')),
          getDocs(collection(db, 'catalog_items'))
        ]);
        if (!active) return;
        const eqs = eqSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Equipment)
          .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es'));
        const cats = catSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as CatalogItem)
          .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es'));
        setEquipmentList(eqs);
        setCatalogList(cats);
      } catch (err) {
        console.warn('Error loading equipment/catalog ref data in InvoiceModal:', err);
      }
    };
    loadRefData();

    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setErrorMsg('');
    setStatusMessage('');
    setSelectedFile(null);
    setSelectedFileBase64('');
    setShowNewProvider(false);
    setSelectedCatalogId('__none__');
    setNewItemName('');
    setNewItemQty('1');
    setNewItemUnitPrice('');
    setNewItemTech('');
    setNewItemEquipmentId('__none__');
    setNewItemObs('');

    if (existingInvoice) {
      setProviderId(existingInvoice.providerId || '');
      setName(existingInvoice.name || '');
      setDate(existingInvoice.date || new Date().toISOString().slice(0, 10));
      setExpenseCategory(existingInvoice.expenseCategory || 'Repuestos e Insumos');
      setNotes(existingInvoice.notes || '');
      const existingItems = Array.isArray(existingInvoice.items) ? existingInvoice.items : [];
      setItems(existingItems);

      const iva = Number(existingInvoice.ivaAmount) || 0;
      setIvaAmountStr(String(iva));

      const itemsSum = existingItems.reduce(
        (sum, it) => sum + (Number(it.totalPrice) || (Number(it.unitPrice) || 0) * (Number(it.quantity) || 1)),
        0
      );
      const savedTotal = Number(existingInvoice.totalAmount);
      if (!isNaN(savedTotal) && savedTotal > 0 && Math.abs(savedTotal - (itemsSum + iva)) > 1) {
        setManualTotalEnabled(true);
        setManualTotalStr(String(savedTotal));
      } else {
        setManualTotalEnabled(false);
        setManualTotalStr('');
      }
    } else {
      setProviderId('');
      setName('');
      setDate(new Date().toISOString().slice(0, 10));
      setExpenseCategory('Repuestos e Insumos');
      setNotes('');
      setItems([]);
      setIvaAmountStr('0');
      setManualTotalEnabled(false);
      setManualTotalStr('');
    }
  }, [open, existingInvoice]);

  // Unique technology suggestions combining common biomedical/TIC terms + existing inventory equipment names
  const technologySuggestions = useMemo(() => {
    const set = new Set<string>(COMMON_TECHNOLOGIES);
    for (const eq of equipmentList) {
      if (eq.name?.trim()) set.add(eq.name.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [equipmentList]);

  const itemsSubtotal = useMemo(() => {
    return items.reduce((sum, it) => {
      const qty = Number(it.quantity) || 1;
      const unitP = Number(it.unitPrice) || 0;
      const lineTotal = typeof it.totalPrice === 'number' ? it.totalPrice : qty * unitP;
      return sum + (isNaN(lineTotal) ? 0 : lineTotal);
    }, 0);
  }, [items]);

  const parsedIva = Math.max(0, Number(ivaAmountStr) || 0);
  const computedTotal = manualTotalEnabled
    ? Math.max(0, Number(manualTotalStr) || 0)
    : itemsSubtotal + parsedIva;

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') resolve(reader.result);
        else reject(new Error('No se pudo leer el archivo.'));
      };
      reader.onerror = () => reject(new Error('Error leyendo archivo.'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg('');

    if (file.size > 20 * 1024 * 1024) {
      setErrorMsg('El archivo supera el límite permitido de 20 MB.');
      return;
    }

    const allowed = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp'
    ];
    if (!allowed.includes(file.type) && !file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMsg('Solo se permiten archivos en formato PDF o Imagen (JPG, PNG, WEBP).');
      return;
    }

    setSelectedFile(file);
    try {
      const b64 = await fileToBase64(file);
      setSelectedFileBase64(b64);
    } catch (err) {
      console.error(err);
    }
    if (e.target) e.target.value = '';
  };

  const handleCreateQuickProvider = async () => {
    if (!newProvName.trim()) {
      setErrorMsg('Ingrese el nombre del nuevo proveedor.');
      return;
    }
    setCreatingProvider(true);
    setErrorMsg('');
    try {
      const docRef = await addDoc(collection(db, 'providers'), {
        name: newProvName.trim(),
        contactName: newProvName.trim(),
        email: newProvEmail.trim() || 'contacto@proveedor.com',
        phone: newProvPhone.trim() || 'N/A',
        whatsapp: newProvPhone.trim() || '',
        specialties: ['Suministros / Facturación'],
        technologyScope: scope === 'all' ? 'biomedical' : scope,
        createdAt: new Date().toISOString()
      });
      setProviderId(docRef.id);
      setShowNewProvider(false);
      setNewProvName('');
      setNewProvEmail('');
      setNewProvPhone('');
    } catch (err: any) {
      console.error('Error creating quick provider:', err);
      setErrorMsg(err.message || 'No se pudo crear el proveedor.');
    } finally {
      setCreatingProvider(false);
    }
  };

  const handlePickFromCatalog = (catId: string) => {
    setSelectedCatalogId(catId);
    if (catId === '__none__') return;
    const found = catalogList.find((c) => c.id === catId);
    if (!found) return;
    setNewItemName(found.name);
    setNewItemUnitPrice(String(found.lastUnitPrice || 0));
    setNewItemTech(found.technologyType || '');
  };

  const handlePickSpecificEquipment = (eqId: string) => {
    setNewItemEquipmentId(eqId);
    if (eqId === '__none__') return;
    const eq = equipmentList.find((e) => e.id === eqId);
    if (eq && !newItemTech.trim()) {
      setNewItemTech(eq.name);
    }
  };

  const handleAddItem = () => {
    if (!newItemName.trim()) return;
    const qty = Number(newItemQty);
    const cleanQty = isNaN(qty) || qty <= 0 ? 1 : qty;
    const unitP = Math.max(0, Number(newItemUnitPrice) || 0);
    const eq =
      newItemEquipmentId && newItemEquipmentId !== '__none__'
        ? equipmentList.find((e) => e.id === newItemEquipmentId)
        : undefined;

    const resolvedTech = newItemTech.trim() || eq?.name || 'General / Insumos';

    const newItem: InvoiceItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: newItemName.trim(),
      quantity: cleanQty,
      unitPrice: unitP > 0 ? unitP : 0,
      totalPrice: unitP > 0 ? cleanQty * unitP : 0,
      technologyType: resolvedTech,
      equipmentId: eq?.id,
      equipmentName: eq ? `${eq.name}${eq.serial ? ` (${eq.serial})` : ''}` : undefined,
      catalogItemId: selectedCatalogId !== '__none__' ? selectedCatalogId : undefined,
      completed: false,
      observations: newItemObs.trim() || ''
    };

    setItems((prev) => [...prev, newItem]);
    setSelectedCatalogId('__none__');
    setNewItemName('');
    setNewItemQty('1');
    setNewItemUnitPrice('');
    setNewItemTech('');
    setNewItemEquipmentId('__none__');
    setNewItemObs('');
  };

  const handleToggleItem = (itemId: string, checked: boolean) => {
    const today = new Date().toISOString().slice(0, 10);
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? {
              ...it,
              completed: checked,
              deliveredAt: checked ? it.deliveredAt || today : undefined
            }
          : it
      )
    );
  };

  const handleUpdateItemField = (itemId: string, field: keyof InvoiceItem, value: any) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const updated: InvoiceItem = { ...it, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          const q = Number(field === 'quantity' ? value : updated.quantity) || 1;
          const u = Number(field === 'unitPrice' ? value : updated.unitPrice) || 0;
          updated.totalPrice = q * u;
        }
        return updated;
      })
    );
  };

  const handleUpdateItemEquipment = (itemId: string, eqId: string) => {
    const eq = eqId !== '__none__' ? equipmentList.find((e) => e.id === eqId) : undefined;
    setItems((prev) =>
      prev.map((it) =>
        it.id === itemId
          ? {
              ...it,
              equipmentId: eq?.id,
              equipmentName: eq ? `${eq.name}${eq.serial ? ` (${eq.serial})` : ''}` : undefined,
              technologyType: it.technologyType || eq?.name
            }
          : it
      )
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setItems((prev) => prev.filter((it) => it.id !== itemId));
  };

  const selectedProvider = providers.find((p) => p.id === providerId);
  const providerDisplayName = selectedProvider?.name || existingInvoice?.providerName || 'Proveedor';

  const totalItems = items.length;
  const completedCount = items.filter((i) => i.completed).length;
  const progressPct = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;
  const computedStatus: 'pendiente' | 'parcial' | 'completa' =
    totalItems > 0 && completedCount === totalItems
      ? 'completa'
      : completedCount > 0
        ? 'parcial'
        : 'pendiente';

  const sanitizeFilenamePart = (val: string) =>
    val.trim().replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]+/g, '_').replace(/^_+|_+$/g, '') || 'Factura';

  const handleSave = async () => {
    setErrorMsg('');

    if (!providerId && !existingInvoice?.providerId) {
      setErrorMsg('Debe seleccionar un proveedor de la lista (o crear uno nuevo).');
      return;
    }
    if (!name.trim()) {
      setErrorMsg('Debe ingresar el nombre o referencia de la factura.');
      return;
    }
    if (!date) {
      setErrorMsg('Debe seleccionar la fecha de la factura.');
      return;
    }
    if (!existingInvoice && !selectedFile && items.length === 0 && computedTotal <= 0) {
      setErrorMsg('Adjunte el soporte (imagen/PDF), agregue ítems o indique el valor de la factura.');
      return;
    }

    setLoading(true);
    try {
      const invoiceId = existingInvoice?.id || `fac-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const nowIso = new Date().toISOString();
      const safeName = sanitizeFilenamePart(name);
      const safeFolderName = `${date} - ${name.trim()}`;

      let driveFolderId = existingInvoice?.driveFolderId || '';
      let driveFolderUrl = existingInvoice?.driveFolderUrl || '';
      let providerDriveFolderId = existingInvoice?.providerDriveFolderId || '';
      let originalFileName = existingInvoice?.originalFileName || '';
      let originalFileUrl = existingInvoice?.originalFileUrl || '';
      let originalFileDriveId = existingInvoice?.originalFileDriveId || '';
      let originalFileMimeType = existingInvoice?.originalFileMimeType || '';
      let partialPdfUrl = existingInvoice?.partialPdfUrl || '';
      let partialPdfDriveId = existingInvoice?.partialPdfDriveId || '';
      let completePdfUrl = existingInvoice?.completePdfUrl || '';
      let completePdfDriveId = existingInvoice?.completePdfDriveId || '';

      // 1. Subir archivo original (Imagen o PDF) si se seleccionó uno nuevo
      if (selectedFile && selectedFileBase64) {
        setStatusMessage('Creando carpeta en Drive y subiendo soporte original...');
        const ext = selectedFile.name.includes('.') ? selectedFile.name.split('.').pop() : 'pdf';
        const targetFileName = `${date}_${safeName}.${ext}`;

        const uploadRes = await fetch('/api/drive/upload-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folderType: 'facturas',
            providerName: providerDisplayName,
            invoiceDate: date,
            invoiceName: name.trim(),
            invoiceFolderName: safeFolderName,
            invoiceFolderId: driveFolderId || undefined,
            providerFolderId: providerDriveFolderId || undefined,
            fileName: targetFileName,
            base64: selectedFileBase64,
            mimeType: selectedFile.type || 'application/pdf',
            technologyScope: existingInvoice?.technologyScope || (scope === 'all' ? 'biomedical' : scope)
          })
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json().catch(() => ({}));
          throw new Error(errData.error || 'Error al subir el documento de la factura a Drive.');
        }

        const driveData = await uploadRes.json();
        driveFolderId = driveData.folderId || driveFolderId;
        driveFolderUrl = driveData.folderUrl || driveFolderUrl;
        providerDriveFolderId = driveData.providerFolderId || providerDriveFolderId;
        originalFileName = targetFileName;
        originalFileUrl = driveData.webViewLink || driveData.url || '';
        originalFileDriveId = driveData.fileId || '';
        originalFileMimeType = selectedFile.type || 'application/pdf';
      }

      // 2. Construir objeto actualizado de Factura con costos y categoría
      const invoiceObj: Invoice = {
        id: invoiceId,
        name: name.trim(),
        date,
        providerId: providerId || existingInvoice?.providerId || '',
        providerName: providerDisplayName,
        technologyScope: existingInvoice?.technologyScope || ((scope === 'all' ? 'biomedical' : scope) as TechnologyScope),
        expenseCategory: expenseCategory || 'Repuestos e Insumos',
        subtotalAmount: itemsSubtotal,
        ivaAmount: parsedIva,
        totalAmount: computedTotal,
        status: computedStatus,
        items,
        notes: notes.trim(),
        driveFolderId: driveFolderId || undefined,
        driveFolderUrl: driveFolderUrl || undefined,
        providerDriveFolderId: providerDriveFolderId || undefined,
        originalFileName: originalFileName || undefined,
        originalFileUrl: originalFileUrl || undefined,
        originalFileDriveId: originalFileDriveId || undefined,
        originalFileMimeType: originalFileMimeType || undefined,
        partialPdfUrl: partialPdfUrl || undefined,
        partialPdfDriveId: partialPdfDriveId || undefined,
        completePdfUrl: completePdfUrl || undefined,
        completePdfDriveId: completePdfDriveId || undefined,
        completedAt: computedStatus === 'completa' ? existingInvoice?.completedAt || nowIso : undefined,
        createdBy: existingInvoice?.createdBy || user?.displayName || user?.email || 'Ingeniería Biomédica',
        createdAt: existingInvoice?.createdAt || nowIso,
        updatedAt: nowIso
      };

      // 3. Si está 100% completa o si el usuario pidió subir reporte de seguimiento parcial a Drive
      let generatedCompletePdf = false;
      const shouldUploadPdf =
        computedStatus === 'completa' || (savePartialPdfToDrive && items.length > 0);

      if (shouldUploadPdf) {
        const isCompleteNow = computedStatus === 'completa';
        setStatusMessage(
          isCompleteNow
            ? 'Generando y archivando PDF Completo en Drive...'
            : 'Generando y archivando PDF de Seguimiento Parcial en Drive...'
        );

        const imageForPdf =
          selectedFileBase64 && selectedFileBase64.startsWith('data:image/')
            ? selectedFileBase64
            : undefined;

        const pdfBase64 = generateInvoiceReportPDF(invoiceObj, true, imageForPdf);
        if (pdfBase64) {
          const pdfFileName = isCompleteNow
            ? `${date}_COMPLETO_${safeName}.pdf`
            : `${date}_SEGUIMIENTO_PARCIAL_${safeName}.pdf`;

          const pdfUploadRes = await fetch('/api/drive/upload-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              folderType: 'facturas',
              providerName: providerDisplayName,
              invoiceDate: date,
              invoiceName: name.trim(),
              invoiceFolderName: safeFolderName,
              invoiceFolderId: driveFolderId || undefined,
              providerFolderId: providerDriveFolderId || undefined,
              fileName: pdfFileName,
              base64: pdfBase64,
              mimeType: 'application/pdf',
              technologyScope: invoiceObj.technologyScope
            })
          });

          if (pdfUploadRes.ok) {
            const pdfDriveData = await pdfUploadRes.json();
            invoiceObj.driveFolderId = pdfDriveData.folderId || invoiceObj.driveFolderId;
            invoiceObj.driveFolderUrl = pdfDriveData.folderUrl || invoiceObj.driveFolderUrl;
            invoiceObj.providerDriveFolderId = pdfDriveData.providerFolderId || invoiceObj.providerDriveFolderId;

            if (isCompleteNow) {
              invoiceObj.completePdfUrl = pdfDriveData.webViewLink || pdfDriveData.url || '';
              invoiceObj.completePdfDriveId = pdfDriveData.fileId || '';
              generatedCompletePdf = true;
              generateInvoiceReportPDF(invoiceObj, false, imageForPdf);
            } else {
              invoiceObj.partialPdfUrl = pdfDriveData.webViewLink || pdfDriveData.url || '';
              invoiceObj.partialPdfDriveId = pdfDriveData.fileId || '';
            }
          }
        }
      }

      // 4. Guardar Factura en Firestore
      setStatusMessage('Guardando factura en base de datos...');
      const sanitized = cleanFirestoreData(invoiceObj);
      try {
        await setDoc(doc(db, 'invoices', invoiceId), sanitized);
      } catch (fsErr: any) {
        const errInfo = {
          error: fsErr?.message || String(fsErr),
          operationType: 'write',
          path: `invoices/${invoiceId}`,
          authInfo: {
            userId: auth.currentUser?.uid,
            email: auth.currentUser?.email,
            emailVerified: auth.currentUser?.emailVerified
          }
        };
        console.error('Firestore Error:', JSON.stringify(errInfo));
        throw new Error(fsErr?.message || 'Error de permisos al guardar en Firestore.');
      }

      // 5. Sincronizar ítems con precio al Catálogo de Costos
      if (syncToCatalog && items.some((it) => (Number(it.unitPrice) || 0) > 0)) {
        setStatusMessage('Actualizando Catálogo de Costos e historial de precios...');
        try {
          await syncInvoiceItemsToCatalog(invoiceObj, catalogList);
        } catch (catErr) {
          console.warn('No se pudo sincronizar el catálogo de costos:', catErr);
        }
      }

      if (onSaved) onSaved(invoiceObj, generatedCompletePdf);
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error saving invoice:', err);
      setErrorMsg(err.message || 'Ocurrió un error al guardar la factura.');
    } finally {
      setLoading(false);
      setStatusMessage('');
    }
  };

  const handleDownloadCurrentPdf = () => {
    const previewInvoice: Invoice = {
      id: existingInvoice?.id || 'preview',
      name: name.trim() || 'Factura',
      date: date || new Date().toISOString().slice(0, 10),
      providerId: providerId || existingInvoice?.providerId || '',
      providerName: providerDisplayName,
      expenseCategory,
      subtotalAmount: itemsSubtotal,
      ivaAmount: parsedIva,
      totalAmount: computedTotal,
      status: computedStatus,
      items,
      notes: notes.trim(),
      originalFileName: selectedFile?.name || existingInvoice?.originalFileName,
      createdBy: existingInvoice?.createdBy || user?.displayName || user?.email || 'Ingeniería Biomédica'
    };
    const imgData =
      selectedFileBase64 && selectedFileBase64.startsWith('data:image/')
        ? selectedFileBase64
        : undefined;
    generateInvoiceReportPDF(previewInvoice, false, imgData);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !loading && onOpenChange(val)}>
      <DialogContent className="max-w-5xl max-h-[93vh] overflow-hidden flex flex-col p-0 rounded-3xl border-slate-200">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 bg-slate-900 text-white rounded-t-3xl border-b border-slate-800 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-xl font-bold text-white flex items-center gap-2.5">
                <Receipt className="h-5 w-5 text-emerald-400" />
                {existingInvoice ? `Seguimiento de Factura: ${existingInvoice.name}` : 'Registrar Nueva Factura de Proveedor'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-300 mt-1">
                Asocie proveedor, soporte, ítems con su valor y tecnología asociada para alimentar Gastos y Catálogo de Costos.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono tabular-nums bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 shrink-0">
              <span className={cn(
                'font-semibold',
                computedStatus === 'completa' ? 'text-emerald-400' :
                computedStatus === 'parcial' ? 'text-amber-400' : 'text-rose-400'
              )}>
                {computedStatus === 'completa' ? '100% Completada' :
                 computedStatus === 'parcial' ? 'Entrega Parcial' : 'Pendiente'}
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-slate-200">{completedCount}/{totalItems} ítems</span>
              <span className="text-slate-500">·</span>
              <span className="text-emerald-300 font-bold">{formatCOP(computedTotal)}</span>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Ruta Drive en tiempo real */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
            <div className="flex items-center gap-2 min-w-0">
              <FolderOpen className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="font-semibold text-slate-700 shrink-0">Carpeta Drive:</span>
              <span className="font-mono text-[11px] truncate text-slate-800">
                Facturas / {providerDisplayName} / {date || 'YYYY-MM-DD'} - {name.trim() || 'Nombre_Factura'}
              </span>
            </div>
            {existingInvoice?.driveFolderUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => window.open(existingInvoice.driveFolderUrl, '_blank')}
                className="h-7 px-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 rounded-lg"
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                Abrir Carpeta en Drive
              </Button>
            )}
          </div>

          {/* 1. Proveedor, Nombre, Fecha y Categoría */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700">Proveedor *</Label>
                <button
                  type="button"
                  onClick={() => setShowNewProvider(!showNewProvider)}
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  {showNewProvider ? 'Cancelar' : '+ Nuevo proveedor'}
                </button>
              </div>
              {!showNewProvider ? (
                <Select value={providerId} onValueChange={setProviderId} disabled={loading}>
                  <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white">
                    <SelectValue placeholder="Seleccione un proveedor..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {providers.length === 0 ? (
                      <div className="p-3 text-xs text-slate-500 text-center">
                        No hay proveedores registrados.
                      </div>
                    ) : (
                      providers.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="font-medium">{p.name}</span>
                          {p.city ? <span className="text-slate-400 ml-1.5 text-xs">({p.city})</span> : null}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <Input
                    placeholder="Nombre de empresa o proveedor *"
                    value={newProvName}
                    onChange={(e) => setNewProvName(e.target.value)}
                    className="h-8 text-xs rounded-lg bg-white"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Correo electrónico"
                      value={newProvEmail}
                      onChange={(e) => setNewProvEmail(e.target.value)}
                      className="h-8 text-xs rounded-lg bg-white"
                    />
                    <Input
                      placeholder="Teléfono / WhatsApp"
                      value={newProvPhone}
                      onChange={(e) => setNewProvPhone(e.target.value)}
                      className="h-8 text-xs rounded-lg bg-white"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={creatingProvider}
                    onClick={handleCreateQuickProvider}
                    className="w-full h-8 text-xs rounded-lg font-semibold"
                  >
                    {creatingProvider ? (
                      <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Guardando...</>
                    ) : (
                      <><Building2 className="mr-1.5 h-3.5 w-3.5" /> Guardar y Seleccionar</>
                    )}
                  </Button>
                </div>
              )}
            </div>

            <div className="md:col-span-3 space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Nombre / N° Factura *</Label>
              <Input
                placeholder="Ej: Factura FE-1045"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                className="h-10 rounded-xl border-slate-200"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Fecha *</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={loading}
                className="h-10 rounded-xl border-slate-200 font-mono"
              />
            </div>

            <div className="md:col-span-3 space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Categoría de Gasto</Label>
              <Select value={expenseCategory} onValueChange={setExpenseCategory} disabled={loading}>
                <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 2. Documento Soporte (PDF o Imagen) */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-700">
              Documento de Factura (PDF o Imagen)
            </Label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                onClick={() => !loading && fileInputRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-2xl p-3.5 flex items-center gap-3.5 transition-colors cursor-pointer',
                  loading
                    ? 'opacity-50 cursor-not-allowed border-slate-200 bg-slate-50'
                    : 'border-slate-300 hover:border-primary hover:bg-primary/5'
                )}
              >
                <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  <UploadCloud className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-900 truncate">
                    {selectedFile
                      ? selectedFile.name
                      : existingInvoice?.originalFileName
                        ? 'Reemplazar archivo de factura actual'
                        : 'Seleccionar imagen o PDF de la factura'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {selectedFile
                      ? `${(selectedFile.size / 1024).toFixed(0)} KB · Se guardará como ${date}_${sanitizeFilenamePart(name || 'Factura')}`
                      : 'Formatos admitidos: PDF, JPG, PNG, WEBP (Máx. 20 MB)'}
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={loading}
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 flex items-center justify-between gap-3">
                {selectedFileBase64 && selectedFile?.type.startsWith('image/') ? (
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={selectedFileBase64}
                      alt="Vista previa factura"
                      className="h-11 w-11 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">Vista previa lista</p>
                      <p className="text-[11px] text-emerald-700">Lista para subir a Drive al guardar</p>
                    </div>
                  </div>
                ) : existingInvoice?.originalFileUrl ? (
                  <>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                        {existingInvoice.originalFileMimeType?.startsWith('image/') ? (
                          <ImageIcon className="h-5 w-5 text-sky-600" />
                        ) : (
                          <FileText className="h-5 w-5 text-rose-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate">
                          {existingInvoice.originalFileName || 'Archivo adjunto en Drive'}
                        </p>
                        <p className="text-[11px] text-slate-500">Almacenado en Google Drive</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(existingInvoice.originalFileUrl, '_blank')}
                      className="h-8 text-xs rounded-xl shrink-0"
                    >
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                      Ver Soporte
                    </Button>
                  </>
                ) : (
                  <div className="flex items-center gap-2.5 text-xs text-slate-500">
                    <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                    <span>
                      {selectedFile
                        ? `PDF seleccionado: ${selectedFile.name}`
                        : 'Aún no se ha cargado un archivo soporte.'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 3. Lista de Transcripción de Ítems, Costos y Tecnología */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-primary" />
                  Transcripción de Ítems, Costos, Tecnología y Entregas
                </h4>
                <p className="text-xs text-slate-500">
                  Transcriba los ítems de la factura con su valor unitario y tecnología (ej: Ventilador, Monitor, Bomba de Infusión).
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
                <span className="font-semibold text-slate-700">{progressPct}%</span>
                <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all duration-300',
                      computedStatus === 'completa'
                        ? 'bg-emerald-600'
                        : computedStatus === 'parcial'
                          ? 'bg-amber-500'
                          : 'bg-slate-400'
                    )}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Add item panel */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
              {catalogList.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 pb-2 border-b border-slate-200/80">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 shrink-0">
                    <BookOpen className="h-3.5 w-3.5 text-primary" />
                    Precargar desde Catálogo:
                  </div>
                  <div className="flex-1">
                    <Select value={selectedCatalogId} onValueChange={handlePickFromCatalog} disabled={loading}>
                      <SelectTrigger className="h-8 text-xs rounded-lg bg-white border-slate-200">
                        <SelectValue placeholder="Elegir ítem previo del catálogo (opcional)..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        <SelectItem value="__none__">— Escribir ítem nuevo manualmente —</SelectItem>
                        {catalogList.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name} · {formatCOP(cat.lastUnitPrice)} ({cat.technologyType || 'General'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-4">
                  <Input
                    placeholder="Descripción del ítem / repuesto *"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddItem();
                      }
                    }}
                    disabled={loading}
                    className="h-9 text-xs rounded-xl bg-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Input
                    type="number"
                    min={1}
                    placeholder="Cant."
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(e.target.value)}
                    disabled={loading}
                    className="h-9 text-xs rounded-xl bg-white font-mono"
                    title="Cantidad"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Input
                    type="number"
                    min={0}
                    placeholder="V. Unitario ($)"
                    value={newItemUnitPrice}
                    onChange={(e) => setNewItemUnitPrice(e.target.value)}
                    disabled={loading}
                    className="h-9 text-xs rounded-xl bg-white font-mono"
                    title="Valor unitario en pesos (COP)"
                  />
                </div>
                <div className="sm:col-span-3">
                  <Input
                    list="invoice-tech-suggestions"
                    placeholder="Tecnología (ej: Ventilador)"
                    value={newItemTech}
                    onChange={(e) => setNewItemTech(e.target.value)}
                    disabled={loading}
                    className="h-9 text-xs rounded-xl bg-white"
                    title="Tecnología asociada para análisis de gastos"
                  />
                  <datalist id="invoice-tech-suggestions">
                    {technologySuggestions.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </div>
                <div className="sm:col-span-1">
                  <Button
                    type="button"
                    onClick={handleAddItem}
                    disabled={loading || !newItemName.trim()}
                    className="w-full h-9 rounded-xl px-0"
                    title="Agregar ítem a la factura"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-6">
                  <Select value={newItemEquipmentId} onValueChange={handlePickSpecificEquipment} disabled={loading}>
                    <SelectTrigger className="h-8 text-xs rounded-xl bg-white border-slate-200">
                      <SelectValue placeholder="Asociar a equipo específico del inventario (opcional)..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      <SelectItem value="__none__">Sin equipo específico (solo por tecnología)</SelectItem>
                      {equipmentList.map((eq) => (
                        <SelectItem key={eq.id} value={eq.id}>
                          {eq.name} · {eq.brand} {eq.model} {eq.serial ? `(SN: ${eq.serial})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-6">
                  <Input
                    placeholder="Observación de entrega / referencia (opcional)"
                    value={newItemObs}
                    onChange={(e) => setNewItemObs(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddItem();
                      }
                    }}
                    disabled={loading}
                    className="h-8 text-xs rounded-xl bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Items list */}
            {items.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-200 rounded-2xl text-xs text-slate-500">
                No hay ítems agregados aún. Agregue los ítems arriba para controlar entregas, costos por tecnología y alimentar el Catálogo.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden bg-white">
                {items.map((item, idx) => {
                  const qty = Number(item.quantity) || 1;
                  const unitP = Number(item.unitPrice) || 0;
                  const lineTotal = typeof item.totalPrice === 'number' ? item.totalPrice : qty * unitP;
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        'p-3 space-y-2 transition-colors',
                        item.completed ? 'bg-emerald-50/40' : 'hover:bg-slate-50/70'
                      )}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center gap-2.5">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <Checkbox
                            id={`chk-${item.id}`}
                            checked={item.completed}
                            onCheckedChange={(checked) => handleToggleItem(item.id, Boolean(checked))}
                            disabled={loading}
                            className="h-5 w-5 rounded-md data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                          />
                          <span className="text-xs font-mono text-slate-400 w-5 shrink-0">{idx + 1}.</span>
                          <Input
                            value={item.name}
                            onChange={(e) => handleUpdateItemField(item.id, 'name', e.target.value)}
                            disabled={loading}
                            className={cn(
                              'h-8 text-xs font-semibold border-transparent hover:border-slate-200 focus:border-slate-300 bg-transparent px-2 flex-1',
                              item.completed && 'line-through text-slate-500'
                            )}
                          />
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pl-8 lg:pl-0">
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-slate-400">Cant:</span>
                            <Input
                              type="number"
                              min={1}
                              value={qty}
                              onChange={(e) => handleUpdateItemField(item.id, 'quantity', Number(e.target.value) || 1)}
                              disabled={loading}
                              className="h-8 w-14 text-xs font-mono text-center rounded-lg border-slate-200"
                            />
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-slate-400">V.Unit:</span>
                            <Input
                              type="number"
                              min={0}
                              value={unitP || ''}
                              placeholder="0"
                              onChange={(e) => handleUpdateItemField(item.id, 'unitPrice', Number(e.target.value) || 0)}
                              disabled={loading}
                              className="h-8 w-24 text-xs font-mono text-right rounded-lg border-slate-200"
                            />
                          </div>

                          <div className="w-24 text-right font-mono text-xs font-bold text-slate-800 tabular-nums">
                            {formatCOP(lineTotal)}
                          </div>

                          {item.completed ? (
                            <Input
                              type="date"
                              value={item.deliveredAt || ''}
                              onChange={(e) => handleUpdateItemField(item.id, 'deliveredAt', e.target.value)}
                              disabled={loading}
                              className="h-8 w-32 text-xs font-mono rounded-lg border-emerald-200 bg-emerald-50/60"
                              title="Fecha de entrega"
                            />
                          ) : (
                            <span className="text-[11px] font-semibold text-rose-600 w-20 text-center">
                              Pendiente
                            </span>
                          )}

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={loading}
                            onClick={() => handleRemoveItem(item.id)}
                            className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg shrink-0"
                            title="Eliminar ítem"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Segunda línea compacta: Tecnología, Equipo específico y Observación */}
                      <div className="flex flex-wrap items-center gap-2 pl-8">
                        <div className="flex items-center gap-1.5">
                          <Cpu className="h-3 w-3 text-slate-400 shrink-0" />
                          <Input
                            list="invoice-tech-suggestions"
                            placeholder="Tecnología (ej: Monitor)"
                            value={item.technologyType || ''}
                            onChange={(e) => handleUpdateItemField(item.id, 'technologyType', e.target.value)}
                            disabled={loading}
                            className="h-7 w-40 text-[11px] rounded-lg border-slate-200 bg-white"
                          />
                        </div>

                        <div className="w-52">
                          <Select
                            value={item.equipmentId || '__none__'}
                            onValueChange={(val) => handleUpdateItemEquipment(item.id, val)}
                            disabled={loading}
                          >
                            <SelectTrigger className="h-7 text-[11px] rounded-lg border-slate-200 bg-white">
                              <SelectValue placeholder="Equipo específico (opcional)" />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                              <SelectItem value="__none__">Sin equipo específico</SelectItem>
                              {equipmentList.map((eq) => (
                                <SelectItem key={eq.id} value={eq.id}>
                                  {eq.name} {eq.serial ? `(${eq.serial})` : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <Input
                          placeholder="Observación / Nota entrega"
                          value={item.observations || ''}
                          onChange={(e) => handleUpdateItemField(item.id, 'observations', e.target.value)}
                          disabled={loading}
                          className="h-7 flex-1 min-w-[160px] text-[11px] rounded-lg border-slate-200 bg-white"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. Resumen Financiero + Sincronización Catálogo + Opciones PDF */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2 border-t border-slate-200">
            {/* Financial summary box */}
            <div className="lg:col-span-6 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                  Resumen Económico de la Factura
                </h5>
                <label className="flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer">
                  <Checkbox
                    checked={manualTotalEnabled}
                    onCheckedChange={(c) => {
                      const next = Boolean(c);
                      setManualTotalEnabled(next);
                      if (next && !manualTotalStr) {
                        setManualTotalStr(String(itemsSubtotal + parsedIva));
                      }
                    }}
                    disabled={loading}
                    className="h-3.5 w-3.5"
                  />
                  <span>Ajustar total manual</span>
                </label>
              </div>

              <div className="grid grid-cols-3 gap-2.5 text-xs">
                <div className="space-y-1">
                  <span className="text-[11px] text-slate-500 block">Subtotal Ítems</span>
                  <div className="h-9 px-3 rounded-xl border border-slate-200 bg-white flex items-center font-mono font-semibold text-slate-800 tabular-nums">
                    {formatCOP(itemsSubtotal)}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-slate-500 block">IVA / Otros ($)</span>
                  <Input
                    type="number"
                    min={0}
                    value={ivaAmountStr}
                    onChange={(e) => setIvaAmountStr(e.target.value)}
                    disabled={loading || manualTotalEnabled}
                    className="h-9 text-xs font-mono rounded-xl bg-white border-slate-200"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-slate-500 block">Total Factura ($)</span>
                  {manualTotalEnabled ? (
                    <Input
                      type="number"
                      min={0}
                      value={manualTotalStr}
                      onChange={(e) => setManualTotalStr(e.target.value)}
                      disabled={loading}
                      className="h-9 text-xs font-mono font-bold rounded-xl bg-white border-emerald-300"
                    />
                  ) : (
                    <div className="h-9 px-3 rounded-xl border border-emerald-200 bg-emerald-50/70 flex items-center font-mono font-bold text-emerald-800 tabular-nums">
                      {formatCOP(computedTotal)}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2 pt-1 border-t border-slate-200/70">
                <Checkbox
                  id="chk-sync-catalog"
                  checked={syncToCatalog}
                  onCheckedChange={(c) => setSyncToCatalog(Boolean(c))}
                  disabled={loading}
                  className="mt-0.5"
                />
                <label htmlFor="chk-sync-catalog" className="text-[11px] text-slate-600 cursor-pointer">
                  <span className="font-semibold text-slate-800">Alimentar Catálogo de Costos automáticamente:</span>{' '}
                  Guarda cada ítem con su valor unitario en el catálogo para validar precios y armar presupuestos futuros.
                </label>
              </div>
            </div>

            {/* Observaciones y PDF */}
            <div className="lg:col-span-6 flex flex-col justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Observaciones Generales</Label>
                <Textarea
                  rows={2}
                  placeholder="Notas sobre tiempos de entrega, acuerdos con el proveedor o pendientes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={loading}
                  className="rounded-xl border-slate-200 text-xs bg-white"
                />
              </div>

              {computedStatus === 'completa' ? (
                <div className="flex items-start gap-2 text-xs text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>100% completada:</strong> Al guardar, se archivará el <strong>PDF Completo</strong> en Google Drive.
                  </span>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="chk-partial-pdf"
                    checked={savePartialPdfToDrive}
                    onCheckedChange={(c) => setSavePartialPdfToDrive(Boolean(c))}
                    disabled={loading || items.length === 0}
                    className="mt-0.5"
                  />
                  <label htmlFor="chk-partial-pdf" className="text-[11px] text-slate-700 cursor-pointer">
                    <span className="font-semibold">Guardar PDF de seguimiento parcial en Drive</span> (con ítems entregados y pendientes).
                  </label>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  onClick={handleDownloadCurrentPdf}
                  className="h-8 text-xs rounded-xl border-slate-300 bg-white"
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Descargar PDF Actual
                </Button>
                {existingInvoice?.completePdfUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(existingInvoice.completePdfUrl, '_blank')}
                    className="h-8 text-xs rounded-xl border-emerald-300 text-emerald-700 hover:bg-emerald-50 bg-white"
                  >
                    <HardDrive className="h-3.5 w-3.5 mr-1.5" />
                    Ver PDF Completo en Drive
                  </Button>
                )}
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 px-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            {loading && statusMessage ? (
              <span className="font-medium text-primary flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {statusMessage}
              </span>
            ) : (
              <span>
                {computedStatus === 'completa'
                  ? 'Estado final: Factura completada al 100%'
                  : computedStatus === 'parcial'
                    ? `Seguimiento parcial: faltan ${totalItems - completedCount} ítem(s) por entregar`
                    : 'Seguimiento inicial pendiente de entrega'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => onOpenChange(false)}
              className="rounded-xl font-semibold text-xs h-10 px-4 border-slate-300 flex-1 sm:flex-initial"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={loading}
              onClick={handleSave}
              className={cn(
                'rounded-xl font-semibold text-xs h-10 px-5 text-white flex-1 sm:flex-initial',
                computedStatus === 'completa'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-primary hover:bg-primary/90'
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Procesando...
                </>
              ) : computedStatus === 'completa' ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Completar Factura y Guardar
                </>
              ) : (
                <>
                  <Clock className="mr-2 h-4 w-4" />
                  Guardar Factura y Catálogo
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
