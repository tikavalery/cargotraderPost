import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { usePlanUsage } from '../../hooks/usePlanUsage';
import { purchaseAiApi } from '../../services/purchaseApi';
import { estimateDataUrlBytes, normalizeImageDataUrl, normalizeImageFile } from '../../utils/imageUpload';
import PurchaseCameraModal from './PurchaseCameraModal';
import PlanUpgradeBanner from '../plan/PlanUpgradeBanner';

const MAX = 12;
const MAX_BYTES = 3 * 1024 * 1024;

function newPhotoId() {
  return `ip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Capture product photos for bulk purchase lines, then AI-match each photo to a line.
 * photos: [{ id, src, lineKey, confidence, identifiedAs }]
 */
export default function BulkItemPhotosSection({
  photos = [],
  onPhotosChange,
  lines = []
}) {
  const inputRef = useRef(null);
  const { showToast } = useToast();
  const { hasFeature, loading: planLoading } = useSubscription();
  const { aiLimit, aiUsed, aiRemaining, atAiLimit, reload: reloadUsage } = usePlanUsage();
  const canAiAssist = hasFeature('purchaseAiFill');
  const [matching, setMatching] = useState(false);
  const [aiBanner, setAiBanner] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  const namedLines = lines.filter((l) => String(l.itemName || '').trim());
  const matchedCount = photos.filter((p) => p.lineKey).length;

  const aiQuotaLabel =
    aiLimit == null
      ? 'Unlimited AI analyses'
      : `${aiRemaining ?? Math.max(0, aiLimit - aiUsed)} of ${aiLimit} AI analyses left this month`;

  const appendPhotos = (srcs) => {
    const room = MAX - photos.length;
    if (room <= 0) {
      showToast(`Maximum ${MAX} product photos`);
      return;
    }
    const next = srcs.slice(0, room).map((src) => ({
      id: newPhotoId(),
      src,
      lineKey: '',
      confidence: 0,
      identifiedAs: ''
    }));
    onPhotosChange([...photos, ...next].slice(0, MAX));
    setAiBanner(null);
  };

  const addFiles = async (fileList) => {
    const files = [...fileList].filter((f) => f.type.startsWith('image/'));
    const room = MAX - photos.length;
    if (room <= 0) {
      showToast(`Maximum ${MAX} product photos`);
      return;
    }
    const batch = files.slice(0, room);
    const valid = batch.filter((f) => f.size <= MAX_BYTES);
    if (batch.length > valid.length) showToast('Some images skipped (max 3 MB each)');
    if (!valid.length) return;
    try {
      const results = await Promise.all(valid.map((file) => normalizeImageFile(file)));
      appendPhotos(results);
    } catch {
      showToast('Could not process one or more images');
    }
  };

  const addDataUrl = async (dataUrl) => {
    if (photos.length >= MAX) {
      showToast(`Maximum ${MAX} product photos`);
      return;
    }
    try {
      const normalized = await normalizeImageDataUrl(dataUrl);
      if (estimateDataUrlBytes(normalized) > MAX_BYTES) {
        showToast('Photo too large (max 3 MB)');
        return;
      }
      appendPhotos([normalized]);
    } catch {
      showToast('Could not process captured photo');
    }
  };

  const removeAt = (id) => {
    onPhotosChange(photos.filter((p) => p.id !== id));
    setAiBanner(null);
  };

  const assignLine = (id, lineKey) => {
    onPhotosChange(
      photos.map((p) =>
        p.id === id
          ? { ...p, lineKey: lineKey || '', confidence: lineKey ? p.confidence || 1 : 0 }
          : // Keep one photo per line when assigning (free previous owner of this photo's target)
            lineKey && p.lineKey === lineKey && p.id !== id
            ? { ...p, lineKey: '', confidence: 0 }
            : p
      )
    );
  };

  const handleMatch = async () => {
    if (!canAiAssist) {
      showToast('AI matching is on Professional and higher — upgrade to match item photos');
      return;
    }
    if (atAiLimit) {
      showToast('Monthly AI limit reached — upgrade for a higher AI allowance');
      return;
    }
    if (!photos.length) {
      showToast('Add product photos first');
      return;
    }
    if (!namedLines.length) {
      showToast('Add named purchase lines (from the receipt) before matching');
      return;
    }

    setMatching(true);
    setAiBanner(null);
    try {
      const res = await purchaseAiApi.matchItemPhotos({
        photos: photos.map((p) => p.src),
        lines: namedLines.map((l) => ({
          key: l.key,
          itemName: l.itemName,
          category: l.category,
          notes: l.notes
        }))
      });
      const matches = res.data?.data?.matches || [];
      const next = photos.map((photo, i) => {
        const m = matches.find((row) => Number(row.photoIndex) === i) || matches[i];
        if (!m) return photo;
        return {
          ...photo,
          lineKey: m.lineKey || '',
          confidence: Number(m.confidence) || 0,
          identifiedAs: m.identifiedAs || ''
        };
      });
      onPhotosChange(next);
      const hit = next.filter((p) => p.lineKey).length;
      setAiBanner(hit ? 'success' : 'error');
      reloadUsage();
      showToast(
        res.data?.message ||
          (hit ? `Matched ${hit} photo(s) to line items` : 'No confident matches — assign manually'),
        hit ? 'success' : undefined
      );
    } catch (e) {
      setAiBanner('error');
      showToast(e.response?.data?.message || e.message || 'AI photo matching failed');
      if (e.response?.status === 403) reloadUsage();
    } finally {
      setMatching(false);
    }
  };

  const lineLabel = (key) => {
    const line = lines.find((l) => l.key === key);
    if (!line) return 'Unassigned';
    return line.itemName || 'Untitled';
  };

  return (
    <div className="pur-ai-section pur-bulk-item-photos">
      <div className="pur-ai-header">
        <div className="pur-ai-header-text">
          <h3>
            <i className="fas fa-camera" /> Product photos
          </h3>
          <p>
            {canAiAssist
              ? atAiLimit
                ? 'Monthly AI limit reached. Upgrade your plan for a higher AI allowance.'
                : `Photograph each purchased item — AI matches photos to lines above. ${aiQuotaLabel}.`
              : 'Photograph each item. AI matching is available on Professional and higher — you can still assign photos manually.'}
          </p>
        </div>
        <div className="pur-ai-actions">
          <button
            type="button"
            className="pur-ai-btn pur-ai-btn-camera"
            onClick={() => {
              if (!navigator.mediaDevices?.getUserMedia) {
                showToast('Live camera not supported here — use Upload Photo');
                return;
              }
              setCameraOpen(true);
            }}
            title="Take Photo"
            aria-label="Take Photo"
          >
            <i className="fas fa-camera" />
            <span className="pur-ai-chrome-label">Take Photo</span>
          </button>
          <button
            type="button"
            className="pur-ai-btn pur-ai-btn-upload"
            onClick={() => inputRef.current?.click()}
            title="Upload Photo"
            aria-label="Upload Photo"
          >
            <i className="fas fa-cloud-upload-alt" />
            <span className="pur-ai-chrome-label">Upload Photo</span>
          </button>
          {canAiAssist ? (
            atAiLimit ? (
              <Link
                to="/pricing"
                state={{ upgradeFeature: 'purchaseAiFill' }}
                className="pur-ai-btn pur-ai-btn-analyze"
                style={{ textDecoration: 'none' }}
              >
                <i className="fas fa-arrow-up" />
                <span className="pur-ai-chrome-label">Upgrade AI limit</span>
              </Link>
            ) : (
              <button
                type="button"
                className="pur-ai-btn pur-ai-btn-analyze"
                disabled={matching || !photos.length || !namedLines.length || planLoading}
                onClick={handleMatch}
              >
                <i className={`fas ${matching ? 'fa-spinner fa-spin' : 'fa-link'}`} />
                <span className="pur-ai-chrome-label">{matching ? 'Matching…' : 'Match to lines'}</span>
              </button>
            )
          ) : (
            <Link
              to="/pricing"
              state={{ upgradeFeature: 'purchaseAiFill' }}
              className="pur-ai-btn pur-ai-btn-analyze"
              style={{ textDecoration: 'none' }}
            >
              <i className="fas fa-lock" />
              <span className="pur-ai-chrome-label">Unlock AI</span>
            </Link>
          )}
        </div>
      </div>

      {!canAiAssist && !planLoading && (
        <div style={{ marginBottom: 12 }}>
          <PlanUpgradeBanner feature="purchaseAiFill" compact />
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <PurchaseCameraModal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={addDataUrl}
        title="Photograph purchased item"
      />

      <div
        className={`pur-ai-drop${dragOver ? ' dragover' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      >
        <i className="fas fa-box-open" />
        <span>Drag product photos here or click to browse — one photo per item works best</span>
      </div>

      {photos.length > 0 && (
        <div className="pur-bulk-photo-match-grid">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className={`pur-bulk-photo-card${photo.lineKey ? ' is-matched' : ''}`}
            >
              <div className="pur-bulk-photo-card-media">
                <img src={photo.src} alt={photo.identifiedAs || 'Product'} />
                <button
                  type="button"
                  className="remove-photo"
                  onClick={() => removeAt(photo.id)}
                  aria-label="Remove"
                >
                  <i className="fas fa-times" />
                </button>
              </div>
              {photo.identifiedAs ? (
                <div className="pur-bulk-photo-id">{photo.identifiedAs}</div>
              ) : null}
              <label className="pur-bulk-photo-assign">
                <span>Match to</span>
                <select
                  className="form-select"
                  value={photo.lineKey || ''}
                  onChange={(e) => assignLine(photo.id, e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {namedLines.map((line, idx) => (
                    <option key={line.key} value={line.key}>
                      #{idx + 1} {line.itemName}
                    </option>
                  ))}
                </select>
              </label>
              {photo.lineKey ? (
                <div className="pur-bulk-photo-meta">
                  {lineLabel(photo.lineKey)}
                  {photo.confidence > 0 ? (
                    <span> · {Math.round(photo.confidence * 100)}%</span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {photos.length > 0 && (
        <p className="form-hint" style={{ marginTop: 10, fontSize: 12 }}>
          {matchedCount} of {photos.length} photo{photos.length === 1 ? '' : 's'} assigned — each
          matched photo is saved on that inventory item.
        </p>
      )}

      {aiBanner === 'success' && (
        <div className="pur-ai-banner pur-ai-banner-ok">
          Photos matched. Review assignments above — fix any wrong matches before saving.
        </div>
      )}
      {aiBanner === 'error' && (
        <div className="pur-ai-banner pur-ai-banner-err">
          Could not auto-match photos. Use the dropdown on each photo to assign a line.
        </div>
      )}
    </div>
  );
}
