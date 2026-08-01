export function emptyCashFlowData() {
  return {
    rows: [],
    pagination: { page: 1, pageSize: 25, total: 0, pages: 1 },
    summary: {
      inflowXafFmt: '+0',
      outflowXafFmt: '−0',
      netXafFmt: '+0',
      inflowFmt: '0',
      outflowFmt: '0',
      netFmt: '0',
      inflowUsdFmt: '',
      outflowUsdFmt: '',
      netUsdFmt: '',
      inCount: 0,
      outCount: 0,
      syncedCount: 0,
      totalCount: 0,
      pendingCount: 0,
      inflowTrend: 0,
      outflowTrend: 0,
      inflowTrendLabel: 'vs yesterday',
      netPositive: true
    },
    tabCounts: { all: 0, income: 0, expenses: 0, refunds: 0, synced: 0 }
  };
}

export function normalizeCashFlowData(raw) {
  const base = emptyCashFlowData();
  if (!raw || typeof raw !== 'object') return base;
  if (Array.isArray(raw)) {
    return { ...base, rows: raw, pagination: { ...base.pagination, total: raw.length } };
  }
  const pagination = {
    ...base.pagination,
    ...(raw.pagination || {}),
    page: Number(raw.pagination?.page) || 1,
    pageSize: Number(raw.pagination?.pageSize || raw.pagination?.limit) || 25,
    total: Number(raw.pagination?.total) || (Array.isArray(raw.rows) ? raw.rows.length : 0),
    pages: Number(raw.pagination?.pages) || 1
  };
  if (!raw.pagination?.pages && pagination.pageSize > 0) {
    pagination.pages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));
  }
  return {
    rows: Array.isArray(raw.rows) ? raw.rows : [],
    pagination,
    summary: { ...base.summary, ...(raw.summary || {}) },
    tabCounts: { ...base.tabCounts, ...(raw.tabCounts || {}) }
  };
}
