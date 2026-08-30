import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// jspdf-autotable augments the jsPDF instance at runtime with this property;
// it isn't part of the base jsPDF type, so we type it explicitly instead of
// reaching for `any`.
type JsPDFWithAutoTable = jsPDF & { lastAutoTable: { finalY: number } };
import type { Invoice, InvoiceItem, Tenant, Customer } from './types';
import { formatMoney } from './localization';

export type BrandSettings = {
  logo_url?: string | null;
  stamp_url?: string | null;
  phone?: string | null;
  address?: string | null;
  email?: string | null;
} | null;

export type InvoicePdfInput = {
  invoice: Invoice;
  items: InvoiceItem[];
  tenant: Tenant | null;
  brand: BrandSettings;
  customer: Customer | null;
  currency: string;
};

// Brand palette (matches tailwind.config.js `brand` scale) so the PDF stays
// visually consistent with the rest of the product rather than looking like
// a generic template.
const BRAND_DARK: [number, number, number] = [27, 92, 64];   // brand-700 #1B5C40
const BRAND_LIGHT: [number, number, number] = [234, 243, 238]; // brand-50 #EAF3EE
const INK_900: [number, number, number] = [23, 30, 26];
const INK_500: [number, number, number] = [110, 122, 115];
const INK_300: [number, number, number] = [180, 190, 184];

async function toDataURL(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  sent: 'Envoyée',
  paid: 'Payée',
  overdue: 'En retard',
  cancelled: 'Annulée',
};

const STATUS_COLORS: Record<string, [number, number, number]> = {
  draft: [140, 140, 140],
  sent: [46, 140, 102],
  paid: [27, 92, 64],
  overdue: [190, 60, 50],
  cancelled: [140, 140, 140],
};

