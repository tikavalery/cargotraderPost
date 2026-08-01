import { Link } from 'react-router-dom';
import LangToggle from '../common/LangToggle';

export default function AuthTopBar() {
  return (
    <div className="auth-panel-top">
      <Link to="/login" className="auth-logo-mark">
        <div className="logo-icon">A</div>
        <span className="logo-name">CargoTrader</span>
      </Link>
      <LangToggle />
    </div>
  );
}
