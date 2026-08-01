import { Link } from 'react-router-dom';
import { useT } from '../../i18n/LanguageContext';

const MODULES = [
  { to: '/finance/revenue', icon: 'fa-arrow-trend-up', label: 'Revenue', sub: 'POS & channels' },
  { to: '/finance/expenses', icon: 'fa-receipt', label: 'Expenses', sub: 'COGS & shipping' },
  { to: '/finance/cash-flow', icon: 'fa-water', label: 'Cash Flow', sub: 'Full ledger' },
  { to: '/finance/profit-loss', icon: 'fa-coins', label: 'Profit & Loss', sub: 'Business P&L' }
];

export default function ModuleNavRow() {
  const t = useT();
  return (
    <div className="module-nav-row">
      {MODULES.map((m) => (
        <Link key={m.to} to={m.to} className="module-nav-card">
          <i className={`fas ${m.icon}`} />
          <span>{t(m.label)}</span>
          <small>{t(m.sub)}</small>
          <i className="fas fa-chevron-right" style={{ fontSize: 10, color: 'var(--text-light)', marginTop: 4 }} />
        </Link>
      ))}
    </div>
  );
}
