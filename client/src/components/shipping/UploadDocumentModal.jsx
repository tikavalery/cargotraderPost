import { useEffect, useState } from 'react';
import { shippingApi } from '../../services/shippingApi';
import { resolveDocumentForSave } from '../../utils/cloudinaryUpload';

const DOC_TYPES = [
  { value: 'invoice', label: 'Commercial Invoice' },
  { value: 'packing', label: 'Packing List' },
  { value: 'bl', label: 'Bill of Lading' },
  { value: 'customs', label: 'Customs Declaration' },
  { value: 'insurance', label: 'Insurance Certificate' },
  { value: 'origin', label: 'Certificate of Origin' },
  { value: 'pod', label: 'Proof of Delivery' },
  { value: 'duty', label: 'Duty Payment Receipt' }
];

const DOC_STATUSES = [
  { value: 'pending', label: 'Pending Review' },
  { value: 'verified', label: 'Verified' },
  { value: 'expiring', label: 'Expiring Soon' }
];

const EMPTY = { shipmentId: '', type: 'invoice', name: '', status: 'pending', notes: '' };

const ACCEPTED_TYPES =
  '.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.rtf,.png,.jpg,.jpeg,.webp,.gif,application/pdf,image/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv';

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export default function UploadDocumentModal({
  open,
  onClose,
  shipments,
  onSaved,
  showToast,
  document: editDoc = null
}) {
  const isEdit = Boolean(editDoc);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [fileMeta, setFileMeta] = useState(null);
  const [fileDataUrl, setFileDataUrl] = useState('');

  useEffect(() => {
    if (!open) return;
    if (editDoc) {
      setForm({
        shipmentId: editDoc.shipmentId || '',
        type: editDoc.type || 'invoice',
        name: editDoc.name || '',
        status: editDoc.status || 'pending',
        notes: editDoc.notes || ''
      });
      setFileMeta(editDoc.fileUrl ? { name: editDoc.fileName, size: editDoc.fileSize, url: editDoc.fileUrl } : null);
      setFileDataUrl('');
    } else {
      setForm(EMPTY);
      setFileMeta(null);
      setFileDataUrl('');
    }
  }, [open, editDoc]);

  if (!open) return null;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      showToast?.('File too large (max 10 MB)');
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setFileDataUrl(dataUrl);
      setFileMeta({ name: file.name, size: `${(file.size / 1024).toFixed(1)} KB` });
    } catch {
      showToast?.('Could not read file');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.shipmentId) {
      showToast?.('Select a shipment');
      return;
    }
    if (!isEdit && !fileDataUrl) {
      showToast?.('Choose a file to upload');
      return;
    }
    setSaving(true);
    try {
      const ship = shipments.find((s) => s.shipmentId === form.shipmentId);
      const typeLabel = DOC_TYPES.find((d) => d.value === form.type)?.label;
      const payload = {
        shipmentId: form.shipmentId,
        type: form.type,
        name: form.name || typeLabel,
        route: ship
          ? `${ship.originFlag || ''} ${ship.origin || ''} → ${ship.destFlag || ''} ${ship.dest || ''}`.trim()
          : editDoc?.route || '',
        notes: form.notes,
        status: form.status
      };

      let fileFields = {
        fileName: editDoc?.fileName || `${form.type}-${form.shipmentId}.pdf`,
        fileSize: editDoc?.fileSize || '—',
        fileUrl: editDoc?.fileUrl || ''
      };

      if (fileDataUrl) {
        const uploaded = await resolveDocumentForSave({
          dataUrl: fileDataUrl,
          fileName: fileMeta?.name || fileFields.fileName
        });
        if (!uploaded?.fileUrl) {
          throw new Error('File upload failed');
        }
        fileFields = {
          fileName: uploaded.fileName,
          fileSize: uploaded.fileSize,
          fileUrl: uploaded.fileUrl
        };
      }

      if (!isEdit && !fileFields.fileUrl) {
        showToast?.('Choose a file to upload');
        return;
      }

      let saved = null;
      if (isEdit) {
        const id = editDoc.docId || editDoc.id;
        const res = await shippingApi.updateDocument(id, { ...payload, ...fileFields });
        saved = res.data?.data || null;
        onSaved?.('updated', saved);
      } else {
        const res = await shippingApi.createDocument({ ...payload, ...fileFields });
        saved = res.data?.data || null;
        onSaved?.('created', saved);
      }
      onClose();
    } catch (err) {
      showToast?.(err.response?.data?.message || err.message || (isEdit ? 'Update failed' : 'Upload failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ship-modal-overlay" onClick={onClose} role="presentation">
      <div className="ship-modal" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="ship-modal-header">
          <div className="ship-modal-title">{isEdit ? 'Edit Document' : 'Upload Document'}</div>
          <button type="button" className="wh-modal-close" onClick={onClose} aria-label="Close">
            <i className="fas fa-times" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="ship-modal-body">
            <label className="form-label">Shipment</label>
            <select className="form-select" value={form.shipmentId} onChange={set('shipmentId')} required>
              <option value="">Select shipment…</option>
              {shipments.map((s) => (
                <option key={s.shipmentId} value={s.shipmentId}>
                  {s.shipmentId}
                </option>
              ))}
            </select>
            <label className="form-label">Document Type</label>
            <select className="form-select" value={form.type} onChange={set('type')}>
              {DOC_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <label className="form-label">Document Name</label>
            <input
              className="form-input"
              value={form.name}
              onChange={set('name')}
              placeholder="Optional display name"
            />
            {isEdit ? (
              <>
                <label className="form-label">Status</label>
                <select className="form-select" value={form.status} onChange={set('status')}>
                  {DOC_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            <label className="form-label">
              File {isEdit ? '(optional — replace)' : <span className="req">*</span>}
            </label>
            <input
              type="file"
              accept={ACCEPTED_TYPES}
              className="form-input"
              onChange={handleFile}
              // Native `required` breaks after we clear the input (so the same file can be
              // re-selected). App state (`fileDataUrl` / submit handler) is the source of truth.
              aria-required={!isEdit}
            />
            <p style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 4 }}>
              PDF, Word, Excel, CSV, text, or images — max 10 MB
            </p>
            {fileMeta && (
              <p style={{ fontSize: 12, color: 'var(--text-mid)', marginTop: 6 }}>
                {fileMeta.name}
                {fileMeta.size ? ` · ${fileMeta.size}` : ''}
                {fileMeta.url ? (
                  <>
                    {' · '}
                    <a href={fileMeta.url} target="_blank" rel="noreferrer">
                      Open current
                    </a>
                  </>
                ) : null}
              </p>
            )}
            <label className="form-label">Notes</label>
            <textarea className="form-input" rows={2} value={form.notes} onChange={set('notes')} />
          </div>
          <div className="ship-modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary-green" disabled={saving}>
              {saving ? 'Uploading…' : isEdit ? 'Save Changes' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
