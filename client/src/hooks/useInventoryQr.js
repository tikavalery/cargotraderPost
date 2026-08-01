import { useCallback, useState } from 'react';

export function useInventoryQr() {
  const [qrRecord, setQrRecord] = useState(null);
  const openQr = useCallback((record) => {
    if (record?.sku) setQrRecord(record);
  }, []);
  const closeQr = useCallback(() => setQrRecord(null), []);
  return { qrRecord, qrOpen: Boolean(qrRecord), openQr, closeQr };
}
