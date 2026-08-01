import { exportInventoryCsv } from './inventoryExport';

function formatMoneyUsd(value) {
  const n = Number(value) || 0;
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
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

function escapeHtml(str) {
  return String(str)
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
    .meta { display: grid; grid-template-columns: repeat(2, minmax(180px, 1fr)); gap: 8px 24px; margin-bottom: 18px; font-size: 13px; }
    .meta strong { color: #1A3C5E; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #E5EAF0; padding: 8px 10px; text-align: left; }
    th { background: #FAFBFC; color: #8A97A8; text-transform: uppercase; font-size: 10px; letter-spacing: 0.4px; }
    .kpi { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
    .kpi div { background: #F4F7FA; border-radius: 8px; padding: 10px 14px; min-width: 120px; }
    .kpi strong { display: block; font-size: 18px; color: #1A3C5E; }
    .kpi span { font-size: 11px; color: #8A97A8; }
    .sign { margin-top: 32px; display: flex; gap: 48px; }
    .sign div { flex: 1; border-top: 1px solid #C5CED8; padding-top: 8px; font-size: 12px; color: #8A97A8; }
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

/** Export shipment list rows as Excel-compatible CSV. */
export function exportShipmentsCsv(rows = [], { filename } = {}) {
  if (!rows.length) return false;
  const headers = [
    'Shipment ID',
    'Status',
    'Origin',
    'Destination',
    'Carrier',
    'Location (City)',
    'Location (Country)',
    'Method',
    'ETA',
    'Items',
    'Weight',
    'Landed Cost (USD)',
    'Tracking/Container',
    'Warehouse',
    'Updated',
    'Mode'
  ];
  const lines = [headers.map(csvEscape).join(',')];
  rows.forEach((s) => {
    lines.push([
      s.shipmentId || s.id || '',
      s.status || '',
      s.origin || '',
      s.dest || '',
      s.carrier || '',
      s.currentCity || '',
      s.currentCountry || '',
      s.shippingMethod || '',
      s.eta || '',
      s.items ?? '',
      s.weight || '',
      s.landedCostUsd ?? '',
      s.container || s.trackingNumber || '',
      s.warehouseName || '',
      s.updated || '',
      s.mode || ''
    ].map(csvEscape).join(','));
  });
  downloadTextFile(filename || `shipments-${stamp()}.csv`, `\uFEFF${lines.join('\r\n')}`);
  return true;
}

/** Export cargo items on a shipment (reuses inventory CSV columns). */
export function exportShipmentItemsCsv(items = [], { filename, includeCost = true } = {}) {
  return exportInventoryCsv(items, {
    filename: filename || `shipment-items-${stamp()}.csv`,
    includeCost
  });
}

/** Print a packing list for a shipment and its cargo items. */
export function printPackingList(shipment, items = []) {
  if (!shipment) return false;
  const shipmentId = shipment.shipmentId || shipment.id || 'Shipment';
  const totalUnits = items.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);
  const route = `${shipment.origin || '—'} → ${shipment.dest || '—'}`;

  const rows = items
    .map(
      (item, idx) => `<tr>
        <td>${idx + 1}</td>
        <td>${escapeHtml(item.name || '')}</td>
        <td>${escapeHtml(item.sku || '')}</td>
        <td>${escapeHtml(item.category || '')}</td>
        <td>${item.qty ?? 0}</td>
        <td>${escapeHtml(item.location || 'On Transit')}</td>
      </tr>`
    )
    .join('');

  return openPrintWindow(
    `Packing List — ${shipmentId}`,
    `<h1>Packing List</h1>
     <p class="sub">${escapeHtml(shipmentId)} · Generated ${new Date().toLocaleString()} · CargoTrader</p>
     <div class="meta">
       <div><strong>Route:</strong> ${escapeHtml(route)}</div>
       <div><strong>Carrier:</strong> ${escapeHtml(shipment.carrier || '—')}</div>
       <div><strong>Status:</strong> ${escapeHtml(shipment.status || '—')}</div>
       <div><strong>ETA:</strong> ${escapeHtml(shipment.eta || '—')}</div>
       <div><strong>Tracking:</strong> ${escapeHtml(shipment.container || shipment.trackingNumber || '—')}</div>
       <div><strong>Weight:</strong> ${escapeHtml(shipment.weight || '—')}</div>
       <div><strong>Landed Cost:</strong> ${escapeHtml(formatMoneyUsd(shipment.landedCostUsd || 0))}</div>
       <div><strong>Warehouse:</strong> ${escapeHtml(shipment.warehouseName || '—')}</div>
     </div>
     <div class="kpi">
       <div><strong>${items.length}</strong><span>Line items</span></div>
       <div><strong>${totalUnits}</strong><span>Total units</span></div>
     </div>
     <table>
       <thead>
         <tr>
           <th>#</th>
           <th>Item</th>
           <th>SKU</th>
           <th>Category</th>
           <th>Qty</th>
           <th>Location</th>
         </tr>
       </thead>
       <tbody>
         ${rows || '<tr><td colspan="6">No items on this shipment</td></tr>'}
       </tbody>
     </table>
     <div class="sign">
       <div>Packed by</div>
       <div>Checked by</div>
       <div>Received by</div>
     </div>`
  );
}

/** Print a summary report of shipments (list page). */
export function printShipmentsReport(rows = [], { title = 'Shipments Report' } = {}) {
  if (!rows.length) return false;
  const totalCost = rows.reduce((s, r) => s + (Number(r.landedCostUsd) || 0), 0);
  const totalItems = rows.reduce((s, r) => s + (Number(r.items) || 0), 0);
  const bodyRows = rows
    .map(
      (s) => `<tr>
        <td>${escapeHtml(s.shipmentId || s.id || '')}</td>
        <td>${escapeHtml(s.status || '')}</td>
        <td>${escapeHtml(`${s.origin || ''} → ${s.dest || ''}`)}</td>
        <td>${escapeHtml(s.carrier || '')}</td>
        <td>${escapeHtml(s.currentLocation || [s.currentCity, s.currentCountry].filter(Boolean).join(', ') || '—')}</td>
        <td>${escapeHtml(s.eta || '')}</td>
        <td>${s.items ?? 0}</td>
        <td>${escapeHtml(formatMoneyUsd(s.landedCostUsd || 0))}</td>
      </tr>`
    )
    .join('');

  return openPrintWindow(
    title,
    `<h1>${escapeHtml(title)}</h1>
     <p class="sub">Generated ${new Date().toLocaleString()} · CargoTrader</p>
     <div class="kpi">
       <div><strong>${rows.length}</strong><span>Shipments</span></div>
       <div><strong>${totalItems}</strong><span>Items</span></div>
       <div><strong>${escapeHtml(formatMoneyUsd(totalCost))}</strong><span>Landed cost</span></div>
     </div>
     <table>
       <thead>
         <tr>
           <th>Shipment ID</th>
           <th>Status</th>
           <th>Route</th>
           <th>Carrier</th>
           <th>Location</th>
           <th>ETA</th>
           <th>Items</th>
           <th>Landed Cost</th>
         </tr>
       </thead>
       <tbody>${bodyRows}</tbody>
     </table>`
  );
}
