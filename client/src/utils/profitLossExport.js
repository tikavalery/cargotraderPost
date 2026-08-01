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
    h2 { font-size: 13px; color: #1A3C5E; margin: 18px 0 8px; border-bottom: 2px solid #1A3C5E; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #E5EAF0; padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: #FAFBFC; color: #8A97A8; text-transform: uppercase; font-size: 10px; letter-spacing: 0.4px; }
    td.amt { text-align: right; font-variant-numeric: tabular-nums; }
    .kpi { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
    .kpi div { background: #F4F7FA; border-radius: 8px; padding: 10px 14px; min-width: 130px; border-top: 3px solid #1A3C5E; }
    .kpi.green div { border-top-color: #2ECC71; }
    .kpi strong { display: block; font-size: 15px; color: #1A3C5E; }
    .kpi span { font-size: 10px; color: #8A97A8; text-transform: uppercase; letter-spacing: 0.3px; }
    .section { font-weight: 800; background: #F4F7FA; color: #1A3C5E; }
    .highlight { background: rgba(46,204,113,0.12); font-weight: 800; }
    .pos { color: #2ECC71; font-weight: 700; }
    .neg { color: #E74C3C; font-weight: 700; }
    .bold { font-weight: 700; }
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

function fmtKpi(kpis = {}, key, fallback = '0') {
  const fmtKey = `${key}Fmt`;
  if (kpis[fmtKey] != null) return String(kpis[fmtKey]);
  if (kpis[key] != null) return groupDigits(kpis[key]);
  return fallback;
}

function statementAmount(row) {
  if (row?.amountFmt) return row.amountFmt;
  if (row?.amountXaf == null) return '';
  return groupDigits(row.amountXaf);
}

/** Build a plain-text P&L summary for clipboard / email. */
export function buildProfitLossSummaryText(data, { businessName = 'Business', rangeLabel = '', currency = 'XAF' } = {}) {
  const kpis = data?.kpis || {};
  const statement = data?.statement || [];
  const lines = [
    `CargoTrader — Profit & Loss`,
    businessName,
    rangeLabel ? `Period: ${rangeLabel}` : '',
    `Currency: ${currency}`,
    `Exported: ${new Date().toLocaleString()}`,
    '',
    'KEY METRICS',
    `Total Revenue: ${fmtKpi(kpis, 'revenue')}`,
    `Cost of Goods Sold: ${fmtKpi(kpis, 'cogs')}`,
    `Gross Margin: ${kpis.grossMarginPct ?? 0}%`,
    `Operating Expenses: ${fmtKpi(kpis, 'operatingExpenses')}`,
    `Net Profit: ${fmtKpi(kpis, 'netProfit')}`,
    `Net Margin: ${kpis.netMarginPct ?? 0}%`,
    ''
  ];

  if (statement.length) {
    lines.push('STATEMENT');
    statement.forEach((row) => {
      const label = row.label || '';
      const amt = statementAmount(row);
      if (row.type === 'section') {
        lines.push(amt ? `${label}: ${amt}` : label);
      } else {
        lines.push(`  ${label}: ${amt}`);
      }
    });
  }

  return lines.filter((l, i) => l !== '' || lines[i - 1] !== '').join('\n');
}

/** Export P&L as Excel-compatible CSV. */
export function exportProfitLossExcel(data, { businessName = 'Business', rangeLabel = '', currency = 'XAF', filename } = {}) {
  if (!data) return false;
  const kpis = data.kpis || {};
  const statement = data.statement || [];
  const lines = [];

  lines.push(['CargoTrader — Profit & Loss Statement']);
  lines.push(['Business', businessName]);
  lines.push(['Period', rangeLabel]);
  lines.push(['Currency', currency]);
  lines.push(['Exported', new Date().toLocaleString()]);
  lines.push([]);

  lines.push(['Key Metrics']);
  lines.push(['Metric', 'Amount']);
  lines.push(['Total Revenue', fmtKpi(kpis, 'revenue')]);
  lines.push(['Cost of Goods Sold', fmtKpi(kpis, 'cogs')]);
  lines.push(['COGS % of Revenue', `${kpis.cogsPctOfRevenue ?? 0}%`]);
  lines.push(['Gross Margin %', `${kpis.grossMarginPct ?? 0}%`]);
  lines.push(['Operating Expenses', fmtKpi(kpis, 'operatingExpenses')]);
  lines.push(['Net Profit', fmtKpi(kpis, 'netProfit')]);
  lines.push(['Net Margin %', `${kpis.netMarginPct ?? 0}%`]);
  lines.push([]);

  lines.push(['Statement']);
  lines.push(['Item', 'Amount (XAF)', 'Type']);
  if (statement.length) {
    statement.forEach((row) => {
      lines.push([row.label || '', statementAmount(row), row.type || 'line']);
    });
  } else {
    lines.push(['No statement lines for this period', '', '']);
  }

  const csv = lines.map((row) => row.map(csvEscape).join(',')).join('\r\n');
  downloadTextFile(filename || `profit-loss-${stamp()}.csv`, `\uFEFF${csv}`);
  return true;
}

/** Printable P&L report (Save as PDF from browser print). */
export function exportProfitLossPdf(data, { businessName = 'Business', rangeLabel = '', currency = 'XAF' } = {}) {
  if (!data) return false;
  const kpis = data.kpis || {};
  const statement = data.statement || [];

  const stmtRows = statement.length
    ? statement.map((row) => {
        const amt = statementAmount(row);
        if (row.type === 'section') {
          const cls = [
            'section',
            row.highlight ? 'highlight' : '',
            row.negative ? 'neg' : row.amountXaf != null && row.amountXaf >= 0 ? 'pos' : ''
          ].filter(Boolean).join(' ');
          return `<tr class="${cls}">
            <td>${escapeHtml(row.label || '')}${row.sub ? ` <span style="color:#8A97A8;font-weight:500">· ${escapeHtml(row.sub)}</span>` : ''}</td>
            <td class="amt">${escapeHtml(amt)}</td>
          </tr>`;
        }
        const cls = [
          row.bold ? 'bold' : '',
          row.negative ? 'neg' : 'pos'
        ].filter(Boolean).join(' ');
        return `<tr class="${cls}">
          <td>${escapeHtml(row.label || '')}</td>
          <td class="amt">${escapeHtml(amt)}</td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="2">No financial activity in this period.</td></tr>';

  return openPrintWindow(
    'Profit & Loss Statement',
    `<h1>Profit &amp; Loss Statement</h1>
     <p class="sub">${escapeHtml(businessName)} · ${escapeHtml(rangeLabel || 'Period')} · ${escapeHtml(currency)} · ${escapeHtml(new Date().toLocaleString())}</p>

     <h2>Key Metrics</h2>
     <div class="kpi green">
       <div><span>Total Revenue</span><strong>${escapeHtml(fmtKpi(kpis, 'revenue'))}</strong></div>
       <div><span>COGS</span><strong>${escapeHtml(fmtKpi(kpis, 'cogs'))}</strong></div>
       <div><span>Op. Expenses</span><strong>${escapeHtml(fmtKpi(kpis, 'operatingExpenses'))}</strong></div>
       <div><span>Net Profit</span><strong>${escapeHtml(fmtKpi(kpis, 'netProfit'))}</strong></div>
       <div><span>Gross Margin</span><strong>${escapeHtml(String(kpis.grossMarginPct ?? 0))}%</strong></div>
     </div>

     <h2>Statement</h2>
     <table>
       <thead><tr><th>Item</th><th>Amount (XAF)</th></tr></thead>
       <tbody>${stmtRows}</tbody>
     </table>
     <p class="sub no-print">Use your browser’s print dialog → Save as PDF.</p>`
  );
}

/** Open mailto with P&L summary for accountant. */
export function emailProfitLossToAccountant(data, { businessName = 'Business', rangeLabel = '', currency = 'XAF' } = {}) {
  const body = buildProfitLossSummaryText(data, { businessName, rangeLabel, currency });
  const subject = encodeURIComponent(`P&L Report — ${businessName} — ${rangeLabel || 'Period'}`);
  const mailto = `mailto:?subject=${subject}&body=${encodeURIComponent(body)}`;
  window.location.href = mailto;
  return true;
}

export async function copyProfitLossSummary(data, options = {}) {
  const text = buildProfitLossSummaryText(data, options);
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  return false;
}
