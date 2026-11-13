import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet,
  Calendar,
  TrendingUp,
  Building2,
  Cpu,
  Download,
  FileSpreadsheet,
  Search,
  Receipt,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  ArrowRight
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Invoice, Provider } from '@/types';
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
import { EXPENSE_CATEGORIES, formatCOP } from '@/lib/financialUtils';
import { generateExpensesReportPDF, generateInvoiceReportPDF } from '@/lib/pdfGenerator';
import { cn } from '@/lib/utils';

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre'
];

type ExpenseTab = 'monthly' | 'technology' | 'providers' | 'invoices';

export default function Expenses() {
  const navigate = useNavigate();
  const { scope, scopeConfig, filterByScope } = useTechnologyScope();

  const [loading, setLoading] = React.useState(true);
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [providers, setProviders] = React.useState<Provider[]>([]);

  const currentYear = String(new Date().getFullYear());
  const [selectedYear, setSelectedYear] = React.useState<string>(currentYear);
  const [selectedMonth, setSelectedMonth] = React.useState<string>('all'); // 'all' | '01'..'12'
  const [selectedProvider, setSelectedProvider] = React.useState<string>('all');
  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');
  const [searchTerm, setSearchTerm] = React.useState<string>('');
  const [activeTab, setActiveTab] = React.useState<ExpenseTab>('monthly');
  const [expandedTech, setExpandedTech] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    const qInv = query(collection(db, 'invoices'), orderBy('date', 'desc'));
    const unsubInv = onSnapshot(
      qInv,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Invoice[];
        setInvoices(list);
        setLoading(false);
      },
      (err) => {
        console.warn('Expenses invoices snapshot error:', err);
        setLoading(false);
      }
    );

    const qProv = query(collection(db, 'providers'), orderBy('name', 'asc'));
    const unsubProv = onSnapshot(
      qProv,
      (snap) => {
        setProviders(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Provider[]);
      },
      (err) => {
        console.warn('Expenses providers snapshot error:', err);
      }
    );

    return () => {
      unsubInv();
      unsubProv();
    };
  }, []);

  const scopedInvoices = React.useMemo(() => {
    if (scope === 'all') return invoices;
    return filterByScope(invoices);
  }, [invoices, scope, filterByScope]);

  // Available years from invoices + current year
  const availableYears = React.useMemo(() => {
    const years = new Set<string>([currentYear]);
    for (const inv of scopedInvoices) {
      const y = (inv.date || '').slice(0, 4);
      if (/^\d{4}$/.test(y)) years.add(y);
    }
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [scopedInvoices, currentYear]);

  // Invoices filtered by Year, Provider, Category, Search (for 12-month bar chart)
  const yearFilteredInvoices = React.useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return scopedInvoices.filter((inv) => {
      if (selectedYear !== 'all' && !(inv.date || '').startsWith(selectedYear)) return false;
      if (selectedProvider !== 'all' && inv.providerId !== selectedProvider) return false;
      if (selectedCategory !== 'all' && (inv.expenseCategory || 'Repuestos e Insumos') !== selectedCategory) return false;
      if (!q) return true;

      const matchBasic =
        inv.name?.toLowerCase().includes(q) ||
        inv.providerName?.toLowerCase().includes(q) ||
        inv.expenseCategory?.toLowerCase().includes(q);
      const matchItem =
        Array.isArray(inv.items) &&
        inv.items.some(
          (it) =>
            it.name?.toLowerCase().includes(q) ||
            it.technologyType?.toLowerCase().includes(q) ||
            it.equipmentName?.toLowerCase().includes(q)
        );
      return Boolean(matchBasic || matchItem);
    });
  }, [scopedInvoices, selectedYear, selectedProvider, selectedCategory, searchTerm]);

  // Period filtered invoices (also applies Month filter)
  const periodInvoices = React.useMemo(() => {
    if (selectedMonth === 'all') return yearFilteredInvoices;
    return yearFilteredInvoices.filter((inv) => (inv.date || '').slice(5, 7) === selectedMonth);
  }, [yearFilteredInvoices, selectedMonth]);

  // 12-month aggregation (across yearFilteredInvoices)
  const monthlyStats = React.useMemo(() => {
    const buckets = MONTH_NAMES.map((name, idx) => ({
      monthKey: String(idx + 1).padStart(2, '0'),
      month: name,
      shortMonth: name.slice(0, 3),
      count: 0,
      total: 0
    }));

    for (const inv of yearFilteredInvoices) {
      const mStr = (inv.date || '').slice(5, 7);
      const mIdx = Number(mStr) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        buckets[mIdx].count += 1;
        buckets[mIdx].total += Number(inv.totalAmount) || 0;
      }
    }

    const yearTotal = buckets.reduce((acc, b) => acc + b.total, 0);
    const maxMonth = Math.max(1, ...buckets.map((b) => b.total));
    const activeMonths = buckets.filter((b) => b.total > 0).length;

    return {
      rows: buckets.map((b) => ({
        ...b,
        sharePct: yearTotal > 0 ? (b.total / yearTotal) * 100 : 0,
        barPct: (b.total / maxMonth) * 100
      })),
      yearTotal,
      monthlyAvg: activeMonths > 0 ? yearTotal / activeMonths : 0
    };
  }, [yearFilteredInvoices]);

  // Period totals
  const periodSummary = React.useMemo(() => {
    let totalSpent = 0;
    let completeSpent = 0;
    let inProgressSpent = 0;
    for (const inv of periodInvoices) {
      const amt = Number(inv.totalAmount) || 0;
      totalSpent += amt;
      if (inv.status === 'completa') completeSpent += amt;
      else inProgressSpent += amt;
    }
    return {
      totalSpent,
      completeSpent,
      inProgressSpent,
      invoiceCount: periodInvoices.length
    };
  }, [periodInvoices]);

  // Aggregation by Provider
  const providerStats = React.useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        count: number;
        completeCount: number;
        pendingCount: number;
        total: number;
      }
    >();

    for (const inv of periodInvoices) {
      const key = inv.providerId || inv.providerName || 'sin-proveedor';
      const amt = Number(inv.totalAmount) || 0;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        if (inv.status === 'completa') existing.completeCount += 1;
        else existing.pendingCount += 1;
        existing.total += amt;
      } else {
        map.set(key, {
          id: key,
          name: inv.providerName || 'Proveedor sin asignar',
          count: 1,
          completeCount: inv.status === 'completa' ? 1 : 0,
          pendingCount: inv.status === 'completa' ? 0 : 1,
          total: amt
        });
      }
    }

    const total = periodSummary.totalSpent || 1;
    return Array.from(map.values())
      .map((p) => ({
        ...p,
        sharePct: periodSummary.totalSpent > 0 ? (p.total / total) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total);
  }, [periodInvoices, periodSummary.totalSpent]);

  // Aggregation by Technology Type (Ventilador, Monitor, Bomba de Infusión, etc.)
  const technologyStats = React.useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        itemCount: number;
        total: number;
        details: {
          date: string;
          invoiceName: string;
          providerName: string;
          itemName: string;
          equipmentName?: string;
          quantity: number;
          totalPrice: number;
        }[];
      }
    >();

    const addToTech = (
      techName: string,
      amount: number,
      detail?: {
        date: string;
        invoiceName: string;
        providerName: string;
        itemName: string;
        equipmentName?: string;
        quantity: number;
        totalPrice: number;
      }
    ) => {
      const key = techName.trim() || 'General / Insumos';
      const existing = map.get(key);
      if (existing) {
        existing.total += amount;
        if (detail) {
          existing.itemCount += 1;
          existing.details.push(detail);
        }
      } else {
        map.set(key, {
          name: key,
          itemCount: detail ? 1 : 0,
          total: amount,
          details: detail ? [detail] : []
        });
      }
    };

    for (const inv of periodInvoices) {
      const items = Array.isArray(inv.items) ? inv.items : [];
      let itemizedSum = 0;

      for (const it of items) {
        const qty = Number(it.quantity) || 1;
        const unitP = Number(it.unitPrice) || 0;
        const lineTotal = typeof it.totalPrice === 'number' ? it.totalPrice : qty * unitP;
        itemizedSum += lineTotal;

        if (lineTotal > 0 || it.technologyType) {
          addToTech(it.technologyType || it.equipmentName || 'General / Insumos', lineTotal, {
            date: inv.date,
            invoiceName: inv.name,
            providerName: inv.providerName,
            itemName: it.name,
            equipmentName: it.equipmentName,
            quantity: qty,
            totalPrice: lineTotal
          });
        }
      }

      const invTotal = Number(inv.totalAmount) || 0;
      const remainder = invTotal - itemizedSum;
      if (remainder > 1) {
        addToTech('IVA / Otros Cargos o Sin Desglose', remainder, {
          date: inv.date,
          invoiceName: inv.name,
          providerName: inv.providerName,
          itemName: itemizedSum > 0 ? 'IVA / Ajustes de factura' : `Total factura (${inv.expenseCategory || 'General'})`,
          quantity: 1,
          totalPrice: remainder
        });
      }
    }

    const grandTotal = Array.from(map.values()).reduce((s, t) => s + t.total, 0) || 1;
    return Array.from(map.values())
      .map((t) => ({
        ...t,
        sharePct: grandTotal > 0 ? (t.total / grandTotal) * 100 : 0
      }))
      .sort((a, b) => b.total - a.total);
  }, [periodInvoices]);

  const topTech = technologyStats.find(
    (t) => t.name !== 'IVA / Otros Cargos o Sin Desglose' && t.total > 0
  ) || technologyStats[0];

  const selectedMonthLabel =
    selectedMonth === 'all'
      ? 'Todo el año'
      : MONTH_NAMES[Number(selectedMonth) - 1] || selectedMonth;

  const handleExportPDF = () => {
    generateExpensesReportPDF({
      year: selectedYear === 'all' ? 'Todos' : selectedYear,
      monthLabel: selectedMonthLabel,
      scopeLabel: scopeConfig.shortLabel,
      totalSpent: periodSummary.totalSpent,
      invoiceCount: periodSummary.invoiceCount,
      completeSpent: periodSummary.completeSpent,
      inProgressSpent: periodSummary.inProgressSpent,
      monthlyRows: monthlyStats.rows.map((r) => ({
        month: r.month,
        count: r.count,
        total: r.total,
        sharePct: r.sharePct
      })),
      providerRows: providerStats.map((p) => ({
        name: p.name,
        count: p.count,
        total: p.total,
        sharePct: p.sharePct
      })),
      techRows: technologyStats.map((t) => ({
        name: t.name,
        itemCount: t.itemCount,
        total: t.total,
        sharePct: t.sharePct
      }))
    });
  };

  const handleExportCSV = () => {
    const headers = [
      'Fecha',
      'Factura',
      'Proveedor',
      'Categoria',
      'Estado',
      'Subtotal',
      'IVA',
      'Total Factura',
      'Detalle Tecnologia / Items'
    ];
    const rows = periodInvoices.map((inv) => {
      const itemsDesc = (inv.items || [])
        .map(
          (it) =>
            `${it.name} (${it.technologyType || 'General'} x${it.quantity || 1}: ${it.totalPrice || 0})`
        )
        .join(' | ');
      return [
        inv.date || '',
        inv.name || '',
        inv.providerName || '',
        inv.expenseCategory || '',
        inv.status || '',
        String(inv.subtotalAmount || 0),
        String(inv.ivaAmount || 0),
        String(inv.totalAmount || 0),
        itemsDesc
      ];
    });

    const escapeCsv = (val: string) => `"${String(val).replace(/"/g, '""')}"`;
    const csvContent =
      '\uFEFF' + [headers, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Gastos_${selectedYear}_${selectedMonthLabel.replace(/\s+/g, '_')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Control de Gastos e Inversión
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Seguimiento mes a mes, por proveedor y por tecnología alimentado automáticamente desde Facturas · {scopeConfig.shortLabel}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleExportCSV}
            disabled={periodInvoices.length === 0}
            className="rounded-xl h-9 px-3.5 text-xs font-semibold border-slate-200 bg-white"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5 text-emerald-700" />
            Exportar Excel
          </Button>
          <Button
            type="button"
            onClick={handleExportPDF}
            disabled={periodInvoices.length === 0}
            className="rounded-xl h-9 px-4 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Descargar PDF
          </Button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar ítem, tecnología, factura..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl border-slate-200 bg-white"
            />
          </div>

          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="h-9 text-xs rounded-xl border-slate-200 bg-white">
              <SelectValue placeholder="Año" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los años</SelectItem>
              {availableYears.map((y) => (
                <SelectItem key={y} value={y}>
                  Año {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="h-9 text-xs rounded-xl border-slate-200 bg-white">
              <SelectValue placeholder="Mes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo el año (12 meses)</SelectItem>
              {MONTH_NAMES.map((m, idx) => {
                const code = String(idx + 1).padStart(2, '0');
                return (
                  <SelectItem key={code} value={code}>
                    {m}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          <Select value={selectedProvider} onValueChange={setSelectedProvider}>
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

          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="h-9 text-xs rounded-xl border-slate-200 bg-white">
              <SelectValue placeholder="Todas las categorías" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {EXPENSE_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Invertido ({selectedMonthLabel})
            </span>
            <Wallet className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {formatCOP(periodSummary.totalSpent)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
            {periodSummary.invoiceCount} {periodSummary.invoiceCount === 1 ? 'factura' : 'facturas'} en el período
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">
              Promedio Mensual ({selectedYear === 'all' ? 'Histórico' : selectedYear})
            </span>
            <TrendingUp className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {formatCOP(monthlyStats.monthlyAvg)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
            Acumulado año: {formatCOP(monthlyStats.yearTotal)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Recibido 100% vs En Curso</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-700 font-mono tabular-nums">
            {formatCOP(periodSummary.completeSpent)}
          </p>
          <p className="text-[11px] text-amber-700 mt-0.5 font-mono tabular-nums">
            En curso / parcial: {formatCOP(periodSummary.inProgressSpent)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Mayor Inversión por Tecnología</span>
            <Cpu className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-2 text-lg font-bold text-slate-900 truncate">
            {topTech ? topTech.name : 'Sin datos'}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5 font-mono tabular-nums">
            {topTech ? `${formatCOP(topTech.total)} (${topTech.sharePct.toFixed(1)}%)` : 'Asocie tecnología en Facturas'}
          </p>
        </div>
      </div>

      {/* View Switcher */}
      <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200">
        {(
          [
            { id: 'monthly', label: 'Mes a Mes', icon: Calendar },
            { id: 'technology', label: `Por Tecnología (${technologyStats.length})`, icon: Cpu },
            { id: 'providers', label: `Por Proveedor (${providerStats.length})`, icon: Building2 },
            { id: 'invoices', label: `Facturas del Período (${periodInvoices.length})`, icon: Receipt }
          ] as { id: ExpenseTab; label: string; icon: any }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap',
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-16 flex flex-col items-center justify-center gap-3 text-slate-500">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="text-xs font-medium">Calculando gastos e inversión tecnológica...</p>
        </div>
      ) : yearFilteredInvoices.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
            <Wallet className="h-6 w-6 text-slate-400" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-bold text-slate-900">
              No hay gastos registrados con los filtros actuales
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Los gastos se calculan automáticamente a partir de las facturas registradas con valor económico en el módulo de Facturas.
            </p>
          </div>
          <Button
            onClick={() => navigate('/invoices')}
            className="rounded-xl h-10 px-5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white"
          >
            Ir a Facturas
            <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </div>
      ) : activeTab === 'monthly' ? (
        <div className="space-y-4">
          {/* Visual 12-Month Chart */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Evolución Mensual de Inversión ({selectedYear === 'all' ? 'Todos los años' : selectedYear})
                </h3>
                <p className="text-xs text-slate-500">
                  Haga clic en una barra mensual para filtrar el detalle por ese mes.
                </p>
              </div>
              {selectedMonth !== 'all' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedMonth('all')}
                  className="h-7 px-2.5 text-xs rounded-lg border-slate-200"
                >
                  Ver los 12 meses
                </Button>
              )}
            </div>

            <div className="grid grid-cols-12 gap-2 items-end h-52 pt-6 pb-2 border-b border-slate-100">
              {monthlyStats.rows.map((m) => {
                const isSelected = selectedMonth === m.monthKey;
                return (
                  <button
                    key={m.monthKey}
                    type="button"
                    onClick={() =>
                      setSelectedMonth(isSelected ? 'all' : m.monthKey)
                    }
                    className="group flex flex-col items-center justify-end h-full gap-1.5 focus:outline-none"
                    title={`${m.month}: ${formatCOP(m.total)} (${m.count} facturas)`}
                  >
                    <span className="text-[10px] font-mono text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity tabular-nums truncate max-w-full">
                      {m.total > 0 ? formatCOP(m.total) : ''}
                    </span>
                    <div className="w-full max-w-[38px] flex-1 flex items-end justify-center">
                      <div
                        className={cn(
                          'w-full rounded-t-lg transition-all duration-200',
                          isSelected
                            ? 'bg-slate-900'
                            : m.total > 0
                              ? 'bg-emerald-600/85 group-hover:bg-emerald-700'
                              : 'bg-slate-100'
                        )}
                        style={{
                          height: m.total > 0 ? `${Math.max(8, m.barPct)}%` : '4px'
                        }}
                      />
                    </div>
                    <span
                      className={cn(
                        'text-[11px] font-semibold tabular-nums',
                        isSelected ? 'text-slate-900 underline' : 'text-slate-500'
                      )}
                    >
                      {m.shortMonth}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 12-Month Breakdown Table */}
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Mes</th>
                    <th className="px-4 py-3 text-center">Facturas</th>
                    <th className="px-4 py-3 text-right">Total Invertido</th>
                    <th className="px-4 py-3 text-right">% del Año</th>
                    <th className="px-4 py-3 w-40">Distribución</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthlyStats.rows.map((m) => {
                    const isSelected = selectedMonth === m.monthKey;
                    return (
                      <tr
                        key={m.monthKey}
                        onClick={() => setSelectedMonth(isSelected ? 'all' : m.monthKey)}
                        className={cn(
                          'cursor-pointer transition-colors',
                          isSelected ? 'bg-slate-100/80' : 'hover:bg-slate-50/70'
                        )}
                      >
                        <td className="px-4 py-3 font-semibold text-slate-900">{m.month}</td>
                        <td className="px-4 py-3 text-center font-mono tabular-nums text-slate-700">
                          {m.count}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold tabular-nums text-slate-900">
                          {formatCOP(m.total)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600">
                          {m.sharePct.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3">
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-600 rounded-full"
                              style={{ width: `${m.barPct}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'technology' ? (
        /* Gasto por Tipo de Tecnología */
        <div className="space-y-3">
          {technologyStats.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-xs text-slate-500">
              No hay ítems asociados a tecnologías en el período seleccionado.
            </div>
          ) : (
            technologyStats.map((tech) => {
              const isOpen = Boolean(expandedTech[tech.name]);
              return (
                <div
                  key={tech.name}
                  className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedTech((prev) => ({ ...prev, [tech.name]: !prev[tech.name] }))
                    }
                    className="w-full p-4 px-5 flex flex-wrap items-center justify-between gap-4 text-left hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">{tech.name}</p>
                        <p className="text-xs text-slate-500 tabular-nums">
                          {tech.itemCount} {tech.itemCount === 1 ? 'concepto registrado' : 'conceptos registrados'} ·{' '}
                          {tech.sharePct.toFixed(1)}% del gasto del período
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="hidden sm:block w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-slate-900 rounded-full"
                          style={{ width: `${Math.min(100, tech.sharePct)}%` }}
                        />
                      </div>
                      <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                        {formatCOP(tech.total)}
                      </span>
                    </div>
                  </button>

                  {isOpen && tech.details.length > 0 && (
                    <div className="border-t border-slate-100 overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                          <tr>
                            <th className="px-4 py-2.5">Fecha</th>
                            <th className="px-4 py-2.5">Ítem / Repuesto</th>
                            <th className="px-4 py-2.5">Equipo Específico</th>
                            <th className="px-4 py-2.5">Proveedor · Factura</th>
                            <th className="px-4 py-2.5 text-center">Cant.</th>
                            <th className="px-4 py-2.5 text-right">Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {tech.details.map((d, i) => (
                            <tr key={i} className="hover:bg-slate-50/50">
                              <td className="px-4 py-2.5 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                                {d.date}
                              </td>
                              <td className="px-4 py-2.5 font-semibold text-slate-900">{d.itemName}</td>
                              <td className="px-4 py-2.5 text-slate-600">{d.equipmentName || '—'}</td>
                              <td className="px-4 py-2.5 text-slate-600">
                                {d.providerName} · {d.invoiceName}
                              </td>
                              <td className="px-4 py-2.5 text-center font-mono tabular-nums">
                                {d.quantity}
                              </td>
                              <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900 tabular-nums">
                                {formatCOP(d.totalPrice)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : activeTab === 'providers' ? (
        /* Gasto por Proveedor */
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3 text-center">Facturas</th>
                  <th className="px-4 py-3 text-center">Completadas</th>
                  <th className="px-4 py-3 text-center">Pend./Parcial</th>
                  <th className="px-4 py-3 text-right">Total Facturado</th>
                  <th className="px-4 py-3 text-right">% Participación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {providerStats.map((prov) => (
                  <tr
                    key={prov.id}
                    onClick={() => setSelectedProvider(prov.id)}
                    className="hover:bg-slate-50/70 cursor-pointer transition-colors"
                    title="Clic para filtrar por este proveedor"
                  >
                    <td className="px-4 py-3.5 font-bold text-slate-900">{prov.name}</td>
                    <td className="px-4 py-3.5 text-center font-mono tabular-nums">{prov.count}</td>
                    <td className="px-4 py-3.5 text-center font-mono tabular-nums text-emerald-700 font-semibold">
                      {prov.completeCount}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono tabular-nums text-amber-700 font-semibold">
                      {prov.pendingCount}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-slate-900 tabular-nums">
                      {formatCOP(prov.total)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-600">
                      {prov.sharePct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Detalle de Facturas del Período */
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Factura</th>
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3">Categoría</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-right">Valor Total</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {periodInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-700 tabular-nums whitespace-nowrap">
                      {inv.date}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">{inv.name}</td>
                    <td className="px-4 py-3 text-slate-700">{inv.providerName}</td>
                    <td className="px-4 py-3 text-slate-600">{inv.expenseCategory || 'General'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'text-[11px] font-semibold px-2 py-0.5 rounded-md border',
                          inv.status === 'completa'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : inv.status === 'parcial'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                        )}
                      >
                        {inv.status === 'completa'
                          ? 'Completa'
                          : inv.status === 'parcial'
                            ? 'Parcial'
                            : 'Pendiente'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                      {formatCOP(inv.totalAmount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {inv.originalFileUrl && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(inv.originalFileUrl, '_blank')}
                            className="h-7 px-2 rounded-lg text-[11px] border-slate-200"
                            title="Ver soporte original"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => generateInvoiceReportPDF(inv, false)}
                          className="h-7 px-2 rounded-lg text-[11px] border-slate-200"
                          title="Descargar PDF de Factura"
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
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
}
