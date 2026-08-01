import BrandPanel from './BrandPanel';
import AuthTopBar from './AuthTopBar';
import AuthFooter from './AuthFooter';

export default function AuthLayout({ children }) {
  return (
    <div className="auth-root">
      <div className="app-wrapper">
        <BrandPanel />
        <div className="auth-panel">
          <AuthTopBar />
          <div className="auth-body">
            <div className="auth-form-wrap">{children}</div>
          </div>
          <AuthFooter />
        </div>
      </div>
    </div>
  );
}
