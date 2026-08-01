import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppShell from '../../layout/AppShell';
import { usePosStore } from '../../context/PosStoreContext';
import { useToast } from '../../context/ToastContext';
import { usePosCart } from '../../hooks/usePosCart';
import { usePosProducts } from '../../hooks/usePosProducts';
import { useHeldSales } from '../../hooks/useHeldSales';
import { posApi, storesApi } from '../../services/posApi';
import { formatXaf } from '../../utils/format';
import PosNavbar from '../../components/stores/PosNavbar';
import ProductGrid from '../../components/stores/ProductGrid';
import CartPanel from '../../components/stores/CartPanel';
import PaymentPanel from '../../components/stores/PaymentPanel';
import ProductDetailModal from '../../components/stores/ProductDetailModal';
import QrScanModal from '../../components/stores/QrScanModal';
import SaleSuccessModal from '../../components/stores/SaleSuccessModal';

import ClerkStoreNotice from '../../components/ClerkStoreNotice';
import { useT } from '../../i18n/LanguageContext';

export default function PosTerminalPage() {
  const t = useT();
  const { activeStore, storeId } = usePosStore();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [detailProduct, setDetailProduct] = useState(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);

  const cart = usePosCart();
  const { products, loading, refetch } = usePosProducts(storeId, { category, search });
  const { create: createHeld } = useHeldSales(storeId);

  useEffect(() => {
    refetch();
  }, [storeId, refetch]);

  useEffect(() => {
    const resumeId = searchParams.get('resume');
    if (!resumeId) return;
    posApi.resumeHeld(resumeId).then((res) => {
      cart.restore(res.data?.data);
      showToast(t('Held sale restored'), 'success');
      navigate('/stores/pos', { replace: true });
    }).catch(() => showToast(t('Could not resume held sale')));
  }, [searchParams]);

  const handleQuickAdd = (product) => {
    const ok = cart.addProduct(product);
    if (ok) showToast(t('{name} added', { name: product.name }), 'success');
    else showToast(t('Out of stock'), 'error');
  };

  const handleLookup = async (code) => {
    setLookupLoading(true);
    try {
      const res = await storesApi.lookup(code, storeId);
      handleQuickAdd(res.data?.data);
    } catch {
      const local = products.find(
        (p) => p.sku.toLowerCase() === code.toLowerCase() || String(p.productId).toLowerCase() === code.toLowerCase()
      );
      if (local) handleQuickAdd(local);
      else showToast(t('Product not found'));
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSearchEnter = async (e) => {
    if (e.key !== 'Enter' || !search.trim()) return;
    await handleLookup(search.trim());
    setSearch('');
  };

  const handleHold = async () => {
    if (!cart.lines.length) return;
    try {
      await createHeld({
        storeId,
        ...cart.payload
      });
      cart.clearCart();
      showToast(t('Sale held'), 'success');
    } catch (e) {
      showToast(e.response?.data?.message || t('Hold failed'));
    }
  };

  const handleCancel = () => {
    if (cart.lines.length && !window.confirm(t('Clear current cart?'))) return;
    cart.clearCart();
  };

  const confirmDiscountIfNeeded = () => {
    const discount = Number(cart.totals.discount) || 0;
    if (discount <= 0) return true;
    const parts = [];
    if (Number(cart.discVal) > 0) {
      parts.push(
        cart.discType === 'pct'
          ? t('{pct}% manual discount', { pct: cart.discVal })
          : t('{amount} manual discount', { amount: formatXaf(cart.discVal) })
      );
    }
    if (cart.promoCode && Number(cart.promoPct) > 0) {
      parts.push(t('promo {code} ({pct}%)', { code: cart.promoCode, pct: cart.promoPct }));
    }
    const detail = parts.length ? parts.join(' · ') : t('a discount');
    return window.confirm(
      t(
        'You are applying a discount of {amount} ({detail}).\n\nSubtotal: {subtotal}\nTotal after discount: {total}\n\nContinue with this discounted sale?',
        {
          amount: formatXaf(discount),
          detail,
          subtotal: formatXaf(cart.totals.subtotal),
          total: formatXaf(cart.totals.total)
        }
      )
    );
  };

  const handleDiscValChange = (value) => {
    const next = Number(value) || 0;
    const prev = Number(cart.discVal) || 0;
    if (next > 0 && prev === 0) {
      const ok = window.confirm(
        t(
          'Apply a discount to this sale?\n\nYou are about to reduce the sale total. Confirm only if this discount is intentional.'
        )
      );
      if (!ok) return;
    }
    cart.setDiscVal(next);
  };

  const handlePromoApply = (code, pct) => {
    if (pct > 0) {
      const ok = window.confirm(
        t(
          'Apply promo code {code} for {pct}% off this sale?\n\nConfirm only if this discount is intentional.',
          { code, pct }
        )
      );
      if (!ok) return;
    }
    cart.setPromoCode(code);
    cart.setPromoPct(pct);
    if (code) showToast(t('Promo {code} applied', { code }), 'success');
  };

  const handleComplete = async () => {
    if (!cart.lines.length) return;
    if (cart.tendered < cart.totals.total) {
      showToast(t('Insufficient tendered amount'));
      return;
    }
    if (!confirmDiscountIfNeeded()) return;
    setCompleting(true);
    try {
      const res = await posApi.createTransaction({
        storeId,
        storeName: activeStore?.name,
        ...cart.payload,
        payment: 'Cash',
        promoPct: cart.promoPct
      });
      setReceipt(res.data?.receipt || res.data?.data);
      setSuccessOpen(true);
      cart.clearCart();
      refetch();
    } catch (e) {
      showToast(e.response?.data?.message || t('Sale failed'));
    } finally {
      setCompleting(false);
    }
  };

  return (
    <>
      <AppShell
        className="app-shell--pos"
        hideSearch
        breadcrumbs={[
          { label: 'CargoTrader', to: '/dashboard' },
          { label: 'POS Terminal', current: true }
        ]}
        userMenuProps={{ avatarVariant: 'primary' }}
        navbarRight={<PosNavbar />}
      >
        <div className="content pos-terminal-page">
          <ClerkStoreNotice />
          <div className="pos-grid">
            <div>
              <ProductGrid
                products={products}
                loading={loading}
                lookupLoading={lookupLoading}
                category={category}
                onCategoryChange={setCategory}
                search={search}
                onSearchChange={setSearch}
                onScanClick={() => setQrOpen(true)}
                onPreview={setDetailProduct}
                onQuickAdd={handleQuickAdd}
                storeName={activeStore?.name}
                onSearchKeyDown={handleSearchEnter}
              />
            </div>
            <CartPanel
              lines={cart.lines}
              totals={cart.totals}
              discType={cart.discType}
              discVal={cart.discVal}
              promoCode={cart.promoCode}
              onDiscTypeChange={cart.setDiscType}
              onDiscValChange={handleDiscValChange}
              onPromoApply={handlePromoApply}
              onPromoClear={() => { cart.setPromoCode(''); cart.setPromoPct(0); }}
              onUpdateQty={cart.updateQty}
              onRemoveLine={cart.removeLine}
              onHold={handleHold}
              onCancel={handleCancel}
            />
            <PaymentPanel
              payment={cart.payment}
              onPaymentChange={cart.setPayment}
              tendered={cart.tendered}
              onTenderedChange={cart.setTendered}
              total={cart.totals.total}
              onComplete={handleComplete}
              completing={completing}
            />
          </div>
        </div>
      </AppShell>

      <ProductDetailModal
        product={detailProduct}
        open={!!detailProduct}
        onClose={() => setDetailProduct(null)}
        onAdd={handleQuickAdd}
      />
      <QrScanModal open={qrOpen} onClose={() => setQrOpen(false)} onScan={handleLookup} />
      <SaleSuccessModal
        open={successOpen}
        receipt={receipt}
        onClose={() => { setSuccessOpen(false); setReceipt(null); }}
      />
    </>
  );
}
