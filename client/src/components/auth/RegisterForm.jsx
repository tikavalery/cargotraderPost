import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { COUNTRY_CURRENCY, COUNTRIES } from '../../theme/authConstants';
import AuthErrorBanner from './AuthErrorBanner';
import TabSwitcher from './TabSwitcher';
import PasswordInput from './PasswordInput';
import CurrencyChipGroup from './CurrencyChipGroup';
import RoleSelector from './RoleSelector';
import SocialAuthButtons from './SocialAuthButtons';
import TwoFactorNotice from './TwoFactorNotice';

function validate(form) {
  if (!form.name.trim()) return 'Please enter your full name';
  if (!form.identifier.trim()) return 'Please enter your email or phone number';
  if (form.password.length < 8) return 'Password must be at least 8 characters';
  if (!form.country) return 'Please select your country';
  if (!form.currency) return 'Please select your preferred currency';
  return null;
}

export default function RegisterForm() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    identifier: '',
    password: '',
    businessName: '',
    country: 'Cameroon',
    currency: 'XAF',
    role: 'Business Owner'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleCountryChange = (e) => {
    const country = e.target.value;
    setForm((f) => {
      const next = { ...f, country };
      const local = COUNTRY_CURRENCY[country];
      if (local) next.currency = local;
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const validationError = validate(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      await register({
        name: form.name.trim(),
        identifier: form.identifier.trim(),
        password: form.password,
        businessName: form.businessName.trim(),
        country: form.country || 'Cameroon',
        currency: form.currency,
        role: 'Business Owner'
      });
      setTimeout(() => navigate('/dashboard'), 500);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <>
      <AuthErrorBanner message={error} />

      <div className="form-heading">
        <h2>Create your CargoTrader account</h2>
        <p>Start managing your import business today</p>
      </div>

      <TabSwitcher activeTab="register" />

      <form onSubmit={handleSubmit}>
        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label" htmlFor="regName">Full Name</label>
            <div className="input-wrap">
              <i className="fas fa-user input-icon" />
              <input
                id="regName"
                type="text"
                className="form-input"
                placeholder="Amara Ndoye"
                autoComplete="name"
                value={form.name}
                onChange={set('name')}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="regIdentifier">Email or Phone</label>
            <div className="input-wrap">
              <input
                id="regIdentifier"
                type="text"
                className="form-input"
                placeholder="amara@example.com"
                autoComplete="email"
                value={form.identifier}
                onChange={set('identifier')}
              />
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="regPassword">Password</label>
          <PasswordInput
            id="regPassword"
            value={form.password}
            onChange={set('password')}
            placeholder="Create a strong password"
          />
        </div>

        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label" htmlFor="regBusiness">
              Business Name <span className="label-optional">(optional)</span>
            </label>
            <div className="input-wrap">
              <i className="fas fa-store input-icon" />
              <input
                id="regBusiness"
                type="text"
                className="form-input"
                placeholder="e.g. ThriftShip Cameroon"
                value={form.businessName}
                onChange={set('businessName')}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="regCountry">Country Operated</label>
            <div className="input-wrap">
              <i className="fas fa-globe-africa input-icon" />
              <select id="regCountry" className="form-select" value={form.country} onChange={handleCountryChange}>
                <option value="">Select country…</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <i className="fas fa-chevron-down select-arrow" />
            </div>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="regCurrency">Preferred Currency</label>
          <p className="form-hint">Select one currency for your business. You can change it later in the app.</p>
          <CurrencyChipGroup value={form.currency} onChange={(code) => setForm((f) => ({ ...f, currency: code }))} />
        </div>

        <div className="form-group">
          <label className="form-label">Your Role</label>
          <RoleSelector />
        </div>

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? (
            <>
              <i className="fas fa-spinner fa-spin" /> Creating account…
            </>
          ) : (
            <>
              <i className="fas fa-user-plus" /> Create Account
            </>
          )}
        </button>
      </form>

      <SocialAuthButtons
        dividerLabel="or sign up with"
        mode="register"
        registerMeta={{
          businessName: form.businessName,
          country: form.country,
          currency: form.currency,
          role: form.role
        }}
        onSuccess={() => navigate('/dashboard', { replace: true })}
        onError={setError}
      />
      <TwoFactorNotice variant="register" />

      <p className="auth-prompt">
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </>
  );
}
