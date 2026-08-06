import { useEffect, useMemo, useState } from 'react';
import AppShell from '../../layout/AppShell';
import { inventoryItemsApi } from '../../api';
import { useT } from '../../i18n/LanguageContext';
import AccountantReadOnlyNotice from '../../components/AccountantReadOnlyNotice';
import TablePagination from '../../components/common/TablePagination';

const TYPE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'inbound', label: 'Inbound' },
  { id: 'outbound', label: 'Outbound' }
];

const LOCATION_FILTERS = [
  { id: 'all', label: 'All locations' },
  { id: 'warehouse', label: 'Warehouses' },
  { id: 'store', label: 'Stores' },
  { id: 'shipment', label: 'Shipments' }
];

export default function InventoryActivityLogPage() {
  const t = useT();
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState({ total: 0, inbound: 0, outbound: 0 });
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [type, setType] = useState('all');
  const [locationKind, setLocationKind] = useState('all');
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    const id = setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [type, locationKind, searchDebounced]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    inventoryItemsApi
      .activityLog({
        type,
        locationKind,
        search: searchDebounced || undefined,
        page,
        limit: pageSize
      })
      .then((res) => {
        if (cancelled) return;
        const p = res.data?.pagination || {};
        setLogs(res.data?.data || []);
        setSummary(res.data?.summary || { total: 0, inbound: 0, outbound: 0 });
        setPagination({
          page: Number(p.page) || page,
          pageSize: Number(p.pageSize || p.limit) || pageSize,
          total: Number(p.total) || 0,
          pages: Number(p.pages) || 1
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setLogs([]);
        setSummary({ total: 0, inbound: 0, outbound: 0 });
        setPagination({ page: 1, pageSize, total: 0, pages: 1 });
        setError(err.response?.data?.message || 'Could not load activity log');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [type, locationKind, searchDebounced, page, pageSize]);

  const emptyHint = useMemo(() => {
    if (searchDebounced || type !== 'all' || locationKind !== 'all') {
      return t('No movements match your filters.');
    }
    return t(
      'No stock movements yet. Purchases, sales, deletes, and returns that change on-hand inventory appear here.'
    );
  }, [searchDebounced, type, locationKind, t]);

  return (
    <AppShell searchPlaceholder={t('Search inventory…')}>
      <div className="content inv-scroll-layout inv-activity-page">
        <AccountantReadOnlyNotice module="inventory" />

        <div className="inv-page-sticky inv-activity-chrome">
          <div className="inv-activity-chrome-strip">
            <div className="page-header">
              <div>
                <h1>{t('Inbound / Outbound Log')}</h1>
                <p className="page-sub page-chrome-dense-hide">
                  {t(
                    'Inbound: stock entering inventory (purchases, qty increases, returns). Outbound: stock leaving (sales, deletes, qty decreases). Location transfers are not listed here.'
                  )}
                </p>
              </div>
            </div>

            <div className="inv-activity-summary" aria-label={t('Movement summary')}>
              <div className="inv-activity-kpi">
                <span>{t('Shown')}</span>
                <strong>{summary.total}</strong>
              </div>
              <div className="inv-activity-kpi inbound">
                <span>{t('Inbound')}</span>
                <strong>+{summary.inbound}</strong>
              </div>
              <div className="inv-activity-kpi outbound">
                <span>{t('Outbound')}</span>
                <strong>−{summary.outbound}</strong>
              </div>
            </div>

            <div className="toolbar inv-action-bar inv-activity-toolbar">
              <div className="toolbar-search">
                <i className="fas fa-search search-icon" />
                <input
                  type="search"
                  placeholder={t('Search description, user, source, location…')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="inv-activity-pills" role="group" aria-label={t('Movement type')}>
                {TYPE_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={`inv-activity-pill${type === f.id ? ' active' : ''}`}
                    onClick={() => setType(f.id)}
                  >
                    {t(f.label)}
                  </button>
                ))}
              </div>
              <select
                className="filter-select"
                value={locationKind}
                onChange={(e) => setLocationKind(e.target.value)}
                aria-label={t('Location type')}
              >
                {LOCATION_FILTERS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {t(f.label)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="inv-fetch-error" style={{ marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div className="inv-activity-list">
          {loading && (
            <div className="inv-activity-empty">
              <i className="fas fa-spinner fa-spin" /> {t('Loading movements…')}
            </div>
          )}
          {!loading && !logs.length && (
            <div className="inv-activity-empty">
              <i className="fas fa-history" />
              <p>{emptyHint}</p>
            </div>
          )}
          {!loading &&
            logs.map((log) => (
              <div key={log.id || log._id} className="log-entry">
                <div className={`log-icon ${log.type}`}>
                  <i className={`fas fa-arrow-${log.type === 'inbound' ? 'down' : 'up'}`} />
                </div>
                <div className="log-info">
                  <div className="log-desc">{log.desc}</div>
                  <div className="log-meta">
                    <span className="inv-activity-loc">
                      <i
                        className={`fas ${
                          log.locationKind === 'store'
                            ? 'fa-store'
                            : log.locationKind === 'shipment'
                              ? 'fa-ship'
                              : 'fa-warehouse'
                        }`}
                      />
                      {log.locationName}
                    </span>
                    <span>{log.date}</span>
                    <span>{log.user}</span>
                    <span>{log.source}</span>
                  </div>
                </div>
                <div className="log-right">
                  <div className={`log-qty ${log.type}`}>
                    {log.type === 'inbound' ? '+' : '-'}
                    {log.qty}
                  </div>
                  <div className="log-date">{log.ago}</div>
                </div>
              </div>
            ))}
        </div>

        <TablePagination
          page={pagination.page || page}
          pages={pagination.pages || 1}
          total={pagination.total ?? summary.total}
          pageSize={pagination.pageSize || pageSize}
          onPage={setPage}
          onPageSize={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          noun="movements"
          disabled={loading}
        />
      </div>
    </AppShell>
  );
}
