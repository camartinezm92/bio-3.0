import * as React from 'react';
import {
  Receipt,
  Plus,
  Search,
  Building2,
  FolderOpen,
  ExternalLink,
  Download,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  ChevronDown,
  ChevronRight,
  LayoutList,
  Layers,
  CheckSquare,
  HardDrive,
  Loader2
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Invoice, Provider } from '@/types';
import { useAuth } from '@/lib/AuthContext';
import { useTechnologyScope } from '@/lib/TechnologyScopeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { ConfirmModal, FeedbackModal } from '@/components/ui/ConfirmModal';
import { InvoiceModal } from '@/components/invoices/InvoiceModal';
import { generateInvoiceReportPDF } from '@/lib/pdfGenerator';
import { formatCOP } from '@/lib/financialUtils';
import { cn } from '@/lib/utils';

type StatusFilter = 'all' | 'pendiente' | 'parcial' | 'completa';
type ViewMode = 'grouped' | 'list';

export default function Invoices() {
  const { user } = useAuth();
  const { scope, scopeConfig, filterByScope } = useTechnologyScope();

  const [loading, setLoading] = React.useState(true);
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [providers, setProviders] = React.useState<Provider[]>([]);

  // Filters & view state
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [providerFilter, setProviderFilter] = React.useState<string>('all');
  const [viewMode, setViewMode] = React.useState<ViewMode>('grouped');
  const [collapsedProviders, setCollapsedProviders] = React.useState<Record<string, boolean>>({});

  // Modals
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingInvoice, setEditingInvoice] = React.useState<Invoice | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = React.useState<Invoice | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{
    open: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  }>({
    open: false,
    title: '',
    message: '',
    type: 'info'
  });

  const isAdmin = user?.role?.toUpperCase() === 'ADMIN';
  const canCreate = isAdmin || user?.permissions?.invoices?.create !== false;
  const canEdit = isAdmin || user?.permissions?.invoices?.edit !== false;
  const canDelete = isAdmin || Boolean(user?.permissions?.invoices?.delete);

  // Real-time listeners for invoices & providers
  React.useEffect(() => {
    const qInvoices = query(collection(db, 'invoices'), orderBy('date', 'desc'));
    const unsubInvoices = onSnapshot(
      qInvoices,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data()
        })) as Invoice[];
        setInvoices(list);
        setLoading(false);
      },
      (error) => {
        console.warn('Invoices snapshot error:', error);
        setLoading(false);
      }
    );

    const qProviders = query(collection(db, 'providers'), orderBy('name', 'asc'));
    const unsubProviders = onSnapshot(
      qProviders,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data()
        })) as Provider[];
        setProviders(list);
      },
      (error) => {
        console.warn('Providers snapshot error in Invoices:', error);
      }
    );

    return () => {
      unsubInvoices();
      unsubProviders();
    };
  }, []);

  // Scope filtering (respects selected technology scope, or shows all in 'all' mode)
  const scopedInvoices = React.useMemo(() => {
    if (scope === 'all') return invoices;
    return filterByScope(invoices);
  }, [invoices, scope, filterByScope]);

  // Metrics
  const stats = React.useMemo(() => {
    const total = scopedInvoices.length;
    const pending = scopedInvoices.filter((i) => i.status === 'pendiente').length;
    const partial = scopedInvoices.filter((i) => i.status === 'parcial').length;
    const complete = scopedInvoices.filter((i) => i.status === 'completa').length;
    const pendingItemsTotal = scopedInvoices.reduce((acc, inv) => {
      const items = Array.isArray(inv.items) ? inv.items : [];
      return acc + items.filter((it) => !it.completed).length;
    }, 0);
    const totalAmount = scopedInvoices.reduce((acc, inv) => acc + (Number(inv.totalAmount) || 0), 0);
    return { total, pending, partial, complete, pendingItemsTotal, totalAmount };
  }, [scopedInvoices]);

  // Filtered invoices
  const filteredInvoices = React.useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return scopedInvoices.filter((inv) => {
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      if (providerFilter !== 'all' && inv.providerId !== providerFilter) return false;
      if (!q) return true;

      const matchName = inv.name?.toLowerCase().includes(q);
      const matchProv = inv.providerName?.toLowerCase().includes(q);
      const matchDate = inv.date?.toLowerCase().includes(q);
      const matchItem =
        Array.isArray(inv.items) &&
        inv.items.some((it) => it.name?.toLowerCase().includes(q));
      return Boolean(matchName || matchProv || matchDate || matchItem);
    });
  }, [scopedInvoices, statusFilter, providerFilter, searchTerm]);

  // Grouped by provider
  const groupedByProvider = React.useMemo(() => {
    const map = new Map<
      string,
      {
        providerId: string;
        providerName: string;
        invoices: Invoice[];
        pendingItems: number;
        completeCount: number;
        totalBilled: number;
      }
    >();

    for (const inv of filteredInvoices) {
      const key = inv.providerId || inv.providerName || 'sin-proveedor';
      const existing = map.get(key);
      const invPendingItems = Array.isArray(inv.items)
        ? inv.items.filter((it) => !it.completed).length
        : 0;
      const isComplete = inv.status === 'completa' ? 1 : 0;
      const amt = Number(inv.totalAmount) || 0;

      if (existing) {
        existing.invoices.push(inv);
        existing.pendingItems += invPendingItems;
        existing.completeCount += isComplete;
        existing.totalBilled += amt;
      } else {
        map.set(key, {
          providerId: key,
          providerName: inv.providerName || 'Proveedor sin asignar',
          invoices: [inv],
          pendingItems: invPendingItems,
          completeCount: isComplete,
          totalBilled: amt
        });
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.providerName.localeCompare(b.providerName, 'es')
    );
  }, [filteredInvoices]);

  const toggleProviderCollapse = (key: string) => {
    setCollapsedProviders((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleOpenNew = () => {
    setEditingInvoice(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (inv: Invoice) => {
    setEditingInvoice(inv);
    setModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!invoiceToDelete) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'invoices', invoiceToDelete.id));
      setInvoiceToDelete(null);
      setFeedback({
        open: true,
        type: 'success',
        title: 'Factura eliminada',
        message: 'El registro de seguimiento fue eliminado de la base de datos.'
      });
    } catch (error: any) {
      console.error('Error deleting invoice:', error);
      setFeedback({
        open: true,
        type: 'error',
        title: 'Error al eliminar',
        message: error?.message || 'No se pudo eliminar el registro.'
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleSavedFeedback = (saved: Invoice, generatedCompletePdf: boolean) => {
    if (generatedCompletePdf) {
      setFeedback({
        open: true,
        type: 'success',
        title: 'Factura Completada al 100%',
        message: `Todos los ítems de "${saved.name}" fueron entregados. Se generó, descargó y archivó el PDF Completo en Google Drive dentro de Facturas / ${saved.providerName}.`
      });
    } else {
      const pending = Array.isArray(saved.items)
        ? saved.items.filter((i) => !i.completed).length
        : 0;
      setFeedback({
        open: true,
        type: 'info',
        title: 'Seguimiento de Factura Guardado',
        message:
          pending > 0
            ? `La factura "${saved.name}" quedó registrada con ${pending} ítem(s) pendiente(s) por entrega en la carpeta de ${saved.providerName}.`
            : `La factura "${saved.name}" se guardó correctamente en Google Drive.`
      });
    }
  };

  const getStatusLabel = (status: Invoice['status']) => {
    switch (status) {
      case 'completa':
        return {
          text: 'Completa',
          classes: 'bg-emerald-50 text-emerald-700 border-emerald-200'
        };
      case 'parcial':
        return {
          text: 'Parcial',
          classes: 'bg-amber-50 text-amber-800 border-amber-200'
        };
      case 'pendiente':
      default:
        return {
          text: 'Pendiente',
          classes: 'bg-rose-50 text-rose-700 border-rose-200'
        };
    }
  };

  const getItemStats = (inv: Invoice) => {
    const items = Array.isArray(inv.items) ? inv.items : [];
    const total = items.length;
    const completed = items.filter((i) => i.completed).length;
    const pendingList = items.filter((i) => !i.completed);
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pendingList, pct };
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Control de Facturas y Entregas
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Seguimiento por proveedor de soportes, ítems recibidos y pendientes · Estructura Drive:{' '}
            <span className="font-mono text-xs text-slate-700">Facturas / Proveedor / Fecha - Factura</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {canCreate && (
            <Button
              onClick={handleOpenNew}
              className="rounded-xl h-10 px-4 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Nueva Factura
            </Button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Facturado</span>
            <Receipt className="h-4 w-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 tabular-nums font-mono">
              {formatCOP(stats.totalAmount)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
            {stats.total} {stats.total === 1 ? 'factura' : 'facturas'} · {scopeConfig.shortLabel}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Pendientes</span>
            <AlertCircle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-700 tabular-nums">{stats.pending}</span>
            <span className="text-xs text-slate-500">sin entregas</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Entregas Parciales</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-700 tabular-nums">{stats.partial}</span>
            <span className="text-xs text-slate-500 tabular-nums">
              · {stats.pendingItemsTotal} ítems pendientes
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Completadas 100%</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-700 tabular-nums">{stats.complete}</span>
            <span className="text-xs text-slate-500">con PDF final</span>
          </div>
        </div>
      </div>

      {/* Filters & Toolbar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Segmented status filter */}
          <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200 self-start">
            {(
              [
                { id: 'all', label: `Todas (${stats.total})` },
                { id: 'pendiente', label: `Pendientes (${stats.pending})` },
                { id: 'parcial', label: `Parciales (${stats.partial})` },
                { id: 'completa', label: `Completas (${stats.complete})` }
              ] as { id: StatusFilter; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors tabular-nums',
                  statusFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search, provider filter & view mode */}
          <div className="flex flex-wrap items-center gap-2.5 flex-1 lg:justify-end">
            <div className="relative flex-1 min-w-[210px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar factura, proveedor o ítem..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl border-slate-200 bg-white"
              />
            </div>

            <div className="w-52">
              <Select value={providerFilter} onValueChange={setProviderFilter}>
                <SelectTrigger className="h-9 text-xs rounded-xl border-slate-200 bg-white">
                  <SelectValue placeholder="Todos los proveedores" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="all">Todos los proveedores</SelectItem>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('grouped')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors',
                  viewMode === 'grouped'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
                title="Agrupado por proveedor (como las carpetas de Drive)"
              >
                <Layers className="h-3.5 w-3.5" />
                Por Proveedor
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors',
                  viewMode === 'list'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
                title="Listado general cronológico"
              >
                <LayoutList className="h-3.5 w-3.5" />
                Listado
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-16 flex flex-col items-center justify-center gap-3 text-slate-500">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="text-xs font-medium">Cargando control de facturas...</p>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
            <Receipt className="h-6 w-6 text-slate-400" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-slate-900">
              {scopedInvoices.length === 0
                ? 'No hay facturas registradas aún'
                : 'No hay facturas que coincidan con los filtros'}
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              {scopedInvoices.length === 0
                ? 'Registre una factura seleccionando el proveedor, adjunte la imagen o PDF, y agregue los ítems para controlar entregas parciales y archivar el PDF final en Drive.'
                : 'Ajuste los filtros de estado, proveedor o búsqueda para visualizar otras facturas.'}
            </p>
          </div>
          {scopedInvoices.length === 0 && canCreate ? (
            <Button
              onClick={handleOpenNew}
              className="rounded-xl h-10 px-5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Registrar Primera Factura
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setProviderFilter('all');
              }}
              className="rounded-xl h-9 px-4 text-xs font-semibold border-slate-300"
            >
              Limpiar filtros
            </Button>
          )}
        </div>
      ) : viewMode === 'grouped' ? (
        /* Vista Agrupada por Proveedor */
        <div className="space-y-4">
          {groupedByProvider.map((group) => {
            const isCollapsed = Boolean(collapsedProviders[group.providerId]);
            return (
              <div
                key={group.providerId}
                className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
              >
                {/* Provider Group Header */}
                <button
                  type="button"
                  onClick={() => toggleProviderCollapse(group.providerId)}
                  className="w-full px-5 py-3.5 bg-slate-50/70 hover:bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-left transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                    )}
                    <div className="h-8 w-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                      <Building2 className="h-4 w-4 text-slate-700" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 truncate">
                          {group.providerName}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-mono truncate">
                        Drive: Facturas / {group.providerName}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-600 tabular-nums shrink-0">
                    {group.totalBilled > 0 && (
                      <>
                        <span className="font-mono font-bold text-slate-900">
                          {formatCOP(group.totalBilled)}
                        </span>
                        <span className="text-slate-300">·</span>
                      </>
                    )}
                    <span>
                      <strong className="text-slate-900">{group.invoices.length}</strong>{' '}
                      {group.invoices.length === 1 ? 'factura' : 'facturas'}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span>
                      <strong className="text-emerald-700">{group.completeCount}</strong> completadas
                    </span>
                    {group.pendingItems > 0 && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span className="font-semibold text-amber-700">
                          {group.pendingItems} ítem(s) por recibir
                        </span>
                      </>
                    )}
                  </div>
                </button>

                {/* Invoices inside Provider */}
                {!isCollapsed && (
                  <div className="divide-y divide-slate-100">
                    {group.invoices.map((inv) => {
                      const st = getStatusLabel(inv.status);
                      const { total, completed, pendingList, pct } = getItemStats(inv);
                      return (
                        <div
                          key={inv.id}
                          className="p-4 px-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
                        >
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2.5">
                              <span className="text-sm font-bold text-slate-900">{inv.name}</span>
                              <span
                                className={cn(
                                  'text-[11px] font-semibold px-2 py-0.5 rounded-md border',
                                  st.classes
                                )}
                              >
                                {st.text}
                              </span>
                              {typeof inv.totalAmount === 'number' && inv.totalAmount > 0 && (
                                <span className="font-mono text-xs font-bold text-slate-900 tabular-nums">
                                  {formatCOP(inv.totalAmount)}
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 tabular-nums">
                              <span className="font-mono text-slate-700">{inv.date}</span>
                              {inv.expenseCategory && (
                                <>
                                  <span className="text-slate-300">·</span>
                                  <span>{inv.expenseCategory}</span>
                                </>
                              )}
                              <span className="text-slate-300">·</span>
                              <span>
                                {completed}/{total} ítems entregados ({pct}%)
                              </span>
                              {inv.originalFileName && (
                                <>
                                  <span className="text-slate-300">·</span>
                                  <span className="truncate max-w-[200px] font-mono text-[11px]">
                                    {inv.originalFileName}
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Pending items quick summary */}
                            {pendingList.length > 0 && (
                              <p className="text-xs text-rose-700 truncate">
                                <span className="font-semibold">Pendientes:</span>{' '}
                                {pendingList
                                  .slice(0, 3)
                                  .map((it) => `${it.name}${it.quantity && it.quantity > 1 ? ` (x${it.quantity})` : ''}`)
                                  .join(', ')}
                                {pendingList.length > 3 ? ` y ${pendingList.length - 3} más` : ''}
                              </p>
                            )}
                          </div>

                          {/* Progress bar + Actions */}
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <div className="hidden sm:flex items-center gap-2 mr-2">
                              <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className={cn(
                                    'h-full rounded-full transition-all',
                                    inv.status === 'completa'
                                      ? 'bg-emerald-600'
                                      : inv.status === 'parcial'
                                        ? 'bg-amber-500'
                                        : 'bg-rose-500'
                                  )}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs font-mono text-slate-600 tabular-nums w-9 text-right">
                                {pct}%
                              </span>
                            </div>

                            {canEdit && (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleOpenEdit(inv)}
                                className="h-8 px-3 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white"
                              >
                                <CheckSquare className="h-3.5 w-3.5 mr-1.5" />
                                Gestionar / Ítems
                              </Button>
                            )}

                            {inv.originalFileUrl && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(inv.originalFileUrl, '_blank')}
                                className="h-8 px-2.5 rounded-xl text-xs border-slate-200 text-slate-700"
                                title="Ver soporte original (Imagen o PDF)"
                              >
                                <FileText className="h-3.5 w-3.5 mr-1" />
                                Soporte
                              </Button>
                            )}

                            {inv.driveFolderUrl && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(inv.driveFolderUrl, '_blank')}
                                className="h-8 px-2.5 rounded-xl text-xs border-slate-200 text-slate-700"
                                title="Abrir carpeta de esta factura en Google Drive"
                              >
                                <FolderOpen className="h-3.5 w-3.5 mr-1 text-amber-600" />
                                Drive
                              </Button>
                            )}

                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (inv.completePdfUrl && inv.status === 'completa') {
                                  window.open(inv.completePdfUrl, '_blank');
                                } else {
                                  generateInvoiceReportPDF(inv, false);
                                }
                              }}
                              className="h-8 px-2.5 rounded-xl text-xs border-slate-200 text-slate-700"
                              title={
                                inv.status === 'completa'
                                  ? 'Abrir / Descargar PDF Completo'
                                  : 'Descargar PDF de Seguimiento Actual'
                              }
                            >
                              <Download className="h-3.5 w-3.5 mr-1" />
                              PDF
                            </Button>

                            {canDelete && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setInvoiceToDelete(inv)}
                                className="h-8 w-8 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                title="Eliminar registro"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Vista Listado General */
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Factura</th>
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3">Progreso Ítems</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => {
                  const st = getStatusLabel(inv.status);
                  const { total, completed, pct } = getItemStats(inv);
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3.5 font-mono text-slate-700 tabular-nums whitespace-nowrap">
                        {inv.date}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900">{inv.name}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[220px]">
                          {[inv.expenseCategory, inv.originalFileName].filter(Boolean).join(' · ')}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-700">
                        {inv.providerName}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                        {typeof inv.totalAmount === 'number' && inv.totalAmount > 0 ? formatCOP(inv.totalAmount) : '-'}
                      </td>
                      <td className="px-4 py-3.5 tabular-nums">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                inv.status === 'completa'
                                  ? 'bg-emerald-600'
                                  : inv.status === 'parcial'
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500'
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-slate-600 font-mono">
                            {completed}/{total}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={cn(
                            'text-[11px] font-semibold px-2 py-0.5 rounded-md border',
                            st.classes
                          )}
                        >
                          {st.text}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {canEdit && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleOpenEdit(inv)}
                              className="h-7 px-2.5 rounded-lg text-[11px] font-semibold bg-slate-900 hover:bg-slate-800 text-white"
                            >
                              Gestionar
                            </Button>
                          )}
                          {inv.originalFileUrl && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(inv.originalFileUrl, '_blank')}
                              className="h-7 px-2 rounded-lg text-[11px] border-slate-200"
                              title="Ver soporte"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          )}
                          {inv.driveFolderUrl && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(inv.driveFolderUrl, '_blank')}
                              className="h-7 px-2 rounded-lg text-[11px] border-slate-200"
                              title="Abrir en Drive"
                            >
                              <HardDrive className="h-3 w-3 text-amber-600" />
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => generateInvoiceReportPDF(inv, false)}
                            className="h-7 px-2 rounded-lg text-[11px] border-slate-200"
                            title="Descargar PDF"
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                          {canDelete && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setInvoiceToDelete(inv)}
                              className="h-7 w-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                              title="Eliminar"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoice Create/Edit Modal */}
      <InvoiceModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        existingInvoice={editingInvoice}
        providers={providers}
        onSaved={handleSavedFeedback}
      />

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={Boolean(invoiceToDelete)}
        onClose={() => !deleting && setInvoiceToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Eliminar Registro de Factura"
        description={`¿Está seguro de eliminar "${invoiceToDelete?.name}" (${invoiceToDelete?.providerName}) del seguimiento? Los archivos ya guardados en Google Drive permanecerán intactos.`}
        confirmText="Eliminar Factura"
        variant="danger"
        icon="trash"
        isLoading={deleting}
      />

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={feedback.open}
        onClose={() => setFeedback((prev) => ({ ...prev, open: false }))}
        title={feedback.title}
        message={feedback.message}
        type={feedback.type}
      />
    </div>
  );
}
