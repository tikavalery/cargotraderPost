import { Link } from 'react-router-dom';
import { useT } from '../../i18n/LanguageContext';

export default function AuthFooter() {
  const t = useT();
  return (
    <div className="auth-footer">
      <Link to="/login" className="footer-link">{t('Login')}</Link>
      <span className="footer-sep">·</span>
      <Link to="/register" className="footer-link">{t('Register')}</Link>
      <span className="footer-sep">·</span>
      <Link to="/terms" className="footer-link">{t('Terms of Service')}</Link>
      <span className="footer-sep">·</span>
      <Link to="/privacy" className="footer-link">{t('Privacy Policy')}</Link>
      <span className="footer-sep">·</span>
      <Link to="/contact" className="footer-link">{t('Contact Support')}</Link>
      <span className="footer-sep">·</span>
      <span className="footer-link" style={{ cursor: 'default' }}>{t('© 2026 CargoTrader')}</span>
    </div>
  );
}
