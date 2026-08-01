import { formatXaf } from './format';

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadTextFile(filename, content, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function locationLabel(s) {
  return [s.city, s.country].filter(Boolean).join(', ') || '';
}

function openPrintWindow(title, bodyHtml) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; color: #1a2b3c; margin: 24px; }
    h1 { font-size: 20px; margin: 0 0 4px; color: #1A3C5E; }
    .sub { color: #8A97A8; font-size: 12px; margin-bottom: 18px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #E5EAF0; padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: #FAFBFC; color: #8A97A8; text-transform: uppercase; font-size: 10px; letter-spacing: 0.4px; }
    .kpi { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
    .kpi div { background: #F4F7FA; border-radius: 8px; padding: 10px 14px; min-width: 120px; }
    .kpi strong { display: block; font-size: 18px; color: #1A3C5E; }
    .kpi span { font-size: 11px; color: #8A97A8; }
    @media print {
      body { margin: 12px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  ${bodyHtml}
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.focus(); window.print(); }, 250);
    });
  </script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'width=900,height=700');
  if (!win) {
    URL.revokeObjectURL(url);
    return false;
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

export function suppliersExportRows(suppliers = []) {
  return suppliers.map((s) => ({
    ID: s.supplierId || s.id || s._id || '',
    Name: s.name || '',
    City: s.city || '',
    Country: s.country || '',
    Email: s.email || '',
    Phone: s.phone || '',
    Rating: Number(s.rating || 0).toFixed(1),
    Purchases: s.purchaseCount ?? 0,
    'Total Value (XAF)': s.totalPurchaseValue || 0
  }));
}

/** Download suppliers as CSV (opens in Excel). */
export function exportSuppliersCsv(suppliers, { filename } = {}) {
  const rows = suppliersExportRows(suppliers);
  if (!rows.length) return false;

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(','))
  ];
  const csv = `\uFEFF${lines.join('\r\n')}`;
  downloadTextFile(filename || `suppliers-${stamp()}.csv`, csv);
  return true;
}

/** Print a suppliers summary list. */
export function printSuppliersReport(suppliers = [], { title = 'Supplier List' } = {}) {
  const totalPurchases = suppliers.reduce((s, r) => s + (Number(r.purchaseCount) || 0), 0);
  const totalValue = suppliers.reduce((s, r) => s + (Number(r.totalPurchaseValue) || 0), 0);
  const withContact = suppliers.filter((r) => r.email || r.phone).length;

  const rows = suppliers
    .map((s) => {
      const cells = [
        escapeHtml(s.supplierId || s.id || ''),
        escapeHtml(s.name || ''),
        escapeHtml(locationLabel(s) || '—'),
        escapeHtml(s.email || '—'),
        escapeHtml(s.phone || '—'),
        Number(s.rating || 0).toFixed(1),
        s.purchaseCount ?? 0,
        escapeHtml(formatXaf(s.totalPurchaseValue || 0))
      ];
      return `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
    })
    .join('');

  const head = ['ID', 'Name', 'Location', 'Email', 'Phone', 'Rating', 'Purchases', 'Total Value']
    .map((h) => `<th>${h}</th>`)
    .join('');

  return openPrintWindow(
    title,
    `<h1>${escapeHtml(title)}</h1>
     <p class="sub">Generated ${escapeHtml(new Date().toLocaleString())} · CargoTrader</p>
     <div class="kpi">
       <div><strong>${suppliers.length}</strong><span>Suppliers</span></div>
       <div><strong>${withContact}</strong><span>With contact</span></div>
       <div><strong>${totalPurchases}</strong><span>Linked purchases</span></div>
       <div><strong>${escapeHtml(formatXaf(totalValue))}</strong><span>Total purchase value</span></div>
     </div>
     <table>
       <thead><tr>${head}</tr></thead>
       <tbody>${rows || '<tr><td colspan="8">No suppliers</td></tr>'}</tbody>
     </table>`
  );
}
