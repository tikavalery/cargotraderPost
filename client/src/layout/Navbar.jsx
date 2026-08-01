import { Link } from 'react-router-dom';
import { useSyncedSearch } from '../context/SearchContext';
import { useAuth } from '../context/AuthContext';
import NavbarUserMenu from './NavbarUserMenu';
import ClerkStoreNavbarPill from '../components/stores/ClerkStoreNavbarPill';
import WarehouseWorkerNavbarPill from '../components/warehouses/WarehouseWorkerNavbarPill';
import LangToggle from '../components/common/LangToggle';
import { useT } from '../i18n/LanguageContext';

function Breadcrumbs({ items, t }) {
  return (
    <nav className="navbar-breadcrumb" aria-label={t('Breadcrumb')}>
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="breadcrumb-segment">
          {i > 0 && <span className="breadcrumb-sep">/</span>}
          {item.current ? (
            <span className="breadcrumb-current">{t(item.label)}</span>
          ) : (
            <Link to={item.to} className="breadcrumb-link">
              {t(item.label)}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

export default function Navbar({
  placeholder = 'Search items, SKU…',
  title,
  hideSearch,
  breadcrumbs,
  navbarRight,
  userMenuProps,
  onMenuToggle,
  sidebarOpen = false,
  showLangToggle = true
}) {
  const { search, setSearch } = useSyncedSearch();
  const { user } = useAuth();
  const t = useT();

  return (
    <header className="navbar">
      <div className="navbar-left">
        {onMenuToggle && (
          <button
            type="button"
            className="navbar-menu-btn"
            onClick={onMenuToggle}
            aria-label={sidebarOpen ? t('Close menu') : t('Open menu')}
            aria-expanded={sidebarOpen}
          >
            <i className={`fas ${sidebarOpen ? 'fa-times' : 'fa-bars'}`} />
          </button>
        )}
        {breadcrumbs ? (
          <Breadcrumbs items={breadcrumbs} t={t} />
        ) : (
          <div className="navbar-title">
            {typeof title === 'string' || title == null ? t(title || 'CargoTrader') : title}
          </div>
        )}
      </div>
      {!hideSearch && (
        <div className="search-bar">
          <i className="fas fa-search search-icon" />
          <input
            type="search"
            placeholder={t(placeholder)}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label={t('Global search')}
          />
        </div>
      )}
      {(navbarRight || user || showLangToggle) && (
        <div className="navbar-actions">
          <ClerkStoreNavbarPill />
          <WarehouseWorkerNavbarPill />
          {showLangToggle && <LangToggle />}
          {navbarRight}
          {user && <NavbarUserMenu {...userMenuProps} />}
        </div>
      )}
    </header>
  );
}
