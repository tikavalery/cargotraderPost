import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { staffApi } from '../../services/staffApi';
import AuthLayout from '../../components/auth/AuthLayout';
import PasswordInput from '../../components/auth/PasswordInput';
import AuthErrorBanner from '../../components/auth/AuthErrorBanner';

export default function AcceptInvitePage() {
  const { token } = useParams();
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', password: '' });

  useEffect(() => {
    staffApi
      .previewInvitation(token)
      .then((res) => setPreview(res.data.data))
      .catch((err) => setError(err.response?.data?.message || 'Invalid or expired invitation'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    setSubmitting(true);
    try {
      const res = await staffApi.acceptInvitation({
        token,
        name: form.name.trim(),
        password: form.password
      });
      localStorage.setItem('afritrade_token', res.data.token);
      if (res.data.refreshToken) localStorage.setItem('afritrade_refresh_token', res.data.refreshToken);
      localStorage.setItem('afritrade_user', JSON.stringify(res.data.user));
      if (res.data.user?.defaultBusinessId) {
        localStorage.setItem('afritrade_business_id', res.data.user.defaultBusinessId);
      }
      window.location.assign('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <AuthErrorBanner message={error} />

      {loading && <p style={{ color: 'var(--text-light)', fontSize: 13 }}>Verifying invitation…</p>}

      {!loading && !preview && (
        <>
          <div className="form-heading">
            <h2>Invitation expired</h2>
            <p>This link is invalid or has expired. Ask your business owner to send a new invitation.</p>
          </div>
          <Link to="/login" className="btn-primary" style={{ display: 'inline-flex', marginTop: 12, textDecoration: 'none' }}>
            Go to login
          </Link>
        </>
      )}

      {!loading && preview && (
        <>
          <div className="form-heading">
            <h2>Join {preview.businessName}</h2>
            <p>
              You&apos;ve been invited as <strong>{preview.role}</strong>
              {preview.identifier ? ` (${preview.identifier})` : ''}. Set your name and password to finish.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="invite-name">Full name</label>
              <div className="input-wrap">
                <i className="fas fa-user input-icon" />
                <input
                  id="invite-name"
                  type="text"
                  className="form-input"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Your full name"
                  autoComplete="name"
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="invite-password">Password</label>
              <PasswordInput
                id="invite-password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="At least 6 characters"
                autoComplete="new-password"
              />
            </div>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? (
                <>
                  <i className="fas fa-spinner fa-spin" /> Creating account…
                </>
              ) : (
                'Complete registration'
              )}
            </button>
          </form>

          <p style={{ marginTop: 16, fontSize: 13, color: 'var(--text-light)' }}>
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
