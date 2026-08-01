import { useMemo, useState, useEffect } from 'react';
import { formatXaf } from '../../utils/format';
import { statusBadgeClass } from '../../utils/utilizationColors';
import { usePurchaseSelection } from '../../hooks/usePurchaseSelection';
import { CategorySelectOptions } from '../../theme/inventoryConstants';
import ItemPhotoCell from '../inventory/ItemPhotoCell';
import ViewItemModal from '../inventory/modals/ViewItemModal';
import Td from '../common/Td';
import MobileSelectAllBar from '../common/MobileSelectAllBar';
import TablePagination from '../common/TablePagination';
import WarehouseStockItemModal from './WarehouseStockItemModal';
import { inventoryItemsApi } from '../../api';
import { emitInventoryChanged } from '../../utils/inventoryEvents';
import {
  exportInventoryCsv,
  printInventoryLabels,
  printInventoryReport
} from '../../utils/inventoryExport';
import { useT } from '../../i18n/LanguageContext';

const TAB_DEFS = [
  { id: 'stock', label: 'Stock List', icon: 'fa-boxes' },
  { id: 'log', label: 'Inbound/Outbound Log', icon: 'fa-history' }
];

export default function WarehouseDetailPanel({
  open,
  warehouseId,
  allWarehouses,
  detail,
  category = '',
  stockSearch = '',
  onCategoryChange,
  onStockSearchChange,
  page = 1,
  pageSize = 25,
  onPage,
  onPageSize,
  onClose,
  onSaveChanges,
  onTransfer,
  onDeleteStock,
  onRefresh,
  transferTick = 0,
  warehousesApi,
  showToast,
  readOnly = false
}) {
  const translate = useT();
  const { warehouse, stock, logs, pagination = {}, loading, reload } = detail;
  const [tab, setTab] = useState('stock');
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [itemSaving, setItemSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const stockRows = useMemo(
    () => stock.map((r) => ({ ...r, selectId: r._id || r.id })),
    [stock]
  );

  const selection = usePurchaseSelection(stockRows);

  useEffect(() => {
    if (transferTick > 0) selection.clearSelection();
  }, [transferTick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setTab('stock');
    selection.clearSelection();
  }, [warehouseId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  const wh = warehouse;

  const openTransfer = (rows = selection.selectedRows) => {
    if (!rows.length) {
      showToast?.('Select items to transfer');
      return;
    }
    onTransfer(wh, rows);
  };

  const openViewSelected = () => {
    const row = selection.selectedRows[0];
    if (row) setViewItem(row);
  };

  const openEditSelected = () => {
    if (selection.count !== 1) {
      showToast('Select exactly one item to edit');
      return;
    }
    const row = selection.selectedRows[0];
    if (!row) return;
    setEditItem(row);
    setItemFormOpen(true);
  };

  const handleExportAllStock = () => {
    if (!stockRows.length) {
      showToast('No items to export');
      return;
    }
    const slug = (wh?.name || 'warehouse').toLowerCase().replace(/\s+/g, '-');
    const ok = exportInventoryCsv(stockRows, {
      filename: `warehouse-${slug}-stock-${stockRows.length}.csv`
    });
    if (ok) showToast(`Exported ${stockRows.length} item(s)`, 'success');
  };

  const handleExportSelected = () => {
    if (!selection.count) {
      showToast('Select items to export');
      return;
    }
    const ok = exportInventoryCsv(selection.selectedRows, {
      filename: `warehouse-stock-selected-${selection.count}.csv`
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

  const handlePrintReport = () => {
    if (!stockRows.length) {
      showToast('No items to print');
      return;
    }
    const ok = printInventoryReport(stockRows, {
      title: `Warehouse Inventory — ${wh?.name || 'Warehouse'}`
    });
    if (!ok) showToast('Allow pop-ups to print the warehouse report');
  };

  const handleBulkDelete = async () => {
    if (!selection.count || readOnly) return;
    const count = selection.count;
    if (!window.confirm(`Delete ${count} selected item(s) from this warehouse? This cannot be undone.`)) {
      return;
    }
    setDeleting(true);
    try {
      const ids = selection.selectedRows.map((r) => r._id || r.id).filter(Boolean);
      if (onDeleteStock) {
        await onDeleteStock(ids);
      } else {
        await inventoryItemsApi.bulkDelete(ids);
      }
      selection.clearSelection();
      emitInventoryChanged();
      reload();
      onRefresh?.();
      showToast(count === 1 ? 'Item deleted' : `${count} item(s) deleted`, 'success');
    } catch (e) {
      showToast(e.response?.data?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const saveStockItem = async (data) => {
    setItemSaving(true);
    try {
      if (editItem) {
        await warehousesApi.updateStock(warehouseId, editItem._id, data);
        showToast('Item updated', 'success');
      } else {
        await warehousesApi.addStock(warehouseId, data);
        showToast('Item added', 'success');
      }
      setItemFormOpen(false);
      setEditItem(null);
      reload();
      onRefresh();
      emitInventoryChanged();
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to save item');
    } finally {
      setItemSaving(false);
    }
  };

  const tabCount = (id) => {
    if (id === 'stock') return pagination.total ?? stock.length;
    return logs.length;
  };

  return (
    <>
      <div className={`content-overlay${open ? ' open' : ''}`} onClick={onClose} />
      <div className={`fw-modal wh-detail-modal${open ? ' open' : ''}`} role="dialog">
        {loading && !wh ? (
          <div style={{ padding: 48, textAlign: 'center' }}><i className="fas fa-spinner fa-spin" /> Loading…</div>
        ) : wh ? (
          <>
            <div className="wh-detail-chrome">
              <div className="fw-modal-summary">
                <div className="fw-modal-summary-left">
                  <div className="fw-modal-wh-icon"><i className="fas fa-warehouse" /></div>
                  <div className="wh-detail-identity">
                    <div className="fw-modal-wh-name">{wh.name}</div>
                    <div className="fw-modal-wh-loc">{wh.flag} {wh.country} · {wh.address}</div>
                    <span className={`badge ${statusBadgeClass(wh.status)}`}>{wh.status}</span>
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
                      <i className={`fas ${tabDef.icon}`} /> {translate(tabDef.label)}
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
                          placeholder="Search items in warehouse…"
                          value={stockSearch}
                          onChange={(e) => onStockSearchChange?.(e.target.value)}
                        />
                      </div>
                      <select
                        className="stock-filter wh-detail-category"
                        value={category}
                        onChange={(e) => onCategoryChange?.(e.target.value)}
                        aria-label="All Categories"
                      >
                        <option value="">All Categories</option>
                        <CategorySelectOptions />
                      </select>
                      <span className="stock-view-hint wh-detail-hint">Stock items in this warehouse</span>
                      {!readOnly && (
                        <button
                          type="button"
                          className={`btn-bulk-transfer${selection.count ? ' visible' : ''}`}
                          onClick={() => openTransfer()}
                        >
                          <i className="fas fa-exchange-alt" /> Transfer ({selection.count})
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="wh-detail-header-btns">
                {tab === 'stock' && (
                  <>
                    <button type="button" className="btn-wh-toolbar wh-detail-icon-btn" onClick={handleExportAllStock} title="Export Stock" aria-label="Export Stock">
                      <i className="fas fa-file-excel" />
                    </button>
                    <button type="button" className="btn-wh-toolbar wh-detail-icon-btn" onClick={handlePrintReport} title="Print Report" aria-label="Print Report">
                      <i className="fas fa-print" />
                    </button>
                  </>
                )}
                <button type="button" className="fw-close-btn wh-detail-close" onClick={onClose} aria-label="Close">
                  <i className="fas fa-times" />
                </button>
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
                        {!readOnly && (
                          <button type="button" className="btn-bulk-inline" onClick={() => openTransfer()}>
                            <i className="fas fa-exchange-alt" /> Transfer Selected Items
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
                        {!readOnly && selection.count === 1 && (
                          <button type="button" className="btn-bulk-inline" onClick={openEditSelected}>
                            <i className="fas fa-pen" /> Edit
                          </button>
                        )}
                        {!readOnly && (
                          <button
                            type="button"
                            className="btn-bulk-inline"
                            style={{ background: 'var(--danger)' }}
                            onClick={handleBulkDelete}
                            disabled={deleting}
                          >
                            <i className="fas fa-trash" /> Delete Selected
                          </button>
                        )}
                        <button type="button" className="btn-bulk-clear-inline" onClick={selection.clearSelection}>Clear</button>
                      </div>
                    </div>
                  )}

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
                          <col className="wh-stock-col-location" />
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
                                ref={(el) => { if (el) el.indeterminate = selection.someVisibleSelected; }}
                                onChange={() => selection.toggleAll(selection.visibleIds)}
                                aria-label="Select all"
                              />
                            </th>
                            <th className="wh-stock-photo-cell">{translate('Photo')}</th>
                            <th className="wh-stock-name-cell">{translate('Item Name')}</th>
                            <th>{translate('SKU')}</th>
                            <th>{translate('Category')}</th>
                            <th>{translate('Qty')}</th>
                            <th>{translate('Location')}</th>
                            <th>{translate('Purchase Price')}</th>
                            <th>{translate('Target Price')}</th>
                            <th>{translate('Purchased')}</th>
                            <th>{translate('Actions')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {!stockRows.length && (
                            <tr><td colSpan={11} style={{ textAlign: 'center', padding: 32, color: 'var(--text-light)' }}>No items in this warehouse</td></tr>
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
                                  <input type="checkbox" checked={selected} onChange={() => selection.toggleRow(sid)} />
                                </Td>
                                <Td label="Photo" hideLabel className="wh-stock-photo-cell">
                                  <ItemPhotoCell photos={row.photos} category={row.category} size={32} />
                                </Td>
                                <Td label="Item Name" className="item-name wh-stock-name-cell" title={row.name}>
                                  {row.name}
                                </Td>
                                <Td label="SKU" className="sku-code">{row.sku}</Td>
                                <Td label="Category"><span className="cat-chip">{row.category}</span></Td>
                                <Td label="Qty">{row.qty}</Td>
                                <Td label="Location">{row.location}</Td>
                                <Td label="Purchase Price" className="val-cell">{formatXaf(row.purchasePrice)}</Td>
                                <Td label="Target Price" className="val-cell">{formatXaf(row.targetPrice)}</Td>
                                <Td label="Purchased">{row.purchaseDate || '—'}</Td>
                                <Td label="Actions" className="at-card-actions" onClick={(e) => e.stopPropagation()}>
                                  <button type="button" className="btn-action-icon" title="View" onClick={() => setViewItem(row)}><i className="fas fa-eye" /></button>
                                  {!readOnly && (
                                    <>
                                      <button type="button" className="btn-action-icon" title="Transfer" onClick={() => openTransfer([row])}><i className="fas fa-exchange-alt" /></button>
                                      <button type="button" className="btn-action-icon edit" title="Edit" onClick={() => { setEditItem(row); setItemFormOpen(true); }}><i className="fas fa-pen" /></button>
                                    </>
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
                      onPage={onPage}
                      onPageSize={onPageSize}
                      noun="items"
                      disabled={loading}
                    />
                  </div>
                </>
              )}

              {tab === 'log' && (
                <div>
                  <div className="stock-toolbar">
                    <span className="stock-view-hint">Inbound and outbound movements for {wh.name}</span>
                  </div>
                  {!logs.length ? (
                    <div className="damage-empty">
                      <i className="fas fa-history" />
                      <div className="empty-title">No activity logged yet</div>
                      <div className="empty-sub">Transfers and stock changes will appear in this log</div>
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
                          <div className={`log-qty ${log.type}`}>{log.type === 'inbound' ? '+' : '-'}{log.qty}</div>
                          <div className="log-date">{log.ago}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

            </div>

            <div className="fw-modal-footer">
              <span style={{ fontSize: 12, color: 'var(--text-light)' }}>🏭 CargoTrader / Warehouses / {wh.name}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn-fw-close" onClick={onClose}>Close</button>
                <button type="button" className="btn-save-changes" onClick={() => { onSaveChanges(); onClose(); }}>
                  <i className="fas fa-check" /> Save Changes
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>

      <WarehouseStockItemModal
        open={itemFormOpen}
        warehouseName={wh?.name}
        item={editItem}
        onClose={() => { setItemFormOpen(false); setEditItem(null); }}
        onSave={saveStockItem}
        saving={itemSaving}
      />

      <ViewItemModal
        open={Boolean(viewItem)}
        itemId={viewItem?._id || viewItem?.id}
        previewItem={viewItem}
        onClose={() => setViewItem(null)}
        stack
      />
    </>
  );
}
