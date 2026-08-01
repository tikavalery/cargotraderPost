import { Link } from 'react-router-dom';
import { useState } from 'react';
import AppShell from '../layout/AppShell';
import { useAuth } from '../context/AuthContext';
import { useDashboard } from '../hooks/useDashboard';
import DashboardKpiRow from '../components/dashboard/DashboardKpiRow';
import InventorySummaryCard from '../components/dashboard/InventorySummaryCard';
import WarehouseSummaryCard from '../components/dashboard/WarehouseSummaryCard';
import ShippingSummaryCard from '../components/dashboard/ShippingSummaryCard';
import FinanceSummaryCard from '../components/dashboard/FinanceSummaryCard';
import PlanStatusCard from '../components/dashboard/PlanStatusCard';
import { useLanguage, useT } from '../i18n/LanguageContext';

function formatToday(lang) {
  return new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function formatShortDate(lang) {
  return new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

export default function DashboardPage() {
  const { user } = useAuth();
  const t = useT();
  const { lang } = useLanguage();
  const [financePeriod, setFinancePeriod] = useState('month');
  const { data, isLoading, isError, refetch } = useDashboard(financePeriod);

  const businessName = user?.businessName || 'ThriftShip Cameroon';
  const location = user?.country ? `${user.country}` : 'Yaoundé, CM';

  return (
    <AppShell
      hideSearch
      title={
        <span className="dash-navbar-title">
          <span className="dash-brand-a">A</span>
          {t('CargoTrader — Comprehensive Dashboard')}
        </span>
      }
    >
      <div className="content dash-content">
        <div className="dash-page">
        <header className="dash-page-header">
          <div>
            <h1>{t('Dashboard — Comprehensive Summary View')}</h1>
            <p className="dash-page-sub">{businessName} · {location} · {formatToday(lang)}</p>
          </div>
          <div className="dash-header-actions">
            <span className="dash-date-badge">{formatShortDate(lang)}</span>
          </div>
        </header>

        {isError && (
          <div className="dash-error">
            {t('Unable to load dashboard.')}{' '}
            <button type="button" onClick={() => refetch()}>{t('Retry')}</button>
          </div>
        )}

        <DashboardKpiRow kpis={data?.kpis} loading={isLoading} />

        <PlanStatusCard />

        <div className="dash-summary-stack">
          <InventorySummaryCard inventory={data?.inventory} loading={isLoading} />
          <WarehouseSummaryCard warehouses={data?.warehouses} loading={isLoading} />
          <ShippingSummaryCard shipping={data?.shipping} loading={isLoading} />
          <FinanceSummaryCard
            finance={data?.finance}
            loading={isLoading}
            period={financePeriod}
            onPeriodChange={setFinancePeriod}
          />
        </div>

        <footer className="dash-footer">
          <Link to="/dashboard">{t('Home')}</Link>
          <span>·</span>
          <Link to="/terms">{t('Terms')}</Link>
          <span>·</span>
          <Link to="/privacy">{t('Privacy')}</Link>
          <span>·</span>
          <Link to="/contact">{t('Contact')}</Link>
          <span>·</span>
          <span>{t('© 2026 CargoTrader')}</span>
        </footer>
        </div>
      </div>
    </AppShell>
  );
}
