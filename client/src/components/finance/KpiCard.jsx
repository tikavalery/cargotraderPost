export default function KpiCard({ label, value, sub, footer, accent = 'primary', icon }) {
  return (
    <div className={`kpi-card ${accent}`}>
      <div className="kpi-label">{label}</div>
      {icon && <div style={{ float: 'right', color: 'var(--text-light)' }}><i className={`fas ${icon}`} /></div>}
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
      {footer && <div className="kpi-footer">{footer}</div>}
    </div>
  );
}
