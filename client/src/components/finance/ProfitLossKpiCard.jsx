import { fmtCurrency } from '../../constants/financeConstants';

const TONES = {
  revenue: { bg: 'rgba(232,93,38,0.12)', color: 'var(--primary)', icon: 'fa-wallet' },
  goods: { bg: 'rgba(26,60,94,0.1)', color: 'var(--secondary)', icon: 'fa-cart-shopping' },
  costs: { bg: 'rgba(26,60,94,0.1)', color: 'var(--secondary)', icon: 'fa-receipt' },
  ship: { bg: 'rgba(22,160,133,0.12)', color: 'var(--teal)', icon: 'fa-ship' },
  profit: { bg: 'rgba(46,204,113,0.12)', color: 'var(--success)', icon: 'fa-sack-dollar' },
  margin: { bg: 'rgba(245,166,35,0.12)', color: 'var(--accent)', icon: 'fa-percent' }
};

function Trend({ value, suffix = '%', label }) {
  if (value == null || Number.isNaN(value)) return null;
  const up = value >= 0;
  return (
    <span className={up ? 'pl-trend-up' : 'pl-trend-down'}>
      <i className={`fas fa-arrow-${up ? 'up' : 'down'}`} />
      {up ? '+' : ''}{value}{suffix}{label ? ` ${label}` : ''}
    </span>
  );
}

export default function ProfitLossKpiCard({
  label,
  amountXaf,
  currency,
  tone = 'revenue',
  trend,
  trendSuffix,
  trendLabel,
  footnote,
  customValue,
  showIcon = false
}) {
  const meta = TONES[tone] || TONES.revenue;
  const primary = customValue ?? fmtCurrency(currency, amountXaf);
  const showTop = showIcon || trend != null;

  return (
    <div className="pl-kpi-card">
      {showTop && (
        <div className="pl-kpi-top">
          {showIcon && (
            <div className="pl-kpi-icon" style={{ background: meta.bg, color: meta.color }}>
              <i className={`fas ${meta.icon}`} />
            </div>
          )}
          {trend != null && <Trend value={trend} suffix={trendSuffix} label={trendLabel} />}
        </div>
      )}
      <div className="pl-kpi-label">{label}</div>
      <div className="pl-kpi-value">{primary}</div>
      {footnote && <div className="pl-kpi-foot">{footnote}</div>}
    </div>
  );
}
