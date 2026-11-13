import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import { db, cleanFirestoreData } from '@/lib/firebase';
import { CatalogItem, CatalogPriceEntry, Invoice, InvoiceItem } from '@/types';

export const EXPENSE_CATEGORIES = [
  'Repuestos e Insumos',
  'Mantenimiento Preventivo',
  'Mantenimiento Correctivo',
  'Calibración / Metrología',
  'Equipos Nuevos',
  'Infraestructura / TIC',
  'Otros'
] as const;

export const COMMON_TECHNOLOGIES = [
  'Ventilador Mecánico',
  'Monitor de Signos Vitales',
  'Bomba de Infusión',
  'Desfibrilador',
  'Incubadora',
  'Electrocardiógrafo',
  'Máquina de Anestesia',
  'Autoclave / Esterilizador',
  'Aspirador / Succionador',
  'Computador / TIC',
  'Red / Conectividad',
  'Planta Eléctrica / UPS',
  'Gases Medicinales',
  'General / Insumos'
] as const;

export function formatCOP(value?: number | null): string {
  const num = Number(value);
  if (!isFinite(num) || isNaN(num)) return '$0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(Math.round(num));
}

export function normalizeCatalogKey(name: string, technologyType?: string): string {
  const cleanName = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const cleanTech = (technologyType || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return cleanTech ? `${cleanName}__${cleanTech}` : cleanName;
}

export function buildCatalogDocId(normalizedKey: string): string {
  const slug = normalizedKey.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'item';
  // Simple deterministic short hash to avoid collisions after truncation
  let hash = 0;
  for (let i = 0; i < normalizedKey.length; i++) {
    hash = (hash * 31 + normalizedKey.charCodeAt(i)) >>> 0;
  }
  return `cat_${slug}_${hash.toString(36)}`;
}

/**
 * Sincroniza automáticamente los ítems con valor unitario de una factura hacia la colección `catalog_items`.
 */
export async function syncInvoiceItemsToCatalog(invoice: Invoice, existingCatalog?: CatalogItem[]): Promise<number> {
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const pricedItems = items.filter(
    (it): it is InvoiceItem => Boolean(it.name?.trim()) && typeof it.unitPrice === 'number' && it.unitPrice > 0
  );

  if (pricedItems.length === 0) return 0;

  let catalogList = existingCatalog;
  if (!catalogList) {
    try {
      const snap = await getDocs(collection(db, 'catalog_items'));
      catalogList = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as CatalogItem[];
    } catch (err) {
      console.warn('No se pudo leer catalog_items para sincronizar:', err);
      catalogList = [];
    }
  }

  const byId = new Map<string, CatalogItem>();
  const byKey = new Map<string, CatalogItem>();
  for (const c of catalogList) {
    byId.set(c.id, c);
    if (c.normalizedName) byKey.set(c.normalizedName, c);
  }

  let syncedCount = 0;
  const nowIso = new Date().toISOString();

  for (const item of pricedItems) {
    const unitPrice = Number(item.unitPrice) || 0;
    const normKey = normalizeCatalogKey(item.name, item.technologyType);
    const existing =
      (item.catalogItemId ? byId.get(item.catalogItemId) : undefined) ||
      byKey.get(normKey);

    const newEntry: CatalogPriceEntry = {
      date: invoice.date || nowIso.slice(0, 10),
      unitPrice,
      providerId: invoice.providerId,
      providerName: invoice.providerName || 'Proveedor',
      invoiceId: invoice.id,
      invoiceName: invoice.name
    };

    if (existing) {
      const prevHistory = Array.isArray(existing.priceHistory) ? [...existing.priceHistory] : [];
      const existingIdx = prevHistory.findIndex(
        (h) => h.invoiceId === invoice.id && h.date === newEntry.date
      );
      if (existingIdx >= 0) {
        prevHistory[existingIdx] = newEntry;
      } else {
        prevHistory.unshift(newEntry);
      }

      // Ordenar historial más reciente primero y limitar a 25 registros
      prevHistory.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      const trimmedHistory = prevHistory.slice(0, 25);

      const avg =
        trimmedHistory.reduce((sum, h) => sum + (Number(h.unitPrice) || 0), 0) /
        Math.max(1, trimmedHistory.length);

      const latest = trimmedHistory[0] || newEntry;

      const updatedDoc: CatalogItem = {
        ...existing,
        name: item.name.trim(),
        normalizedName: normKey,
        unit: item.unit || existing.unit,
        technologyType: item.technologyType || existing.technologyType,
        technologyScope: invoice.technologyScope || existing.technologyScope,
        lastUnitPrice: latest.unitPrice,
        averagePrice: Math.round(avg),
        lastProviderId: latest.providerId || existing.lastProviderId,
        lastProviderName: latest.providerName || existing.lastProviderName,
        lastPurchaseDate: latest.date || existing.lastPurchaseDate,
        priceHistory: trimmedHistory,
        updatedAt: nowIso
      };

      await setDoc(doc(db, 'catalog_items', existing.id), cleanFirestoreData(updatedDoc));
      byId.set(existing.id, updatedDoc);
      byKey.set(normKey, updatedDoc);
      syncedCount++;
    } else {
      const newId = item.catalogItemId || buildCatalogDocId(normKey);
      const newDoc: CatalogItem = {
        id: newId,
        name: item.name.trim(),
        normalizedName: normKey,
        unit: item.unit || 'Und',
        technologyType: item.technologyType || 'General / Insumos',
        technologyScope: invoice.technologyScope || 'biomedical',
        lastUnitPrice: unitPrice,
        averagePrice: Math.round(unitPrice),
        lastProviderId: invoice.providerId,
        lastProviderName: invoice.providerName,
        lastPurchaseDate: invoice.date || nowIso.slice(0, 10),
        priceHistory: [newEntry],
        createdAt: nowIso,
        updatedAt: nowIso
      };

      await setDoc(doc(db, 'catalog_items', newId), cleanFirestoreData(newDoc));
      byId.set(newId, newDoc);
      byKey.set(normKey, newDoc);
      syncedCount++;
    }
  }

  return syncedCount;
}
