// Offline sales queue (IndexedDB) — POS.tsx.
//
// SCOPE: this deliberately does NOT make the whole checkout flow work
// offline. The real checkout() function runs a long chain of sequential
// network calls (stock feasibility checks, gift card verification, serial/
// batch consumption, loyalty point redemption — see POSPage.tsx) that
// genuinely require a live connection to be correct: verifying a gift
// card balance, or that a serialized item is still actually in stock,
// cannot be done safely against stale local data without risking a sale
// that oversells inventory or spends more of a gift card than it holds.
//
// What CAN be deferred safely: a plain cash sale with no split payment,
// no gift card, no loyalty-point redemption, and no serial/batch tracked
// items — nothing about that case depends on server-side state that could
// have changed. Only that case is queued here; POSPage.tsx blocks
// checkout with a clear explanation for anything riskier while offline,
// rather than silently degrading correctness.
//
// A queued sale is replayed through the normal insert path (sales +
// sale_payments + sale_items — see syncOfflineSale in POSPage.tsx) as soon
// as connectivity returns, in the order it was created. If a replay fails
// (e.g. the day session was closed on another device while offline), it
// stays in the queue and is surfaced to the cashier instead of being
// silently dropped or retried forever.

const DB_NAME = 'posflow_offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending_sales';

export type OfflineSalePayload = {
  id: string; // crypto.randomUUID() — also used as the idempotency key on sync
  tenant_id: string;
  store_id: string | null;
  day_session_id: string;
  user_id: string | null;
  customer_id: string | null;
  reference: string;
  currency: string;
  subtotal: number;
  tax_total: number;
  discount_total: number;
  total: number;
  notes: string;
  queued_at: string;
  items: { product_id: string; name: string; quantity: number; unit_price: number; tax_rate: number; total: number }[];
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function queueOfflineSale(sale: OfflineSalePayload): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(sale);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function getQueuedSales(): Promise<OfflineSalePayload[]> {
  const db = await openDB();
  const result = await new Promise<OfflineSalePayload[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result as OfflineSalePayload[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  // Oldest first, so sales sync (and consume stock) in the order they
  // actually happened at the register.
  return result.sort((a, b) => a.queued_at.localeCompare(b.queued_at));
}

export async function removeQueuedSale(id: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
