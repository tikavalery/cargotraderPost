import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { usePlanUsage } from '../../hooks/usePlanUsage';
import { financeApi } from '../../services/financeApi';
import { estimateDataUrlBytes, normalizeImageDataUrl, normalizeImageFile } from '../../utils/imageUpload';
import { mediaSrc } from '../../utils/cloudinaryUpload';
import PurchaseCameraModal from '../purchasing/PurchaseCameraModal';
import PlanUpgradeBanner from '../plan/PlanUpgradeBanner';

const MAX = 8;
const MAX_BYTES = 3 * 1024 * 1024;

/**
 * Receipt capture / upload for Record Expense.
 * Uses the same plan gate + monthly AI quota as AI Purchase Assistant (purchaseAiFill).
 */
export default function ExpenseAiReceiptSection({ photos = [], onPhotosChange, onAnalysisApply }) {
  const inputRef = useRef(null);
  const { showToast } = useToast();
  const { hasFeature, loading: planLoading } = useSubscription();
  const { aiLimit, aiUsed, aiRemaining, atAiLimit, reload: reloadUsage } = usePlanUsage();
  const canAiAssist = hasFeature('purchaseAiFill');
  const [analyzing, setAnalyzing] = useState(false);
  const [aiBanner, setAiBanner] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  const aiQuotaLabel =
    aiLimit == null
      ? 'Unlimited AI analyses'
      : `${aiRemaining ?? Math.max(0, aiLimit - aiUsed)} of ${aiLimit} AI analyses left this month`;

  const addFiles = async (fileList) => {
    const files = [...fileList].filter((f) => f.type.startsWith('image/'));
    const room = MAX - photos.length;
    if (room <= 0) {
      showToast(`Maximum ${MAX} receipt images`);
      return;
    }

    const batch = files.slice(0, room);
    const valid = batch.filter((f) => f.size <= MAX_BYTES);
    if (batch.length > valid.length) {
      showToast('Some images skipped (max 3 MB each)');
    }
    if (!valid.length) return;

    Promise.all(valid.map((file) => normalizeImageFile(file)))
      .then((results) => {
        onPhotosChange([...photos, ...results].slice(0, MAX));
        setAiBanner(null);
      })
      .catch(() => {
        showToast('Could not process one or more images');
      });
  };

  const addDataUrl = async (dataUrl) => {
    if (photos.length >= MAX) {
      showToast(`Maximum ${MAX} receipt images`);
      return;
    }
    try {
      const normalized = await normalizeImageDataUrl(dataUrl);
      if (estimateDataUrlBytes(normalized) > MAX_BYTES) {
        showToast('Photo too large (max 3 MB)');
        return;
      }
      onPhotosChange([...photos, normalized].slice(0, MAX));
      setAiBanner(null);
    } catch {
      showToast('Could not process captured photo');
    }
  };

  const openCamera = () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast('Live camera not supported here — use Upload Photo');
      return;
    }
    setCameraOpen(true);
  };

  const removeAt = (idx) => {
    onPhotosChange(photos.filter((_, i) => i !== idx));
    setAiBanner(null);
  };

  const handleAnalyze = async () => {
    if (!canAiAssist) {
      showToast('AI Expense Assistant is on Professional and higher — upgrade to analyze receipts');
      return;
    }
    if (atAiLimit) {
      showToast('Monthly AI limit reached — upgrade for a higher AI allowance');
      return;
    }
    const image = photos.find((p) => typeof p === 'string' && p.startsWith('data:image/'));
    if (!image) {
      showToast('Add or capture a receipt photo first, then run AI Expense Assistant');
      return;
    }

    setAnalyzing(true);
    setAiBanner(null);
    try {
      const res = await financeApi.analyzeExpenseImage([image]);
      const data = res.data?.data;
      if (!data) throw new Error('No analysis data returned');

      onAnalysisApply?.(data);
      setAiBanner('success');
      reloadUsage();
      showToast('AI Expense Assistant suggestions loaded. Please review and edit.', 'success');
    } catch (e) {
      setAiBanner('error');
      showToast(e.response?.data?.message || e.message || 'AI Expense Assistant analysis failed');
      if (e.response?.status === 403) reloadUsage();
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="pur-ai-section fin-expense-ai">
      <div className="pur-ai-header">
        <div className="pur-ai-header-text">
          <h3>
            <i className="fas fa-wand-magic-sparkles" /> AI Expense Assistant
          </h3>
          <p>
            {canAiAssist
              ? atAiLimit
                ? 'Monthly AI limit reached. Upgrade your plan for a higher AI allowance.'
                : `Take or upload a receipt — AI fills date, category, amount, and more. ${aiQuotaLabel}.`
              : 'Add receipt photos here. AI Expense Assistant is available on Professional and higher (shared AI quota with Purchases).'}
          </p>
        </div>
        <div className="pur-ai-actions">
          <button
            type="button"
            className="pur-ai-btn pur-ai-btn-camera"
            onClick={openCamera}
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
                title="Upgrade AI limit"
                aria-label="Upgrade AI limit"
              >
                <i className="fas fa-arrow-up" />
                <span className="pur-ai-chrome-label">Upgrade AI limit</span>
              </Link>
            ) : (
              <button
                type="button"
                className="pur-ai-btn pur-ai-btn-analyze"
                disabled={analyzing || !photos.length || planLoading}
                onClick={handleAnalyze}
                title={analyzing ? 'Analyzing…' : 'Run Assistant'}
                aria-label={analyzing ? 'Analyzing…' : 'Run Assistant'}
              >
                <i className={`fas ${analyzing ? 'fa-spinner fa-spin' : 'fa-robot'}`} />
                <span className="pur-ai-chrome-label">{analyzing ? 'Analyzing…' : 'Run Assistant'}</span>
              </button>
            )
          ) : (
            <Link
              to="/pricing"
              state={{ upgradeFeature: 'purchaseAiFill' }}
              className="pur-ai-btn pur-ai-btn-analyze"
              style={{ textDecoration: 'none' }}
              title="Unlock AI Expense Assistant"
              aria-label="Unlock AI Expense Assistant"
            >
              <i className="fas fa-lock" />
              <span className="pur-ai-chrome-label">Unlock AI</span>
            </Link>
          )}
        </div>
      </div>

      {!canAiAssist && !planLoading && (
        <div style={{ marginBottom: 10 }}>
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
        <i className="fas fa-receipt" />
        <span>Drag receipt photos here or click to browse · up to {MAX} images</span>
      </div>

      {photos.length > 0 && (
        <div className="photo-previews pur-ai-previews">
          {photos.map((src, i) => (
            <div key={`${i}-${String(src).slice(0, 32)}`} className={`photo-thumb${i === 0 && canAiAssist ? ' pur-ai-primary' : ''}`}>
              <img src={mediaSrc(src)} alt={`Receipt ${i + 1}`} />
              {i === 0 && canAiAssist && <span className="pur-ai-primary-badge">AI</span>}
              <button type="button" className="remove-photo" onClick={() => removeAt(i)} aria-label="Remove">
                <i className="fas fa-times" />
              </button>
            </div>
          ))}
        </div>
      )}

      {aiBanner === 'success' && (
        <div className="pur-ai-banner success">
          <i className="fas fa-check-circle" />
          AI Expense Assistant suggestions loaded. Please review and edit all fields before saving.
        </div>
      )}
      {aiBanner === 'error' && (
        <div className="pur-ai-banner error">
          <i className="fas fa-exclamation-circle" />
          AI Expense Assistant failed. Check your plan access and API key, or try another photo.
        </div>
      )}
    </div>
  );
}
