import QRCode from 'qrcode';
import { formatXaf } from './format';
import { itemPurchasePrice, itemTargetPrice } from '../theme/inventoryConstants';
import { buildItemQrPayload } from './itemQr';

function groupLabel(item) {
  const g = item?.group?.trim();
  return g || '—';
}

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

/** Build inventory rows for CSV / reports. */
export function inventoryExportRows(items = [], { includeCost = true } = {}) {
  return items.map((item) => {
    const row = {
      Name: item.name || '',
      SKU: item.sku || '',
      Category: item.category || '',
      Group: groupLabel(item),
      Qty: item.qty ?? 0,
      Location: item.location || '',
      Status: item.status || '',
      'Target Price (XAF)': itemTargetPrice(item) || 0,
      Purchased: item.purchaseDate || '',
      Notes: item.notes || ''
    };
    if (includeCost) {
      row['Purchase Price (XAF)'] = itemPurchasePrice(item) || 0;
    }
    return row;
  });
}

/** Download inventory as CSV (opens in Excel). */
export function exportInventoryCsv(items, { filename, includeCost = true } = {}) {
  const rows = inventoryExportRows(items, { includeCost });
  if (!rows.length) return false;

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(csvEscape).join(','),
    ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(','))
  ];
  // BOM helps Excel open UTF-8 correctly
  const csv = `\uFEFF${lines.join('\r\n')}`;
  downloadTextFile(filename || `inventory-${stamp()}.csv`, csv);
  return true;
}

function openPrintWindow(title, bodyHtml) {
  // Blob URL avoids blank tabs from window.open(..., 'noopener') where
  // document.write is blocked / the returned window is null.
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
    th, td { border: 1px solid #E5EAF0; padding: 8px 10px; text-align: left; }
    th { background: #FAFBFC; color: #8A97A8; text-transform: uppercase; font-size: 10px; letter-spacing: 0.4px; }
    .kpi { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
    .kpi div { background: #F4F7FA; border-radius: 8px; padding: 10px 14px; min-width: 120px; }
    .kpi strong { display: block; font-size: 18px; color: #1A3C5E; }
    .kpi span { font-size: 11px; color: #8A97A8; }
    .labels { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .label-card {
      border: 1.5px dashed #1A3C5E; border-radius: 10px; padding: 14px 16px;
      break-inside: avoid; page-break-inside: avoid;
      display: flex; gap: 12px; align-items: center;
    }
    .label-qr { width: 88px; height: 88px; flex-shrink: 0; object-fit: contain; }
    .label-qr-missing {
      width: 88px; height: 88px; flex-shrink: 0; display: flex; align-items: center;
      justify-content: center; border: 1px solid #E5EAF0; border-radius: 6px;
      font-size: 10px; color: #8A97A8; text-align: center; padding: 6px;
    }
    .label-body { min-width: 0; flex: 1; }
    .label-name { font-weight: 800; font-size: 14px; margin-bottom: 4px; }
    .label-sku { font-family: ui-monospace, monospace; font-size: 12px; color: #1A3C5E; }
    .label-meta { font-size: 11px; color: #5A6A7A; margin-top: 6px; }
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
  // Keep blob alive long enough for the tab to load / print
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

/** Print barcode-style labels with QR codes for selected items. */
export async function printInventoryLabels(items = []) {
  if (!items.length) return false;

  const cards = await Promise.all(
    items.map(async (item) => {
      const price = itemTargetPrice(item);
      const payload = buildItemQrPayload(item);
      let qrHtml = `<div class="label-qr-missing">No SKU</div>`;
      if (payload) {
        try {
          const dataUrl = await QRCode.toDataURL(payload, {
            width: 176,
            margin: 1,
            color: { dark: '#1A3C5E', light: '#FFFFFF' }
          });
          qrHtml = `<img class="label-qr" src="${dataUrl}" alt="QR ${escapeHtml(item.sku || '')}" />`;
        } catch {
          qrHtml = `<div class="label-qr-missing">QR unavailable</div>`;
        }
      }

      return `<div class="label-card">
        ${qrHtml}
        <div class="label-body">
          <div class="label-name">${escapeHtml(item.name || 'Item')}</div>
          <div class="label-sku">${escapeHtml(item.sku || '—')}</div>
          <div class="label-meta">
            ${escapeHtml(item.category || '')}
            ${item.location ? ` · ${escapeHtml(item.location)}` : ''}
            · Qty ${item.qty ?? 0}
            ${price ? ` · ${escapeHtml(formatXaf(price))}` : ''}
          </div>
        </div>
      </div>`;
    })
  );

  return openPrintWindow(
    'Inventory Labels',
    `<h1>Inventory Labels</h1>
     <p class="sub">${items.length} label${items.length !== 1 ? 's' : ''} with QR · CargoTrader</p>
     <div class="labels">${cards.join('')}</div>`
  );
}

/** Print a simple inventory summary report. */
export function printInventoryReport(items = [], { includeCost = true, title = 'Inventory Report' } = {}) {
  const totalUnits = items.reduce((s, i) => s + (Number(i.qty) || 0), 0);
  const totalValue = items.reduce((s, i) => s + (itemTargetPrice(i) || 0) * (Number(i.qty) || 0), 0);
  const totalCost = includeCost
    ? items.reduce((s, i) => s + (itemPurchasePrice(i) || 0) * (Number(i.qty) || 0), 0)
    : 0;

  const rows = items
    .map((item) => {
      const cells = [
        escapeHtml(item.name || ''),
        escapeHtml(item.sku || ''),
        escapeHtml(item.category || ''),
        escapeHtml(groupLabel(item)),
        item.qty ?? 0,
        escapeHtml(item.location || '—')
      ];
      if (includeCost) cells.push(escapeHtml(formatXaf(itemPurchasePrice(item) || 0)));
      cells.push(escapeHtml(formatXaf(itemTargetPrice(item) || 0)));
      return `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
    })
    .join('');

  const head = [
    'Item',
    'SKU',
    'Category',
    'Group',
    'Qty',
    'Location',
    ...(includeCost ? ['Purchase'] : []),
    'Target'
  ]
    .map((h) => `<th>${h}</th>`)
    .join('');

  return openPrintWindow(
    title,
    `<h1>${escapeHtml(title)}</h1>
     <p class="sub">Generated ${new Date().toLocaleString()} · CargoTrader</p>
     <div class="kpi">
       <div><strong>${items.length}</strong><span>SKUs</span></div>
       <div><strong>${totalUnits}</strong><span>Total units</span></div>
       <div><strong>${escapeHtml(formatXaf(totalValue))}</strong><span>Target value</span></div>
       ${includeCost ? `<div><strong>${escapeHtml(formatXaf(totalCost))}</strong><span>Purchase value</span></div>` : ''}
     </div>
     <table>
       <thead><tr>${head}</tr></thead>
       <tbody>${rows || '<tr><td colspan="8">No items</td></tr>'}</tbody>
     </table>`
  );
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
