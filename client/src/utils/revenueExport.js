import { groupDigits } from './numberFormat';

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
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function rowDate(r) {
  if (!r?.date) return '';
  try {
    return new Date(r.date).toISOString().slice(0, 10);
  } catch {
    return String(r.date).slice(0, 10);
  }
}

function formatAmount(amount, currency) {
  const n = Number(amount) || 0;
  if (currency === 'XAF') return groupDigits(n);
  if (currency === 'EUR') return `€${groupDigits(n, { maximumFractionDigits: 2 })}`;
  return `$${groupDigits(n, { maximumFractionDigits: 2 })}`;
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
    .kpi div { background: #F4F7FA; border-radius: 8px; padding: 10px 14px; min-width: 120px; border-top: 3px solid #2ECC71; }
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

function totalXaf(rows = []) {
  return rows.reduce((s, r) => s + (Number(r.amountXaf) || 0), 0);
}

/** Export revenue rows as Excel-compatible CSV. */
export function exportRevenueCsv(rows = [], { filename } = {}) {
  if (!rows.length) return false;
  const headers = ['Date', 'Source', 'Description', 'Amount', 'Currency', 'XAF', 'Reference', 'Status'];
  const lines = [headers.map(csvEscape).join(',')];
  rows.forEach((r) => {
    lines.push([
      rowDate(r),
      r.source || '',
      r.description || '',
      r.amount ?? '',
      r.currency || 'XAF',
      r.amountXaf ?? '',
      r.reference || '',
      r.status || ''
    ].map(csvEscape).join(','));
  });
  downloadTextFile(filename || `revenue-${stamp()}.csv`, `\uFEFF${lines.join('\r\n')}`);
  return true;
}

/** Printable revenue report (Save as PDF from browser print). */
export function printRevenueReport(rows = [], { title = 'Revenue Report' } = {}) {
  if (!rows.length) return false;
  const sum = totalXaf(rows);
  const bodyRows = rows.map((r) => `<tr>
    <td>${escapeHtml(rowDate(r))}</td>
    <td>${escapeHtml(r.source || '')}</td>
    <td>${escapeHtml(r.description || '')}</td>
    <td>${escapeHtml(formatAmount(r.amount, r.currency))}</td>
    <td>${escapeHtml(r.currency || 'XAF')}</td>
    <td>${escapeHtml(groupDigits(r.amountXaf ?? 0))}</td>
    <td>${escapeHtml(r.reference || '')}</td>
    <td>${escapeHtml(r.status || '')}</td>
  </tr>`).join('');

  return openPrintWindow(
    title,
    `<h1>${escapeHtml(title)}</h1>
     <p class="sub">${rows.length} entr${rows.length === 1 ? 'y' : 'ies'} · CargoTrader · ${escapeHtml(new Date().toLocaleString())}</p>
     <div class="kpi">
       <div><span>Entries</span><strong>${rows.length}</strong></div>
       <div><span>Total (XAF)</span><strong>${groupDigits(sum)}</strong></div>
     </div>
     <table>
       <thead><tr>
         <th>Date</th><th>Source</th><th>Description</th><th>Amount</th>
         <th>Currency</th><th>XAF</th><th>Reference</th><th>Status</th>
       </tr></thead>
       <tbody>${bodyRows}</tbody>
     </table>
     <p class="sub no-print">Use your browser’s print dialog → Save as PDF.</p>`
  );
}

/** Print selected revenue entries as individual slips. */
export function printSelectedRevenue(rows = []) {
  if (!rows.length) return false;
  const slips = rows.map((r) => `<div class="slip">
    <div class="slip-head">
      <div class="slip-id">${escapeHtml(r.reference && r.reference !== '—' ? r.reference : r.id || 'Revenue')}</div>
      <div>${escapeHtml(rowDate(r))}</div>
    </div>
    <div class="slip-grid">
      <div><span>Source</span>${escapeHtml(r.source || '—')}</div>
      <div><span>Status</span>${escapeHtml(r.status || '—')}</div>
      <div><span>Amount</span>${escapeHtml(formatAmount(r.amount, r.currency))} ${escapeHtml(r.currency || '')}</div>
      <div><span>XAF</span>${escapeHtml(groupDigits(r.amountXaf ?? 0))}</div>
      <div style="grid-column:1/-1"><span>Description</span>${escapeHtml(r.description || '—')}</div>
    </div>
  </div>`).join('');

  return openPrintWindow(
    'Selected Revenue',
    `<h1>Selected Revenue</h1>
     <p class="sub">${rows.length} entr${rows.length === 1 ? 'y' : 'ies'} · CargoTrader</p>
     ${slips}`
  );
}
