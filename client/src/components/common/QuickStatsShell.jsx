import { Link } from 'react-router-dom';
import AppShell from '../../layout/AppShell';
import { useToast } from '../../context/ToastContext';
import { useT } from '../../i18n/LanguageContext';
import {
  exportQuickStatsCsv,
  flattenSectionsForCsv,
  printQuickStats
} from '../../utils/quickStatsExport';

export function QuickStatsKpiCard({ label, value, footer, accent = 'var(--secondary)', icon, iconBg }) {
  const t = useT();
  return (
    <div className="kpi-card" style={{ '--accent-color': accent }}>
      <div className="kpi-top">
        <span className="kpi-label">{t(label)}</span>
        {icon && (
          <div className="kpi-icon" style={{ background: iconBg || 'rgba(26,60,94,0.1)', color: accent }}>
            <i className={`fas ${icon}`} />
          </div>
        )}
      </div>
      <div className="kpi-value">{value}</div>
      {footer != null && footer !== '' && <div className="kpi-footer">{footer}</div>}
    </div>
  );
}

export function QuickStatsMiniCard({ label, value, sub }) {
  const t = useT();
  return (
    <div className="mini-stat-card">
      <div className="mini-stat-label">{t(label)}</div>
      <div className="mini-stat-value">{value}</div>
      {sub && <div className="mini-stat-sub">{typeof sub === 'string' ? t(sub) : sub}</div>}
    </div>
  );
}

/**
 * Shared shell for module Quick Stats pages (matches Shipping Quick Stats design).
 * @param {Array<{ label: string, kpis: Array<{ label: string, value: any, footer?: any, accent?: string, icon?: string, iconBg?: string }>, mini?: Array }> } sections
 */
export default function QuickStatsShell({
  title,
  subtitle,
  breadcrumbs,
  backTo,
  backLabel = 'Back',
  loading = false,
  sections = [],
  hint,
  navbarRight,
  exportFilename
}) {
  const t = useT();
  const { showToast } = useToast();

  const printableSections = sections.map((s) => ({
    label: t(s.label),
    kpis: [
      ...(s.kpis || []).map((k) => ({
        label: k.label,
        value: k.value,
        footer: typeof k.footer === 'string' ? k.footer : ''
      })),
      ...(s.mini || []).map((m) => ({
        label: m.label,
        value: m.value,
        footer: m.sub || ''
      }))
    ]
  }));

  const handleExport = () => {
    const rows = flattenSectionsForCsv(printableSections, t(title));
    if (!rows.length) {
      showToast(t('No stats to export'));
      return;
    }
    const ok = exportQuickStatsCsv(rows, {
      title: t(title),
      filename: exportFilename || `${title.toLowerCase().replace(/\s+/g, '-')}.csv`
    });
    if (ok) showToast(t('Quick stats exported'), 'success');
  };

  const handlePrint = () => {
    const ok = printQuickStats(printableSections, {
      title: t(title),
      subtitle: subtitle || t('Generated {when} · CargoTrader', { when: new Date().toLocaleString() })
    });
    if (!ok) showToast(t('Allow pop-ups to print'));
    else showToast(t('Print dialog opened'), 'success');
  };

  return (
    <AppShell
      className="app-shell--quick-stats"
      hideSearch
      breadcrumbs={breadcrumbs}
      navbarRight={
        navbarRight || (
          backTo ? (
            <Link
              to={backTo}
              className="btn-ghost qs-back-btn"
              title={t(backLabel)}
              aria-label={t(backLabel)}
            >
              <i className="fas fa-arrow-left" />
              <span className="qs-chrome-label">{t(backLabel)}</span>
            </Link>
          ) : null
        )
      }
    >
      <div className="content qs-page">
        <div className="qs-chrome">
          <div className="page-header">
            <div>
              <h1>{t(title)}</h1>
              {subtitle && <p className="page-header-sub">{subtitle}</p>}
            </div>
            <div className="page-header-right">
              <button
                type="button"
                className="btn-ghost"
                onClick={handlePrint}
                disabled={loading}
                title={t('Print')}
                aria-label={t('Print')}
              >
                <i className="fas fa-print" />
                <span className="qs-chrome-label">{t('Print')}</span>
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={handleExport}
                disabled={loading}
                title={t('Export')}
                aria-label={t('Export')}
              >
                <i className="fas fa-file-excel" />
                <span className="qs-chrome-label">{t('Export')}</span>
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-light)' }}>
            <i className="fas fa-spinner fa-spin" /> {t('Loading…')}
          </p>
        ) : (
          <>
            {sections.map((section) => (
              <div key={section.label} className="ship-kpi-section">
                <div className="ship-kpi-section-label">{t(section.label)}</div>
                {section.kpis?.length > 0 && (
                  <div className="kpi-row" style={section.kpis.length > 4 ? { gridTemplateColumns: `repeat(${Math.min(section.kpis.length, 4)}, 1fr)` } : undefined}>
                    {section.kpis.map((k) => (
                      <QuickStatsKpiCard
                        key={k.label}
                        label={k.label}
                        value={k.value}
                        footer={k.footer}
                        accent={k.accent}
                        icon={k.icon}
                        iconBg={k.iconBg}
                      />
                    ))}
                  </div>
                )}
                {section.mini?.length > 0 && (
                  <div className="mini-stat-row">
                    {section.mini.map((m) => (
                      <QuickStatsMiniCard key={m.label} label={m.label} value={m.value} sub={m.sub} />
                    ))}
                  </div>
                )}
              </div>
            ))}
            {hint && (
              <div className="ship-hint-card">
                <i className="fas fa-info-circle" style={{ color: 'var(--primary)' }} />
                <span>{hint}</span>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
