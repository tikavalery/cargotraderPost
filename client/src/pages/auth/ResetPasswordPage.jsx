import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AuthLayout from '../../components/auth/AuthLayout';
import AuthErrorBanner from '../../components/auth/AuthErrorBanner';
import PasswordInput from '../../components/auth/PasswordInput';
import { authApi } from '../../api';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    authApi
      .validateResetToken(token)
      .then((res) => setValid(Boolean(res.data?.valid)))
      .catch(() => setValid(false))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      await authApi.resetPassword({ token, password });
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reset password');
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <AuthErrorBanner message={error} />

      {loading && (
        <p style={{ color: 'var(--text-light)', fontSize: 13 }}>
          <i className="fas fa-spinner fa-spin" /> Verifying reset link…
        </p>
      )}

      {!loading && !valid && (
        <>
          <div className="form-heading">
            <h2>Link expired</h2>
            <p>This password reset link is invalid or has expired. Request a new one.</p>
          </div>
          <Link to="/forgot-password" className="btn-primary" style={{ display: 'inline-flex', textDecoration: 'none' }}>
            Request new link
          </Link>
        </>
      )}

      {!loading && valid && !done && (
        <>
          <div className="form-heading">
            <h2>Set new password</h2>
            <p>Choose a strong password for your CargoTrader account.</p>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="newPassword">
                New password
              </label>
              <PasswordInput
                id="newPassword"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
                disabled={submitting}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="confirmPassword">
                Confirm password
              </label>
              <PasswordInput
                id="confirmPassword"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat password"
                autoComplete="new-password"
                disabled={submitting}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? (
                <>
                  <i className="fas fa-spinner fa-spin" /> Updating…
                </>
              ) : (
                <>
                  <i className="fas fa-lock" /> Update password
                </>
              )}
            </button>
          </form>
        </>
      )}

      {done && (
        <div className="auth-success-panel">
          <p className="auth-success-text">
            <i className="fas fa-check-circle" style={{ color: 'var(--success)', marginRight: 8 }} />
            Password updated. Redirecting to sign in…
          </p>
        </div>
      )}
    </AuthLayout>
  );
}
