import { Link } from 'react-router-dom';
import { useT } from '../../i18n/LanguageContext';

export default function TabSwitcher({ activeTab }) {
  const t = useT();
  return (
    <div className="tab-switcher">
      <Link to="/login" className={`tab-btn${activeTab === 'login' ? ' active' : ''}`}>
        {t('Login')}
      </Link>
      <Link to="/register" className={`tab-btn${activeTab === 'register' ? ' active' : ''}`}>
        {t('Register')}
      </Link>
    </div>
  );
}
