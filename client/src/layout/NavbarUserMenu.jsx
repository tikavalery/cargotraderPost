import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useT } from '../i18n/LanguageContext';
import { STORE_CLERK_ROLE } from '../utils/permissions';

function getInitials(name) {
  return (name || 'U')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function NavbarUserMenu({
  roleLabel,
  avatarVariant = 'default',
  showChevron = true,
  className = ''
}) {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const t = useT();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  const name = user?.name || 'User';
  const roleKey = roleLabel || user?.role || 'Business Owner';
  const role = t(roleKey);
  const initials = getInitials(name);
  const isFrontlineSales =
    roleKey === STORE_CLERK_ROLE ||
    roleKey === 'Cashier' ||
    String(roleKey).toLowerCase() === 'cashier';
  const avatarClass =
    avatarVariant === 'primary'
      ? 'ship-user-avatar nav-user-avatar-primary'
      : 'ship-user-avatar';
  const badgeClass = isFrontlineSales ? 'pos-cashier-badge' : 'ship-role-badge';

  const updateMenuPosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setMenuStyle({
      position: 'fixed',
      top: rect.bottom + 8,
      right: Math.max(12, window.innerWidth - rect.right),
      minWidth: 220
    });
  };

  useEffect(() => {
    if (!open) return undefined;
    updateMenuPosition();
    const onDocClick = (event) => {
      const inTrigger = rootRef.current?.contains(event.target);
      const inMenu = dropdownRef.current?.contains(event.target);
      if (!inTrigger && !inMenu) setOpen(false);
    };
    const onEsc = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const onLayout = () => updateMenuPosition();
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    window.addEventListener('resize', onLayout);
    window.addEventListener('scroll', onLayout, true);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
      window.removeEventListener('resize', onLayout);
      window.removeEventListener('scroll', onLayout, true);
    };
  }, [open]);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setOpen(false);
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      showToast('Sign out failed', 'error');
      setSigningOut(false);
    }
  };

  const handleProfile = () => {
    setOpen(false);
    navigate('/settings/profile');
  };

  if (!user) return null;

  const dropdown = open && menuStyle
    ? createPortal(
        <div className="nav-user-dropdown" style={menuStyle} role="menu" ref={dropdownRef}>
          <div className="nav-user-dropdown-header">
            <div className="nav-user-dropdown-avatar">{initials}</div>
            <div className="nav-user-dropdown-meta">
              <div className="nav-user-dropdown-name">{name}</div>
              {user.email ? <div className="nav-user-dropdown-email">{user.email}</div> : null}
              {user.businessName ? (
                <div className="nav-user-dropdown-business">{user.businessName}</div>
              ) : null}
            </div>
          </div>
          <div className="nav-user-dropdown-divider" />
          <button type="button" className="nav-user-dropdown-item" role="menuitem" onClick={handleProfile}>
            <i className="fas fa-user-cog" aria-hidden />
            Profile Settings
          </button>
          <button
            type="button"
            className="nav-user-dropdown-item danger"
            role="menuitem"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            <i className={`fas fa-sign-out-alt${signingOut ? ' fa-spin' : ''}`} aria-hidden />
            {signingOut ? 'Signing out…' : 'Sign Out'}
          </button>
        </div>,
        document.body
      )
    : null;

  return (
    <div className={`nav-user-menu ${className}`.trim()} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="ship-user-pill nav-user-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account menu for ${name}`}
      >
        <div className={avatarClass}>{initials}</div>
        <div className="nav-user-text">
          <div className="ship-user-name">{name}</div>
          <span className={badgeClass}>{role}</span>
        </div>
        {showChevron && (
          <i
            className={`fas fa-chevron-down nav-user-chevron${open ? ' open' : ''}`}
            aria-hidden
          />
        )}
      </button>
      {dropdown}
    </div>
  );
}