export async function buildInvoicePdf({ invoice, items, tenant, brand, customer, currency }: InvoicePdfInput): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;

  const [logoData, stampData] = await Promise.all([
    brand?.logo_url ? toDataURL(brand.logo_url) : Promise.resolve(null),
    brand?.stamp_url ? toDataURL(brand.stamp_url) : Promise.resolve(null),
  ]);

  // --- Top accent band ---
  doc.setFillColor(...BRAND_DARK);
  doc.rect(0, 0, pageWidth, 3, 'F');

  const headerY = margin + 6;

  // --- Logo + company identity (left) ---
  if (logoData) {
    try { doc.addImage(logoData, 'PNG', margin, headerY - 4, 22, 22, undefined, 'FAST'); } catch { /* skip */ }
  }
  const textX = logoData ? margin + 28 : margin;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...INK_900);
  doc.text(tenant?.name ?? 'Entreprise', textX, headerY);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...INK_500);
  let infoY = headerY + 5.5;
  const infoLines = [brand?.address, brand?.phone ? `Tél: ${brand.phone}` : null, brand?.email].filter(Boolean) as string[];
  infoLines.forEach((line) => { doc.text(line, textX, infoY); infoY += 4.2; });

  // --- "FACTURE" title + number + status badge (right) ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...BRAND_DARK);
  doc.text('FACTURE', pageWidth - margin, headerY, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...INK_500);
  doc.text(`N° ${invoice.number}`, pageWidth - margin, headerY + 6.5, { align: 'right' });

  const statusColor = STATUS_COLORS[invoice.status] ?? INK_500;
  const statusLabel = (STATUS_LABELS[invoice.status] ?? invoice.status).toUpperCase();
  doc.setFontSize(8);
  const badgeW = doc.getTextWidth(statusLabel) + 7;
  const badgeX = pageWidth - margin - badgeW;
  const badgeY = headerY + 9.5;
  doc.setFillColor(...statusColor);
  doc.roundedRect(badgeX, badgeY, badgeW, 5.5, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(statusLabel, badgeX + badgeW / 2, badgeY + 3.8, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...INK_500);
  let rightY = badgeY + 10.5;
  doc.text(`Date d'émission : ${invoice.issue_date}`, pageWidth - margin, rightY, { align: 'right' });
  if (invoice.due_date) { rightY += 4.2; doc.text(`Échéance : ${invoice.due_date}`, pageWidth - margin, rightY, { align: 'right' }); }

  let y = Math.max(infoY, rightY) + 6;
  doc.setDrawColor(...INK_300);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 9;

  // --- "Facturé à" box ---
  const boxW = 82;
  const boxH = 8 + (customer?.address ? 4.2 : 0) + (customer?.phone ? 4.2 : 0) + (customer?.email ? 4.2 : 0) + (customer?.tax_id ? 4.2 : 0) + 5;
  doc.setFillColor(...BRAND_LIGHT);
  doc.roundedRect(margin, y, boxW, boxH, 2, 2, 'F');
  let by = y + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...BRAND_DARK);
  doc.text('FACTURÉ À', margin + 5, by);
  by += 5.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...INK_900);
  doc.text(customer?.name ?? 'Client', margin + 5, by);
  by += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...INK_500);
  [customer?.address, customer?.phone, customer?.email, customer?.tax_id ? `NIF/Reg : ${customer.tax_id}` : null]
    .filter(Boolean)
    .forEach((line) => { doc.text(line as string, margin + 5, by); by += 4.2; });

  y += boxH + 10;

  // --- Items table ---
  autoTable(doc, {
    startY: y,
    head: [['DÉSIGNATION', 'QTÉ', 'PRIX UNITAIRE', 'REMISE', 'TVA', 'TOTAL']],
    body: items.map((it) => [
      it.name,
      String(it.quantity),
      formatMoney(it.unit_price, currency),
      it.discount ? formatMoney(it.discount, currency) : '—',
      it.tax_rate ? `${it.tax_rate}%` : '—',
      formatMoney(it.total, currency),
    ]),
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 9, textColor: INK_900, cellPadding: { top: 3.2, bottom: 3.2, left: 3, right: 3 } },
    headStyles: { fillColor: BRAND_DARK, textColor: 255, fontSize: 7.8, fontStyle: 'bold', halign: 'left' },
    alternateRowStyles: { fillColor: [247, 250, 248] },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'right', cellWidth: 16 },
      2: { halign: 'right', cellWidth: 30 },
      3: { halign: 'right', cellWidth: 24 },
      4: { halign: 'right', cellWidth: 16 },
      5: { halign: 'right', cellWidth: 30, fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
    didParseCell: (data) => {
      if (data.section === 'body') data.cell.styles.lineWidth = { top: 0, right: 0, bottom: 0.2, left: 0 };
    },
    didDrawPage: () => {
      doc.setDrawColor(...INK_300);
    },
  });

  let totalsY = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 8;

  // --- Totals box (right-aligned) ---
  const totalsBoxW = 74;
  const totalsX = pageWidth - margin - totalsBoxW;
  const lineRow = (label: string, value: number, opts?: { bold?: boolean; muted?: boolean }) => {
    doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
    doc.setFontSize(opts?.bold ? 10.5 : 9);
    doc.setTextColor(...(opts?.muted ? INK_500 : INK_900));
    doc.text(label, totalsX + 4, totalsY);
    doc.text(formatMoney(value, currency), pageWidth - margin - 4, totalsY, { align: 'right' });
    totalsY += opts?.bold ? 7.5 : 6;
  };

  const hasBalance = !!invoice.paid_amount;
  const boxLines = 1 + (invoice.discount_total ? 1 : 0) + (invoice.tax_total ? 1 : 0) + 1 + (hasBalance ? 2 : 0);
  const totalsBoxH = boxLines * 6.2 + 6;
  doc.setFillColor(250, 251, 250);
  doc.setDrawColor(...INK_300);
  doc.setLineWidth(0.25);
  doc.roundedRect(totalsX, totalsY - 5, totalsBoxW, totalsBoxH, 2, 2, 'FD');
  totalsY += 2;

  lineRow('Sous-total', invoice.subtotal, { muted: true });
  if (invoice.discount_total) lineRow('Remise', -invoice.discount_total, { muted: true });
  if (invoice.tax_total) lineRow('TVA', invoice.tax_total, { muted: true });
  doc.setDrawColor(...INK_300);
  doc.line(totalsX + 4, totalsY - 3, pageWidth - margin - 4, totalsY - 3);
  doc.setFillColor(...BRAND_LIGHT);
  doc.rect(totalsX, totalsY - 1.5, totalsBoxW, 8, 'F');
  doc.setTextColor(...BRAND_DARK);
  lineRow('TOTAL', invoice.total, { bold: true });
  if (hasBalance) {
    doc.setTextColor(...INK_900);
    lineRow('Payé', invoice.paid_amount, { muted: true });
    lineRow('Solde dû', invoice.total - invoice.paid_amount, { bold: true });
  }

  // --- Notes ---
  let notesBottom = totalsY;
  if (invoice.notes) {
    const notesY = totalsY - (hasBalance ? 12 : 5);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(...INK_500);
    const wrapped = doc.splitTextToSize(invoice.notes, totalsX - margin - 8);
    doc.text(wrapped, margin, notesY);
    notesBottom = Math.max(notesBottom, notesY + wrapped.length * 4);
  }

  // --- Stamp (cachet) ---
  if (stampData) {
    try { doc.addImage(stampData, 'PNG', margin, notesBottom + 6, 28, 28, undefined, 'FAST'); } catch { /* skip */ }
  }

  // --- Footer (repeats on every page implicitly via fixed Y from bottom) ---
  doc.setDrawColor(...INK_300);
  doc.setLineWidth(0.2);
  doc.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...BRAND_DARK);
  doc.text('Merci pour votre confiance.', pageWidth / 2, pageHeight - 12, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...INK_500);
  const footerContact = [tenant?.name, brand?.phone, brand?.email].filter(Boolean).join('  •  ');
  if (footerContact) doc.text(footerContact, pageWidth / 2, pageHeight - 8, { align: 'center' });

  return doc;
}

export async function downloadInvoicePdf(input: InvoicePdfInput) {
  const doc = await buildInvoicePdf(input);
  doc.save(`facture-${input.invoice.number}.pdf`);
}

export async function printInvoicePdf(input: InvoicePdfInput) {
  const doc = await buildInvoicePdf(input);
  doc.autoPrint();
  window.open(doc.output('bloburl') as unknown as string, '_blank');
}

export async function getInvoicePdfBlob(input: InvoicePdfInput): Promise<Blob> {
  const doc = await buildInvoicePdf(input);
  return doc.output('blob');
}
