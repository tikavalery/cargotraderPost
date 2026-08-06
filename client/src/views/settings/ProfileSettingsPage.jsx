import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useSubscription } from '../../context/SubscriptionContext';
import { useCurrency } from '../../context/CurrencyContext';
import ManageBillingButton from '../../components/billing/ManageBillingButton';
import { userApi, businessApi } from '../../api';
import { CURRENCY_OPTIONS } from '../../theme/authConstants';

const BUSINESS_OWNER_ROLE = 'Business Owner';

export default function ProfileSettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { canManageStores, role } = usePermissions();
  const { plan } = useSubscription();
  const { currency: appCurrency, setCurrency } = useCurrency();
  const [name, setName] = useState(user?.name || '');

  const [phone, setPhone] = useState(user?.phone || '');
  const [preferredCurrency, setPreferredCurrency] = useState(
    user?.preferredCurrency || appCurrency || 'XAF'
  );
  const [saving, setSaving] = useState(false);

  const isOwner = role === BUSINESS_OWNER_ROLE;
  const businessId = user?.defaultBusinessId || localStorage.getItem('afritrade_business_id') || '';
  const [business, setBusiness] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!isOwner || !businessId) return;
    let cancelled = false;
    businessApi
      .get(businessId)
      .then((res) => {
        if (!cancelled) setBusiness(res.data?.data || res.data || null);
      })
      .catch(() => {
        if (!cancelled) setBusiness(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isOwner, businessId]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await userApi.updateProfile({
        name: name.trim(),
        phone: phone.trim(),
        preferredCurrency
      });
      const updated = res.data?.user;
      if (updated) {
        const stored = { ...user, ...updated, preferredCurrency, currency: preferredCurrency };
        localStorage.setItem('afritrade_user', JSON.stringify(stored));
        localStorage.setItem('afritrade_currency', preferredCurrency);
        setCurrency(preferredCurrency);
      }
      showToast('Profile updated', 'success');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    if (!businessId || !business?.name) {
      showToast('Could not load business details', 'error');
      return;
    }
    if (confirmName.trim().toLowerCase() !== String(business.name).trim().toLowerCase()) {
      showToast('Business name does not match', 'error');
      return;
    }
    setDeleting(true);
    try {
      await businessApi.remove(businessId, {
        confirmName: confirmName.trim(),
        password
      });
      showToast('Your business account has been deleted', 'success');
      setDeleteOpen(false);
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete account', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="settings-profile-page">
      <header className="settings-panel-header page-chrome-dense">
        <h1 className="settings-panel-title">Profile</h1>
        <p className="settings-panel-desc page-chrome-dense-hide">
          Update your personal details and display preferences.
        </p>
      </header>

      <form className="settings-form settings-profile-form" onSubmit={handleSave}>
        <div className="form-group">
          <label className="form-label" htmlFor="profile-email">Email</label>
          <input
            id="profile-email"
            type="email"
            value={user?.email || ''}
            disabled
            className="form-input"
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="profile-name">Full name</label>
          <input
            id="profile-name"
            type="text"
            className="form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="profile-phone">Phone</label>
          <input
            id="profile-phone"
            type="tel"
            className="form-input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="profile-currency">Preferred currency</label>
          <select
            id="profile-currency"
            className="form-input form-select"
            value={preferredCurrency}
            onChange={(e) => {
              const next = e.target.value;
              setPreferredCurrency(next);
              setCurrency(next);
            }}
          >
            {CURRENCY_OPTIONS.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="profile-role">Role</label>
          <input
            id="profile-role"
            type="text"
            className="form-input"
            value={user?.role || ''}
            disabled
          />
        </div>
        <div className="settings-form-actions">
          <button type="submit" className="btn-primary settings-profile-save" disabled={saving}>
            {saving ? <><i className="fas fa-spinner fa-spin" /> Saving…</> : 'Save changes'}
          </button>
        </div>
      </form>

      {canManageStores && plan?.id && plan.id !== 'free' && (
        <section className="settings-billing-section">
          <h2 className="settings-billing-title">Subscription &amp; billing</h2>
          <p className="settings-billing-desc">
            Update your payment method, view invoices, or cancel your {plan.name} plan in Stripe&apos;s secure
            billing portal.
          </p>
          <ManageBillingButton className="btn btn-secondary settings-billing-btn" label="Manage subscription" />
        </section>
      )}

      {isOwner && (
        <section className="settings-danger-zone" aria-labelledby="danger-zone-title">
          <h2 id="danger-zone-title" className="settings-danger-title">
            Danger zone
          </h2>
          <p className="settings-danger-desc">
            Permanently delete <strong>{business?.name || 'this business'}</strong> and all of its data —
            inventory, purchases, warehouses, stores, shipments, sales, finance records, staff access, and
            billing. This cannot be undone.
          </p>
          {!deleteOpen ? (
            <button
              type="button"
              className="btn settings-danger-btn"
              onClick={() => {
                setConfirmName('');
                setPassword('');
                setDeleteOpen(true);
              }}
            >
              <i className="fas fa-trash-alt" /> Delete business account
            </button>
          ) : (
            <form className="settings-danger-form" onSubmit={handleDeleteAccount}>
              <p className="settings-danger-confirm-hint">
                Type <strong>{business?.name || '…'}</strong> to confirm
              </p>
              <div className="form-group">
                <label className="form-label" htmlFor="delete-confirm-name">
                  Business name
                </label>
                <input
                  id="delete-confirm-name"
                  type="text"
                  className="form-input"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  autoComplete="off"
                  required
                  disabled={deleting || !business?.name}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="delete-confirm-password">
                  Your password
                </label>
                <input
                  id="delete-confirm-password"
                  type="password"
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Required for email/password accounts"
                  disabled={deleting}
                />
              </div>
              <div className="settings-danger-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={deleting}
                  onClick={() => {
                    setDeleteOpen(false);
                    setConfirmName('');
                    setPassword('');
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn settings-danger-btn"
                  disabled={
                    deleting ||
                    !business?.name ||
                    confirmName.trim().toLowerCase() !== String(business.name).trim().toLowerCase()
                  }
                >
                  {deleting ? (
                    <>
                      <i className="fas fa-spinner fa-spin" /> Deleting…
                    </>
                  ) : (
                    <>
                      <i className="fas fa-exclamation-triangle" /> Delete forever
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
