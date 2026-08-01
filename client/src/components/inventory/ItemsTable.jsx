import { useMemo } from 'react';
import { itemGroupLabel, UNGROUPED_FILTER } from '../../hooks/useInventory';
import { useSyncedSearch } from '../../context/SearchContext';
import { CategoryFilterOptions, itemPurchasePrice, itemTargetPrice } from '../../theme/inventoryConstants';
import { formatXaf } from '../../utils/format';
import { usePermissions } from '../../hooks/usePermissions';
import { useWarehouseWorker } from '../../context/WarehouseWorkerContext';
import ItemQrButton from './ItemQrButton';
import ItemPhotoCell from './ItemPhotoCell';
import ScanFilterBanner from './ScanFilterBanner';
import Td from '../common/Td';
import MobileSelectAllBar from '../common/MobileSelectAllBar';
import { useT } from '../../i18n/LanguageContext';

export default function ItemsTable({
  items,
  loading,
  error,
  selection,
  onRowClick,
  category,
  location,
  group,
  categories,
  locations,
  groups,
  onCategory,
  onLocation,
  onGroup,
  onScan,
  onShowQr,
  scanFilterLabel,
  onClearScanFilter
}) {
  const t = useT();
  const { canViewCost, inventoryReadOnly, assignedStoreName, isWarehouseWorker, warehouseScopeMessage, assignedWarehousesLabel } = usePermissions();
  const warehouseCtx = useWarehouseWorker();
  const activeWarehouseName = warehouseCtx?.activeWarehouse?.name;
  const { selected, toggle, toggleAll, allSelected, indeterminate, count } = selection;
  const colCount = inventoryReadOnly ? (canViewCost ? 10 : 9) : (canViewCost ? 12 : 11);

  const colWidths = useMemo(() => {
    const parts = [];
    if (!inventoryReadOnly) parts.push(4);
    parts.push(5, canViewCost ? 15 : 19, 8, 8, 9, 5, canViewCost ? 13 : 16);
    if (canViewCost) parts.push(9);
    parts.push(9, 8, 5);
    const total = parts.reduce((sum, w) => sum + w, 0);
    return parts.map((w) => `${((w / total) * 100).toFixed(3)}%`);
  }, [inventoryReadOnly, canViewCost]);

  const warehouseSubtitle = (() => {
    if (activeWarehouseName) {
      return t('Stock at {name}', { name: activeWarehouseName });
    }
    if (warehouseScopeMessage) {
      return t('{scope} — warehouse stock only', { scope: warehouseScopeMessage });
    }
    if (assignedWarehousesLabel) {
      return t('Stock at {name}', { name: assignedWarehousesLabel });
    }
    return t('Warehouse stock — assigned locations only');
  })();

  return (
  <>
    <div className="inv-page-sticky">
      <div className="page-header">
        <div>
          <h1>{t('Individual Items')}</h1>
          <p className="page-sub">
            {isWarehouseWorker
              ? warehouseSubtitle
              : inventoryReadOnly
              ? assignedStoreName
                ? t('Stock at {name} — search, scan, and view selling prices', { name: assignedStoreName })
                : t('Store stock — search, scan, and view selling prices')
              : t('Loose stock — synced with purchases, warehouses, shipping & stores')}
          </p>
        </div>
        <div className="header-btns">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onRowClick('export-all')}
            title={t('Export All')}
            aria-label={t('Export All')}
          >
            <i className="fas fa-file-excel" />
            <span className="inv-chrome-label">{t('Export All')}</span>
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onRowClick('print-report')}
            title={t('Print Inventory Report')}
            aria-label={t('Print Inventory Report')}
          >
            <i className="fas fa-print" />
            <span className="inv-chrome-label">{t('Print Inventory Report')}</span>
          </button>
          <button
            type="button"
            className="btn-scan"
            onClick={onScan}
            title={t('Scan QR Code')}
            aria-label={t('Scan QR Code')}
          >
            <i className="fas fa-qrcode" />
            <span className="inv-chrome-label">{t('Scan QR Code')}</span>
          </button>
        </div>
      </div>
      <InventoryToolbar
        category={category}
        location={location}
        group={group}
        categories={categories}
        locations={locations}
        groups={groups}
        onCategory={onCategory}
        onLocation={onLocation}
        onGroup={onGroup}
        onScan={onScan}
        onClearScanFilter={onClearScanFilter}
        onManageGroups={inventoryReadOnly ? undefined : () => onRowClick('manage-groups')}
      />
      <ScanFilterBanner label={scanFilterLabel} onClear={onClearScanFilter} />
      <div className="inv-bulk-bar">
        <span>
          {scanFilterLabel
            ? '1 item (scan result)'
            : `${items.length} item${items.length !== 1 ? 's' : ''}`}
        </span>
        {count > 0 ? (
          <div className="bulk-actions">
            <span data-bulk-count>{count} selected</span>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onRowClick('export-selected')}
              title="Export Selected"
              aria-label="Export Selected"
            >
              <i className="fas fa-download" />
              <span className="inv-chrome-label">Export Selected</span>
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onRowClick('print-labels')}
              title="Print Labels"
              aria-label="Print Labels"
            >
              <i className="fas fa-tags" />
              <span className="inv-chrome-label">Print Labels</span>
            </button>
            {!inventoryReadOnly && (
              <>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={count !== 1}
                  onClick={() => onRowClick('bulk-view')}
                  title={count !== 1 ? 'Select exactly one item to view' : 'View selected item'}
                  aria-label="View"
                >
                  <i className="fas fa-eye inv-chrome-icon-only" aria-hidden="true" />
                  <span className="inv-chrome-label">View</span>
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={count !== 1}
                  onClick={() => onRowClick('bulk-edit')}
                  title={count !== 1 ? 'Select exactly one item to edit' : 'Edit selected item'}
                  aria-label="Edit"
                >
                  <i className="fas fa-pen" />
                  <span className="inv-chrome-label">Edit</span>
                </button>
                <button
                  type="button"
                  className="btn-bulk-delete"
                  onClick={() => onRowClick('bulk-delete')}
                  title="Delete Selected"
                  aria-label="Delete Selected"
                >
                  <i className="fas fa-trash" />
                  <span className="inv-chrome-label">Delete Selected</span>
                </button>
              </>
            )}
          </div>
        ) : (
          <span className="inv-bulk-hint">
            {inventoryReadOnly
              ? 'Click a row to view item details · Use Scan QR to look up products'
              : 'Select rows for bulk actions · Click a row to open item details'}
          </span>
        )}
      </div>
    </div>

    {/* Phone: fixed bottom dock — compact single row (top chrome clips Edit/Delete) */}
    {count > 0 && (
      <div className="inv-mobile-bulk-dock" role="toolbar" aria-label="Selected item actions">
        <span className="inv-mobile-bulk-count" title={`${count} selected`}>
          {count}
        </span>
        <div className="inv-mobile-bulk-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onRowClick('export-selected')}
            title="Export"
            aria-label="Export"
          >
            <i className="fas fa-download" aria-hidden="true" />
            <span className="inv-mobile-bulk-label">Export</span>
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onRowClick('print-labels')}
            title="Labels"
            aria-label="Labels"
          >
            <i className="fas fa-tags" aria-hidden="true" />
            <span className="inv-mobile-bulk-label">Labels</span>
          </button>
          {!inventoryReadOnly && (
            <>
              <button
                type="button"
                className="btn-secondary"
                disabled={count !== 1}
                onClick={() => onRowClick('bulk-view')}
                title="View"
                aria-label="View"
              >
                <i className="fas fa-eye" aria-hidden="true" />
                <span className="inv-mobile-bulk-label">View</span>
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={count !== 1}
                onClick={() => onRowClick('bulk-edit')}
                title="Edit"
                aria-label="Edit"
              >
                <i className="fas fa-pen" aria-hidden="true" />
                <span className="inv-mobile-bulk-label">Edit</span>
              </button>
              <button
                type="button"
                className="btn-bulk-delete"
                onClick={() => onRowClick('bulk-delete')}
                title="Delete"
                aria-label="Delete"
              >
                <i className="fas fa-trash" aria-hidden="true" />
                <span className="inv-mobile-bulk-label">Delete</span>
              </button>
            </>
          )}
        </div>
      </div>
    )}

    <div className={`inv-layout${count > 0 ? ' inv-layout--bulk-dock' : ''}`}>
      <div className="table-card">
        <div className="table-scroll-stack">
          <div className="table-wrap">
            {!inventoryReadOnly && (
              <MobileSelectAllBar
                checked={allSelected}
                indeterminate={indeterminate}
                onChange={toggleAll}
                disabled={!items.length}
                countLabel={items.length ? `${items.length} item${items.length !== 1 ? 's' : ''}` : ''}
              />
            )}
            <table className="inv-table inv-items-table at-responsive-table">
              <colgroup>
                {colWidths.map((width, i) => (
                  <col key={i} style={{ width }} />
                ))}
              </colgroup>
              <thead>
                <tr>
                  {!inventoryReadOnly && (
                    <th className="inv-check-col">
                      <input
                        type="checkbox"
                        className="inv-select-all"
                        checked={allSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = indeterminate;
                        }}
                        onChange={toggleAll}
                        aria-label={t('Select all')}
                      />
                    </th>
                  )}
                  <th>{t('Photo')}</th>
                  <th>{t('Item Name')}</th>
                  <th>{t('SKU')}</th>
                  <th>{t('Category')}</th>
                  <th>{t('Group')}</th>
                  <th>{t('Qty')}</th>
                  <th>{t('Location')}</th>
                  {canViewCost && <th>{t('Purchase Price')}</th>}
                  <th>{t('Target Price')}</th>
                  <th>{t('Purchased')}</th>
                  <th className="inv-qr-col">QR</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={colCount} style={{ textAlign: 'center', padding: 48, color: 'var(--text-light)' }}>
                      <i className="fas fa-spinner fa-spin" /> Loading items…
                    </td>
                  </tr>
                )}
                {!loading && !error && !items.length && (
                  <tr>
                    <td colSpan={colCount} style={{ textAlign: 'center', padding: 48, color: 'var(--text-light)' }}>
                      {scanFilterLabel
                        ? 'This product is not in the individual items list.'
                        : 'No individual items match your filters.'}
                      {!scanFilterLabel && (
                        <>
                          <br />
                          <span style={{ fontSize: 12, marginTop: 8, display: 'inline-block' }}>
                            Add items from Purchases or run <code>npm run seed</code>, then sign in with your account to load sample data.
                          </span>
                        </>
                      )}
                    </td>
                  </tr>
                )}
                {!loading &&
                  items.map((item) => {
                    const isSelected = selected.has(item._id);
                    return (
                      <tr
                        key={item._id}
                        className={isSelected ? 'row-selected' : ''}
                        onClick={() => onRowClick('view', item)}
                        style={{ cursor: 'pointer' }}
                      >
                        {!inventoryReadOnly && (
                          <Td label="" hideLabel className="inv-check-cell" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              className="inv-row-check"
                              checked={isSelected}
                              onChange={() => toggle(item._id)}
                              aria-label={`Select ${item.name}`}
                            />
                          </Td>
                        )}
                        <Td label="Photo" hideLabel>
                          <ItemPhotoCell photos={item.photos} category={item.category} size={32} />
                        </Td>
                        <Td label="Item Name">
                          <div className="item-name" title={item.name}>{item.name}</div>
                        </Td>
                        <Td label="SKU">
                          <span className="item-sku" title={item.sku}>{item.sku}</span>
                        </Td>
                        <Td label="Category" title={item.category}>{item.category}</Td>
                        <Td label="Group">
                          <span
                            className={`inv-group-label${item.group?.trim() ? '' : ' inv-group-label--empty'}`}
                            title={itemGroupLabel(item)}
                          >
                            {itemGroupLabel(item)}
                          </span>
                        </Td>
                        <Td label="Qty">
                          {item.qty}
                        </Td>
                        <Td
                          label="Location"
                          title={
                            item.shipmentId
                              ? `${item.location || 'On Transit'} (${item.shipmentId})`
                              : item.location || undefined
                          }
                        >
                          {item.location?.startsWith('On Transit') ? (
                            <span className="inv-loc-transit">
                              <i className="fas fa-ship" aria-hidden="true" />
                              {item.location}
                            </span>
                          ) : (
                            item.location || '—'
                          )}
                        </Td>
                        {canViewCost && (
                          <Td label="Purchase Price" className="value-cell">{formatXaf(itemPurchasePrice(item))}</Td>
                        )}
                        <Td label="Target Price" className="value-cell">{formatXaf(itemTargetPrice(item))}</Td>
                        <Td label="Purchased" title={item.purchaseDate || undefined}>{item.purchaseDate || '—'}</Td>
                        <Td label="QR" className="inv-qr-cell" onClick={(e) => e.stopPropagation()}>
                          <ItemQrButton record={item} onShowQr={onShowQr} />
                        </Td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </>
  );
}

export function InventoryToolbar({
  category,
  location,
  group,
  categories,
  locations,
  groups,
  onCategory,
  onLocation,
  onGroup,
  onScan,
  onClearScanFilter,
  onManageGroups
}) {
  const t = useT();
  const { search, setSearch } = useSyncedSearch();

  return (
    <div className="toolbar inv-action-bar">
      <div className="toolbar-search">
        <i className="fas fa-search search-icon" />
        <input
          type="search"
          placeholder={t('Filter items…')}
          value={search}
          onChange={(e) => {
            onClearScanFilter?.();
            setSearch(e.target.value);
          }}
        />
      </div>
      <select
        className="filter-select"
        value={category}
        onChange={(e) => {
          onClearScanFilter?.();
          onCategory(e.target.value);
        }}
      >
        <CategoryFilterOptions allLabel={t('All Categories')} />
      </select>
      <select
        className="filter-select"
        value={location}
        onChange={(e) => {
          onClearScanFilter?.();
          onLocation(e.target.value);
        }}
      >
        <option value="">{t('All Locations')}</option>
        {locations.map((loc) => (
          <option key={loc} value={loc}>
            {loc}
          </option>
        ))}
      </select>
      <select
        className="filter-select inv-group-filter"
        value={group}
        aria-label={t('Filter by Group')}
        onChange={(e) => {
          onClearScanFilter?.();
          onGroup(e.target.value);
        }}
      >
        <option value="">{t('All Groups')}</option>
        <option value={UNGROUPED_FILTER}>{t('Ungrouped')}</option>
        {groups.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>
      {onManageGroups && (
        <button
          type="button"
          className="btn-secondary inv-manage-groups-btn"
          onClick={onManageGroups}
          title={t('Add or manage groups')}
          aria-label={t('Add Group')}
        >
          <i className="fas fa-layer-group" />
          <span className="inv-chrome-label">{t('Add Group')}</span>
        </button>
      )}
    </div>
  );
}
