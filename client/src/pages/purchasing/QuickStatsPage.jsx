import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePurchases } from '../../hooks/usePurchases';
import { useSuppliers } from '../../hooks/useSuppliers';
import QuickStatsShell from '../../components/common/QuickStatsShell';
import { formatXaf } from '../../utils/format';

function isThisMonth(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

export default function QuickStatsPage() {
  const { user } = useAuth();
  const { purchases, total, loading: purchasesLoading } = usePurchases();
  const { suppliers, loading: suppliersLoading } = useSuppliers();
  const loading = purchasesLoading || suppliersLoading;
  const businessName = user?.businessName || 'CargoTrader';

  const stats = useMemo(() => {
    const saved = purchases.filter((p) => p.status === 'saved').length;
    const drafts = purchases.filter((p) => p.status === 'draft').length;
    const thisMonth = purchases.filter((p) => isThisMonth(p.purchaseDate || p.createdAt));
    const totalValue = purchases.reduce(
      (s, p) => s + (Number(p.purchaseValue ?? p.purchasePrice ?? p.value) || 0),
      0
    );
    const monthValue = thisMonth.reduce(
      (s, p) => s + (Number(p.purchaseValue ?? p.purchasePrice ?? p.value) || 0),
      0
    );
    const avgValue = purchases.length ? Math.round(totalValue / purchases.length) : 0;
    const topSupplier = [...suppliers].sort(
      (a, b) => (Number(b.totalPurchaseValue) || 0) - (Number(a.totalPurchaseValue) || 0)
    )[0];
    const categories = new Set(purchases.map((p) => p.category).filter(Boolean));
    return {
      saved,
      drafts,
      thisMonthCount: thisMonth.length,
      totalValue,
      monthValue,
      avgValue,
      supplierCount: suppliers.length,
      topSupplierName: topSupplier?.name || '—',
      topSupplierValue: topSupplier?.totalPurchaseValue || 0,
      categoryCount: categories.size,
      purchaseCount: total || purchases.length
    };
  }, [purchases, suppliers, total]);

  const sections = [
    {
      label: 'Purchases Overview',
      kpis: [
        {
          label: 'Total Purchases',
          value: stats.purchaseCount.toLocaleString('en-US'),
          footer: `${stats.saved} saved · ${stats.drafts} drafts`,
          accent: 'var(--primary)',
          icon: 'fa-shopping-cart',
          iconBg: 'rgba(232,93,38,0.12)'
        },
        {
          label: 'Total Spend',
          value: formatXaf(stats.totalValue),
          footer: `avg ${formatXaf(stats.avgValue)} per purchase`,
          accent: 'var(--secondary)',
          icon: 'fa-dollar-sign',
          iconBg: 'rgba(26,60,94,0.1)'
        },
        {
          label: 'This Month',
          value: stats.thisMonthCount,
          footer: formatXaf(stats.monthValue),
          accent: 'var(--success)',
          icon: 'fa-calendar',
          iconBg: 'rgba(46,204,113,0.12)'
        },
        {
          label: 'Drafts',
          value: stats.drafts,
          footer: 'awaiting completion',
          accent: 'var(--accent)',
          icon: 'fa-file-alt',
          iconBg: 'rgba(245,166,35,0.12)'
        }
      ]
    },
    {
      label: 'Suppliers',
      mini: [
        { label: 'Suppliers', value: stats.supplierCount, sub: 'in directory' },
        { label: 'Categories', value: stats.categoryCount, sub: 'purchase categories' },
        { label: 'Top Supplier', value: stats.topSupplierName, sub: formatXaf(stats.topSupplierValue) },
        { label: 'Saved Orders', value: stats.saved, sub: 'completed purchases' }
      ]
    }
  ];

  return (
    <QuickStatsShell
      title="Purchasing Quick Stats"
      subtitle={`${businessName} · Purchases & supplier metrics`}
      breadcrumbs={[
        { label: 'CargoTrader', to: '/dashboard' },
        { label: 'Purchasing', to: '/purchasing/all' },
        { label: 'Quick Stats', current: true }
      ]}
      backTo="/purchasing/all"
      backLabel="Back to Purchases"
      loading={loading}
      sections={sections}
      exportFilename="purchasing-quick-stats.csv"
      hint={
        <>
          Live from All Purchases and Suppliers.{' '}
          <Link to="/purchasing/all" style={{ color: 'var(--primary)', fontWeight: 600 }}>View purchases</Link>
          {' · '}
          <Link to="/purchasing/suppliers" style={{ color: 'var(--primary)', fontWeight: 600 }}>Suppliers</Link>
        </>
      }
    />
  );
}
