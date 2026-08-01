import { Link } from 'react-router-dom';
import { useState } from 'react';
import AuthLayout from '../../components/auth/AuthLayout';
import AuthErrorBanner from '../../components/auth/AuthErrorBanner';
import { authApi } from '../../api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authApi.forgotPassword({ email: email.trim() });
      setSent(true);
      if (res.data?.devResetUrl) setDevResetUrl(res.data.devResetUrl);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not send reset email. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <AuthErrorBanner message={error} />

      <div className="form-heading">
        <h2>Forgot password?</h2>
        <p>
          {sent
            ? 'Check your email for a link to reset your password.'
            : 'Enter the email on your account and we will send reset instructions.'}
        </p>
      </div>

      {!sent ? (
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="forgotEmail">
              Email address
            </label>
            <div className="input-wrap">
              <input
                id="forgotEmail"
                type="email"
                className="form-input"
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin" /> Sending…
              </>
            ) : (
              <>
                <i className="fas fa-paper-plane" /> Send reset link
              </>
            )}
          </button>
        </form>
      ) : (
        <div className="auth-success-panel">
          <p className="auth-success-text">
            If an account exists for <strong>{email}</strong>, you will receive an email shortly.
            The link expires in 1 hour.
          </p>
          {devResetUrl && (
            <p className="auth-google-hint" style={{ marginTop: 12 }}>
              <strong>Development:</strong> SMTP is not configured. Use this reset link:{' '}
              <a href={devResetUrl}>{devResetUrl}</a>
            </p>
          )}
          <Link to="/login" className="btn-primary" style={{ display: 'inline-flex', marginTop: 16, textDecoration: 'none' }}>
            Back to sign in
          </Link>
        </div>
      )}

      {!sent && (
        <p className="auth-prompt" style={{ marginTop: 20 }}>
          Remember your password? <Link to="/login">Sign in</Link>
        </p>
      )}
    </AuthLayout>
  );
}
