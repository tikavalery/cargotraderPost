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
    h2 { font-size: 14px; color: #1A3C5E; margin: 20px 0 8px; border-bottom: 2px solid #1A3C5E; padding-bottom: 4px; }
    .kpi { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
    .kpi div { background: #F4F7FA; border-radius: 8px; padding: 10px 14px; min-width: 140px; border-top: 3px solid #1A3C5E; }
    .kpi.green div { border-top-color: #2ECC71; }
    .kpi strong { display: block; font-size: 16px; color: #1A3C5E; }
    .kpi span { font-size: 11px; color: #8A97A8; text-transform: uppercase; letter-spacing: 0.3px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 8px; }
    th, td { border: 1px solid #E5EAF0; padding: 8px 10px; text-align: left; }
    th { background: #FAFBFC; color: #8A97A8; text-transform: uppercase; font-size: 10px; letter-spacing: 0.4px; }
    .pos { color: #2ECC71; font-weight: 700; }
    .neg { color: #E74C3C; font-weight: 700; }
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

function periodLabel(period) {
  if (period === 'quarter') return 'This Quarter';
  if (period === 'year') return 'This Year';
  return 'This Month';
}

/** Download finance dashboard summary as Excel-compatible CSV. */
export function exportFinanceDashboardExcel(data, { period = 'month', currency = 'XAF' } = {}) {
  if (!data) return false;
  const { kpis = {}, revenueBySource = [], expenseByCategory = [], cashFlow = {}, plSummary } = data;
  const plLines = plSummary?.lines || [];
  const lines = [];

  lines.push(['CargoTrader — Finance Dashboard']);
  lines.push(['Period', periodLabel(period)]);
  lines.push(['Currency', currency]);
  lines.push(['Exported', new Date().toLocaleString()]);
  lines.push([]);

  lines.push(['KPIs']);
  lines.push(['Metric', 'Amount']);
  lines.push(['Total Revenue', kpis.revenue || '']);
  lines.push(['Total Expenses', kpis.expenses || '']);
  lines.push(['Net Profit', kpis.profit || '']);
  lines.push(['Margin %', kpis.marginPct ?? '']);
  lines.push(['Cash In', cashFlow.inFmt || '']);
  lines.push(['Cash Out', cashFlow.outFmt || '']);
  lines.push(['Cash Flow (Net)', cashFlow.netFmt || '']);
  lines.push([]);

  lines.push(['Revenue by Source']);
  lines.push(['Source', 'Amount', 'Share %']);
  revenueBySource.forEach((s) => lines.push([s.source, s.amount, s.pct]));
  if (!revenueBySource.length) lines.push(['—', '', '']);
  lines.push([]);

  lines.push(['Expenses by Category']);
  lines.push(['Category', 'Amount', 'Share %']);
  expenseByCategory.forEach((c) => lines.push([c.category, c.amount, c.pct]));
  if (!expenseByCategory.length) lines.push(['—', '', '']);
  lines.push([]);

  lines.push(['Business P&L Summary']);
  lines.push(['Line', 'Amount', 'Note']);
  plLines.forEach((r) => lines.push([r.label, r.amountFmt, r.sub || '']));
  if (!plLines.length) lines.push(['—', '', '']);

  const csv = lines.map((row) => row.map(csvEscape).join(',')).join('\r\n');
  downloadTextFile(`finance-dashboard-${stamp()}.csv`, `\uFEFF${csv}`);
  return true;
}

/** Open a printable PDF-ready finance dashboard report. */
export function exportFinanceDashboardPdf(data, { period = 'month', currency = 'XAF' } = {}) {
  if (!data) return false;
  const { kpis = {}, revenueBySource = [], expenseByCategory = [], cashFlow = {}, plSummary } = data;
  const plLines = plSummary?.lines || [];

  const revenueRows = revenueBySource.length
    ? revenueBySource.map((s) => `<tr><td>${escapeHtml(s.source)}</td><td>${escapeHtml(s.amount)}</td><td>${s.pct}%</td></tr>`).join('')
    : '<tr><td colspan="3">No revenue this period</td></tr>';

  const expenseRows = expenseByCategory.length
    ? [...expenseByCategory]
        .sort((a, b) => (b.amountXaf || 0) - (a.amountXaf || 0))
        .map((c) => `<tr><td>${escapeHtml(c.category)}</td><td>${escapeHtml(c.amount)}</td><td>${c.pct}%</td></tr>`)
        .join('')
    : '<tr><td colspan="3">No expenses this period</td></tr>';

  const plRows = plLines.length
    ? plLines
        .map((r) => {
          const cls = r.tone === 'pos' ? 'pos' : r.tone === 'neg' ? 'neg' : '';
          return `<tr>
            <td>${escapeHtml(r.label)}${r.sub ? ` <span style="color:#8A97A8">· ${escapeHtml(r.sub)}</span>` : ''}</td>
            <td class="${cls}">${escapeHtml(r.amountFmt)}</td>
          </tr>`;
        })
        .join('')
    : '<tr><td colspan="2">No P&amp;L activity this period</td></tr>';

  return openPrintWindow(
    'Finance Dashboard',
    `<h1>Finance Dashboard</h1>
     <p class="sub">${escapeHtml(periodLabel(period))} · ${escapeHtml(currency)} · CargoTrader · ${escapeHtml(new Date().toLocaleString())}</p>

     <h2>Key Metrics</h2>
     <div class="kpi green">
       <div><span>Total Revenue</span><strong>${escapeHtml(kpis.revenue || '—')}</strong></div>
       <div><span>Total Expenses</span><strong>${escapeHtml(kpis.expenses || '—')}</strong></div>
       <div><span>Net Profit</span><strong>${escapeHtml(kpis.profit || '—')}</strong></div>
       <div><span>Cash Flow (Net)</span><strong>${escapeHtml(cashFlow.netFmt || '—')}</strong></div>
     </div>

     <h2>Revenue by Source</h2>
     <table><thead><tr><th>Source</th><th>Amount</th><th>Share</th></tr></thead><tbody>${revenueRows}</tbody></table>

     <h2>Expenses by Category</h2>
     <table><thead><tr><th>Category</th><th>Amount</th><th>Share</th></tr></thead><tbody>${expenseRows}</tbody></table>

     <h2>Business P&amp;L Summary</h2>
     <table><thead><tr><th>Line</th><th>Amount</th></tr></thead><tbody>${plRows}</tbody></table>

     <p class="sub no-print">Use your browser’s print dialog → Save as PDF.</p>`
  );
}
