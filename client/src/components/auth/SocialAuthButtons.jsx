import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api';

export default function SocialAuthButtons({
  dividerLabel = 'or sign up with',
  mode = 'login',
  registerMeta = {},
  onSuccess,
  onError
}) {
  const { loginWithGoogle } = useAuth();
  const [clientId, setClientId] = useState('');
  const [configHint, setConfigHint] = useState('');
  const [configLoading, setConfigLoading] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authApi
      .googleConfig()
      .then((res) => {
        if (cancelled) return;
        const { clientId: id, configured, hint } = res.data || {};
        if (configured && id) {
          setClientId(id);
          setConfigHint('');
        } else {
          setClientId('');
          setConfigHint(hint || 'Google sign-in is not configured on the server.');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConfigHint('Cannot reach the API. Start the server and try again.');
        }
      })
      .finally(() => {
        if (!cancelled) setConfigLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleGoogleSuccess = async (credentialResponse) => {
    const credential = credentialResponse?.credential;
    if (!credential) {
      onError?.('Google did not return a sign-in credential');
      return;
    }

    setLoading(true);
    try {
      const data = await loginWithGoogle({
        credential,
        mode,
        rememberMe: true,
        ...registerMeta
      });
      onSuccess?.(data);
    } catch (err) {
      onError?.(err.response?.data?.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="or-divider">
        <span>{dividerLabel}</span>
      </div>

      {configLoading && (
        <p className="auth-google-hint">
          <i className="fas fa-spinner fa-spin" /> Loading Google sign-in…
        </p>
      )}

      {!configLoading && !clientId && (
        <div className="auth-google-hint">
          <p style={{ margin: '0 0 8px' }}>{configHint}</p>
          <p style={{ margin: 0, fontSize: 12 }}>
            In Google Cloud Console, create an <strong>OAuth 2.0 Client ID</strong> (Web application),
            add your app origins (e.g. <code>http://localhost:5173</code> and your Heroku HTTPS URL)
            under Authorized JavaScript origins, set <code>GOOGLE_CLIENT_ID</code> on the server, and
            restart.
          </p>
        </div>
      )}

      {!configLoading && clientId && (
        <div className={`social-row google-login-wrap${loading ? ' is-loading' : ''}`}>
          {loading ? (
            <button type="button" className="btn-social btn-social-google" disabled>
              <i className="fas fa-spinner fa-spin" /> Signing in with Google…
            </button>
          ) : (
            <GoogleOAuthProvider clientId={clientId}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() =>
                  onError?.(
                    'Google blocked sign-in (invalid_client). Create a new OAuth Web Client ID in Google Cloud Console, update GOOGLE_CLIENT_ID in server/.env, and restart the server.'
                  )
                }
                useOneTap={false}
                ux_mode="popup"
                theme="outline"
                size="large"
                text={mode === 'register' ? 'signup_with' : 'continue_with'}
                shape="rectangular"
                width="360"
              />
            </GoogleOAuthProvider>
          )}
        </div>
      )}
    </>
  );
}
