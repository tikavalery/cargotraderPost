import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { inventoryItemsApi } from '../api';
import { onInventoryChanged } from '../utils/inventoryEvents';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import PaymentFailureBanner from '../components/billing/PaymentFailureBanner';
import { useT } from '../i18n/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';

const SIDEBAR_EXPANDED_KEY = 'afritrade.sidebarExpanded';

function readDesktopExpanded() {
  try {
    const stored = localStorage.getItem(SIDEBAR_EXPANDED_KEY);
    if (stored === null) return false;
    return stored === '1';
  } catch {
    return false;
  }
}

export default function AppShell({
  children,
  searchPlaceholder,
  navbarTitle,
  hideSearch,
  breadcrumbs,
  navbarRight,
  userMenuProps,
  className = ''
}) {
  const t = useT();
  const { isAuthenticated } = useAuth();
  const { currency } = useCurrency();
  const [stats, setStats] = useState({ itemCount: 0, totalRecords: 0 });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopExpanded, setDesktopExpanded] = useState(readDesktopExpanded);
  const location = useLocation();

  useEffect(() => {
    // Login / logout forces collapsed; expand preference still persists mid-session.
    const onCollapse = () => setDesktopExpanded(false);
    window.addEventListener('afritrade:sidebar-collapse', onCollapse);
    return () => window.removeEventListener('afritrade:sidebar-collapse', onCollapse);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    inventoryItemsApi
      .stats()
      .then((res) => setStats(res.data))
      .catch(() => {});
    return undefined;
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const refresh = () => {
      inventoryItemsApi.stats().then((res) => setStats(res.data)).catch(() => {});
    };
    const stopInventory = onInventoryChanged(refresh);
    return () => {
      stopInventory();
    };
  }, [isAuthenticated]);

  const refreshStats = () => {
    inventoryItemsApi.stats().then((res) => setStats(res.data)).catch(() => {});
  };

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_EXPANDED_KEY, desktopExpanded ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [desktopExpanded]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('sidebar-rail-collapsed', !desktopExpanded);
    return () => root.classList.remove('sidebar-rail-collapsed');
  }, [desktopExpanded]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 900) setMobileOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
        if (window.innerWidth > 900) setDesktopExpanded(false);
      }
    };
    if (!mobileOpen && !desktopExpanded) return undefined;
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen, desktopExpanded]);

  const toggleSidebar = () => {
    if (window.innerWidth <= 900) {
      setMobileOpen((open) => !open);
      return;
    }
    setDesktopExpanded((open) => !open);
  };

  const shellClass = [
    'app-shell',
    mobileOpen ? 'sidebar-open' : '',
    desktopExpanded ? '' : 'sidebar-collapsed',
    className
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={shellClass}>
      <button
        type="button"
        className="sidebar-backdrop"
        aria-label={t('Close menu')}
        tabIndex={mobileOpen ? 0 : -1}
        onClick={() => setMobileOpen(false)}
      />
      <Sidebar
        stats={stats}
        onClose={() => setMobileOpen(false)}
        expanded={desktopExpanded}
        onToggleExpand={toggleSidebar}
      />
      <div className="main-area">
        <PaymentFailureBanner />
        <Navbar
          placeholder={searchPlaceholder}
          title={navbarTitle}
          hideSearch={hideSearch}
          breadcrumbs={breadcrumbs}
          navbarRight={navbarRight}
          userMenuProps={userMenuProps}
          onMenuToggle={toggleSidebar}
          sidebarOpen={mobileOpen || desktopExpanded}
        />
        {typeof children === 'function' ? (
          <div key={currency} className="app-shell-currency-scope">
            {children({ refreshStats })}
          </div>
        ) : (
          <div key={currency} className="app-shell-currency-scope">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
