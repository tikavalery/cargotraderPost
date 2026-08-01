import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { formatXaf } from '../../utils/format';
import { storeStatusBadgeClass } from '../../utils/utilizationColors';
import { usePurchaseSelection } from '../../hooks/usePurchaseSelection';
import { useStoreInventory } from '../../hooks/useStoreInventory';
import { useStoreLogs } from '../../hooks/useStoreLogs';
import { useToast } from '../../context/ToastContext';
import { CategorySelectOptions } from '../../theme/inventoryConstants';
import {
  exportInventoryCsv,
  printInventoryLabels,
  printInventoryReport
} from '../../utils/inventoryExport';
import { inventoryItemsApi } from '../../api';
import { emitInventoryChanged } from '../../utils/inventoryEvents';
import { useT } from '../../i18n/LanguageContext';
import ItemPhotoCell from '../inventory/ItemPhotoCell';
import Td from '../common/Td';
import MobileSelectAllBar from '../common/MobileSelectAllBar';
import TablePagination from '../common/TablePagination';

const TAB_DEFS = [
  { id: 'stock', label: 'Stock List', icon: 'fa-boxes' },
  { id: 'log', label: 'Inbound/Outbound Log', icon: 'fa-history' }
];

export default function StoreInventoryPanel({
  storeId,
  onViewItem,
  onTransfer,
  canTransfer = false,
  canDelete = false,
  transferTick = 0,
  onDeleted
}) {
  const t = useT();
  const { showToast } = useToast();
  const [tab, setTab] = useState('stock');
  const [category, setCategory] = useState('');
  const [stockSearch, setStockSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    const id = setTimeout(() => setSearchDebounced(stockSearch.trim()), 300);
    return () => clearTimeout(id);
  }, [stockSearch]);

  useEffect(() => {
    setPage(1);
  }, [category, searchDebounced, storeId]);

  const { items, store, pagination, loading, error, refetch } = useStoreInventory(storeId, {
    category,
    search: searchDebounced,
    page,
    limit: pageSize,
    paginated: true
  });
  const { logs, loading: logsLoading } = useStoreLogs(storeId);

  const stockRows = useMemo(
    () => items.map((r) => ({ ...r, selectId: r._id || r.id })),
    [items]
  );

  const selection = usePurchaseSelection(stockRows);
  const addressLine = store?.address || store?.city || '—';

  useEffect(() => {
    if (transferTick > 0) selection.clearSelection();
  }, [transferTick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setTab('stock');
    setCategory('');
    setStockSearch('');
    setSearchDebounced('');
    setPage(1);
    setPageSize(25);
    selection.clearSelection();
  }, [storeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const tabCount = (id) => {
    if (id === 'stock') return pagination.total ?? items.length;
    return logs.length;
  };

  const openTransfer = (rows = selection.selectedRows) => {
    if (!rows.length || !store) return;
    onTransfer?.(store, rows);
  };

  const openViewSelected = () => {
    const row = selection.selectedRows[0];
    if (row) onViewItem?.(row);
  };

  const handleExportAll = () => {
    if (!stockRows.length) {
      showToast('No items to export');
      return;
    }
    const slug = (store?.name || storeId || 'store').replace(/\s+/g, '-').toLowerCase();
    const ok = exportInventoryCsv(stockRows, {
      filename: `store-inventory-${slug}-${stockRows.length}.csv`
    });
    if (ok) showToast(`Exported ${stockRows.length} item(s)`, 'success');
  };

  const handlePrintReport = () => {
    if (!stockRows.length) {
      showToast('No items to print');
      return;
    }
    const ok = printInventoryReport(stockRows, {
      title: `Store Inventory Report — ${store?.name || 'Store'}`
    });
    if (!ok) showToast('Allow pop-ups to print the store report');
  };

  const handleExportSelected = () => {
    if (!selection.count) {
      showToast('Select items to export');
      return;
    }
    const ok = exportInventoryCsv(selection.selectedRows, {
      filename: `store-inventory-selected-${selection.count}.csv`
    });
    if (ok) showToast(`Exported ${selection.count} selected item(s)`, 'success');
  };

  const handlePrintLabels = async () => {
    if (!selection.count) {
      showToast('Select items to print labels');
      return;
    }
    try {
      const ok = await printInventoryLabels(selection.selectedRows);
      if (!ok) showToast('Allow pop-ups to print labels');
    } catch {
      showToast('Could not generate labels');
    }
  };

  const handleDeleteSelected = async () => {
    if (!selection.count || !canDelete) return;
    if (
      !window.confirm(
        `Delete ${selection.count} selected item(s) from store inventory? This cannot be undone.`
      )
    ) {
      return;
    }
    try {
      const ids = selection.selectedRows.map((r) => r._id || r.id).filter(Boolean);
      await inventoryItemsApi.bulkDelete(ids);
      showToast(
        ids.length === 1 ? 'Item deleted' : `${ids.length} item(s) deleted`,
        'success'
      );
      selection.clearSelection();
      emitInventoryChanged();
      await refetch?.();
      onDeleted?.();
    } catch (e) {
      showToast(e.response?.data?.message || 'Delete failed');
    }
  };

  if (loading && !store) {
    return (
      <div className="store-inventory-panel">
        <div style={{ padding: 48, textAlign: 'center' }}>
          <i className="fas fa-spinner fa-spin" /> Loading store inventory…
        </div>
      </div>
    );
  }

  if (error && !store) {
    return (
      <div className="store-inventory-panel">
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--danger)' }}>{error}</div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="store-inventory-panel">
        <div className="damage-empty">
          <i className="fas fa-store" />
          <div className="empty-title">Select a store</div>
          <div className="empty-sub">Choose a store from the navbar to view shelf inventory</div>
        </div>
      </div>
    );
  }

  return (
    <div className="store-inventory-panel">
      <div className="store-inv-chrome">
        <div className="fw-modal-summary">
          <div className="fw-modal-summary-left">
            <div className="fw-modal-wh-icon store-inv-icon">
              <span style={{ fontSize: 20 }}>{store.flag || store.icon || '🏪'}</span>
            </div>
            <div className="store-inv-identity">
              <div className="fw-modal-wh-name">{store.name}</div>
              <div className="fw-modal-wh-loc">
                {store.city ? `${store.city} · ` : ''}
                {addressLine}
              </div>
              <span className={`badge ${storeStatusBadgeClass(store.status)}`}>
                {store.status}
              </span>
            </div>
          </div>
        </div>

        <div className="fw-modal-tabs">
          <div className="fw-tab-row">
            {TAB_DEFS.map((tabDef) => (
              <button
                key={tabDef.id}
                type="button"
                className={`fw-tab-btn${tab === tabDef.id ? ' active' : ''}`}
                onClick={() => setTab(tabDef.id)}
                aria-current={tab === tabDef.id ? 'page' : undefined}
              >
                <i className={`fas ${tabDef.icon}`} /> {t(tabDef.label)}
                <span className="tab-count">{tabCount(tabDef.id)}</span>
              </button>
            ))}
          </div>
          <div className="fw-modal-tabs-right">
            {tab === 'stock' && (
              <>
                <div className="fw-search-wrap">
                  <i className="fas fa-search" />
                  <input
                    className="fw-search-input"
                    placeholder="Search items on shelf…"
                    value={stockSearch}
                    onChange={(e) => setStockSearch(e.target.value)}
                  />
                </div>
                <select
                  className="stock-filter store-inv-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  aria-label="All Categories"
                >
                  <option value="">All Categories</option>
                  <CategorySelectOptions />
                </select>
                <span className="stock-view-hint store-inv-hint">Sellable stock at {store.name}</span>
              </>
            )}
          </div>
        </div>

        <div className="header-btns store-inv-header-btns">
          <button
            type="button"
            className="btn-secondary store-inv-icon-btn"
            onClick={handleExportAll}
            title="Export Store Inventory"
            aria-label="Export Store Inventory"
          >
            <i className="fas fa-file-excel" />
          </button>
          <button
            type="button"
            className="btn-secondary store-inv-icon-btn"
            onClick={handlePrintReport}
            title="Print Store Report"
            aria-label="Print Store Report"
          >
            <i className="fas fa-print" />
          </button>
          <Link to="/stores" className="btn-secondary store-inv-banner-nav" title="All Stores" aria-label="All Stores">
            <i className="fas fa-store" />
            <span className="store-inv-chrome-label">All Stores</span>
          </Link>
          <Link
            to={storeId ? `/stores/pos?store=${encodeURIComponent(storeId)}` : '/stores/pos'}
            className="btn-add store-inv-banner-nav"
            title="Open POS"
            aria-label="Open POS"
          >
            <i className="fas fa-cash-register" />
            <span className="store-inv-chrome-label">Open POS</span>
          </Link>
        </div>
      </div>

      <div className="fw-modal-body">
        {tab === 'stock' && (
          <>
        {selection.count > 0 && (
          <div className="stock-bulk-bar visible">
            <div className="stock-bulk-bar-left">{selection.count} selected</div>
            <div className="stock-bulk-bar-actions">
              <button type="button" className="btn-bulk-inline" onClick={handleExportSelected}>
                <i className="fas fa-download" /> Export Selected
              </button>
              {canTransfer && (
                <button type="button" className="btn-bulk-inline" onClick={() => openTransfer()}>
                  <i className="fas fa-exchange-alt" /> Transfer Selected
                </button>
              )}
              <button type="button" className="btn-bulk-inline" onClick={handlePrintLabels}>
                <i className="fas fa-tags" /> Print Labels
              </button>
              {selection.count === 1 && (
                <button type="button" className="btn-bulk-inline" onClick={openViewSelected}>
                  <i className="fas fa-eye" /> View
                </button>
              )}
              {canDelete && (
                <button type="button" className="btn-bulk-delete" onClick={handleDeleteSelected}>
                  <i className="fas fa-trash" /> Delete Selected
                </button>
              )}
              <button type="button" className="btn-bulk-clear-inline" onClick={selection.clearSelection}>
                Clear
              </button>
            </div>
          </div>
        )}

        {error && <p style={{ color: 'var(--danger)', marginBottom: 12 }}>{error}</p>}

        <div className="fw-table-card">
          <div className="table-scroll-x">
            <MobileSelectAllBar
              checked={selection.allVisibleSelected && stockRows.length > 0}
              indeterminate={selection.someVisibleSelected}
              onChange={() => selection.toggleAll(selection.visibleIds)}
              disabled={!stockRows.length}
              countLabel={stockRows.length ? `${stockRows.length} item${stockRows.length !== 1 ? 's' : ''}` : ''}
            />
            <table className="stock-table at-responsive-table wh-stock-table">
              <colgroup>
                <col className="wh-stock-col-check" />
                <col className="wh-stock-col-photo" />
                <col className="wh-stock-col-name" />
                <col className="wh-stock-col-sku" />
                <col className="wh-stock-col-category" />
                <col className="wh-stock-col-qty" />
                <col className="wh-stock-col-price" />
                <col className="wh-stock-col-price" />
                <col className="wh-stock-col-date" />
                <col className="wh-stock-col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th className="wh-stock-check-cell">
                    <input
                      type="checkbox"
                      checked={selection.allVisibleSelected && stockRows.length > 0}
                      ref={(el) => {
                        if (el) el.indeterminate = selection.someVisibleSelected;
                      }}
                      onChange={() => selection.toggleAll(selection.visibleIds)}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="wh-stock-photo-cell">{t('Photo')}</th>
                  <th className="wh-stock-name-cell">{t('Item Name')}</th>
                  <th>{t('SKU')}</th>
                  <th>{t('Category')}</th>
                  <th>{t('Qty')}</th>
                  <th>{t('Purchase Price')}</th>
                  <th>{t('Target Price')}</th>
                  <th>{t('Purchased')}</th>
                  <th>{t('Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {!stockRows.length && !loading && (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: 32, color: 'var(--text-light)' }}>
                      No items on this store shelf yet — transfer stock from a warehouse
                    </td>
                  </tr>
                )}
                {loading && !stockRows.length && (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: 32, color: 'var(--text-light)' }}>
                      <i className="fas fa-spinner fa-spin" /> Loading…
                    </td>
                  </tr>
                )}
                {stockRows.map((row) => {
                  const sid = row.selectId;
                  const selected = selection.selectedIds.has(sid);
                  return (
                    <tr
                      key={sid}
                      className={selected ? 'selected-row' : ''}
                      onClick={() => selection.toggleRow(sid)}
                    >
                      <Td label="" hideLabel className="wh-stock-check-cell" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => selection.toggleRow(sid)}
                        />
                      </Td>
                      <Td label="Photo" hideLabel className="wh-stock-photo-cell">
                        <ItemPhotoCell photos={row.photos} category={row.category} size={32} />
                      </Td>
                      <Td label="Item Name" className="item-name wh-stock-name-cell" title={row.name}>
                        {row.name}
                      </Td>
                      <Td label="SKU" className="sku-code">
                        {row.sku}
                      </Td>
                      <Td label="Category">
                        <span className="cat-chip">{row.category}</span>
                      </Td>
                      <Td label="Qty">{row.qty}</Td>
                      <Td label="Purchase Price" className="val-cell">
                        {formatXaf(row.purchasePrice)}
                      </Td>
                      <Td label="Target Price" className="val-cell">
                        {formatXaf(row.targetPrice)}
                      </Td>
                      <Td label="Purchased">{row.purchaseDate || '—'}</Td>
                      <Td label="Actions" className="at-card-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn-action-icon"
                          title="View"
                          onClick={() => onViewItem?.(row)}
                        >
                          <i className="fas fa-eye" />
                        </button>
                        {canTransfer && (
                          <button
                            type="button"
                            className="btn-action-icon"
                            title="Transfer stock"
                            onClick={() => openTransfer([row])}
                          >
                            <i className="fas fa-exchange-alt" />
                          </button>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={pagination.page || page}
            pages={pagination.pages || 1}
            total={pagination.total ?? stockRows.length}
            pageSize={pagination.pageSize || pageSize}
            onPage={setPage}
            onPageSize={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            noun="items"
            disabled={loading}
          />
        </div>
          </>
        )}

        {tab === 'log' && (
          <div>
            <div className="stock-toolbar">
              <span className="stock-view-hint">
                {t('Inbound and outbound movements for {name}').replace('{name}', store.name)}
              </span>
            </div>
            {logsLoading && !logs.length ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-light)' }}>
                <i className="fas fa-spinner fa-spin" /> Loading log…
              </div>
            ) : !logs.length ? (
              <div className="damage-empty">
                <i className="fas fa-history" />
                <div className="empty-title">No activity logged yet</div>
                <div className="empty-sub">Transfers and POS sales will appear in this log</div>
              </div>
            ) : (
              logs.map((log) => (
                <div key={log._id} className="log-entry">
                  <div className={`log-icon ${log.type}`}>
                    <i className={`fas fa-arrow-${log.type === 'inbound' ? 'down' : 'up'}`} />
                  </div>
                  <div className="log-info">
                    <div className="log-desc">{log.desc}</div>
                    <div className="log-meta">
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
              ))
            )}
          </div>
        )}
      </div>

      <div className="fw-modal-footer">
        <span style={{ fontSize: 12, color: 'var(--text-light)' }}>
          🏪 CargoTrader / Stores / {store.name}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/stores" className="btn-fw-close">
            All Stores
          </Link>
          <Link to="/stores/pos" className="btn-save-changes">
            <i className="fas fa-cash-register" /> Open POS
          </Link>
        </div>
      </div>
    </div>
  );
}
