import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatUsdAmount } from '../../utils/formatUsd';
import { formatXaf } from '../../utils/format';
import { shipmentStatusBadgeClass } from '../../utils/shipmentStatusBadge';
import { shippingApi } from '../../services/shippingApi';
import { warehousesApi } from '../../api';
import { useWarehouses } from '../../hooks/useWarehouses';
import { useStores } from '../../hooks/useStores';
import { useShipments } from '../../hooks/useShipments';
import { usePurchaseSelection } from '../../hooks/usePurchaseSelection';
import { CategorySelectOptions } from '../../theme/inventoryConstants';
import ItemPhotoCell from '../inventory/ItemPhotoCell';
import ViewItemModal from '../inventory/modals/ViewItemModal';
import Td from '../common/Td';
import MobileSelectAllBar from '../common/MobileSelectAllBar';
import TablePagination from '../common/TablePagination';
import StockBulkSelectionBar from '../common/StockBulkSelectionBar';
import TransferModal from '../warehouses/TransferModal';
import { emitInventoryChanged } from '../../utils/inventoryEvents';
import { exportShipmentItemsCsv, printPackingList } from '../../utils/shipmentExport';
import ShipmentLandedCostTab from './ShipmentLandedCostTab';

export default function ShipmentDetailModal({
  open,
  shipment,
  onClose,
  onMarkArrived,
  onItemsChanged,
  completed,
  readOnly = false,
  canViewCost = true,
  showToast
}) {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, pages: 1 });
  const [goodsCostXaf, setGoodsCostXaf] = useState(0);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [category, setCategory] = useState('');
  const [stockSearch, setStockSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [viewItem, setViewItem] = useState(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferItems, setTransferItems] = useState([]);
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferTick, setTransferTick] = useState(0);
  const [markingArrived, setMarkingArrived] = useState(false);
  const [activeTab, setActiveTab] = useState('items');
  const [worksheetTotals, setWorksheetTotals] = useState(null);
  const [liveShipment, setLiveShipment] = useState(shipment);
  const { warehouses } = useWarehouses();
  const { stores: allStores } = useStores({ lite: true });
  const { shipments: activeShipments } = useShipments({ mode: 'active', limit: 100 });

  const shipmentId = shipment?.shipmentId || shipment?.id;

  useEffect(() => {
    setLiveShipment(shipment);
    setWorksheetTotals(null);
    setActiveTab('items');
  }, [shipmentId, open]);

  useEffect(() => {
    const id = setTimeout(() => setSearchDebounced(stockSearch.trim()), 300);
    return () => clearTimeout(id);
  }, [stockSearch]);

  useEffect(() => {
    setPage(1);
  }, [category, searchDebounced, shipmentId]);

  const loadItems = useCallback(() => {
    if (!shipment) return;
    const id = shipment.shipmentId || shipment.id;
    setItemsLoading(true);
    const params = {
      page,
      limit: pageSize,
      category: category || undefined,
      search: searchDebounced || undefined
    };
    shippingApi.getItems(id, params)
      .then((res) => {
        const list = res.data?.data || [];
        setItems(list);
        if (res.data?.totals && Object.prototype.hasOwnProperty.call(res.data.totals, 'goodsCostXaf')) {
          setGoodsCostXaf(Number(res.data.totals.goodsCostXaf) || 0);
        } else {
          // Fallback when API has not returned totals yet
          setGoodsCostXaf(
            list.reduce(
              (sum, row) => sum + (Number(row.qty) || 0) * (Number(row.purchasePrice) || 0),
              0
            )
          );
        }
        const p = res.data?.pagination;
        if (p) {
          setPagination({
            page: Number(p.page) || page,
            pageSize: Number(p.pageSize || p.limit) || pageSize,
            total: Number(p.total) || 0,
            pages: Number(p.pages) || 1
          });
        } else {
          setPagination({ page: 1, pageSize: list.length || pageSize, total: list.length, pages: 1 });
        }
      })
      .catch(() => {
        setItems([]);
        setGoodsCostXaf(0);
        setPagination({ page: 1, pageSize, total: 0, pages: 1 });
      })
      .finally(() => setItemsLoading(false));
  }, [shipment, page, pageSize, category, searchDebounced]);

  useEffect(() => {
    if (!open) return;
    setCategory('');
    setStockSearch('');
    setSearchDebounced('');
    setPage(1);
    setPageSize(25);
  }, [open, shipmentId]);

  useEffect(() => {
    if (!open || !shipment) return;
    loadItems();
  }, [open, shipmentId, loadItems]);

  const stockRows = useMemo(
    () => items.map((r) => ({ ...r, selectId: r._id || r.id })),
    [items]
  );

  const itemsGoodsCost = useMemo(
    () =>
      stockRows.reduce(
        (sum, row) => sum + (Number(row.qty) || 0) * (Number(row.purchasePrice) || 0),
        0
      ),
    [stockRows]
  );
  // Prefer API full-shipment total; if it is still 0 while visible rows have cost, use row sum
  const displayGoodsCost = goodsCostXaf > 0 ? goodsCostXaf : itemsGoodsCost;

  const selection = usePurchaseSelection(stockRows);
  const totalItems = pagination.total || shipment?.items || items.length;

  useEffect(() => {
    if (transferTick > 0) selection.clearSelection();
  }, [transferTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const openTransfer = (rows = selection.selectedRows) => {
    if (!rows.length || readOnly) return;
    setTransferItems(rows);
    setTransferOpen(true);
  };

  const handleExportItems = (rows = selection.count ? selection.selectedRows : stockRows) => {
    if (!rows.length) {
      showToast?.('No items to export');
      return;
    }
    const ok = exportShipmentItemsCsv(rows, {
      filename: `shipment-${shipmentId}-items-${rows.length}.csv`,
      includeCost: canViewCost
    });
    if (ok) showToast?.(`Exported ${rows.length} item(s)`, 'success');
  };

  const handlePrintPackingList = (rows = selection.count ? selection.selectedRows : stockRows) => {
    const ok = printPackingList(shipment, rows.length ? rows : items);
    if (!ok) showToast?.('Allow pop-ups to print the packing list');
    else showToast?.('Packing list opened for printing', 'success');
  };

  const handleMarkArrivedClick = async () => {
    if (!onMarkArrived || markingArrived) return;
    setMarkingArrived(true);
    try {
      await onMarkArrived(shipment);
    } catch {
      /* parent shows toast */
    } finally {
      setMarkingArrived(false);
    }
  };

  const confirmTransfer = async ({ toDestinationId, destinationType, notes, items, itemIds }) => {
    if (!shipment) return;
    setTransferSaving(true);
    try {
      const lines = (items || []).map((i) => ({
        itemId: String(i.itemId || i.id || i._id || ''),
        qty: i.qty
      })).filter((i) => i.itemId);
      const res = await warehousesApi.transfer({
        sourceType: 'shipment',
        fromShipmentId: shipment.shipmentId || shipment.id,
        toDestinationId,
        destinationType,
        items: lines,
        itemIds: itemIds?.length ? itemIds : lines.map((i) => i.itemId),
        notes
      });
      showToast?.(res.data?.message || 'Transfer completed successfully!', 'success');
      setTransferTick((t) => t + 1);
      loadItems();
      onItemsChanged?.();
      emitInventoryChanged();
      return res.data?.message;
    } catch (e) {
      showToast?.(e.response?.data?.message || 'Transfer failed');
      throw e;
    } finally {
      setTransferSaving(false);
    }
  };

  if (!open || !shipment) return null;

  const displayShipment = liveShipment || shipment;
  const liveStatus = displayShipment.status;
  const transferSource = {
    type: 'shipment',
    id: shipmentId,
    shipmentId,
    name: shipmentId,
    originFlag: displayShipment.originFlag
  };
  const alreadyArrived = ['Arrived', 'Delivered', 'Closed', 'Offloaded'].includes(liveStatus);
  const landedCostDisplay =
    worksheetTotals?.grandTotalXaf != null
      ? formatXaf(worksheetTotals.grandTotalXaf)
      : formatUsdAmount(displayShipment.landedCostUsd);

  return (
    <>
      <div className={`content-overlay${open ? ' open' : ''}`} onClick={onClose} />
      <div className={`ship-fw-modal fw-modal${open ? ' open' : ''}`}>
        <div className="ship-detail-chrome">
          <div className="fw-modal-summary">
            <div className="fw-modal-summary-left">
              <div className="fw-modal-wh-icon"><i className="fas fa-ship" /></div>
              <div className="ship-detail-identity">
                <div className="fw-modal-wh-name">{shipmentId}</div>
                <div className="fw-modal-wh-loc">
                  {displayShipment.originFlag} {displayShipment.origin} → {displayShipment.destFlag} {displayShipment.dest}
                </div>
                <span className={`badge ${shipmentStatusBadgeClass(liveStatus)}`}>
                  {liveStatus}
                </span>
              </div>
            </div>
            <div className="fw-modal-summary-center">
              {canViewCost && (
                <div className="fw-modal-stat">
                  <div className="fw-modal-stat-val">{formatXaf(displayGoodsCost)}</div>
                  <div className="fw-modal-stat-label">Cost of Goods</div>
                </div>
              )}
              <div className="fw-modal-stat">
                <div className="fw-modal-stat-val">{landedCostDisplay}</div>
                <div className="fw-modal-stat-label">Landed Cost</div>
              </div>
              <div className="fw-modal-stat">
                <div className="fw-modal-stat-val">{totalItems}</div>
                <div className="fw-modal-stat-label">Total Items</div>
              </div>
              <div className="fw-modal-stat">
                <div className="fw-modal-stat-val">{displayShipment.weight || '—'}</div>
                <div className="fw-modal-stat-label">Cargo Weight</div>
              </div>
              <div className="fw-modal-stat">
                <div className="fw-modal-stat-val" style={{ fontSize: 13 }}>{displayShipment.carrier}</div>
                <div className="fw-modal-stat-label">ETA {displayShipment.eta}</div>
              </div>
              <div className="fw-modal-stat">
                <div className="fw-modal-stat-val" style={{ fontSize: 13 }}>
                  {displayShipment.currentLocation ||
                    [displayShipment.currentCity, displayShipment.currentCountry].filter(Boolean).join(', ') ||
                    '—'}
                </div>
                <div className="fw-modal-stat-label">Current location</div>
              </div>
            </div>
          </div>

          <div className="fw-modal-tabs">
            <div className="fw-tab-row">
              <button
                type="button"
                className={`fw-tab-btn${activeTab === 'items' ? ' active' : ''}`}
                aria-current={activeTab === 'items' ? 'page' : undefined}
                onClick={() => setActiveTab('items')}
              >
                <i className="fas fa-cube" /> Individual Items
                <span className="tab-count">{totalItems}</span>
              </button>
              {canViewCost && (
                <button
                  type="button"
                  className={`fw-tab-btn${activeTab === 'landed' ? ' active' : ''}`}
                  aria-current={activeTab === 'landed' ? 'page' : undefined}
                  onClick={() => setActiveTab('landed')}
                >
                  <i className="fas fa-calculator" /> Landed Cost
                </button>
              )}
            </div>
            {activeTab === 'items' && (
            <div className="fw-modal-tabs-right">
              <div className="fw-search-wrap">
                <i className="fas fa-search" />
                <input
                  className="fw-search-input"
                  placeholder="Search items on shipment…"
                  value={stockSearch}
                  onChange={(e) => setStockSearch(e.target.value)}
                />
              </div>
              <select
                className="stock-filter ship-detail-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label="All Categories"
              >
                <option value="">All Categories</option>
                <CategorySelectOptions />
              </select>
              <span className="stock-view-hint ship-detail-hint">Cargo items on this shipment</span>
              <button
                type="button"
                className="btn-ghost ship-detail-action"
                onClick={() => handleExportItems(stockRows)}
                title="Export Items"
                aria-label="Export Items"
              >
                <i className="fas fa-file-excel" />
                <span className="ship-detail-chrome-label">Export Items</span>
              </button>
              <button
                type="button"
                className="btn-ghost ship-detail-action"
                onClick={() => handlePrintPackingList(stockRows)}
                title="Print Packing List"
                aria-label="Print Packing List"
              >
                <i className="fas fa-print" />
                <span className="ship-detail-chrome-label">Print Packing List</span>
              </button>
              {!readOnly && (
                <button
                  type="button"
                  className={`btn-bulk-transfer${selection.count ? ' visible' : ''}`}
                  onClick={() => openTransfer()}
                >
                  <i className="fas fa-exchange-alt" /> Transfer ({selection.count})
                </button>
              )}
            </div>
            )}
            {!completed && !alreadyArrived && onMarkArrived && (
              <button
                type="button"
                className="btn-save-changes ship-detail-action ship-detail-mark-arrived"
                disabled={markingArrived}
                onClick={handleMarkArrivedClick}
              >
                <i className={`fas ${markingArrived ? 'fa-spinner fa-spin' : 'fa-check'}`} />
                <span className="ship-detail-chrome-label">
                  {markingArrived ? 'Updating…' : 'Mark Arrived'}
                </span>
              </button>
            )}
          </div>

          <button type="button" className="fw-close-btn ship-detail-close" onClick={onClose} aria-label="Close">
            <i className="fas fa-times" />
          </button>
        </div>

        <div className="fw-modal-body">
          {activeTab === 'landed' ? (
            <ShipmentLandedCostTab
              shipmentId={shipmentId}
              open={open && activeTab === 'landed'}
              readOnly={readOnly}
              canViewCost={canViewCost}
              showToast={showToast}
              onShipmentUpdated={(updated) => {
                if (updated) setLiveShipment((prev) => ({ ...prev, ...updated }));
                onItemsChanged?.();
              }}
              onTotalsChange={(t) => {
                if (t) setWorksheetTotals(t);
              }}
            />
          ) : itemsLoading ? (
              <p style={{ color: 'var(--text-light)', textAlign: 'center', padding: 40 }}>
                <i className="fas fa-spinner fa-spin" /> Loading items…
              </p>
            ) : (
              <>
                {selection.count > 0 && (
                  <StockBulkSelectionBar
                    count={selection.count}
                    onClear={selection.clearSelection}
                    actions={[
                      {
                        key: 'view',
                        icon: 'fa-eye',
                        label: 'View',
                        onClick: () => setViewItem(selection.selectedRows[0]),
                        disabled: selection.count !== 1
                      },
                      {
                        key: 'transfer',
                        icon: 'fa-exchange-alt',
                        label: 'Transfer Items',
                        shortLabel: 'Transfer',
                        onClick: () => openTransfer(),
                        hidden: readOnly
                      },
                      {
                        key: 'export',
                        icon: 'fa-file-excel',
                        label: 'Export Items',
                        shortLabel: 'Export',
                        onClick: () => handleExportItems(selection.selectedRows)
                      },
                      {
                        key: 'print',
                        icon: 'fa-print',
                        label: 'Print Packing List',
                        shortLabel: 'Print',
                        onClick: () => handlePrintPackingList(selection.selectedRows)
                      }
                    ]}
                  />
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
                        {canViewCost && <col className="wh-stock-col-price" />}
                        {canViewCost && <col className="wh-stock-col-price" />}
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
                          <th className="wh-stock-photo-cell">Photo</th>
                          <th className="wh-stock-name-cell">Item Name</th>
                          <th>SKU</th>
                          <th>Category</th>
                          <th>Qty</th>
                          {canViewCost && <th>Purchase Price</th>}
                          {canViewCost && <th>Target Price</th>}
                          <th>Purchased</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!stockRows.length && (
                          <tr>
                            <td colSpan={canViewCost ? 10 : 8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-light)' }}>
                              {pagination.total > 0 || category || searchDebounced
                                ? 'No items match your filters'
                                : 'No inventory items on this shipment yet. Transfer stock from Warehouses and choose Shipping as the destination.'}
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
                              style={{ cursor: 'pointer' }}
                            >
                              <Td label="" hideLabel className="wh-stock-check-cell" onClick={(e) => e.stopPropagation()}>
                                <input type="checkbox" checked={selected} onChange={() => selection.toggleRow(sid)} />
                              </Td>
                              <Td label="Photo" hideLabel className="wh-stock-photo-cell">
                                <ItemPhotoCell photos={row.photos} category={row.category} />
                              </Td>
                              <Td label="Item Name" className="item-name wh-stock-name-cell">{row.name}</Td>
                              <Td label="SKU" className="sku-code">{row.sku}</Td>
                              <Td label="Category"><span className="cat-chip">{row.category}</span></Td>
                              <Td label="Qty">{row.qty}</Td>
                              {canViewCost && <Td label="Purchase Price" className="val-cell">{formatXaf(row.purchasePrice)}</Td>}
                              {canViewCost && <Td label="Target Price" className="val-cell">{formatXaf(row.targetPrice)}</Td>}
                              <Td label="Purchased">{row.purchaseDate || '—'}</Td>
                              <Td label="Actions" className="at-card-actions" onClick={(e) => e.stopPropagation()}>
                                <button type="button" className="btn-action-icon" title="View" onClick={() => setViewItem(row)}>
                                  <i className="fas fa-eye" />
                                </button>
                                {!readOnly && (
                                  <button type="button" className="btn-action-icon" title="Transfer" onClick={() => openTransfer([row])}>
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
                    disabled={itemsLoading}
                  />
                </div>
              </>
            )}
        </div>

        {activeTab === 'landed' && canViewCost && worksheetTotals && (
          <div className="ship-lc-summary ship-lc-summary-dock" aria-label="Landed cost summary">
            <div className="ship-lc-sum-item">
              <span className="ship-lc-sum-label">Goods</span>
              <span className="ship-lc-sum-val">{formatXaf(worksheetTotals.goodsCostXaf)}</span>
            </div>
            <div className="ship-lc-sum-item">
              <span className="ship-lc-sum-label">Freight</span>
              <span className="ship-lc-sum-val">{formatXaf(worksheetTotals.freightCostXaf)}</span>
            </div>
            <div className="ship-lc-sum-item">
              <span className="ship-lc-sum-label">Ins. / duty / VAT</span>
              <span className="ship-lc-sum-val">{formatXaf(worksheetTotals.taxCostXaf)}</span>
            </div>
            <div className="ship-lc-sum-item">
              <span className="ship-lc-sum-label">Clearing</span>
              <span className="ship-lc-sum-val">{formatXaf(worksheetTotals.clearingXaf)}</span>
            </div>
            <div className="ship-lc-sum-item">
              <span className="ship-lc-sum-label">Other fees</span>
              <span className="ship-lc-sum-val">{formatXaf(worksheetTotals.extraFeesXaf)}</span>
            </div>
            <div className="ship-lc-sum-item ship-lc-sum-grand">
              <span className="ship-lc-sum-label">Landed total</span>
              <span className="ship-lc-sum-val">{formatXaf(worksheetTotals.grandTotalXaf)}</span>
            </div>
          </div>
        )}
      </div>

      <TransferModal
        open={transferOpen}
        fromSource={transferSource}
        selectedItems={transferItems}
        allWarehouses={warehouses}
        allStores={allStores}
        activeShipments={activeShipments}
        onClose={() => setTransferOpen(false)}
        onConfirm={confirmTransfer}
        saving={transferSaving}
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
