import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { storesApi } from '../services/posApi';
import { useAuth } from './AuthContext';
import { isStoreClerk } from '../utils/permissions';

const PosStoreContext = createContext(null);
const STORAGE_KEY = 'afritrade:pos-store';
const STORE_SCOPED_PATH = /\/stores\/(pos|inventory|transactions)/;

function readUrlStoreId() {
  try {
    return new URLSearchParams(window.location.search).get('store') || '';
  } catch {
    return '';
  }
}

function isStoreScopedPath() {
  return STORE_SCOPED_PATH.test(window.location.pathname);
}

export function PosStoreProvider({ children }) {
  const { user } = useAuth();
  const clerkStoreLocked = isStoreClerk(user?.role) && !!user?.assignedStoreId;
  const lockedStoreId = clerkStoreLocked ? user.assignedStoreId : null;
  const [searchParams, setSearchParams] = useSearchParams();
  const [stores, setStores] = useState([]);
  const [storeId, setStoreIdState] = useState(
    () => lockedStoreId || readUrlStoreId() || localStorage.getItem(STORAGE_KEY) || ''
  );
  const [loading, setLoading] = useState(true);
  const storeIdRef = useRef(storeId);
  storeIdRef.current = storeId;

  const writeUrlStore = useCallback(
    (id) => {
      if (!id || !isStoreScopedPath()) return;
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (next.get('store') === id) return prev;
          next.set('store', id);
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const applyStoreId = useCallback(
    (id, { syncUrl = true } = {}) => {
      if (!id) return;
      setStoreIdState(id);
      localStorage.setItem(STORAGE_KEY, id);
      if (syncUrl) writeUrlStore(id);
    },
    [writeUrlStore]
  );

  // URL is the source of truth (unless clerk-locked).
  useEffect(() => {
    if (lockedStoreId) {
      applyStoreId(lockedStoreId);
      return;
    }
    const fromUrl = searchParams.get('store');
    if (fromUrl && fromUrl !== storeIdRef.current) {
      setStoreIdState(fromUrl);
      localStorage.setItem(STORAGE_KEY, fromUrl);
    }
  }, [searchParams, lockedStoreId, applyStoreId]);

  // Load stores; never replace a valid ?store= with a different store.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    storesApi
      .list({ lite: '1' })
      .then((res) => {
        if (cancelled) return;
        const list = (res.data?.data || res.data?.stores || []).filter((s) => s.active !== false);
        setStores(list);

        if (lockedStoreId) {
          applyStoreId(lockedStoreId);
          return;
        }

        const urlStore = readUrlStoreId() || searchParams.get('store') || '';
        if (urlStore && list.some((s) => s.storeId === urlStore)) {
          // Keep the URL store — do not fall back to localStorage / first store
          setStoreIdState(urlStore);
          localStorage.setItem(STORAGE_KEY, urlStore);
          return;
        }

        const preferred = urlStore || localStorage.getItem(STORAGE_KEY) || storeIdRef.current || '';
        const match = list.find((s) => s.storeId === preferred);
        const next = match?.storeId || list[0]?.storeId || '';
        if (next) applyStoreId(next);
        else setStoreIdState('');
      })
      .catch(() => {
        if (!cancelled) setStores([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedStoreId]);

  const setStoreId = useCallback(
    (id) => {
      if (clerkStoreLocked) return;
      applyStoreId(id);
    },
    [clerkStoreLocked, applyStoreId]
  );

  const activeStore = useMemo(
    () => stores.find((s) => s.storeId === storeId) || null,
    [stores, storeId]
  );

  return (
    <PosStoreContext.Provider
      value={{ stores, storeId, setStoreId, activeStore, loading, storeLocked: clerkStoreLocked }}
    >
      {children}
    </PosStoreContext.Provider>
  );
}

export const usePosStore = () => useContext(PosStoreContext);
