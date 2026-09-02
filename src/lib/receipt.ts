// Extracted from POSPage.tsx's original printReceipt(), which only ever
// worked from the in-memory state of the sale that was just completed —
// there was no way to reprint a receipt for a past sale even though every
// sale and its line items are persisted in the database from day one.
// This is the same HTML/layout, just taking its data as parameters instead
// of reading component state, so it can be called from the checkout flow
// AND from a sale-history lookup.

export type ReceiptItem = {
  name: string;
  quantity: number;
  unit_price: number;
};

export type ReceiptData = {
  reference: string;
  date: Date;
  items: ReceiptItem[];
  total: number;
  paymentMethod: string;
  paymentReference: string | null;
  staffName?: string | null;
  discountTotal?: number;
  pointsEarned?: number | null;
  // Multi-currency (see migration 0074): when a sale is collected in a
  // currency other than the tenant's own, show the converted amount
  // actually collected alongside the home-currency total the rest of
  // the receipt (and every report) is computed in.
  foreignCurrency?: string | null;
  foreignAmount?: number | null;
};

export type ReceiptLabels = {
  title: string;
  receipt: string;
  date: string;
  designation: string;
  qty: string;
  price: string;
  total: string;
  paymentMode: string;
  refLabel: string;
  status: string;
  statusPaid: string;
  thanks: string;
  keepProof: string;
  staffLabel?: string;
  discountLabel?: string;
  pointsEarnedLabel?: (points: number) => string;
  foreignAmountLabel?: string;
  paymentMethodLabel: (method: string) => string;
};

