import { useState } from 'react';
import { usePosStore } from '../../context/PosStoreContext';
import StoreSelectModal from './StoreSelectModal';
import { useT } from '../../i18n/LanguageContext';

export default function PosNavbar() {
  const { activeStore, storeLocked } = usePosStore();
  const [storeOpen, setStoreOpen] = useState(false);
  const t = useT();

  return (
    <>
      <div className="pos-nav-extras">
        {!storeLocked && (
          <button
            type="button"
            className="pos-store-pill"
            onClick={() => setStoreOpen(true)}
            title={t('Change store')}
          >
            {activeStore?.icon || '🏪'} {activeStore?.name || t('Select store')}
            <i className="fas fa-chevron-down" style={{ fontSize: 10, color: 'var(--text-light)' }} />
          </button>
        )}
      </div>
      <StoreSelectModal open={storeOpen} onClose={() => setStoreOpen(false)} />
    </>
  );
}
