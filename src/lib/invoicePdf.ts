import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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

// Fetches a public image URL and converts it to a data URL so jsPDF can embed
// it. Fails silently (returns null) — a missing logo/stamp shouldn't ever
// block generating the invoice.
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

export async function buildInvoicePdf({ invoice, items, tenant, brand, customer, currency }: InvoicePdfInput): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;

  const [logoData, stampData] = await Promise.all([
    brand?.logo_url ? toDataURL(brand.logo_url) : Promise.resolve(null),
    brand?.stamp_url ? toDataURL(brand.stamp_url) : Promise.resolve(null),
  ]);

  // --- Header: logo + company identity (left), invoice title (right) ---
  let headerY = margin;
  if (logoData) {
    try {
      doc.addImage(logoData, 'PNG', margin, headerY, 28, 28, undefined, 'FAST');
    } catch { /* unsupported format, skip */ }
  }
  const textX = logoData ? margin + 34 : margin;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(tenant?.name ?? 'Entreprise', textX, headerY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90);
  let infoY = headerY + 12;
  if (brand?.address) { doc.text(brand.address, textX, infoY); infoY += 4.5; }
  if (brand?.phone) { doc.text(`Tél: ${brand.phone}`, textX, infoY); infoY += 4.5; }
  if (brand?.email) { doc.text(brand.email, textX, infoY); infoY += 4.5; }

  doc.setTextColor(20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('FACTURE', pageWidth - margin, headerY + 6, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`N° ${invoice.number}`, pageWidth - margin, headerY + 13, { align: 'right' });
  doc.text(`Date: ${invoice.issue_date}`, pageWidth - margin, headerY + 18, { align: 'right' });
  if (invoice.due_date) doc.text(`Échéance: ${invoice.due_date}`, pageWidth - margin, headerY + 23, { align: 'right' });
  doc.text(`Statut: ${STATUS_LABELS[invoice.status] ?? invoice.status}`, pageWidth - margin, headerY + 28, { align: 'right' });

  let y = Math.max(infoY, headerY + 34) + 6;
  doc.setDrawColor(220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // --- Bill to ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(140);
  doc.text('FACTURÉ À', margin, y);
  doc.setTextColor(20);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(customer?.name ?? 'Client', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(90);
  y += 5;
  if (customer?.address) { doc.text(customer.address, margin, y); y += 4.5; }
  if (customer?.phone) { doc.text(customer.phone, margin, y); y += 4.5; }
  if (customer?.email) { doc.text(customer.email, margin, y); y += 4.5; }
  if (customer?.tax_id) { doc.text(`NIF/Reg: ${customer.tax_id}`, margin, y); y += 4.5; }
  doc.setTextColor(20);

  y += 4;

  // --- Items table ---
  autoTable(doc, {
    startY: y,
    head: [['Désignation', 'Qté', 'Prix unitaire', 'Remise', 'TVA', 'Total']],
    body: items.map((it) => [
      it.name,
      String(it.quantity),
      formatMoney(it.unit_price, currency),
      it.discount ? formatMoney(it.discount, currency) : '—',
      it.tax_rate ? `${it.tax_rate}%` : '—',
      formatMoney(it.total, currency),
    ]),
    theme: 'striped',
    headStyles: { fillColor: [26, 54, 93], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: margin, right: margin },
  });

  // @ts-ignore - lastAutoTable is added by the plugin at runtime
  let totalsY = (doc as any).lastAutoTable.finalY + 8;

  // --- Totals ---
  const totalsX = pageWidth - margin - 60;
  const lineTotal = (label: string, value: number, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(bold ? 11 : 9.5);
    doc.text(label, totalsX, totalsY);
    doc.text(formatMoney(value, currency), pageWidth - margin, totalsY, { align: 'right' });
    totalsY += bold ? 7 : 5.5;
  };
  lineTotal('Sous-total', invoice.subtotal);
  if (invoice.discount_total) lineTotal('Remise', -invoice.discount_total);
  if (invoice.tax_total) lineTotal('TVA', invoice.tax_total);
  doc.setDrawColor(220);
  doc.line(totalsX, totalsY - 2, pageWidth - margin, totalsY - 2);
  lineTotal('Total', invoice.total, true);
  if (invoice.paid_amount) {
    lineTotal('Payé', invoice.paid_amount);
    lineTotal('Solde dû', invoice.total - invoice.paid_amount, true);
  }

  if (invoice.notes) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text(doc.splitTextToSize(invoice.notes, pageWidth - margin * 2 - 65), margin, totalsY + 4);
  }

  // --- Stamp (cachet) ---
  if (stampData) {
    try {
      doc.addImage(stampData, 'PNG', pageWidth - margin - 32, totalsY + 6, 32, 32, undefined, 'FAST');
    } catch { /* unsupported format, skip */ }
  }

  // --- Footer ---
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('Merci pour votre confiance.', pageWidth / 2, pageHeight - 12, { align: 'center' });

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
