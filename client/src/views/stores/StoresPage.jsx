import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useToast } from '../../context/ToastContext';
import { useSyncedSearch } from '../../context/SearchContext';
import { useT } from '../../i18n/LanguageContext';
import { storesApi } from '../../services/posApi';
import { useStores, filterStores } from '../../hooks/useStores';
import AppShell from '../../layout/AppShell';
import StoreGrid from '../../components/stores/StoreGrid';
import AddEditStoreModal from '../../components/stores/AddEditStoreModal';
import AccountantReadOnlyNotice from '../../components/AccountantReadOnlyNotice';
import PlanLimitBanner from '../../components/plan/PlanLimitBanner';
import { usePlanUsage } from '../../hooks/usePlanUsage';

const BREADCRUMBS = [
  { label: 'CargoTrader', to: '/dashboard' },
  { label: 'All Stores', current: true }
];

export default function StoresPage() {
  const t = useT();
  const { user } = useAuth();
  const { isStoreClerk, canManageStores } = usePermissions();
  const { showToast } = useToast();
  const { search } = useSyncedSearch();
  const { stores, meta, loading, error, refetch } = useStores();
  const { planId, storeLimit, storesUsed, atStoreLimit, reload: reloadUsage } = usePlanUsage();
  const [addOpen, setAddOpen] = useState(false);
  const [editStore, setEditStore] = useState(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => filterStores(stores, search), [stores, search]);
  const businessName = user?.businessName || 'ThriftShip Cameroon';
  const subtitle = `${businessName} · ${meta.storeCount || stores.length} store${(meta.storeCount || stores.length) !== 1 ? 's' : ''} across ${meta.cityCount || 1} ${(meta.cityCount || 1) !== 1 ? 'cities' : 'city'}`;

  const openAddStore = () => {
    if (atStoreLimit) {
      showToast(
        storeLimit != null
          ? `Your plan allows up to ${storeLimit} store${storeLimit === 1 ? '' : 's'} (${storesUsed} used). Existing stores are kept — upgrade or remove one to add another.`
          : 'Store limit reached. Upgrade your plan to add more.'
      );
      return;
    }
    setAddOpen(true);
  };

  const handleAdd = async (form) => {
    setSaving(true);
    try {
      const res = await storesApi.create(form);
      showToast(`Store added: ${res.data.data.name}`, 'success');
      setAddOpen(false);
      refetch();
      reloadUsage();
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to add store');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (form) => {
    setSaving(true);
    try {
      await storesApi.update(editStore.storeId, form);
      showToast('Store updated', 'success');
      setEditStore(null);
      refetch();
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to update store');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (store) => {
    if (
      !window.confirm(
        `Permanently delete store "${store.name}"? This cannot be undone. Store inventory at this location will also be removed.`
      )
    ) {
      return;
    }
    try {
      await storesApi.remove(store.storeId);
      showToast('Store deleted', 'success');
      refetch();
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to delete store');
    }
  };

  if (isStoreClerk) return <Navigate to="/stores/pos" replace />;

  return (
    <AppShell
      className="app-shell--stores"
      searchPlaceholder={t('Search stores, cities, managers…')}
      breadcrumbs={BREADCRUMBS}
      navbarRight={
        canManageStores ? (
          <button
            type="button"
            className="btn-add-store-nav"
            onClick={openAddStore}
            title={t('Add Store')}
            aria-label={t('Add Store')}
          >
            <i className="fas fa-plus" />
            <span className="stores-chrome-label">{t('Add Store')}</span>
          </button>
        ) : null
      }
    >
      <div className="content stores-landing-page">
        <div className="page-header stores-landing-chrome">
          <div>
            <h1>{t('Stores & Sales')}</h1>
            <p className="page-header-sub">{subtitle}</p>
          </div>
        </div>

        <AccountantReadOnlyNotice module="stores" />

        <PlanLimitBanner
          label={t('Stores')}
          limit={storeLimit}
          used={storesUsed}
          planId={planId}
        />

        {loading && (
          <p style={{ color: 'var(--text-light)' }}>
            <i className="fas fa-spinner fa-spin" /> {t('Loading stores…')}
          </p>
        )}
        {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
        {!loading && !error && (
          <StoreGrid
            stores={filtered}
            totalCount={stores.length}
            searchActive={Boolean(search?.trim())}
            onEdit={canManageStores ? setEditStore : undefined}
            onDelete={canManageStores ? handleDelete : undefined}
          />
        )}
      </div>

      {canManageStores && (
        <>
          <AddEditStoreModal open={addOpen} onClose={() => setAddOpen(false)} onSave={handleAdd} saving={saving} />
          <AddEditStoreModal
            open={Boolean(editStore)}
            store={editStore}
            onClose={() => setEditStore(null)}
            onSave={handleEdit}
            saving={saving}
          />
        </>
      )}
    </AppShell>
  );
}
