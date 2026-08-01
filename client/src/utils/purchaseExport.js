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

function statusLabel(status) {
  if (status === 'saved') return 'Saved';
  if (status === 'draft') return 'Draft';
  return status || '—';
}

function supplierName(p) {
  return p.supplier?.name || p.supplierName || '';
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
    .slip {
      border: 1.5px solid #1A3C5E; border-radius: 10px; padding: 18px 20px;
      margin-bottom: 18px; break-inside: avoid; page-break-inside: avoid;
    }
    .slip-head { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
    .slip-id { font-family: ui-monospace, monospace; font-weight: 700; color: #1A3C5E; }
    .slip-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; font-size: 12px; }
    .slip-grid span { color: #8A97A8; display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px; }
    .slip-notes { margin-top: 12px; font-size: 12px; color: #5A6A7A; }
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

export function purchasesExportRows(purchases = []) {
  return purchases.map((p) => ({
    ID: p.purchaseId || p.id || '',
    Item: p.itemName || '',
    SKU: p.sku || '',
    Category: p.category || '',
    Supplier: supplierName(p),
    Qty: p.quantity ?? 0,
    Location: p.location || '',
    'Purchase Price (XAF)': p.purchasePrice || 0,
    'Target Price (XAF)': p.targetPrice || 0,
    'Purchase Value (XAF)': p.purchaseValue || 0,
    Purchased: p.purchaseDate || '',
    Status: statusLabel(p.status),
    Notes: p.notes || ''
  }));
}

/** Download purchases as CSV (opens in Excel). */
export function exportPurchasesCsv(purchases, { filename } = {}) {
  const rows = purchasesExportRows(purchases);
  if (!rows.length) return false;

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(','))
  ];
  const csv = `\uFEFF${lines.join('\r\n')}`;
  downloadTextFile(filename || `purchases-${stamp()}.csv`, csv);
  return true;
}

/** Print detail slips for selected purchases. */
export function printSelectedPurchases(purchases = []) {
  if (!purchases.length) return false;

  const slips = purchases
    .map((p) => {
      const id = p.purchaseId || p.id || '—';
      return `<div class="slip">
        <div class="slip-head">
          <div>
            <h1 style="font-size:16px;margin:0">Purchase Record</h1>
            <div class="sub" style="margin:4px 0 0">CargoTrader</div>
          </div>
          <div class="slip-id">${escapeHtml(id)}</div>
        </div>
        <div class="slip-grid">
          <div><span>Item</span>${escapeHtml(p.itemName || '—')}</div>
          <div><span>SKU</span>${escapeHtml(p.sku || '—')}</div>
          <div><span>Category</span>${escapeHtml(p.category || '—')}</div>
          <div><span>Supplier</span>${escapeHtml(supplierName(p) || '—')}</div>
          <div><span>Qty</span>${p.quantity ?? 0}</div>
          <div><span>Location</span>${escapeHtml(p.location || '—')}</div>
          <div><span>Purchase Price</span>${escapeHtml(formatXaf(p.purchasePrice || 0))}</div>
          <div><span>Target Price</span>${escapeHtml(formatXaf(p.targetPrice || 0))}</div>
          <div><span>Purchased</span>${escapeHtml(p.purchaseDate || '—')}</div>
          <div><span>Status</span>${escapeHtml(statusLabel(p.status))}</div>
        </div>
        ${
          p.notes
            ? `<div class="slip-notes"><strong>Notes:</strong> ${escapeHtml(p.notes)}</div>`
            : ''
        }
      </div>`;
    })
    .join('');

  return openPrintWindow(
    'Selected Purchases',
    `<p class="sub">${purchases.length} purchase${purchases.length !== 1 ? 's' : ''} · Generated ${escapeHtml(new Date().toLocaleString())}</p>
     ${slips}`
  );
}

/** Print a purchases summary report. */
export function printPurchasesReport(purchases = [], { title = 'Purchase Report' } = {}) {
  const totalQty = purchases.reduce((s, p) => s + (Number(p.quantity) || 0), 0);
  const totalCost = purchases.reduce((s, p) => s + (Number(p.purchaseValue) || 0), 0);
  const totalTarget = purchases.reduce((s, p) => s + (Number(p.value) || 0), 0);
  const saved = purchases.filter((p) => p.status === 'saved').length;
  const drafts = purchases.filter((p) => p.status === 'draft').length;

  const rows = purchases
    .map((p) => {
      const cells = [
        escapeHtml(p.purchaseId || p.id || ''),
        escapeHtml(p.itemName || ''),
        escapeHtml(p.sku || ''),
        escapeHtml(supplierName(p) || '—'),
        p.quantity ?? 0,
        escapeHtml(p.location || '—'),
        escapeHtml(formatXaf(p.purchasePrice || 0)),
        escapeHtml(formatXaf(p.targetPrice || 0)),
        escapeHtml(p.purchaseDate || '—'),
        escapeHtml(statusLabel(p.status))
      ];
      return `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
    })
    .join('');

  const head = [
    'ID',
    'Item',
    'SKU',
    'Supplier',
    'Qty',
    'Location',
    'Purchase',
    'Target',
    'Date',
    'Status'
  ]
    .map((h) => `<th>${h}</th>`)
    .join('');

  return openPrintWindow(
    title,
    `<h1>${escapeHtml(title)}</h1>
     <p class="sub">Generated ${escapeHtml(new Date().toLocaleString())} · CargoTrader</p>
     <div class="kpi">
       <div><strong>${purchases.length}</strong><span>Purchases</span></div>
       <div><strong>${totalQty}</strong><span>Total units</span></div>
       <div><strong>${escapeHtml(formatXaf(totalCost))}</strong><span>Purchase value</span></div>
       <div><strong>${escapeHtml(formatXaf(totalTarget))}</strong><span>Target value</span></div>
       <div><strong>${saved}</strong><span>Saved</span></div>
       <div><strong>${drafts}</strong><span>Drafts</span></div>
     </div>
     <table>
       <thead><tr>${head}</tr></thead>
       <tbody>${rows || '<tr><td colspan="10">No purchases</td></tr>'}</tbody>
     </table>`
  );
}
