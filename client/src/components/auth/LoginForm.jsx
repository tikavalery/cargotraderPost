import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AuthErrorBanner from './AuthErrorBanner';
import TabSwitcher from './TabSwitcher';
import PasswordInput from './PasswordInput';
import RememberMeRow from './RememberMeRow';
import SocialAuthButtons from './SocialAuthButtons';
import TwoFactorNotice from './TwoFactorNotice';
import { useT } from '../../i18n/LanguageContext';

function validate(identifier, password, t) {
  if (!identifier.trim()) return t('Please enter your email or phone number');
  if (!password) return t('Please enter your password');
  return null;
}

function getLoginError(err, t) {
  if (!err.response) {
    return t('Cannot reach server. Start the API with npm run dev:server and check MongoDB connection.');
  }
  return err.response?.data?.message || t('Invalid email/phone or password');
}

export default function LoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const t = useT();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const validationError = validate(identifier, password, t);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const data = await login({ identifier: identifier.trim(), password, rememberMe });
      const role = data?.user?.role;
      const isClerk = role === 'Store Clerk';
      navigate(isClerk ? '/stores/pos' : '/dashboard', { replace: true });
    } catch (err) {
      setError(getLoginError(err, t));
    } finally {
      setLoading(false);
    }
  };

  const onEnterSubmit = (e) => {
    if (e.key === 'Enter') handleSubmit(e);
  };

  return (
    <>
      <AuthErrorBanner message={error} />

      <div className="form-heading">
        <h2>{t('Welcome back')}</h2>
        <p>{t('Sign in to your CargoTrader account')}</p>
      </div>

      <TabSwitcher activeTab="login" />

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label" htmlFor="loginIdentifier">
            {t('Email or Phone Number')}
          </label>
          <div className="input-wrap">
            <input
              id="loginIdentifier"
              type="text"
              className="form-input"
              placeholder="you@company.com or +237 6xx xx xx xx"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              onKeyDown={onEnterSubmit}
              disabled={loading}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="loginPassword">
            {t('Password')}
          </label>
          <PasswordInput
            id="loginPassword"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={onEnterSubmit}
            placeholder={t('Enter your password')}
            autoComplete="current-password"
            disabled={loading}
          />
        </div>

        <RememberMeRow checked={rememberMe} onChange={setRememberMe} />

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? (
            <>
              <i className="fas fa-spinner fa-spin" /> {t('Signing in…')}
            </>
          ) : (
            <>
              <i className="fas fa-sign-in-alt" /> {t('Sign In')}
            </>
          )}
        </button>
      </form>

      <SocialAuthButtons
        dividerLabel={t('or continue with')}
        mode="login"
        onSuccess={(data) => {
          const role = data?.user?.role;
          navigate(role === 'Store Clerk' ? '/stores/pos' : '/dashboard', { replace: true });
        }}
        onError={setError}
      />
      <TwoFactorNotice variant="login" />

      <p className="auth-prompt">
        {t("Don't have an account?")} <Link to="/register">{t('Register')}</Link>
      </p>
    </>
  );
}
