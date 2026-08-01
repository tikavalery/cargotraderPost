import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppShell from '../../layout/AppShell';
import { usePermissions } from '../../hooks/usePermissions';
import { useSyncedSearch } from '../../context/SearchContext';
import { useToast } from '../../context/ToastContext';
import { useShipmentDocuments } from '../../hooks/useShipments';
import { useShipments } from '../../hooks/useShipments';
import { docStatusBadgeClass } from '../../utils/shipmentStatusBadge';
import { shippingApi } from '../../services/shippingApi';
import { usePurchaseSelection } from '../../hooks/usePurchaseSelection';
import ShipmentFilterChips from '../../components/shipping/ShipmentFilterChips';
import UploadDocumentModal from '../../components/shipping/UploadDocumentModal';
import TablePagination from '../../components/common/TablePagination';
import Td from '../../components/common/Td';
import MobileSelectAllBar from '../../components/common/MobileSelectAllBar';
import {
  downloadDocumentFile,
  exportDocumentsCsv,
  exportDocumentsZip,
  openDocumentInNewTab,
  printDocumentsReport
} from '../../utils/documentExport';

export default function DocumentsPage() {
  const { canManageShipments } = usePermissions();
  const { showToast } = useToast();
  const { search } = useSyncedSearch();
  const [searchParams] = useSearchParams();
  const shipmentParam = searchParams.get('shipment') || '';
  const { shipments: activeShipments } = useShipments({ mode: 'active' });
  const { shipments: completedShipments } = useShipments({ mode: 'completed' });
  const allShipments = [...activeShipments, ...completedShipments];

  const [chip, setChip] = useState('All');
  const [typeFilter, setTypeFilter] = useState('all');
  const [shipmentFilter, setShipmentFilter] = useState(shipmentParam);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [searchDebounced, setSearchDebounced] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editDoc, setEditDoc] = useState(null);
  const [viewDoc, setViewDoc] = useState(null);
  const [deletingId, setDeletingId] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    if (shipmentParam) setShipmentFilter(shipmentParam);
  }, [shipmentParam]);

  useEffect(() => {
    const id = setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [searchDebounced, chip, typeFilter, shipmentFilter]);

  const { documents, pagination, loading, error, reload } = useShipmentDocuments({
    paginated: true,
    page,
    limit: pageSize,
    search: searchDebounced,
    statusChip: chip,
    type: typeFilter,
    shipmentId: shipmentFilter
  });

  const selectableDocs = useMemo(
    () => documents.map((d) => ({ ...d, selectId: d.docId || d.id })),
    [documents]
  );
  const selection = usePurchaseSelection(selectableDocs);

  const requireSelection = () => {
    if (!selection.count) {
      showToast('Select one or more documents first');
      return false;
    }
    return true;
  };

  const handleExportAll = () => {
    if (!documents.length) {
      showToast('No documents to export');
      return;
    }
    const ok = exportDocumentsCsv(documents, {
      filename: `shipment-documents-${documents.length}.csv`
    });
    if (ok) showToast(`Exported ${documents.length} document(s) as CSV`, 'success');
  };

  const handleExportAllZip = async () => {
    if (!documents.length) {
      showToast('No documents to export');
      return;
    }
    setBulkBusy(true);
    try {
      const ok = await exportDocumentsZip(documents, {
        filename: `shipment-documents-page-${documents.length}.zip`
      });
      if (ok) showToast(`ZIP ready — ${documents.length} document(s)`, 'success');
    } catch {
      showToast('Could not create ZIP archive');
    } finally {
      setBulkBusy(false);
    }
  };

  const handlePrintSelected = () => {
    if (!requireSelection()) return;
    const ok = printDocumentsReport(selection.selectedRows, {
      title: 'Selected Shipment Documents'
    });
    if (!ok) showToast('Allow pop-ups to print documents');
    else showToast(`Printing ${selection.count} document(s)`, 'success');
  };

  const handleExportZip = async (rows = selection.selectedRows) => {
    if (!rows.length) {
      showToast('Select one or more documents first');
      return;
    }
    setBulkBusy(true);
    try {
      const ok = await exportDocumentsZip(rows, {
        filename: `shipment-documents-selected-${rows.length}.zip`
      });
      if (ok) showToast(`ZIP ready — ${rows.length} document(s)`, 'success');
    } catch {
      showToast('Could not create ZIP archive');
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkDownload = () => {
    if (!requireSelection()) return;
    handleExportZip(selection.selectedRows);
  };

  const handleDownloadOne = async (doc) => {
    try {
      const ok = await downloadDocumentFile(doc);
      if (ok) showToast(`Downloaded ${doc.fileName || doc.name}`, 'success');
      else showToast('No file attached — downloaded a summary instead');
    } catch {
      showToast('Download failed');
    }
  };

  const handleOpenFile = async (doc) => {
    try {
      const ok = await openDocumentInNewTab(doc);
      if (!ok) showToast('Could not open file — try Download instead');
    } catch {
      showToast('Could not open file');
    }
  };

  const handleDelete = async (doc) => {
    const id = doc.docId || doc.id;
    if (!id) return;
    if (!window.confirm(`Delete document "${doc.name}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await shippingApi.deleteDocument(id);
      if (viewDoc && (viewDoc.docId === id || viewDoc.id === id)) setViewDoc(null);
      if (editDoc && (editDoc.docId === id || editDoc.id === id)) setEditDoc(null);
      selection.clearSelection();
      showToast('Document deleted', 'success');
      reload();
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not delete document');
    } finally {
      setDeletingId('');
    }
  };

  const handleDeleteSelected = async () => {
    if (!requireSelection()) return;
    if (!canManageShipments) {
      showToast('You do not have permission to delete documents');
      return;
    }
    const rows = selection.selectedRows;
    if (!window.confirm(
      `Delete ${rows.length} selected document${rows.length !== 1 ? 's' : ''}? This cannot be undone.`
    )) return;

    setBulkBusy(true);
    let deleted = 0;
    try {
      for (const doc of rows) {
        const id = doc.docId || doc.id;
        if (!id) continue;
        await shippingApi.deleteDocument(id);
        deleted += 1;
      }
      if (viewDoc && rows.some((d) => (d.docId || d.id) === (viewDoc.docId || viewDoc.id))) {
        setViewDoc(null);
      }
      if (editDoc && rows.some((d) => (d.docId || d.id) === (editDoc.docId || editDoc.id))) {
        setEditDoc(null);
      }
      selection.clearSelection();
      showToast(`Deleted ${deleted} document${deleted !== 1 ? 's' : ''}`, 'success');
      reload();
    } catch (err) {
      showToast(err.response?.data?.message || `Deleted ${deleted} before an error occurred`);
      reload();
    } finally {
      setBulkBusy(false);
    }
  };

  const handleEdit = (doc) => {
    setViewDoc(null);
    setEditDoc(doc);
  };

  const closeEditModal = () => {
    setEditDoc(null);
    setUploadOpen(false);
  };

  const openUpload = () => {
    setEditDoc(null);
    setUploadOpen(true);
  };

  return (
    <>
      <AppShell
        className="app-shell--shipping"
        searchPlaceholder="Search documents, shipment IDs, file names…"
        breadcrumbs={[
          { label: 'CargoTrader', to: '/dashboard' },
          { label: 'Shipping', to: '/shipping' },
          { label: 'Logistics', to: '/shipping' },
          { label: 'Documents', current: true }
        ]}
        navbarRight={
          canManageShipments ? (
            <button
              type="button"
              className="btn-primary-orange ship-upload-nav-btn"
              onClick={openUpload}
            >
              <i className="fas fa-plus" aria-hidden />
              <span className="ship-upload-nav-label">Upload Document</span>
            </button>
          ) : null
        }
      >
        <div className="content ship-page ship-list-page ship-documents-page">
          <div className="page-header">
            <div className="ship-list-title-block">
              <h1>Shipment Documents</h1>
              <p className="page-header-sub">ThriftShip Cameroon · invoices, customs forms, bills of lading &amp; compliance files</p>
            </div>
            <div className="page-header-right">
              <button
                type="button"
                className="btn-ghost"
                onClick={handlePrintSelected}
                disabled={bulkBusy}
                title="Print Selected"
                aria-label="Print Selected"
              >
                <i className="fas fa-print" />
                <span className="ship-chrome-label">Print Selected</span>
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => handleExportZip()}
                disabled={bulkBusy}
                title="Export ZIP"
                aria-label="Export ZIP"
              >
                <i className={`fas ${bulkBusy ? 'fa-spinner fa-spin' : 'fa-file-archive'}`} />
                <span className="ship-chrome-label">Export ZIP</span>
              </button>
              <div className="doc-export-all-group">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={handleExportAll}
                  disabled={bulkBusy}
                  title="Export All Documents"
                  aria-label="Export All Documents"
                >
                  <i className="fas fa-file-excel" />
                  <span className="ship-chrome-label">Export All Documents</span>
                </button>
                <button
                  type="button"
                  className="btn-ghost doc-export-all-zip"
                  onClick={handleExportAllZip}
                  disabled={bulkBusy || !documents.length}
                  title="Export documents on this page as ZIP"
                  aria-label="Export documents on this page as ZIP"
                >
                  <i className={`fas ${bulkBusy ? 'fa-spinner fa-spin' : 'fa-file-archive'}`} />
                  <span className="ship-chrome-label">ZIP</span>
                </button>
              </div>
              <ShipmentFilterChips variant="documents" value={chip} onChange={setChip} />
            </div>
          </div>

          <div className="ship-card">
            <div className="doc-filters-row">
              <select className="table-filter-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="all">All types</option>
                <option value="invoice">Commercial Invoice</option>
                <option value="packing">Packing List</option>
                <option value="bl">Bill of Lading</option>
                <option value="customs">Customs</option>
                <option value="insurance">Insurance</option>
                <option value="origin">Certificate of Origin</option>
                <option value="pod">Proof of Delivery</option>
                <option value="duty">Duty Payment</option>
              </select>
              <select className="table-filter-select" value={shipmentFilter} onChange={(e) => setShipmentFilter(e.target.value)}>
                <option value="">All shipments</option>
                {allShipments.map((s) => (
                  <option key={s.shipmentId} value={s.shipmentId}>{s.shipmentId}</option>
                ))}
              </select>
            </div>

            {selection.count > 0 && (
              <div className="stock-bulk-bar visible doc-bulk-bar">
                <div className="stock-bulk-bar-left">{selection.count} selected</div>
                <div className="stock-bulk-bar-actions">
                  <button
                    type="button"
                    className="btn-bulk-inline"
                    onClick={handleBulkDownload}
                    disabled={bulkBusy}
                  >
                    <i className={`fas ${bulkBusy ? 'fa-spinner fa-spin' : 'fa-download'}`} /> Bulk Download
                  </button>
                  {canManageShipments && (
                    <button
                      type="button"
                      className="btn-bulk-inline btn-bulk-delete"
                      onClick={handleDeleteSelected}
                      disabled={bulkBusy}
                    >
                      <i className="fas fa-trash" /> Delete Selected
                    </button>
                  )}
                  <button type="button" className="btn-bulk-clear-inline" onClick={selection.clearSelection}>
                    Clear
                  </button>
                </div>
              </div>
            )}

            <div className="ship-table-wrapper">
              <MobileSelectAllBar
                checked={selection.allVisibleSelected && selectableDocs.length > 0}
                indeterminate={selection.someVisibleSelected}
                onChange={() => selection.toggleAll(selection.visibleIds)}
                disabled={!selectableDocs.length}
                countLabel={selectableDocs.length ? `${selectableDocs.length} document${selectableDocs.length !== 1 ? 's' : ''}` : ''}
              />
              <table className="doc-table at-responsive-table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={selection.allVisibleSelected && selectableDocs.length > 0}
                        ref={(el) => {
                          if (el) el.indeterminate = selection.someVisibleSelected;
                        }}
                        onChange={() => selection.toggleAll(selection.visibleIds)}
                        aria-label="Select all"
                      />
                    </th>
                    <th>Document</th>
                    <th>Type</th>
                    <th>Shipment ID</th>
                    <th>Route</th>
                    <th>Uploaded</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32 }}>Loading…</td></tr>}
                  {!loading && error && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--danger)' }}>
                        {error}
                      </td>
                    </tr>
                  )}
                  {!loading && !error && !documents.length && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-light)' }}>
                        No documents match your filters
                      </td>
                    </tr>
                  )}
                  {!loading && !error && documents.map((d) => {
                    const docKey = d.docId || d.id;
                    const isDeleting = deletingId === docKey;
                    const isSelected = selection.selectedIds.has(docKey);
                    return (
                      <tr
                        key={docKey}
                        className={isSelected ? 'selected-row' : ''}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setViewDoc(d)}
                      >
                        <Td label="" hideLabel onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => selection.toggleRow(docKey)}
                            aria-label={`Select ${d.name}`}
                          />
                        </Td>
                        <Td label="Document">
                          <div className="doc-table-name">{d.name}</div>
                        </Td>
                        <Td label="Type"><span className="doc-type-chip">{d.typeLabel}</span></Td>
                        <Td label="Shipment ID"><strong>{d.shipmentId}</strong></Td>
                        <Td label="Route" className="doc-route-cell">
                          <span className="doc-route-text" title={d.route}>{d.route}</span>
                        </Td>
                        <Td label="Uploaded">{d.uploaded}</Td>
                        <Td label="Status"><span className={`badge ${docStatusBadgeClass(d.status)}`}>{d.statusLabel}</span></Td>
                        <Td label="Actions" className="action-cell at-card-actions" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="tbl-btn tbl-btn-icon tbl-btn-view"
                            onClick={() => setViewDoc(d)}
                            aria-label="View document"
                            title="View"
                          >
                            <i className="fas fa-eye" aria-hidden />
                          </button>
                          <button
                            type="button"
                            className="tbl-btn tbl-btn-icon tbl-btn-docs"
                            onClick={() => handleOpenFile(d)}
                            aria-label="Open file"
                            title="Open file"
                            disabled={!d.fileUrl}
                          >
                            <i className="fas fa-external-link-alt" aria-hidden />
                          </button>
                          <button
                            type="button"
                            className="tbl-btn tbl-btn-icon tbl-btn-docs"
                            onClick={() => handleDownloadOne(d)}
                            aria-label="Download document"
                            title="Download"
                            disabled={!d.fileUrl}
                          >
                            <i className="fas fa-download" aria-hidden />
                          </button>
                          {canManageShipments && (
                            <>
                              <button
                                type="button"
                                className="tbl-btn tbl-btn-icon tbl-btn-edit"
                                onClick={() => handleEdit(d)}
                                aria-label="Edit document"
                                title="Edit"
                              >
                                <i className="fas fa-pen" aria-hidden />
                              </button>
                              <button
                                type="button"
                                className="tbl-btn tbl-btn-icon tbl-btn-delete"
                                onClick={() => handleDelete(d)}
                                disabled={isDeleting || bulkBusy}
                                aria-label="Delete document"
                                title="Delete"
                              >
                                <i className={`fas ${isDeleting ? 'fa-spinner fa-spin' : 'fa-trash'}`} aria-hidden />
                              </button>
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
              total={pagination.total ?? documents.length}
              pageSize={pagination.pageSize || pageSize}
              onPage={setPage}
              onPageSize={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              noun="documents"
              disabled={loading}
            />
          </div>
        </div>
      </AppShell>

      <UploadDocumentModal
        open={uploadOpen || Boolean(editDoc)}
        document={editDoc}
        onClose={closeEditModal}
        shipments={allShipments}
        onSaved={async (mode, saved) => {
          // Clear filters that often hide a freshly uploaded document
          setChip('All');
          setTypeFilter('all');
          setShipmentFilter(saved?.shipmentId || '');
          await reload();
          showToast(mode === 'updated' ? 'Document updated' : 'Document uploaded', 'success');
        }}
        showToast={showToast}
      />

      {viewDoc && (
        <div className="ship-modal-overlay" onClick={() => setViewDoc(null)} role="presentation">
          <div className="ship-modal" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="ship-modal-header">
              <div>
                <div className="ship-modal-title">{viewDoc.name}</div>
                <div className="ship-modal-sub">{viewDoc.fileName} · {viewDoc.shipmentId}</div>
              </div>
              <button type="button" className="wh-modal-close" onClick={() => setViewDoc(null)} aria-label="Close">
                <i className="fas fa-times" />
              </button>
            </div>
            <div className="ship-modal-body">
              <p><strong>Type:</strong> {viewDoc.typeLabel}</p>
              <p><strong>Route:</strong> {viewDoc.route}</p>
              <p><strong>Status:</strong> {viewDoc.statusLabel}</p>
              <p><strong>Uploaded:</strong> {viewDoc.uploaded}</p>
              {viewDoc.notes ? <p><strong>Notes:</strong> {viewDoc.notes}</p> : null}
              {viewDoc.fileUrl ? (
                <p style={{ marginTop: 12 }}>
                  <button type="button" className="link-btn" onClick={() => handleOpenFile(viewDoc)}>
                    <i className="fas fa-external-link-alt" /> Open file in new tab
                  </button>
                </p>
              ) : (
                <p style={{ marginTop: 12, color: 'var(--text-light)' }}>No file attached to this record.</p>
              )}
            </div>
            <div className="ship-modal-footer">
              <button type="button" className="btn-ghost" onClick={() => setViewDoc(null)}>Close</button>
              {canManageShipments && (
                <>
                  <button type="button" className="tbl-btn tbl-btn-edit" onClick={() => handleEdit(viewDoc)}>
                    <i className="fas fa-pen" /> Edit
                  </button>
                  <button type="button" className="tbl-btn tbl-btn-delete" onClick={() => handleDelete(viewDoc)}>
                    <i className="fas fa-trash" /> Delete
                  </button>
                </>
              )}
              <button type="button" className="btn-primary-green" onClick={() => handleDownloadOne(viewDoc)}>
                <i className="fas fa-download" /> Download
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
