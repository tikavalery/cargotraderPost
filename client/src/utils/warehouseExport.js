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

/** Export warehouse list rows as Excel-compatible CSV. */
export function exportWarehousesCsv(rows = [], { filename } = {}) {
  if (!rows.length) return false;
  const headers = [
    'Name',
    'Country',
    'Address',
    'Status',
    'Manager',
    'Phone',
    'Items',
    'Staff',
    'Capacity (m³)',
    'Utilization %',
    'Value (USD)'
  ];
  const lines = [headers.map(csvEscape).join(',')];
  rows.forEach((w) => {
    lines.push([
      w.name || '',
      w.country || '',
      w.address || '',
      w.status || '',
      w.manager || '',
      w.phone || '',
      w.itemsCount ?? '',
      w.staffCount ?? '',
      w.capacityM3 ?? '',
      w.utilization ?? '',
      w.value ?? ''
    ].map(csvEscape).join(','));
  });
  downloadTextFile(filename || `warehouses-${stamp()}.csv`, `\uFEFF${lines.join('\r\n')}`);
  return true;
}
