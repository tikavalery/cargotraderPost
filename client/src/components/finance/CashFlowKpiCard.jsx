const TONES = {
  inflow: { bg: 'rgba(46,204,113,0.12)', color: 'var(--success)', icon: 'fa-arrow-trend-up' },
  outflow: { bg: 'rgba(231,76,60,0.12)', color: 'var(--danger)', icon: 'fa-arrow-trend-down' },
  net: { bg: 'rgba(26,60,94,0.1)', color: 'var(--secondary)', icon: 'fa-scale-balanced' },
  synced: { bg: 'rgba(52,152,219,0.12)', color: '#3498DB', icon: 'fa-rotate' },
  source: { bg: 'rgba(232,93,38,0.12)', color: 'var(--primary)', icon: 'fa-store' }
};

function Trend({ value, suffix = '%', label }) {
  if (value == null || Number.isNaN(value)) return null;
  const up = value >= 0;
  return (
    <span className={up ? 'cf-trend-up' : 'cf-trend-down'}>
      <i className={`fas fa-arrow-${up ? 'up' : 'down'}`} />
      {up ? '+' : ''}{value}{suffix}{label ? ` ${label}` : ''}
    </span>
  );
}

export default function CashFlowKpiCard({
  label,
  primary,
  secondary,
  tone = 'inflow',
  trend,
  trendSuffix,
  trendLabel,
  footnote,
  statusPill,
  showIcon = false
}) {
  const meta = TONES[tone] || TONES.inflow;
  const showTop = showIcon || trend != null || statusPill;

  return (
    <div className={`cf-kpi-card cf-kpi-${tone}`}>
      {showTop && (
        <div className="cf-kpi-top">
          {showIcon && (
            <div className="cf-kpi-icon" style={{ background: meta.bg, color: meta.color }}>
              <i className={`fas ${meta.icon}`} />
            </div>
          )}
          {trend != null && <Trend value={trend} suffix={trendSuffix} label={trendLabel} />}
          {statusPill && <span className={`cf-status-pill ${statusPill.tone}`}>{statusPill.text}</span>}
        </div>
      )}
      <div className="cf-kpi-label">{label}</div>
      <div className="cf-kpi-value">{primary}</div>
      {secondary && <div className="cf-kpi-sub">{secondary}</div>}
      {footnote && <div className="cf-kpi-foot">{footnote}</div>}
    </div>
  );
}