export function printSaleReceipt(
  data: ReceiptData,
  labels: ReceiptLabels,
  opts: { businessName: string; currency: string; lang: string; locale: string; formatMoney: (n: number, c: string) => string },
  presetWindow?: Window | null,
) {
  // BUG FIX: this used to call window.open() itself, which is exactly why
  // reprinting from Sale History was silently failing — SaleHistoryTab's
  // reprint() is an async function that fetches the sale's line items
  // (`await supabase...`) before calling this. Browsers only allow
  // window.open() to succeed as a direct, synchronous result of a user
  // gesture (a click); once you've awaited anything first, it's treated as
  // programmatic and silently blocked by the popup blocker — no error, the
  // receipt just never appears. `presetWindow` lets a caller that needs to
  // await something first open the window synchronously in the click
  // handler (before the await) and hand it in here once the data is ready.
  const w = presetWindow !== undefined ? presetWindow : window.open('', '_blank');
  if (!w) return;

  const rows = data.items
    .map(
      (i) =>
        `<tr><td>${i.name}</td><td style="text-align:right">${i.quantity}</td><td style="text-align:right">${opts.formatMoney(i.unit_price, opts.currency)}</td><td style="text-align:right;font-weight:600">${opts.formatMoney(i.quantity * i.unit_price, opts.currency)}</td></tr>`,
    )
    .join('');

  w.document.write(`<!DOCTYPE html><html lang="${opts.lang}"><head><title>${labels.title} ${data.reference}</title><meta charset="utf-8"/><style>
    * { box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; padding: 24px; max-width: 380px; margin: auto; font-size: 12px; color: #1a1a1a; }
    .brand { text-align: center; font-size: 17px; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 2px; }
    .tagline { text-align: center; font-size: 10px; color: #888; margin-bottom: 12px; }
    .divider { border-top: 1px dashed #999; margin: 10px 0; }
    .divider.solid { border-top: 1.5px solid #333; }
    .meta { display: flex; justify-content: space-between; font-size: 11px; color: #444; margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { padding: 5px 4px; text-align: left; }
    th { text-transform: uppercase; font-size: 9px; color: #888; border-bottom: 1px solid #ccc; }
    td { border-bottom: 1px dotted #ddd; }
    .total-row { display: flex; justify-content: space-between; font-size: 15px; font-weight: 700; margin-top: 10px; padding-top: 8px; border-top: 1.5px solid #333; }
    .payment-block { margin-top: 14px; padding: 10px; background: #f7f7f7; border-radius: 6px; }
    .payment-row { display: flex; justify-content: space-between; font-size: 11px; margin: 3px 0; }
    .payment-row .label { color: #666; }
    .payment-row .value { font-weight: 700; letter-spacing: 0.5px; }
    .footer { text-align: center; margin-top: 18px; font-size: 10px; color: #777; }
    .footer .thanks { font-size: 12px; font-weight: 600; color: #1a1a1a; margin-bottom: 3px; }
  </style></head><body>
    <div class="brand">POS Flow</div>
    <div class="tagline">${opts.businessName}</div>
    <div class="divider solid"></div>
    <div class="meta"><span>${labels.receipt}</span><strong>${data.reference}</strong></div>
    <div class="meta"><span>${labels.date}</span><span>${data.date.toLocaleDateString(opts.locale)} ${data.date.toLocaleTimeString(opts.locale, { hour: '2-digit', minute: '2-digit' })}</span></div>
    ${data.staffName && labels.staffLabel ? `<div class="meta"><span>${labels.staffLabel}</span><span>${data.staffName}</span></div>` : ''}
    <div class="divider"></div>
    <table><thead><tr><th>${labels.designation}</th><th style="text-align:right">${labels.qty}</th><th style="text-align:right">${labels.price}</th><th style="text-align:right">${labels.total}</th></tr></thead><tbody>${rows}</tbody></table>
    ${data.discountTotal && data.discountTotal > 0 && labels.discountLabel ? `<div class="meta"><span>${labels.discountLabel}</span><span>-${opts.formatMoney(data.discountTotal, opts.currency)}</span></div>` : ''}
    <div class="total-row"><span>${labels.total}</span><span>${opts.formatMoney(data.total, opts.currency)}</span></div>
    ${data.foreignCurrency && data.foreignAmount != null && labels.foreignAmountLabel ? `<div class="meta"><span>${labels.foreignAmountLabel}</span><span>${data.foreignAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${data.foreignCurrency}</span></div>` : ''}
    <div class="payment-block">
      <div class="payment-row"><span class="label">${labels.paymentMode}</span><span class="value">${labels.paymentMethodLabel(data.paymentMethod)}</span></div>
      ${data.paymentReference ? `<div class="payment-row"><span class="label">${labels.refLabel}</span><span class="value">${data.paymentReference}</span></div>` : ''}
      <div class="payment-row"><span class="label">${labels.status}</span><span class="value">${labels.statusPaid}</span></div>
    </div>
    <div class="footer">
      <div class="thanks">${labels.thanks}</div>
      ${data.pointsEarned && data.pointsEarned > 0 && labels.pointsEarnedLabel ? `<div>${labels.pointsEarnedLabel(data.pointsEarned)}</div>` : ''}
      ${labels.keepProof}
    </div>
  </body></html>`);
  w.document.close();
  w.print();
}

// Return / exchange slip — same printable pop-up pattern as the sale
// receipt above, but for a processed return: what was brought back, the
// refund method chosen, and the original sale it's linked to.
export type ReturnReceiptData = {
  reference: string;
  originalReference: string;
  date: Date;
  items: ReceiptItem[];
  refundAmount: number;
  refundMethod: string;
  kind: 'return' | 'exchange';
  staffName?: string | null;
};

export type ReturnReceiptLabels = {
  title: string;
  slipNumber: string;
  date: string;
  originalSale: string;
  designation: string;
  qty: string;
  price: string;
  total: string;
  refundMethod: string;
  refundAmount: string;
  staffLabel?: string;
  thanks: string;
  refundMethodLabel: (method: string) => string;
};

export function printReturnReceipt(
  data: ReturnReceiptData,
  labels: ReturnReceiptLabels,
  opts: { businessName: string; currency: string; lang: string; locale: string; formatMoney: (n: number, c: string) => string },
) {
  const w = window.open('', '_blank');
  if (!w) return;

  const rows = data.items
    .map(
      (i) =>
        `<tr><td>${i.name}</td><td style="text-align:right">${i.quantity}</td><td style="text-align:right">${opts.formatMoney(i.unit_price, opts.currency)}</td><td style="text-align:right;font-weight:600">${opts.formatMoney(i.quantity * i.unit_price, opts.currency)}</td></tr>`,
    )
    .join('');

  w.document.write(`<!DOCTYPE html><html lang="${opts.lang}"><head><title>${labels.title} ${data.reference}</title><meta charset="utf-8"/><style>
    * { box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; padding: 24px; max-width: 380px; margin: auto; font-size: 12px; color: #1a1a1a; }
    .brand { text-align: center; font-size: 17px; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 2px; }
    .tagline { text-align: center; font-size: 10px; color: #888; margin-bottom: 12px; }
    .divider { border-top: 1px dashed #999; margin: 10px 0; }
    .divider.solid { border-top: 1.5px solid #333; }
    .meta { display: flex; justify-content: space-between; font-size: 11px; color: #444; margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { padding: 5px 4px; text-align: left; }
    th { text-transform: uppercase; font-size: 9px; color: #888; border-bottom: 1px solid #ccc; }
    td { border-bottom: 1px dotted #ddd; }
    .total-row { display: flex; justify-content: space-between; font-size: 15px; font-weight: 700; margin-top: 10px; padding-top: 8px; border-top: 1.5px solid #333; }
    .payment-block { margin-top: 14px; padding: 10px; background: #f7f7f7; border-radius: 6px; }
    .payment-row { display: flex; justify-content: space-between; font-size: 11px; margin: 3px 0; }
    .payment-row .label { color: #666; }
    .payment-row .value { font-weight: 700; letter-spacing: 0.5px; }
    .footer { text-align: center; margin-top: 18px; font-size: 10px; color: #777; }
    .footer .thanks { font-size: 12px; font-weight: 600; color: #1a1a1a; margin-bottom: 3px; }
  </style></head><body>
    <div class="brand">POS Flow</div>
    <div class="tagline">${opts.businessName}</div>
    <div class="divider solid"></div>
    <div class="meta"><span>${labels.slipNumber}</span><strong>${data.reference}</strong></div>
    <div class="meta"><span>${labels.originalSale}</span><span>${data.originalReference}</span></div>
    <div class="meta"><span>${labels.date}</span><span>${data.date.toLocaleDateString(opts.locale)} ${data.date.toLocaleTimeString(opts.locale, { hour: '2-digit', minute: '2-digit' })}</span></div>
    ${data.staffName && labels.staffLabel ? `<div class="meta"><span>${labels.staffLabel}</span><span>${data.staffName}</span></div>` : ''}
    <div class="divider"></div>
    <table><thead><tr><th>${labels.designation}</th><th style="text-align:right">${labels.qty}</th><th style="text-align:right">${labels.price}</th><th style="text-align:right">${labels.total}</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="total-row"><span>${labels.refundAmount}</span><span>${opts.formatMoney(data.refundAmount, opts.currency)}</span></div>
    <div class="payment-block">
      <div class="payment-row"><span class="label">${labels.refundMethod}</span><span class="value">${labels.refundMethodLabel(data.refundMethod)}</span></div>
    </div>
    <div class="footer">
      <div class="thanks">${labels.thanks}</div>
    </div>
  </body></html>`);
  w.document.close();
  w.print();
}
