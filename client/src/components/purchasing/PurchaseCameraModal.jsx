import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Live camera capture — portaled to document.body.
 * CSS keeps the <video> absolutely filling the viewport (avoids blank 0-height flex bug).
 */
export default function PurchaseCameraModal({
  open,
  onClose,
  onCapture,
  title = 'Take Photo'
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);
  const [facing, setFacing] = useState('environment');

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    let readyTimer = 0;

    const stop = () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    async function startCamera() {
      setError(null);
      setReady(false);

      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Camera not supported in this browser. Use Upload Photo instead.');
        return;
      }

      // Let the portal paint the <video> element first
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      if (cancelled) return;

      const attempts = [
        { video: { facingMode: { ideal: facing } }, audio: false },
        { video: true, audio: false }
      ];

      let stream = null;
      let lastErr = null;
      for (const constraints of attempts) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          break;
        } catch (err) {
          lastErr = err;
        }
      }
      if (cancelled) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }
      if (!stream) {
        const denied =
          lastErr?.name === 'NotAllowedError' || lastErr?.name === 'PermissionDeniedError';
        setError(
          denied
            ? 'Camera permission denied. Allow camera access in your browser settings, then try again.'
            : lastErr?.message || 'Could not open camera'
        );
        return;
      }

      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((t) => t.stop());
        setError('Camera view failed to load. Close and try again, or use Upload Photo.');
        return;
      }

      stop();
      streamRef.current = stream;
      video.srcObject = stream;
      video.muted = true;
      video.defaultMuted = true;
      video.playsInline = true;
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.setAttribute('muted', '');

      const markReady = () => {
        if (!cancelled) setReady(true);
      };

      video.onloadedmetadata = markReady;
      video.onplaying = markReady;

      try {
        // Explicit play() is required in some Chromium builds even with autoPlay
        const p = video.play();
        if (p?.then) await p;
        markReady();
      } catch {
        // Ignore — metadata/playing handlers or timeout will settle state
      }

      readyTimer = window.setTimeout(() => {
        if (cancelled) return;
        if (video.videoWidth > 0) markReady();
        else {
          setError(
            'Camera opened but no image was received. Try Flip, another browser, or Upload Photo.'
          );
        }
      }, 3000);
    }

    startCamera();

    return () => {
      cancelled = true;
      window.clearTimeout(readyTimer);
      stop();
      setReady(false);
    };
  }, [open, facing]);

  useEffect(() => {
    if (open) return undefined;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
    setError(null);
    return undefined;
  }, [open]);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    onCapture?.(canvas.toDataURL('image/jpeg', 0.9));
    onClose?.();
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="pur-camera-overlay" onClick={onClose} role="presentation">
      <div
        className="pur-camera-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="pur-camera-header">
          <h3>
            <i className="fas fa-camera" /> {title}
          </h3>
          <button type="button" className="pur-modal-close" onClick={onClose} aria-label="Close">
            <i className="fas fa-times" />
          </button>
        </div>

        <div className="pur-camera-viewport">
          <video
            ref={videoRef}
            className="pur-camera-video"
            playsInline
            muted
            autoPlay
            controls={false}
          />
          {error ? (
            <div className="pur-camera-error">
              <i className="fas fa-video-slash" />
              <p>{error}</p>
            </div>
          ) : (
            !ready && (
              <div className="pur-camera-loading">
                <i className="fas fa-spinner fa-spin" /> Starting camera…
              </div>
            )
          )}
        </div>

        <div className="pur-camera-footer">
          <button
            type="button"
            className="pur-ai-btn pur-ai-btn-upload"
            onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
            disabled={!!error}
          >
            <i className="fas fa-sync-alt" /> Flip
          </button>
          <button
            type="button"
            className="pur-camera-shutter"
            onClick={handleCapture}
            disabled={!!error || !ready}
            aria-label="Capture photo"
          >
            <span />
          </button>
          <button type="button" className="pur-ai-btn pur-ai-btn-upload" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
