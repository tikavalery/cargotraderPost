import { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../api';

const AuthContext = createContext(null);

const SIDEBAR_EXPANDED_KEY = 'afritrade.sidebarExpanded';

/** After sign-in, start with a collapsed desktop sidebar (icon rail). */
function collapseSidebarForSession() {
  try {
    localStorage.setItem(SIDEBAR_EXPANDED_KEY, '0');
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('afritrade:sidebar-collapse'));
  }
}

function normalizeUser(user) {
  if (!user) return null;
  const preferredCurrency =
    user.preferredCurrency ||
    user.currency ||
    user.preferredCurrencies?.[0] ||
    user.currencies?.[0] ||
    'XAF';
  return {
    ...user,
    preferredCurrency,
    currency: preferredCurrency,
    defaultBusinessId: user.defaultBusinessId ? String(user.defaultBusinessId) : null,
    assignedStoreId: user.assignedStoreId || '',
    assignedStoreName: user.assignedStoreName || ''
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      if (!localStorage.getItem('afritrade_token')) {
        localStorage.removeItem('afritrade_user');
        return null;
      }
      return normalizeUser(JSON.parse(localStorage.getItem('afritrade_user')));
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(!!localStorage.getItem('afritrade_token'));

  useEffect(() => {
    const onSessionCleared = () => setUser(null);
    window.addEventListener('afritrade:session-cleared', onSessionCleared);
    return () => window.removeEventListener('afritrade:session-cleared', onSessionCleared);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('afritrade_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then((res) => {
        const nextUser = normalizeUser(res.data.user);
        setUser(nextUser);
        localStorage.removeItem('afritrade_business_id');
        if (nextUser?.defaultBusinessId) {
          localStorage.setItem('afritrade_business_id', nextUser.defaultBusinessId);
        }
        localStorage.setItem('afritrade_user', JSON.stringify(nextUser));
      })
      .catch((err) => {
        // Only clear the session on real auth failures — not when the API is down
        // (Vite proxy AggregateError / network). Clearing on network errors logs
        // users out and leaves finance pages looking blank.
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          localStorage.removeItem('afritrade_token');
          localStorage.removeItem('afritrade_refresh_token');
          localStorage.removeItem('afritrade_user');
          localStorage.removeItem('afritrade_business_id');
          setUser(null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const persistSession = (token, userData, refreshToken) => {
    const normalized = normalizeUser(userData);
    localStorage.setItem('afritrade_token', token);
    if (refreshToken) localStorage.setItem('afritrade_refresh_token', refreshToken);
    localStorage.removeItem('afritrade_business_id');
    if (normalized?.defaultBusinessId) {
      localStorage.setItem('afritrade_business_id', normalized.defaultBusinessId);
    }
    localStorage.setItem('afritrade_user', JSON.stringify(normalized));
    if (normalized?.preferredCurrency) {
      localStorage.setItem('afritrade_currency', normalized.preferredCurrency);
    }
    collapseSidebarForSession();
    setUser(normalized);
  };

  const register = async (data) => {
    const res = await authApi.register(data);
    persistSession(res.data.token, res.data.user, res.data.refreshToken);
    return res.data;
  };

  const login = async ({ identifier, password, rememberMe = false }) => {
    const res = await authApi.login({ identifier, password, rememberMe });
    persistSession(res.data.token, { ...res.data.user, rememberMe }, res.data.refreshToken);
    return res.data;
  };

  const loginWithGoogle = async (payload) => {
    const res = await authApi.google(payload);
    persistSession(
      res.data.token,
      { ...res.data.user, rememberMe: payload.rememberMe !== false },
      res.data.refreshToken
    );
    return res.data;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      /* clear local session even if API fails */
    }
    localStorage.removeItem('afritrade_token');
    localStorage.removeItem('afritrade_refresh_token');
    localStorage.removeItem('afritrade_user');
    localStorage.removeItem('afritrade_business_id');
    localStorage.removeItem('afritrade_currency');
    collapseSidebarForSession();
    setUser(null);
  };

  const setActiveBusiness = (businessId) => {
    localStorage.setItem('afritrade_business_id', businessId);
    setUser((prev) => (prev ? { ...prev, defaultBusinessId: String(businessId) } : prev));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        register,
        login,
        loginWithGoogle,
        logout,
        setActiveBusiness,
        isAuthenticated: !!user && !!localStorage.getItem('afritrade_token')
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
