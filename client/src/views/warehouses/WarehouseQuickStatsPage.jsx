import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useWarehouses } from '../../hooks/useWarehouses';
import { warehousesApi } from '../../api';
import QuickStatsShell from '../../components/common/QuickStatsShell';
import { formatUsdAmount } from '../../utils/quickStatsExport';

export default function WarehouseQuickStatsPage() {
  const { user } = useAuth();
  const { warehouses, meta, loading: listLoading } = useWarehouses();
  const [details, setDetails] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!warehouses.length) {
        setDetails([]);
        return;
      }
      setDetailLoading(true);
      try {
        const rows = await Promise.all(
          warehouses.map((w) =>
            warehousesApi.get(w.id || w._id || w.warehouseId)
              .then((r) => r.data?.data || r.data?.warehouse || r.data || w)
              .catch(() => w)
          )
        );
        if (!cancelled) setDetails(rows);
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [warehouses]);

  const stats = useMemo(() => {
    const list = details.length ? details : warehouses;
    const totalItems = list.reduce((s, w) => s + (Number(w.itemsCount) || 0), 0);
    const totalValue = list.reduce((s, w) => s + (Number(w.value) || 0), 0);
    const critical = list.filter((w) => (Number(w.utilization) || 0) >= 85 || w.critical).length;
    const avgUtil = list.length
      ? Math.round(list.reduce((s, w) => s + (Number(w.utilization) || 0), 0) / list.length)
      : 0;
    const active = list.filter((w) => String(w.status || '').toLowerCase() === 'active' || !w.status).length;
    return { totalItems, totalValue, critical, avgUtil, active, count: list.length };
  }, [details, warehouses]);

  const businessName = user?.businessName || 'CargoTrader';
  const loading = listLoading || detailLoading;

  const sections = [
    {
      label: 'Warehouse Network',
      kpis: [
        {
          label: 'Locations',
          value: meta.locationCount || stats.count,
          footer: `${meta.countryCount || 0} countries · ${stats.active} active`,
          accent: 'var(--primary)',
          icon: 'fa-warehouse',
          iconBg: 'rgba(232,93,38,0.12)'
        },
        {
          label: 'Total Items',
          value: stats.totalItems.toLocaleString('en-US'),
          footer: 'units across warehouses',
          accent: 'var(--success)',
          icon: 'fa-boxes',
          iconBg: 'rgba(46,204,113,0.12)'
        },
        {
          label: 'Total Value',
          value: formatUsdAmount(stats.totalValue),
          footer: 'inventory value',
          accent: 'var(--secondary)',
          icon: 'fa-dollar-sign',
          iconBg: 'rgba(26,60,94,0.1)'
        },
        {
          label: 'Avg Utilization',
          value: `${stats.avgUtil}%`,
          footer: `${stats.critical} critical (≥85%)`,
          accent: stats.critical ? 'var(--danger)' : 'var(--accent)',
          icon: 'fa-chart-pie',
          iconBg: 'rgba(245,166,35,0.12)'
        }
      ]
    },
    {
      label: 'Capacity',
      mini: [
        { label: 'Countries', value: meta.countryCount || 0, sub: 'operating countries' },
        { label: 'Critical Sites', value: stats.critical, sub: 'near capacity' },
        { label: 'Active Sites', value: stats.active, sub: 'open warehouses' }
      ]
    }
  ];

  return (
    <QuickStatsShell
      title="Warehouse Quick Stats"
      subtitle={`${businessName} · KPIs across ${meta.locationCount || stats.count} storage locations`}
      breadcrumbs={[
        { label: 'CargoTrader', to: '/dashboard' },
        { label: 'Warehouses', to: '/warehouses' },
        { label: 'Quick Stats', current: true }
      ]}
      backTo="/warehouses"
      backLabel="Back to Warehouses"
      loading={loading}
      sections={sections}
      exportFilename="warehouse-quick-stats.csv"
      hint={
        <>
          Metrics from live warehouse records.{' '}
          <Link to="/warehouses" style={{ color: 'var(--primary)', fontWeight: 600 }}>All Warehouses</Link>
        </>
      }
    />
  );
}
