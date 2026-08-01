/** Shared CSV / print helpers for Quick Stats pages. */

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadTextFile(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
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

/**
 * @param {Array<{ section?: string, label: string, value: string|number, note?: string }>} rows
 */
export function exportQuickStatsCsv(rows = [], { filename, title = 'Quick Stats' } = {}) {
  if (!rows.length) return false;
  const lines = [
    ['Section', 'Metric', 'Value', 'Note'].map(csvEscape).join(','),
    ...rows.map((r) =>
      [r.section || title, r.label, r.value, r.note || ''].map(csvEscape).join(',')
    )
  ];
  downloadTextFile(filename || `quick-stats-${stamp()}.csv`, `\uFEFF${lines.join('\r\n')}`);
  return true;
}

/**
 * @param {Array<{ label: string, kpis: Array<{ label: string, value: string|number, footer?: string }> }>} sections
 */
export function printQuickStats(sections = [], { title = 'Quick Stats', subtitle = '' } = {}) {
  if (!sections.length) return false;

  const body = sections
    .map((section) => {
      const cards = (section.kpis || [])
        .map(
          (k) => `<div class="card">
            <div class="label">${escapeHtml(k.label)}</div>
            <div class="value">${escapeHtml(k.value)}</div>
            ${k.footer ? `<div class="footer">${escapeHtml(k.footer)}</div>` : ''}
          </div>`
        )
        .join('');
      return `<h2>${escapeHtml(section.label)}</h2><div class="grid">${cards}</div>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; color: #1a2b3c; margin: 24px; }
    h1 { font-size: 22px; margin: 0 0 4px; color: #1A3C5E; }
    h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; color: #8A97A8; margin: 24px 0 10px; }
    .sub { color: #8A97A8; font-size: 12px; margin-bottom: 18px; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .card { border: 1px solid #E5EAF0; border-radius: 8px; padding: 14px; background: #FAFBFC; }
    .label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #8A97A8; }
    .value { font-size: 22px; font-weight: 800; color: #1A3C5E; margin: 6px 0 4px; }
    .footer { font-size: 11px; color: #8A97A8; }
    @media print { body { margin: 12px; } .grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 800px) { .grid { grid-template-columns: repeat(2, 1fr); } }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p class="sub">${escapeHtml(subtitle || `Generated ${new Date().toLocaleString()} · CargoTrader`)}</p>
  ${body}
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.focus(); window.print(); }, 250);
    });
  </script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank', 'width=960,height=720');
  if (!win) {
    URL.revokeObjectURL(url);
    return false;
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

export function flattenSectionsForCsv(sections = [], title = 'Quick Stats') {
  const rows = [];
  sections.forEach((section) => {
    (section.kpis || []).forEach((k) => {
      rows.push({
        section: section.label || title,
        label: k.label,
        value: k.value,
        note: typeof k.footer === 'string' ? k.footer : ''
      });
    });
  });
  return rows;
}

export { formatUsdAmount } from './formatUsd';
