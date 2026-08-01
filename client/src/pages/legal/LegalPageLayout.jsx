import { Link } from 'react-router-dom';
import AuthFooter from '../../components/auth/AuthFooter';
import LangToggle from '../../components/common/LangToggle';
import { useT } from '../../i18n/LanguageContext';

export default function LegalPageLayout({ title, children }) {
  const t = useT();
  return (
    <div className="legal-root">
      <header className="legal-topbar">
        <Link to="/login" className="legal-brand">
          {t('CargoTrader')}
        </Link>
        <div className="legal-topbar-right">
          <nav className="legal-nav" aria-label={t('Legal')}>
            <Link to="/terms">{t('Terms')}</Link>
            <Link to="/privacy">{t('Privacy')}</Link>
            <Link to="/contact">{t('Contact')}</Link>
          </nav>
          <LangToggle />
        </div>
      </header>
      <main className="legal-main">
        <article className="legal-doc">
          <h1>{t(title)}</h1>
          <p className="legal-updated">{t('Last updated: 16 July 2026')}</p>
          {children}
        </article>
      </main>
      <AuthFooter />
    </div>
  );
}
