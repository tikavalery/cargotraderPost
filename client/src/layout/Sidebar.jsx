import { NavLink, useLocation, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { shippingApi } from '../services/shippingApi';
import { usePermissions } from '../hooks/usePermissions';
import { useT } from '../i18n/LanguageContext';

export default function Sidebar({ stats = {}, onClose, expanded = false, onToggleExpand }) {
  const { user } = useAuth();
  const t = useT();
  const {
    canManagePurchases,
    canViewPurchases,
    canAccessPurchasing,
    canViewFinance,
    canManageShipments,
    canViewShipments,
    canAccessShipping,
    canViewWarehouses,
    canAccessWarehouses,
    canManageUsers,
    canViewSettings,
    canViewStores,
    canManageSales,
    isStoreClerk,
    isWarehouseWorker,
    canManageWarehouses
  } = usePermissions();
  const { hasFeature, plan } = useSubscription();
  const location = useLocation();
  const inventoryActive = location.pathname.startsWith('/inventory');
  const purchasingActive = location.pathname.startsWith('/purchasing');
  const warehousesActive = location.pathname.startsWith('/warehouses');
  const shippingActive = location.pathname.startsWith('/shipping');
  const storesActive = location.pathname.startsWith('/stores');
  const financeActive = location.pathname.startsWith('/finance');
  const settingsActive = location.pathname.startsWith('/settings');
  const pricingActive = location.pathname.startsWith('/pricing');
  const [activeShipments, setActiveShipments] = useState(0);

  useEffect(() => {
    if (!canViewShipments || !user) return;
    if (!localStorage.getItem('afritrade_token')) return;
    shippingApi.stats().then((res) => setActiveShipments(res.data?.activeCount ?? 0)).catch(() => {});
  }, [canViewShipments, user]);

  const businessName = user?.businessName || 'ThriftShip Cameroon';
  const initial = businessName.charAt(0).toUpperCase();
  const purchasingHome = canManagePurchases ? '/purchasing/new' : '/purchasing/all';
  const settingsHome = canManageUsers ? '/settings/users' : '/settings/profile';
  const showPurchasing = canAccessPurchasing && hasFeature('purchases');
  const showShipping = canAccessShipping && hasFeature('shipping');
  const showStores = canViewStores && hasFeature('pos');
  const planName = t(plan?.name || 'Free');

  return (
    <aside
      className={`sidebar${expanded ? '' : ' is-collapsed'}`}
      aria-label={t('Main')}
      aria-expanded={expanded}
    >
      <div className="sidebar-logo">
        <Link
          to="/dashboard"
          className="sidebar-logo-text"
          onClick={onClose}
          aria-label={`${t('CargoTrader')} — ${t('Dashboard')}`}
        >
          <div className="logo-text">{t('CargoTrader')}</div>
          <div className="logo-sub">{t('ERP Platform')}</div>
        </Link>
        {onToggleExpand && (
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={onToggleExpand}
            aria-label={expanded ? t('Collapse sidebar') : t('Expand sidebar')}
            title={expanded ? t('Collapse sidebar') : t('Expand sidebar')}
          >
            <i className={`fas ${expanded ? 'fa-angles-left' : 'fa-angles-right'}`} />
          </button>
        )}
        {onClose && (
          <button type="button" className="sidebar-close" onClick={onClose} aria-label={t('Close menu')}>
            <i className="fas fa-times" />
          </button>
        )}
      </div>

      <Link
        to="/dashboard"
        className="sidebar-biz"
        onClick={onClose}
        title={businessName}
        aria-label={`${businessName} — ${t('Dashboard')}`}
      >
        <div className="biz-avatar">{initial}</div>
        <div className="biz-info">
          <div className="biz-name">{businessName}</div>
          <div className="biz-label">{t('Active Business')}</div>
        </div>
      </Link>

      {plan && !isStoreClerk && !isWarehouseWorker && (
        <Link to="/pricing" className="sidebar-plan-pill" title={t('{plan} plan', { plan: planName })}>
          <i className="fas fa-crown" />
          <span>{t('{plan} plan', { plan: planName })}</span>
        </Link>
      )}

      <nav className="sidebar-nav">
        <div className="nav-section-label"><i className="fas fa-th-large" /> <span>{t('Main')}</span></div>
        {!isStoreClerk && !isWarehouseWorker && (
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            end
            title={t('Dashboard')}
          >
            <i className="fas fa-th-large" />
            <span className="nav-label">{t('Dashboard')}</span>
          </NavLink>
        )}
        <NavLink
          to="/inventory/items"
          className={() => `nav-item${inventoryActive ? ' active' : ''}`}
          title={t('Inventory')}
        >
          <i className="fas fa-boxes" />
          <span className="nav-label">{t('Inventory')}</span>
          {stats.totalRecords > 0 ? (
            <span className="nav-badge">{stats.totalRecords}</span>
          ) : null}
        </NavLink>
        {inventoryActive && (
          <div className="sub-nav">
            <NavLink
              to="/inventory/items"
              className={({ isActive }) => `sub-nav-item${isActive ? ' active' : ''}`}
              end
            >
              <i className="fas fa-cube" />
              {t('Individual Items')}
            </NavLink>
            <NavLink
              to="/inventory/activity-log"
              className={({ isActive }) => `sub-nav-item${isActive ? ' active' : ''}`}
            >
              <i className="fas fa-history" />
              {t('Inbound / Outbound Log')}
            </NavLink>
          </div>
        )}

        <div className="nav-section-label"><i className="fas fa-shopping-bag" /> <span>{t('Commerce')}</span></div>
        {showPurchasing && (
          <>
            <NavLink
              to={purchasingHome}
              className={() => `nav-item${purchasingActive ? ' active' : ''}`}
              title={t('Buying / Purchases')}
            >
              <i className="fas fa-shopping-cart" />
              <span className="nav-label">{t('Buying / Purchases')}</span>
            </NavLink>
            {purchasingActive && (
              <div className="sub-nav">
                {canManagePurchases && (
                  <>
                    <NavLink
                      to="/purchasing/new"
                      className={({ isActive }) => `sub-nav-item${isActive ? ' active' : ''}`}
                      end
                    >
                      <i className="fas fa-plus-circle" />
                      {t('New Purchase')}
                    </NavLink>
                    <NavLink
                      to="/purchasing/bulk-new"
                      className={({ isActive }) => `sub-nav-item${isActive ? ' active' : ''}`}
                    >
                      <i className="fas fa-layer-group" />
                      {t('Bulk New Purchase')}
                    </NavLink>
                  </>
                )}
                <NavLink to="/purchasing/all" className={({ isActive }) => `sub-nav-item${isActive ? ' active' : ''}`}>
                  <i className="fas fa-clipboard-list" />
                  {t('All Purchases')}
                </NavLink>
                <NavLink to="/purchasing/suppliers" className={({ isActive }) => `sub-nav-item${isActive ? ' active' : ''}`}>
                  <i className="fas fa-address-book" /> {t('Suppliers')}
                </NavLink>
                {(canManagePurchases || canViewPurchases) && (
                  <NavLink to="/purchasing/quick-stats" className={({ isActive }) => `sub-nav-item${isActive ? ' active' : ''}`}>
                    <i className="fas fa-chart-bar" />
                    {t('Quick Stats')}
                  </NavLink>
                )}
              </div>
            )}
          </>
        )}
        {showStores && (
        <NavLink
          to={isStoreClerk ? '/stores/pos' : '/stores'}
          className={() => `nav-item${storesActive ? ' active' : ''}`}
          title={t('Stores & Sales')}
        >
          <i className="fas fa-store" />
          <span className="nav-label">{t('Stores & Sales')}</span>
        </NavLink>
        )}
        {showStores && storesActive && (
          <div className="sub-nav">
            {!isStoreClerk && (
              <NavLink to="/stores" className={({ isActive }) => `sub-nav-item${isActive ? ' active' : ''}`} end>
                <i className="fas fa-store" /> {t('All Stores')}
              </NavLink>
            )}
            <NavLink to="/stores/inventory" className={({ isActive }) => `sub-nav-item${isActive ? ' active' : ''}`}>
              <i className="fas fa-boxes" /> {t('Store Inventory')}
            </NavLink>
            {canManageSales && (
              <NavLink to="/stores/pos" className={({ isActive }) => `sub-nav-item${isActive ? ' active' : ''}`}>
                <i className="fas fa-cash-register" /> {t('POS Terminal')}
              </NavLink>
            )}
            <NavLink to="/stores/transactions" className={({ isActive }) => `sub-nav-item${isActive ? ' active' : ''}`}>
              <i className="fas fa-receipt" /> {t('Transactions')}
            </NavLink>
            {!isStoreClerk && (
              <NavLink to="/stores/quick-stats" className={({ isActive }) => `sub-nav-item${isActive ? ' active' : ''}`}>
                <i className="fas fa-chart-bar" /> {t('Quick Stats')}
              </NavLink>
            )}
          </div>
        )}
        {canViewFinance && (
          <>
            <NavLink
              to="/finance"
              className={() => `nav-item${financeActive ? ' active' : ''}`}
              title={t('Finance')}
            >
              <i className="fas fa-chart-line" />
              <span className="nav-label">{t('Finance')}</span>
            </NavLink>
            {financeActive && (
              <div className="sub-nav">
                <NavLink to="/finance" className={({ isActive }) => `sub-nav-item${isActive ? ' active' : ''}`} end>
                  <i className="fas fa-chart-pie" /> {t('Dashboard')}
                </NavLink>
                <NavLink to="/finance/revenue" className={({ isActive }) => `sub-nav-item${isActive ? ' active' : ''}`}>
                  <i className="fas fa-arrow-trend-up" /> {t('Revenue')}
                </NavLink>
                <NavLink to="/finance/expenses" className={({ isActive }) => `sub-nav-item${isActive ? ' active' : ''}`}>
                  <i className="fas fa-receipt" /> {t('Expenses')}
                </NavLink>
                <NavLink to="/finance/cash-flow" className={({ isActive }) => `sub-nav-item${isActive ? ' active' : ''}`}>
                  <i className="fas fa-water" /> {t('Cash Flow')}
                </NavLink>
                <NavLink to="/finance/profit-loss" className={({ isActive }) => `sub-nav-item${isActive ? ' active' : ''}`}>
                  <i className="fas fa-coins" /> {t('Profit & Loss')}
                </NavLink>
              </div>
            )}
          </>
        )}

        {canAccessWarehouses && (
          <>
            <div className="nav-section-label"><i className="fas fa-truck" /> <span>{t('Operations')}</span></div>
            <NavLink
              to="/warehouses"
              className={() => `nav-item${warehousesActive ? ' active' : ''}`}
              title={t('Warehouses')}
            >
              <i className="fas fa-warehouse" />
              <span className="nav-label">{t('Warehouses')}</span>
            </NavLink>
            {warehousesActive && (
              <div className="sub-nav">
                <NavLink to="/warehouses" className={({ isActive }) => `sub-nav-item${isActive ? ' active' : ''}`} end>
                  <i className="fas fa-warehouse" />
                  {isWarehouseWorker ? t('My Warehouses') : t('All Warehouses')}
                </NavLink>
                {canManageWarehouses && (
                  <NavLink to="/warehouses/quick-stats" className={({ isActive }) => `sub-nav-item${isActive ? ' active' : ''}`}>
                    <i className="fas fa-chart-bar" />
                    {t('Quick Stats')}
                  </NavLink>
                )}
              </div>
            )}
          </>
        )}
        {showShipping && (
          <>
            {!canAccessWarehouses && (
              <div className="nav-section-label"><i className="fas fa-truck" /> <span>{t('Operations')}</span></div>
            )}
            <NavLink
              to="/shipping"
              className={() => `nav-item${shippingActive ? ' active' : ''}`}
              title={t('Shipping')}
            >
              <i className="fas fa-ship" />
              <span className="nav-label">{t('Shipping')}</span>
              {activeShipments > 0 && <span className="nav-badge">{activeShipments}</span>}
            </NavLink>
            {shippingActive && (
              <div className="sub-nav">
                <NavLink to="/shipping" className={({ isActive }) => `sub-nav-item${isActive ? ' active' : ''}`} end>
                  <i className="fas fa-ship" /> {t('Active Shipments')}
                </NavLink>
                <NavLink to="/shipping/completed" className={({ isActive }) => `sub-nav-item${isActive ? ' active' : ''}`}>
                  <i className="fas fa-check-circle" /> {t('Completed')}
                </NavLink>
                <NavLink to="/shipping/documents" className={({ isActive }) => `sub-nav-item${isActive ? ' active' : ''}`}>
                  <i className="fas fa-folder-open" /> {t('Documents')}
                </NavLink>
              </div>
            )}
          </>
        )}

        {canViewSettings && (
          <>
            <div className="nav-section-label"><i className="fas fa-sliders-h" /> <span>{t('System')}</span></div>
            <NavLink
              to={settingsHome}
              className={() => `nav-item${settingsActive ? ' active' : ''}`}
              title={t('Settings')}
            >
              <i className="fas fa-cog" />
              <span className="nav-label">{t('Settings')}</span>
            </NavLink>
            {settingsActive && (
              <div className="sub-nav">
                {canManageUsers && (
                  <NavLink
                    to="/settings/users"
                    className={({ isActive }) => `sub-nav-item${isActive ? ' active' : ''}`}
                  >
                    <i className="fas fa-users" /> {t('Users & Staff')}
                  </NavLink>
                )}
                <NavLink
                  to="/settings/profile"
                  className={({ isActive }) => `sub-nav-item${isActive ? ' active' : ''}`}
                >
                  <i className="fas fa-user" /> {t('Profile')}
                </NavLink>
                <NavLink
                  to="/pricing"
                  className={() => `sub-nav-item${pricingActive ? ' active' : ''}`}
                >
                  <i className="fas fa-crown" /> {t('Pricing & Plans')}
                </NavLink>
              </div>
            )}
          </>
        )}
      </nav>
    </aside>
  );
}
