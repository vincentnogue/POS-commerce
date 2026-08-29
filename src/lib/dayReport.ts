// X-Report / Z-Report — printable snapshot of a day session.
// X-Report: printed any number of times (capped by tenants.max_x_reports_per_day)
//           while the day is still open, does not close it.
// Z-Report: printed once, at the moment the day is closed (see close_day_session
//           in migration 0045) — it is the day-closing document.
// Same pop-up print pattern as src/lib/receipt.ts, kept separate because the
// content (cash reconciliation, staff present, payment breakdown) is different
// from a sale receipt.

export type DayReportKind = 'x' | 'z';

export type DayReportData = {
  sessionReference: string; // short id or store name + date
  kind: DayReportKind;
  openedAt: Date;
  closedAt?: Date | null;
  storeName: string;
  openingCash: number;
  closingCash?: number | null;
  expectedCash?: number | null;
  cashVariance?: number | null;
  staffNames: string[];
  salesCount: number;
  paymentBreakdown: { method: string; amount: number; count: number }[];
  returnsTotal: number;
  grossTotal: number;
  printNumber?: number; // which X-Report print this is today
};

export type DayReportLabels = {
  xTitle: string;
  zTitle: string;
  store: string;
  openedAt: string;
  closedAt: string;
  staffPresent: string;
  salesCount: string;
  grossTotal: string;
  returnsTotal: string;
  paymentBreakdown: string;
  openingCash: string;
  closingCash: string;
  expectedCash: string;
  cashVariance: string;
  printNumber: string;
  notClosed: string;
  paymentMethodLabel: (method: string) => string;
};

export function printDayReport(
  data: DayReportData,
  labels: DayReportLabels,
  opts: { businessName: string; currency: string; lang: string; locale: string; formatMoney: (n: number, c: string) => string },
) {
  const w = window.open('', '_blank');
  if (!w) return;

  const title = data.kind === 'z' ? labels.zTitle : labels.xTitle;

  const paymentRows = data.paymentBreakdown
    .map(
      (p) =>
        `<tr><td>${labels.paymentMethodLabel(p.method)}</td><td style="text-align:right">${p.count}</td><td style="text-align:right;font-weight:600">${opts.formatMoney(p.amount, opts.currency)}</td></tr>`,
    )
    .join('');

  w.document.write(`<!DOCTYPE html><html lang="${opts.lang}"><head><title>${title} — ${data.sessionReference}</title><meta charset="utf-8"/><style>
    * { box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; padding: 24px; max-width: 380px; margin: auto; font-size: 12px; color: #1a1a1a; }
    .brand { text-align: center; font-size: 17px; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 2px; }
    .tagline { text-align: center; font-size: 10px; color: #888; margin-bottom: 4px; }
    .kind { text-align: center; font-size: 13px; font-weight: 700; letter-spacing: 1px; margin-bottom: 12px; padding: 4px; background: ${data.kind === 'z' ? '#fdecea' : '#eef7f1'}; border-radius: 6px; }
    .divider { border-top: 1px dashed #999; margin: 10px 0; }
    .divider.solid { border-top: 1.5px solid #333; }
    .meta { display: flex; justify-content: space-between; font-size: 11px; color: #444; margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { padding: 5px 4px; text-align: left; }
    th { text-transform: uppercase; font-size: 9px; color: #888; border-bottom: 1px solid #ccc; }
    td { border-bottom: 1px dotted #ddd; }
    .total-row { display: flex; justify-content: space-between; font-size: 15px; font-weight: 700; margin-top: 10px; padding-top: 8px; border-top: 1.5px solid #333; }
    .cash-block { margin-top: 14px; padding: 10px; background: #f7f7f7; border-radius: 6px; }
    .cash-row { display: flex; justify-content: space-between; font-size: 11px; margin: 3px 0; }
    .cash-row .label { color: #666; }
    .cash-row .value { font-weight: 700; }
    .footer { text-align: center; margin-top: 18px; font-size: 10px; color: #777; }
  </style></head><body>
    <div class="brand">POS Flow</div>
    <div class="tagline">${opts.businessName} — ${data.storeName}</div>
    <div class="kind">${title}${data.kind === 'x' && data.printNumber ? ` (#${data.printNumber})` : ''}</div>
    <div class="divider solid"></div>
    <div class="meta"><span>${labels.openedAt}</span><span>${data.openedAt.toLocaleDateString(opts.locale)} ${data.openedAt.toLocaleTimeString(opts.locale, { hour: '2-digit', minute: '2-digit' })}</span></div>
    <div class="meta"><span>${labels.closedAt}</span><span>${data.closedAt ? `${data.closedAt.toLocaleDateString(opts.locale)} ${data.closedAt.toLocaleTimeString(opts.locale, { hour: '2-digit', minute: '2-digit' })}` : labels.notClosed}</span></div>
    <div class="meta"><span>${labels.staffPresent}</span><span>${data.staffNames.join(', ') || '—'}</span></div>
    <div class="divider"></div>
    <div class="meta"><span>${labels.salesCount}</span><strong>${data.salesCount}</strong></div>
    <table><thead><tr><th>${labels.paymentBreakdown}</th><th style="text-align:right">#</th><th style="text-align:right">${opts.formatMoney(0, opts.currency).replace(/[0-9.,]/g, '').trim() || opts.currency}</th></tr></thead><tbody>${paymentRows}</tbody></table>
    <div class="total-row"><span>${labels.grossTotal}</span><span>${opts.formatMoney(data.grossTotal, opts.currency)}</span></div>
    <div class="meta" style="margin-top:6px"><span>${labels.returnsTotal}</span><span>-${opts.formatMoney(data.returnsTotal, opts.currency)}</span></div>
    <div class="cash-block">
      <div class="cash-row"><span class="label">${labels.openingCash}</span><span class="value">${opts.formatMoney(data.openingCash, opts.currency)}</span></div>
      ${data.kind === 'z' ? `
      <div class="cash-row"><span class="label">${labels.expectedCash}</span><span class="value">${opts.formatMoney(data.expectedCash ?? 0, opts.currency)}</span></div>
      <div class="cash-row"><span class="label">${labels.closingCash}</span><span class="value">${opts.formatMoney(data.closingCash ?? 0, opts.currency)}</span></div>
      <div class="cash-row"><span class="label">${labels.cashVariance}</span><span class="value">${opts.formatMoney(data.cashVariance ?? 0, opts.currency)}</span></div>
      ` : ''}
    </div>
    <div class="footer">${labels.printNumber ? '' : ''}${data.kind === 'z' ? '— Journée clôturée —' : ''}</div>
  </body></html>`);
  w.document.close();
  w.print();
}
