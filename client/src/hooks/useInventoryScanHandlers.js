import { useCallback, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { lookupInventoryByScan } from '../services/inventoryScan';
import { getScanMatchLabel } from '../utils/scanFilter';
import { parseScanPayload } from '../utils/parseScanPayload';

/**
 * QR scan → filter main inventory table to the matched product only.
 * Detail modal opens when the user clicks the table row (page handlers).
 */
export function useInventoryScanHandlers({ resetFilters } = {}) {
  const { showToast } = useToast();
  const [scanOpen, setScanOpen] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [scanMatch, setScanMatch] = useState(null);

  const clearScanFilter = useCallback(() => {
    setScanMatch(null);
  }, []);

  const handleScanCode = useCallback(
    async (rawCode) => {
      const code = parseScanPayload(rawCode);
      if (!code) {
        showToast('Invalid QR code');
        return false;
      }

      setLookupLoading(true);
      try {
        const { matchType, data } = await lookupInventoryByScan(code);

        if (!data) {
          showToast('Product not found');
          return false;
        }

        resetFilters?.();

        const match = { matchType, data };
        setScanMatch(match);
        setScanOpen(false);
        showToast(`Showing: ${getScanMatchLabel(match)}`, 'success');
        return true;
      } catch (err) {
        showToast(err.response?.data?.message || 'Product not found');
        return false;
      } finally {
        setLookupLoading(false);
      }
    },
    [resetFilters, showToast]
  );

  return {
    scanOpen,
    setScanOpen,
    lookupLoading,
    handleScanCode,
    scanMatch,
    scanFilterActive: Boolean(scanMatch),
    scanFilterLabel: getScanMatchLabel(scanMatch),
    clearScanFilter
  };
}
