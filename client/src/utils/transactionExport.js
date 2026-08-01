import { formatXaf } from './format';
import { txnStatusLabel } from '../constants/salesReturns';

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

function txnDate(t) {
  if (!t?.date) return '';
  try {
    return new Date(t.date).toISOString().slice(0, 10);
  } catch {
    return String(t.date).slice(0, 10);
  }
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

export function isRefundableTransaction(t) {
  return t && ['completed', 'partially_returned'].includes(t.status);
}

/** Void only completed sales that have not been returned. */
export function isVoidableTransaction(t) {
  return t && t.status === 'completed' && !(Number(t.refundedTotal) > 0);
}

export function transactionsExportRows(transactions = []) {
  return transactions.map((t) => ({
    Date: txnDate(t),
    ID: t.transactionId || t.id || '',
    Store: t.storeName || '',
    Items: t.itemCount || t.lines?.length || 0,
    'Total (XAF)': t.total || 0,
    Payment: t.payment || '',
    Status: txnStatusLabel(t.status),
    Customer: t.customerName || t.customer?.name || '',
    Cashier: t.cashierName || t.cashier || ''
  }));
}

/** Download transactions as CSV (opens in Excel). */
export function exportTransactionsCsv(transactions, { filename } = {}) {
  const rows = transactionsExportRows(transactions);
  if (!rows.length) return false;

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(','))
  ];
  const csv = `\uFEFF${lines.join('\r\n')}`;
  downloadTextFile(filename || `transactions-${stamp()}.csv`, csv);
  return true;
}

/** Print detail slips for selected transactions. */
export function printSelectedTransactions(transactions = []) {
  if (!transactions.length) return false;

  const slips = transactions
    .map((t) => {
      const id = t.transactionId || t.id || '—';
      return `<div class="slip">
        <div class="slip-head">
          <div>
            <h1 style="font-size:16px;margin:0">Transaction</h1>
            <div class="sub" style="margin:4px 0 0">CargoTrader</div>
          </div>
          <div class="slip-id">${escapeHtml(id)}</div>
        </div>
        <div class="slip-grid">
          <div><span>Date</span>${escapeHtml(txnDate(t) || '—')}</div>
          <div><span>Store</span>${escapeHtml(t.storeName || '—')}</div>
          <div><span>Items</span>${t.itemCount || t.lines?.length || 0}</div>
          <div><span>Total</span>${escapeHtml(formatXaf(t.total || 0))}</div>
          <div><span>Payment</span>${escapeHtml(t.payment || '—')}</div>
          <div><span>Status</span>${escapeHtml(txnStatusLabel(t.status))}</div>
        </div>
      </div>`;
    })
    .join('');

  return openPrintWindow(
    'Selected Transactions',
    `<p class="sub">${transactions.length} transaction${transactions.length !== 1 ? 's' : ''} · Generated ${escapeHtml(new Date().toLocaleString())}</p>
     ${slips}`
  );
}

/** Print a transactions summary report. */
export function printTransactionsReport(transactions = [], { title = 'Transactions Report' } = {}) {
  const totalSales = transactions.reduce((s, t) => s + (Number(t.total) || 0), 0);
  const completed = transactions.filter((t) => t.status === 'completed').length;
  const returned = transactions.filter(
    (t) => t.status === 'returned' || t.status === 'partially_returned'
  ).length;
  const voided = transactions.filter((t) => t.status === 'voided').length;

  const rows = transactions
    .map((t) => {
      const cells = [
        escapeHtml(txnDate(t) || '—'),
        escapeHtml(t.transactionId || ''),
        escapeHtml(t.storeName || '—'),
        t.itemCount || t.lines?.length || 0,
        escapeHtml(formatXaf(t.total || 0)),
        escapeHtml(t.payment || '—'),
        escapeHtml(txnStatusLabel(t.status))
      ];
      return `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
    })
    .join('');

  const head = ['Date', 'ID', 'Store', 'Items', 'Total', 'Payment', 'Status']
    .map((h) => `<th>${h}</th>`)
    .join('');

  return openPrintWindow(
    title,
    `<h1>${escapeHtml(title)}</h1>
     <p class="sub">Generated ${escapeHtml(new Date().toLocaleString())} · CargoTrader</p>
     <div class="kpi">
       <div><strong>${transactions.length}</strong><span>Transactions</span></div>
       <div><strong>${escapeHtml(formatXaf(totalSales))}</strong><span>Total sales</span></div>
       <div><strong>${completed}</strong><span>Completed</span></div>
       <div><strong>${returned}</strong><span>Returned / partial</span></div>
       <div><strong>${voided}</strong><span>Voided</span></div>
     </div>
     <table>
       <thead><tr>${head}</tr></thead>
       <tbody>${rows || '<tr><td colspan="7">No transactions</td></tr>'}</tbody>
     </table>`
  );
}
