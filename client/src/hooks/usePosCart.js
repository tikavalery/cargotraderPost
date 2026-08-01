import { useCallback, useMemo, useState } from 'react';
import { calcCartTotals } from '../utils/calcCartTotals';

export function usePosCart(initial = {}) {
  const [lines, setLines] = useState(initial.lines || []);
  const [customer, setCustomer] = useState(initial.customer || { name: 'Walk-in Customer' });
  const [discType, setDiscType] = useState(initial.discType || 'pct');
  const [discVal, setDiscVal] = useState(initial.discVal ?? 0);
  const [promoCode, setPromoCode] = useState(initial.promoCode || '');
  const [promoPct, setPromoPct] = useState(initial.promoPct || 0);
  const [payment, setPaymentState] = useState('Cash');
  const [tendered, setTendered] = useState(initial.tendered ?? 100000);
  const [momoNumber, setMomoNumber] = useState('');
  const [momoNetwork, setMomoNetwork] = useState('MTN MoMo');

  /** Only cash is accepted until Mobile Money / Card are launched. */
  const setPayment = useCallback(() => {
    setPaymentState('Cash');
  }, []);

  const totals = useMemo(
    () => calcCartTotals(lines, discType, discVal, promoPct),
    [lines, discType, discVal, promoPct]
  );

  const isMobileMoney = false;

  const addProduct = useCallback((product, qty = 1) => {
    if (product.outOfStock || product.qty <= 0) return false;
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.sku === product.sku);
      if (idx >= 0) {
        const next = [...prev];
        const newQty = Math.min(next[idx].qty + qty, product.qty);
        next[idx] = { ...next[idx], qty: newQty };
        return next;
      }
      return [...prev, {
        productId: product.productId,
        sku: product.sku,
        name: product.name,
        price: product.price,
        qty: Math.min(qty, product.qty),
        image: product.image,
        category: product.category,
        catLabel: product.catLabel,
        maxQty: product.qty,
        icon: product.icon,
        color: product.color
      }];
    });
    return true;
  }, []);

  const updateQty = useCallback((sku, delta) => {
    setLines((prev) =>
      prev
        .map((l) => {
          if (l.sku !== sku) return l;
          const max = l.maxQty || 999;
          return { ...l, qty: Math.max(1, Math.min(max, l.qty + delta)) };
        })
        .filter((l) => l.qty > 0)
    );
  }, []);

  const removeLine = useCallback((sku) => {
    setLines((prev) => prev.filter((l) => l.sku !== sku));
  }, []);

  const clearCart = useCallback(() => {
    setLines([]);
    setDiscType('pct');
    setDiscVal(0);
    setPromoCode('');
    setPromoPct(0);
    setMomoNumber('');
    setCustomer({ name: 'Walk-in Customer' });
  }, []);

  const restore = useCallback((payload) => {
    setLines(payload.cart || payload.lines || []);
    setCustomer({ name: payload.customerName || 'Walk-in Customer' });
    if (payload.discType) setDiscType(payload.discType);
    if (payload.discVal != null) setDiscVal(payload.discVal);
    if (payload.promoCode) setPromoCode(payload.promoCode);
    if (payload.promoPct) setPromoPct(payload.promoPct);
    setPaymentState('Cash');
    if (payload.momoNumber) setMomoNumber(payload.momoNumber);
  }, []);

  const payload = useMemo(
    () => ({
      lines,
      cart: lines,
      customerName: customer.name,
      customerId: customer._id,
      discType,
      discVal,
      promoCode,
      promoPct,
      payment: 'Cash',
      tendered,
      ...totals
    }),
    [lines, customer, discType, discVal, promoCode, promoPct, tendered, totals]
  );

  return {
    lines,
    customer,
    setCustomer,
    discType,
    setDiscType,
    discVal,
    setDiscVal,
    promoCode,
    setPromoCode,
    promoPct,
    setPromoPct,
    payment,
    setPayment,
    tendered,
    setTendered,
    momoNumber,
    setMomoNumber,
    momoNetwork,
    setMomoNetwork,
    isMobileMoney,
    totals,
    addProduct,
    updateQty,
    removeLine,
    clearCart,
    restore,
    payload
  };
}
