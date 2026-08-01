import { Link } from 'react-router-dom';
import { useT } from '../../i18n/LanguageContext';

export default function RememberMeRow({ checked, onChange }) {
  const t = useT();
  return (
    <div className="utility-row">
      <label className="remember-label">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span>{t('Remember me')}</span>
      </label>
      <Link to="/forgot-password" className="forgot-link">
        {t('Forgot password?')}
      </Link>
    </div>
  );
}
