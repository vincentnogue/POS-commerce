import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import Papa from 'papaparse';
import { useI18n } from '../lib/i18n';

export function DataTable<T>({
  columns, rows, empty, loading,
}: {
  columns: { key: string; label: string; render?: (row: T) => ReactNode; className?: string }[];
  rows: T[];
  empty?: ReactNode;
  loading?: boolean;
}) {
  const { t } = useI18n();
  if (loading) {
    return <div className="py-10 text-center text-sm text-ink-400 dark:text-ink-500">{t('common.loading')}</div>;
  }
  if (rows.length === 0) {
    return <div className="py-10 text-center text-sm text-ink-400 dark:text-ink-500">{empty ?? t('datatable.empty')}</div>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-100 dark:border-ink-800 text-left text-xs uppercase tracking-wide text-ink-500 dark:text-ink-400">
            {columns.map((c) => (
              <th key={c.key} className={`pb-2.5 font-medium ${c.className ?? ''}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-ink-50 dark:border-ink-800 last:border-0 hover:bg-brand-50/30 dark:hover:bg-brand-900/25">
              {columns.map((c) => (
                <td key={c.key} className={`py-3 ${c.className ?? ''}`}>
                  {c.render ? c.render(row) : (row as any)[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const { t } = useI18n();
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? t('datatable.searchPlaceholder')}
      className="input max-w-xs"
    />
  );
}

export function Select({ value, onChange, options, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input appearance-none pr-9"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 dark:text-ink-500" />
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">{hint}</p>}
    </div>
  );
}

export function exportCSV(filename: string, rows: Record<string, any>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => {
      const v = r[h];
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    }).join(',')),
  ].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Migration/import tool: parses a CSV file (any export from any other
// system — Square, Odoo, Shopify, a spreadsheet, whatever) into rows the
// caller can then map to real fields. Uses Papa Parse rather than a
// hand-rolled splitter so quoted values containing commas/newlines (very
// common in real-world exports, e.g. descriptions) are handled correctly.
// header:true gives us the column names directly; skipEmptyLines avoids
// phantom blank rows from trailing newlines.
export function parseCSV(file: File): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields ?? [];
        resolve({ headers, rows: results.data });
      },
      error: (err: Error) => reject(err),
    });
  });
}
