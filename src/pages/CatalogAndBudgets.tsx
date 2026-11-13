import * as React from 'react';
import {
  BookOpen,
  Calculator,
  Plus,
  Search,
  Trash2,
  Download,
  Save,
  History,
  ChevronDown,
  ChevronRight,
  Cpu,
  Building2,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  FileSpreadsheet,
  Loader2,
  Edit2
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db, cleanFirestoreData } from '@/lib/firebase';
import { Budget, BudgetItem, CatalogItem, Equipment, Provider } from '@/types';
import { useAuth } from '@/lib/AuthContext';
import { useTechnologyScope } from '@/lib/TechnologyScopeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { ConfirmModal, FeedbackModal } from '@/components/ui/ConfirmModal';
import {
  buildCatalogDocId,
  COMMON_TECHNOLOGIES,
  formatCOP,
  normalizeCatalogKey
} from '@/lib/financialUtils';
import { generateBudgetPDF } from '@/lib/pdfGenerator';
import { cn } from '@/lib/utils';

type WorkspaceTab = 'catalog' | 'budgets';

export default function CatalogAndBudgets() {
  const { user } = useAuth();
  const { scope, scopeConfig } = useTechnologyScope();

  const [activeTab, setActiveTab] = React.useState<WorkspaceTab>('catalog');
  const [loading, setLoading] = React.useState(true);

  const [catalogItems, setCatalogItems] = React.useState<CatalogItem[]>([]);
  const [budgets, setBudgets] = React.useState<Budget[]>([]);
  const [providers, setProviders] = React.useState<Provider[]>([]);
  const [equipmentList, setEquipmentList] = React.useState<Equipment[]>([]);

  // Catalog filters & state
  const [searchCatalog, setSearchCatalog] = React.useState('');
  const [techFilter, setTechFilter] = React.useState<string>('all');
  const [expandedHistory, setExpandedHistory] = React.useState<Record<string, boolean>>({});

  // Manual catalog modal
  const [catModalOpen, setCatModalOpen] = React.useState(false);
  const [editingCat, setEditingCat] = React.useState<CatalogItem | null>(null);
  const [catName, setCatName] = React.useState('');
  const [catTech, setCatTech] = React.useState('General / Insumos');
  const [catPrice, setCatPrice] = React.useState('');
  const [catProviderName, setCatProviderName] = React.useState('');
  const [catUnit, setCatUnit] = React.useState('Und');
  const [catNotes, setCatNotes] = React.useState('');
  const [savingCat, setSavingCat] = React.useState(false);

  // Budget Builder state
  const [editingBudgetId, setEditingBudgetId] = React.useState<string | null>(null);
  const [budgetName, setBudgetName] = React.useState('');
  const [budgetDate, setBudgetDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [budgetDesc, setBudgetDesc] = React.useState('');
  const [budgetIvaPct, setBudgetIvaPct] = React.useState<string>('19');
  const [budgetItems, setBudgetItems] = React.useState<BudgetItem[]>([]);
  const [pickerCatalogId, setPickerCatalogId] = React.useState<string>('__none__');
  const [customItemName, setCustomItemName] = React.useState('');
  const [customItemTech, setCustomItemTech] = React.useState('');
  const [customItemQty, setCustomItemQty] = React.useState('1');
  const [customItemPrice, setCustomItemPrice] = React.useState('');
  const [savingBudget, setSavingBudget] = React.useState(false);

  // Delete & Feedback
  const [catToDelete, setCatToDelete] = React.useState<CatalogItem | null>(null);
  const [budgetToDelete, setBudgetToDelete] = React.useState<Budget | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{
    open: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  }>({ open: false, title: '', message: '', type: 'info' });

  const isAdmin = user?.role?.toUpperCase() === 'ADMIN';
  const canCreate = isAdmin || user?.permissions?.catalog?.create !== false;
  const canEdit = isAdmin || user?.permissions?.catalog?.edit !== false;
  const canDelete = isAdmin || Boolean(user?.permissions?.catalog?.delete);

  React.useEffect(() => {
    const unsubCat = onSnapshot(
      query(collection(db, 'catalog_items'), orderBy('name', 'asc')),
      (snap) => {
        setCatalogItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as CatalogItem[]);
        setLoading(false);
      },
      (err) => {
        console.warn('catalog_items snapshot error:', err);
        setLoading(false);
      }
    );

    const unsubBudgets = onSnapshot(
      query(collection(db, 'budgets'), orderBy('date', 'desc')),
      (snap) => {
        setBudgets(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Budget[]);
      },
      (err) => {
        console.warn('budgets snapshot error:', err);
      }
    );

    const unsubProv = onSnapshot(
      query(collection(db, 'providers'), orderBy('name', 'asc')),
      (snap) => {
        setProviders(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Provider[]);
      },
      (err) => console.warn('providers snapshot error:', err)
    );

    const unsubEq = onSnapshot(
      collection(db, 'equipment'),
      (snap) => {
        setEquipmentList(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Equipment[]);
      },
      (err) => console.warn('equipment snapshot error:', err)
    );

    return () => {
      unsubCat();
      unsubBudgets();
      unsubProv();
      unsubEq();
    };
  }, []);

  const technologyOptions = React.useMemo(() => {
    const set = new Set<string>(COMMON_TECHNOLOGIES);
    for (const c of catalogItems) {
      if (c.technologyType?.trim()) set.add(c.technologyType.trim());
    }
    for (const eq of equipmentList) {
      if (eq.name?.trim()) set.add(eq.name.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [catalogItems, equipmentList]);

  const catalogTechTabs = React.useMemo(() => {
    const set = new Set<string>();
    for (const c of catalogItems) {
      if (c.technologyType?.trim()) set.add(c.technologyType.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [catalogItems]);

  const filteredCatalog = React.useMemo(() => {
    const q = searchCatalog.trim().toLowerCase();
    return catalogItems.filter((item) => {
      if (techFilter !== 'all' && (item.technologyType || 'General / Insumos') !== techFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.name?.toLowerCase().includes(q) ||
        item.technologyType?.toLowerCase().includes(q) ||
        item.lastProviderName?.toLowerCase().includes(q)
      );
    });
  }, [catalogItems, techFilter, searchCatalog]);

  const openNewCatalogModal = () => {
    setEditingCat(null);
    setCatName('');
    setCatTech('General / Insumos');
    setCatPrice('');
    setCatProviderName('');
    setCatUnit('Und');
    setCatNotes('');
    setCatModalOpen(true);
  };

  const openEditCatalogModal = (cat: CatalogItem) => {
    setEditingCat(cat);
    setCatName(cat.name);
    setCatTech(cat.technologyType || 'General / Insumos');
    setCatPrice(String(cat.lastUnitPrice || 0));
    setCatProviderName(cat.lastProviderName || '');
    setCatUnit(cat.unit || 'Und');
    setCatNotes(cat.notes || '');
    setCatModalOpen(true);
  };

  const handleSaveCatalogItem = async () => {
    if (!catName.trim()) return;
    const price = Math.max(0, Number(catPrice) || 0);
    setSavingCat(true);
    try {
      const nowIso = new Date().toISOString();
      const today = nowIso.slice(0, 10);
      const normKey = normalizeCatalogKey(catName, catTech);
      const docId = editingCat?.id || buildCatalogDocId(normKey);

      const prevHistory = editingCat?.priceHistory ? [...editingCat.priceHistory] : [];
      if (!editingCat || Math.abs((editingCat.lastUnitPrice || 0) - price) > 0) {
        prevHistory.unshift({
          date: today,
          unitPrice: price,
          providerName: catProviderName.trim() || 'Referencia Manual',
          invoiceName: 'Registro manual en Catálogo'
        });
      }

      const avg =
        prevHistory.length > 0
          ? prevHistory.reduce((s, h) => s + (Number(h.unitPrice) || 0), 0) / prevHistory.length
          : price;

      const payload: CatalogItem = {
        id: docId,
        name: catName.trim(),
        normalizedName: normKey,
        unit: catUnit.trim() || 'Und',
        technologyType: catTech.trim() || 'General / Insumos',
        technologyScope: editingCat?.technologyScope || (scope === 'all' ? 'biomedical' : scope),
        lastUnitPrice: price,
        averagePrice: Math.round(avg),
        lastProviderName: catProviderName.trim() || editingCat?.lastProviderName || 'Referencia Manual',
        lastPurchaseDate: editingCat?.lastPurchaseDate || today,
        priceHistory: prevHistory.slice(0, 25),
        notes: catNotes.trim(),
        createdAt: editingCat?.createdAt || nowIso,
        updatedAt: nowIso
      };

      await setDoc(doc(db, 'catalog_items', docId), cleanFirestoreData(payload));
      setCatModalOpen(false);
      setFeedback({
        open: true,
        type: 'success',
        title: editingCat ? 'Ítem actualizado' : 'Ítem agregado al catálogo',
        message: `"${payload.name}" quedó disponible con precio de referencia ${formatCOP(payload.lastUnitPrice)}.`
      });
    } catch (err: any) {
      console.error('Error saving catalog item:', err);
      setFeedback({
        open: true,
        type: 'error',
        title: 'Error al guardar ítem',
        message: err?.message || 'No se pudo guardar el ítem en el catálogo.'
      });
    } finally {
      setSavingCat(false);
    }
  };

  // Budget Builder operations
  const handleAddCatalogToBudget = (cat: CatalogItem, switchTab = false) => {
    setBudgetItems((prev) => {
      const existing = prev.find((it) => it.catalogItemId === cat.id);
      if (existing) {
        return prev.map((it) =>
          it.catalogItemId === cat.id
            ? {
                ...it,
                quantity: it.quantity + 1,
                totalPrice: (it.quantity + 1) * it.unitPrice
              }
            : it
        );
      }
      const newItem: BudgetItem = {
        id: `bitem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        catalogItemId: cat.id,
        name: cat.name,
        technologyType: cat.technologyType || 'General',
        referenceProvider: cat.lastProviderName || 'Sin proveedor ref.',
        quantity: 1,
        unitPrice: Number(cat.lastUnitPrice) || 0,
        totalPrice: Number(cat.lastUnitPrice) || 0
      };
      return [...prev, newItem];
    });
    if (switchTab) {
      setActiveTab('budgets');
    }
  };

  const handlePickerSelect = (catId: string) => {
    setPickerCatalogId(catId);
    if (catId === '__none__') return;
    const found = catalogItems.find((c) => c.id === catId);
    if (found) {
      handleAddCatalogToBudget(found, false);
      setPickerCatalogId('__none__');
    }
  };

  const handleAddCustomBudgetItem = () => {
    if (!customItemName.trim()) return;
    const qty = Math.max(1, Number(customItemQty) || 1);
    const price = Math.max(0, Number(customItemPrice) || 0);
    setBudgetItems((prev) => [
      ...prev,
      {
        id: `bitem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: customItemName.trim(),
        technologyType: customItemTech.trim() || 'General',
        referenceProvider: 'Cotización / Manual',
        quantity: qty,
        unitPrice: price,
        totalPrice: qty * price
      }
    ]);
    setCustomItemName('');
    setCustomItemTech('');
    setCustomItemQty('1');
    setCustomItemPrice('');
  };

  const handleUpdateBudgetItem = (id: string, field: keyof BudgetItem, value: any) => {
    setBudgetItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const updated = { ...it, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          const q = Math.max(1, Number(field === 'quantity' ? value : updated.quantity) || 1);
          const u = Math.max(0, Number(field === 'unitPrice' ? value : updated.unitPrice) || 0);
          updated.quantity = q;
          updated.unitPrice = u;
          updated.totalPrice = q * u;
        }
        return updated;
      })
    );
  };

  const budgetSubtotal = React.useMemo(
    () => budgetItems.reduce((sum, it) => sum + (Number(it.totalPrice) || 0), 0),
    [budgetItems]
  );
  const parsedIvaPct = Math.max(0, Number(budgetIvaPct) || 0);
  const budgetIvaAmount = Math.round(budgetSubtotal * (parsedIvaPct / 100));
  const budgetTotal = budgetSubtotal + budgetIvaAmount;

  const resetBudgetDraft = () => {
    setEditingBudgetId(null);
    setBudgetName('');
    setBudgetDate(new Date().toISOString().slice(0, 10));
    setBudgetDesc('');
    setBudgetIvaPct('19');
    setBudgetItems([]);
  };

  const handleSaveBudget = async () => {
    if (!budgetName.trim()) {
      setFeedback({
        open: true,
        type: 'warning',
        title: 'Nombre requerido',
        message: 'Ingrese un título para identificar este presupuesto (ej: Repuestos UCI Q4).'
      });
      return;
    }
    if (budgetItems.length === 0) {
      setFeedback({
        open: true,
        type: 'warning',
        title: 'Sin ítems',
        message: 'Agregue al menos un ítem desde el catálogo o de forma manual.'
      });
      return;
    }

    setSavingBudget(true);
    try {
      const nowIso = new Date().toISOString();
      const budgetId = editingBudgetId || `pres-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const budgetObj: Budget = {
        id: budgetId,
        name: budgetName.trim(),
        date: budgetDate || nowIso.slice(0, 10),
        description: budgetDesc.trim(),
        technologyScope: scope === 'all' ? 'biomedical' : scope,
        ivaPercentage: parsedIvaPct,
        subtotalAmount: budgetSubtotal,
        ivaAmount: budgetIvaAmount,
        totalAmount: budgetTotal,
        items: budgetItems,
        createdBy: user?.displayName || user?.email || 'Ingeniería Biomédica',
        createdAt: nowIso,
        updatedAt: nowIso
      };

      await setDoc(doc(db, 'budgets', budgetId), cleanFirestoreData(budgetObj));
      setEditingBudgetId(budgetId);
      setFeedback({
        open: true,
        type: 'success',
        title: 'Presupuesto Guardado',
        message: `El presupuesto "${budgetObj.name}" (${formatCOP(budgetObj.totalAmount)}) quedó guardado para consulta y exportación.`
      });
    } catch (err: any) {
      console.error('Error saving budget:', err);
      setFeedback({
        open: true,
        type: 'error',
        title: 'Error al guardar presupuesto',
        message: err?.message || 'No se pudo guardar el presupuesto.'
      });
    } finally {
      setSavingBudget(false);
    }
  };

  const handleLoadBudget = (b: Budget) => {
    setEditingBudgetId(b.id);
    setBudgetName(b.name);
    setBudgetDate(b.date);
    setBudgetDesc(b.description || '');
    setBudgetIvaPct(String(b.ivaPercentage ?? 19));
    setBudgetItems(Array.isArray(b.items) ? b.items : []);
    setActiveTab('budgets');
  };

  const handleExportCurrentBudgetPDF = () => {
    const draft: Budget = {
      id: editingBudgetId || 'draft',
      name: budgetName.trim() || 'Presupuesto Estimado',
      date: budgetDate || new Date().toISOString().slice(0, 10),
      description: budgetDesc.trim(),
      ivaPercentage: parsedIvaPct,
      subtotalAmount: budgetSubtotal,
      ivaAmount: budgetIvaAmount,
      totalAmount: budgetTotal,
      items: budgetItems,
      createdBy: user?.displayName || user?.email || 'Ingeniería Biomédica'
    };
    generateBudgetPDF(draft);
  };

  const handleExportCurrentBudgetCSV = () => {
    const headers = ['Item', 'Tecnologia', 'Proveedor Ref.', 'Cantidad', 'Valor Unitario', 'Subtotal'];
    const rows = budgetItems.map((it) => [
      it.name,
      it.technologyType || 'General',
      it.referenceProvider || '-',
      String(it.quantity),
      String(it.unitPrice),
      String(it.totalPrice)
    ]);
    rows.push(['', '', '', '', 'Subtotal', String(budgetSubtotal)]);
    rows.push(['', '', '', '', `IVA (${parsedIvaPct}%)`, String(budgetIvaAmount)]);
    rows.push(['', '', '', '', 'TOTAL PRESUPUESTO', String(budgetTotal)]);
    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = '\uFEFF' + [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Presupuesto_${budgetDate}_${(budgetName || 'Estimado').replace(/[^a-zA-Z0-9_-]+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      if (catToDelete) {
        await deleteDoc(doc(db, 'catalog_items', catToDelete.id));
        setCatToDelete(null);
      } else if (budgetToDelete) {
        await deleteDoc(doc(db, 'budgets', budgetToDelete.id));
        if (editingBudgetId === budgetToDelete.id) resetBudgetDraft();
        setBudgetToDelete(null);
      }
    } catch (err: any) {
      console.error('Error deleting record:', err);
      setFeedback({
        open: true,
        type: 'error',
        title: 'Error al eliminar',
        message: err?.message || 'No fue posible eliminar el registro.'
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Catálogo de Costos y Presupuestos
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Base de precios históricos alimentada por Facturas para validar costos y simular presupuestos · {scopeConfig.shortLabel}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {activeTab === 'catalog' && canCreate && (
            <Button
              onClick={openNewCatalogModal}
              className="rounded-xl h-10 px-4 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Agregar Ítem Manual
            </Button>
          )}
          {activeTab === 'budgets' && (
            <Button
              variant="outline"
              onClick={resetBudgetDraft}
              className="rounded-xl h-10 px-4 text-xs font-semibold border-slate-300 bg-white"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Nuevo Presupuesto
            </Button>
          )}
        </div>
      </div>

      {/* Main Segmented Workspace Switcher */}
      <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap',
            activeTab === 'catalog'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          )}
        >
          <BookOpen className="h-4 w-4" />
          Catálogo de Costos ({catalogItems.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('budgets')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap',
            activeTab === 'budgets'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          )}
        >
          <Calculator className="h-4 w-4" />
          Armador de Presupuestos
          {budgetItems.length > 0 && (
            <span className="ml-1 font-mono text-[11px] bg-slate-900 text-white px-1.5 py-0.5 rounded-md tabular-nums">
              {budgetItems.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: CATÁLOGO DE COSTOS */}
      {activeTab === 'catalog' ? (
        <div className="space-y-4">
          {/* Search & Technology Filter */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar repuesto, insumo, proveedor o tecnología..."
                value={searchCatalog}
                onChange={(e) => setSearchCatalog(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl border-slate-200 bg-white"
              />
            </div>

            <div className="w-full sm:w-64">
              <Select value={techFilter} onValueChange={setTechFilter}>
                <SelectTrigger className="h-9 text-xs rounded-xl border-slate-200 bg-white">
                  <SelectValue placeholder="Todas las tecnologías" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="all">Todas las tecnologías</SelectItem>
                  {catalogTechTabs.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-16 flex flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p className="text-xs font-medium">Cargando catálogo de costos...</p>
            </div>
          ) : filteredCatalog.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
                <BookOpen className="h-6 w-6 text-slate-400" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  {catalogItems.length === 0
                    ? 'El catálogo de costos está vacío'
                    : 'No se encontraron ítems con los filtros actuales'}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Al registrar facturas con ítems y valor unitario, estos se guardarán aquí automáticamente con su historial de precios. También puedes agregar precios de referencia manualmente.
                </p>
              </div>
              {canCreate && (
                <Button
                  onClick={openNewCatalogModal}
                  className="rounded-xl h-10 px-5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Agregar Primer Ítem al Catálogo
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
              {filteredCatalog.map((item) => {
                const history = Array.isArray(item.priceHistory) ? item.priceHistory : [];
                const prevEntry = history.length >= 2 ? history[1] : null;
                const diffPct =
                  prevEntry && prevEntry.unitPrice > 0
                    ? ((item.lastUnitPrice - prevEntry.unitPrice) / prevEntry.unitPrice) * 100
                    : null;
                const isExpanded = Boolean(expandedHistory[item.id]);

                return (
                  <div key={item.id} className="hover:bg-slate-50/40 transition-colors">
                    <div className="p-4 px-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{item.name}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 tabular-nums">
                          <span className="font-medium text-slate-700">
                            {item.technologyType || 'General / Insumos'}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span>Último proveedor: {item.lastProviderName || 'N/A'}</span>
                          {item.lastPurchaseDate && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span className="font-mono">{item.lastPurchaseDate}</span>
                            </>
                          )}
                          <span className="text-slate-300">·</span>
                          <span>{history.length} registro(s)</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 shrink-0">
                        <div className="text-right tabular-nums">
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-base font-bold font-mono text-slate-900">
                              {formatCOP(item.lastUnitPrice)}
                            </span>
                            {diffPct !== null && Math.abs(diffPct) >= 0.1 && (
                              <span
                                className={cn(
                                  'inline-flex items-center gap-0.5 text-[11px] font-mono font-semibold',
                                  diffPct > 0 ? 'text-rose-600' : 'text-emerald-700'
                                )}
                                title="Variación frente al registro inmediatamente anterior"
                              >
                                {diffPct > 0 ? (
                                  <TrendingUp className="h-3 w-3" />
                                ) : (
                                  <TrendingDown className="h-3 w-3" />
                                )}
                                {diffPct > 0 ? `+${diffPct.toFixed(1)}%` : `${diffPct.toFixed(1)}%`}
                              </span>
                            )}
                          </div>
                          {typeof item.averagePrice === 'number' && item.averagePrice > 0 && (
                            <p className="text-[11px] text-slate-500 font-mono">
                              Prom: {formatCOP(item.averagePrice)} / {item.unit || 'Und'}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleAddCatalogToBudget(item, true)}
                            className="h-8 px-3 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white"
                          >
                            <Calculator className="h-3.5 w-3.5 mr-1.5" />
                            Presupuestar
                          </Button>

                          {history.length > 0 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setExpandedHistory((p) => ({ ...p, [item.id]: !p[item.id] }))
                              }
                              className="h-8 px-2.5 rounded-xl text-xs border-slate-200 text-slate-700"
                              title="Ver historial de precios y proveedores"
                            >
                              <History className="h-3.5 w-3.5 mr-1" />
                              {isExpanded ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronRight className="h-3 w-3" />
                              )}
                            </Button>
                          )}

                          {canEdit && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditCatalogModal(item)}
                              className="h-8 w-8 rounded-xl text-slate-500 hover:text-slate-900"
                              title="Editar ítem"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          )}

                          {canDelete && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setCatToDelete(item)}
                              className="h-8 w-8 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              title="Eliminar del catálogo"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {isExpanded && history.length > 0 && (
                      <div className="bg-slate-50/80 border-t border-slate-100 px-6 py-3">
                        <p className="text-[11px] font-semibold text-slate-600 mb-2">
                          Historial de Precios por Compra / Proveedor
                        </p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="text-slate-500 border-b border-slate-200">
                                <th className="py-1.5 pr-4 font-medium">Fecha</th>
                                <th className="py-1.5 pr-4 font-medium">Proveedor</th>
                                <th className="py-1.5 pr-4 font-medium">Factura / Origen</th>
                                <th className="py-1.5 text-right font-medium">Valor Unitario</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/60">
                              {history.map((h, i) => (
                                <tr key={i}>
                                  <td className="py-1.5 pr-4 font-mono text-slate-600 tabular-nums">
                                    {h.date}
                                  </td>
                                  <td className="py-1.5 pr-4 font-medium text-slate-800">
                                    {h.providerName}
                                  </td>
                                  <td className="py-1.5 pr-4 text-slate-600">
                                    {h.invoiceName || 'Registro'}
                                  </td>
                                  <td className="py-1.5 text-right font-mono font-bold text-slate-900 tabular-nums">
                                    {formatCOP(h.unitPrice)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* TAB 2: ARMADOR DE PRESUPUESTOS */
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {editingBudgetId ? 'Editando Presupuesto Guardado' : 'Simulador / Nuevo Presupuesto Aproximado'}
                </h2>
                <p className="text-xs text-slate-500">
                  Seleccione ítems del catálogo, ajuste las cantidades requeridas y obtenga el estimado con IVA y PDF para gerencia.
                </p>
              </div>
              <div className="text-right font-mono tabular-nums">
                <span className="text-[11px] text-slate-500 block">Total Presupuestado</span>
                <span className="text-xl font-bold text-emerald-700">{formatCOP(budgetTotal)}</span>
              </div>
            </div>

            {/* Metadata row */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-5 space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Nombre del Presupuesto *</Label>
                <Input
                  placeholder="Ej: Presupuesto Sensores y Baterías UCI - Q4"
                  value={budgetName}
                  onChange={(e) => setBudgetName(e.target.value)}
                  className="h-9 text-xs rounded-xl border-slate-200"
                />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Fecha</Label>
                <Input
                  type="date"
                  value={budgetDate}
                  onChange={(e) => setBudgetDate(e.target.value)}
                  className="h-9 text-xs font-mono rounded-xl border-slate-200"
                />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">IVA (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={50}
                  value={budgetIvaPct}
                  onChange={(e) => setBudgetIvaPct(e.target.value)}
                  className="h-9 text-xs font-mono rounded-xl border-slate-200"
                />
              </div>
              <div className="md:col-span-3 space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Justificación / Nota</Label>
                <Input
                  placeholder="Ej: Reposición trimestral de accesorios"
                  value={budgetDesc}
                  onChange={(e) => setBudgetDesc(e.target.value)}
                  className="h-9 text-xs rounded-xl border-slate-200"
                />
              </div>
            </div>

            {/* Add items to budget */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="text-xs font-semibold text-slate-700 shrink-0">
                  Agregar desde Catálogo:
                </span>
                <div className="flex-1">
                  <Select value={pickerCatalogId} onValueChange={handlePickerSelect}>
                    <SelectTrigger className="h-9 text-xs rounded-xl bg-white border-slate-200">
                      <SelectValue placeholder="Seleccione un ítem del catálogo de costos..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      <SelectItem value="__none__">— Elegir ítem del catálogo —</SelectItem>
                      {catalogItems.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} · {formatCOP(c.lastUnitPrice)} ({c.technologyType || 'General'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2 border-t border-slate-200/80">
                <div className="sm:col-span-4">
                  <Input
                    placeholder="O agregue ítem manual..."
                    value={customItemName}
                    onChange={(e) => setCustomItemName(e.target.value)}
                    className="h-9 text-xs rounded-xl bg-white"
                  />
                </div>
                <div className="sm:col-span-3">
                  <Input
                    list="budget-tech-list"
                    placeholder="Tecnología (ej: Bomba Infusión)"
                    value={customItemTech}
                    onChange={(e) => setCustomItemTech(e.target.value)}
                    className="h-9 text-xs rounded-xl bg-white"
                  />
                  <datalist id="budget-tech-list">
                    {technologyOptions.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </div>
                <div className="sm:col-span-2">
                  <Input
                    type="number"
                    min={1}
                    placeholder="Cant."
                    value={customItemQty}
                    onChange={(e) => setCustomItemQty(e.target.value)}
                    className="h-9 text-xs font-mono rounded-xl bg-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Input
                    type="number"
                    min={0}
                    placeholder="V. Unitario ($)"
                    value={customItemPrice}
                    onChange={(e) => setCustomItemPrice(e.target.value)}
                    className="h-9 text-xs font-mono rounded-xl bg-white"
                  />
                </div>
                <div className="sm:col-span-1">
                  <Button
                    type="button"
                    onClick={handleAddCustomBudgetItem}
                    disabled={!customItemName.trim()}
                    className="w-full h-9 rounded-xl px-0"
                    title="Agregar ítem manual al presupuesto"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Budget items table */}
            {budgetItems.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-slate-200 rounded-2xl text-xs text-slate-500">
                Agregue ítems desde el catálogo o manualmente arriba para calcular el costo aproximado según cantidades.
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-2.5">Ítem / Repuesto</th>
                        <th className="px-4 py-2.5">Tecnología</th>
                        <th className="px-4 py-2.5">Proveedor Ref.</th>
                        <th className="px-4 py-2.5 text-center w-24">Cantidad</th>
                        <th className="px-4 py-2.5 text-right w-36">V. Unitario ($)</th>
                        <th className="px-4 py-2.5 text-right w-36">Subtotal</th>
                        <th className="px-3 py-2.5 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {budgetItems.map((it) => (
                        <tr key={it.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2.5">
                            <Input
                              value={it.name}
                              onChange={(e) => handleUpdateBudgetItem(it.id, 'name', e.target.value)}
                              className="h-8 text-xs font-semibold rounded-lg border-transparent hover:border-slate-200 focus:border-slate-300 bg-transparent px-2"
                            />
                          </td>
                          <td className="px-4 py-2.5 text-slate-600">{it.technologyType || 'General'}</td>
                          <td className="px-4 py-2.5 text-slate-500">{it.referenceProvider || '-'}</td>
                          <td className="px-4 py-2.5">
                            <Input
                              type="number"
                              min={1}
                              value={it.quantity}
                              onChange={(e) => handleUpdateBudgetItem(it.id, 'quantity', e.target.value)}
                              className="h-8 text-xs font-mono text-center rounded-lg border-slate-200"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <Input
                              type="number"
                              min={0}
                              value={it.unitPrice}
                              onChange={(e) => handleUpdateBudgetItem(it.id, 'unitPrice', e.target.value)}
                              className="h-8 text-xs font-mono text-right rounded-lg border-slate-200"
                            />
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900 tabular-nums">
                            {formatCOP(it.totalPrice)}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setBudgetItems((p) => p.filter((x) => x.id !== it.id))}
                              className="h-7 w-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals Bar */}
                <div className="bg-slate-50 border-t border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums">
                    <span className="text-slate-600">
                      Subtotal: <strong className="text-slate-900">{formatCOP(budgetSubtotal)}</strong>
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-600">
                      IVA ({parsedIvaPct}%): <strong className="text-slate-900">{formatCOP(budgetIvaAmount)}</strong>
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="text-emerald-800 text-sm font-bold">
                      Total Estimado: {formatCOP(budgetTotal)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleExportCurrentBudgetCSV}
                      className="h-9 px-3 rounded-xl text-xs border-slate-300 bg-white"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5 text-emerald-700" />
                      Excel
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleExportCurrentBudgetPDF}
                      className="h-9 px-3 rounded-xl text-xs border-slate-300 bg-white"
                    >
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      Descargar PDF
                    </Button>
                    {canCreate && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={savingBudget}
                        onClick={handleSaveBudget}
                        className="h-9 px-4 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white"
                      >
                        {savingBudget ? (
                          <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Guardando...</>
                        ) : (
                          <><Save className="h-3.5 w-3.5 mr-1.5" /> Guardar Presupuesto</>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Saved Budgets List */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              Presupuestos Guardados ({budgets.length})
            </h3>
            {budgets.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
                Aún no hay presupuestos guardados. Arme uno arriba y guárdelo para consultarlo o exportarlo cuando lo necesite.
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden">
                {budgets.map((b) => (
                  <div
                    key={b.id}
                    className="p-4 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                  >
                    <div className="space-y-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{b.name}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 tabular-nums">
                        <span className="font-mono text-slate-700">{b.date}</span>
                        <span className="text-slate-300">·</span>
                        <span>{(b.items || []).length} ítems</span>
                        <span className="text-slate-300">·</span>
                        <span>IVA {b.ivaPercentage || 0}%</span>
                        {b.description && (
                          <>
                            <span className="text-slate-300">·</span>
                            <span className="truncate max-w-xs">{b.description}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <span className="font-mono text-sm font-bold text-emerald-700 tabular-nums mr-2">
                        {formatCOP(b.totalAmount)}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleLoadBudget(b)}
                        className="h-8 px-3 rounded-xl text-xs border-slate-200"
                      >
                        Cargar / Editar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => generateBudgetPDF(b)}
                        className="h-8 px-2.5 rounded-xl text-xs border-slate-200"
                        title="Descargar PDF Presupuesto"
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        PDF
                      </Button>
                      {canDelete && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setBudgetToDelete(b)}
                          className="h-8 w-8 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual Catalog Item Modal */}
      <Dialog open={catModalOpen} onOpenChange={(o) => !savingCat && setCatModalOpen(o)}>
        <DialogContent className="max-w-lg rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              {editingCat ? 'Editar Ítem del Catálogo' : 'Agregar Ítem al Catálogo de Costos'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Registre el costo de referencia de un repuesto, accesorio o servicio para validaciones y presupuestos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Descripción del Ítem *</Label>
              <Input
                placeholder="Ej: Sensor de Flujo Ventilador SV300"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                className="h-10 text-xs rounded-xl border-slate-200"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Tecnología Asociada</Label>
                <Input
                  list="cat-tech-suggestions"
                  value={catTech}
                  onChange={(e) => setCatTech(e.target.value)}
                  className="h-10 text-xs rounded-xl border-slate-200"
                />
                <datalist id="cat-tech-suggestions">
                  {technologyOptions.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Valor Unitario ($ COP) *</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={catPrice}
                  onChange={(e) => setCatPrice(e.target.value)}
                  className="h-10 text-xs font-mono rounded-xl border-slate-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Proveedor de Referencia</Label>
                <Input
                  list="cat-prov-suggestions"
                  placeholder="Nombre proveedor"
                  value={catProviderName}
                  onChange={(e) => setCatProviderName(e.target.value)}
                  className="h-10 text-xs rounded-xl border-slate-200"
                />
                <datalist id="cat-prov-suggestions">
                  {providers.map((p) => (
                    <option key={p.id} value={p.name} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Unidad</Label>
                <Input
                  placeholder="Und, Caja, Kit..."
                  value={catUnit}
                  onChange={(e) => setCatUnit(e.target.value)}
                  className="h-10 text-xs rounded-xl border-slate-200"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Notas</Label>
              <Textarea
                rows={2}
                placeholder="Referencia, número de parte o condiciones de cotización..."
                value={catNotes}
                onChange={(e) => setCatNotes(e.target.value)}
                className="text-xs rounded-xl border-slate-200"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={savingCat}
              onClick={() => setCatModalOpen(false)}
              className="rounded-xl text-xs h-10"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={savingCat || !catName.trim()}
              onClick={handleSaveCatalogItem}
              className="rounded-xl text-xs h-10 bg-slate-900 hover:bg-slate-800 text-white"
            >
              {savingCat ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Guardando...</>
              ) : (
                'Guardar en Catálogo'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={Boolean(catToDelete || budgetToDelete)}
        onClose={() => !deleting && (setCatToDelete(null), setBudgetToDelete(null))}
        onConfirm={handleDeleteConfirm}
        title={catToDelete ? 'Eliminar Ítem del Catálogo' : 'Eliminar Presupuesto'}
        description={
          catToDelete
            ? `¿Seguro que desea eliminar "${catToDelete.name}" del catálogo de costos?`
            : `¿Seguro que desea eliminar el presupuesto "${budgetToDelete?.name}"?`
        }
        confirmText="Eliminar"
        variant="danger"
        icon="trash"
        isLoading={deleting}
      />

      {/* Feedback */}
      <FeedbackModal
        isOpen={feedback.open}
        onClose={() => setFeedback((p) => ({ ...p, open: false }))}
        title={feedback.title}
        message={feedback.message}
        type={feedback.type}
      />
    </div>
  );
}
