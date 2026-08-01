import { useEffect, useId, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { parseScanPayload } from '../../../utils/parseScanPayload';
import ModalShell from './ModalShell';

export default function ScanQrModal({ open, onClose, onScan, loading = false }) {
  const reactId = useId();
  const scannerId = `inv-qr-reader-${reactId.replace(/:/g, '')}`;
  const scannerRef = useRef(null);
  const handledRef = useRef(false);
  const onScanRef = useRef(onScan);
  const [manual, setManual] = useState('');
  const [status, setStatus] = useState('Point your camera at the product QR code');
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!open) {
      setManual('');
      setStatus('Point your camera at the product QR code');
      setCameraReady(false);
      handledRef.current = false;
      return undefined;
    }

    let scanner;
    let cancelled = false;

    const start = async () => {
      try {
        scanner = new Html5Qrcode(scannerId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          async (decoded) => {
            if (handledRef.current || loading) return;
            const code = parseScanPayload(decoded);
            if (!code) return;
            handledRef.current = true;
            setStatus('Looking up product…');
            const ok = await onScanRef.current(code);
            if (!ok) {
              handledRef.current = false;
              setStatus('Product not found — try another code');
            }
          },
          () => {}
        );
        if (!cancelled) {
          setCameraReady(true);
          setStatus('Camera ready — align the QR code in the frame');
        }
      } catch {
        if (!cancelled) {
          setStatus('Camera unavailable — enter the SKU or scan value below');
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      const active = scannerRef.current;
      scannerRef.current = null;
      if (active?.isScanning) {
        active.stop().catch(() => {});
      }
    };
  }, [open, scannerId, loading]);

  const submitManual = async () => {
    if (loading || !manual.trim()) return;
    handledRef.current = true;
    setStatus('Looking up product…');
    const ok = await onScanRef.current(manual.trim());
    if (!ok) {
      handledRef.current = false;
      setStatus('Product not found — check the code and try again');
    }
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Scan Product QR Code"
      subtitle="Use your phone or computer camera to find a product in inventory"
      size="inv-modal-lg"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-scan"
            onClick={submitManual}
            disabled={loading || !manual.trim()}
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin" /> Searching…
              </>
            ) : (
              <>
                <i className="fas fa-search" /> Find Product
              </>
            )}
          </button>
        </>
      }
    >
      <div className="inv-scan-modal">
        <div
          id={scannerId}
          className={`inv-qr-camera${cameraReady ? ' ready' : ''}`}
          aria-hidden={!open}
        />
        <p className="inv-qr-status">{loading ? 'Searching database…' : status}</p>
        <div className="inv-qr-manual">
          <input
            type="text"
            className="form-input"
            placeholder="Or enter SKU / scan code manually…"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitManual()}
            disabled={loading}
          />
        </div>
        <p className="inv-qr-hint">
          Scanned codes match product labels generated in inventory (SKU format:{' '}
          <code>afritrade:item/YOUR-SKU</code>).
        </p>
      </div>
    </ModalShell>
  );
}
