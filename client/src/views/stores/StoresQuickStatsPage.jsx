import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useStores } from '../../hooks/useStores';
import { usePosTransactions } from '../../hooks/usePosTransactions';
import { useSalesReturns } from '../../hooks/useSalesReturns';
import { posApi, storesApi } from '../../services/posApi';
import QuickStatsShell from '../../components/common/QuickStatsShell';
import { formatXaf } from '../../utils/format';

export default function StoresQuickStatsPage() {
  const { user } = useAuth();
  const { stores, meta, loading: storesLoading } = useStores();
  const { transactions, loading: txLoading } = usePosTransactions({ limit: 500 });
  const { returns, loading: returnsLoading } = useSalesReturns();
  const [today, setToday] = useState({ count: 0, total: 0, units: 0 });
  const [inventory, setInventory] = useState({ itemsCount: 0, valueXaf: 0, skuCount: 0 });
  const [enrichLoading, setEnrichLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!stores.length) {
        setEnrichLoading(false);
        return;
      }
      setEnrichLoading(true);
      try {
        const todayResults = await Promise.all(
          stores.map((s) =>
            posApi.todayStats(s.storeId || s.id).then((r) => r.data || {}).catch(() => ({}))
          )
        );
        if (cancelled) return;
        setToday({
          count: todayResults.reduce((s, r) => s + (Number(r.count) || 0), 0),
          total: todayResults.reduce((s, r) => s + (Number(r.total) || 0), 0),
          units: todayResults.reduce((s, r) => s + (Number(r.units) || 0), 0)
        });

        const invResults = await Promise.all(
          stores.slice(0, 12).map((s) =>
            storesApi.inventory(s.storeId || s.id)
              .then((r) => r.data?.summary || {})
              .catch(() => ({}))
          )
        );
        if (cancelled) return;
        setInventory({
          itemsCount: invResults.reduce((s, r) => s + (Number(r.itemsCount) || 0), 0),
          valueXaf: invResults.reduce((s, r) => s + (Number(r.valueXaf) || 0), 0),
          skuCount: invResults.reduce((s, r) => s + (Number(r.skuCount) || 0), 0)
        });
      } finally {
        if (!cancelled) setEnrichLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [stores]);

  const txStats = useMemo(() => {
    const total = transactions.reduce((s, t) => s + (Number(t.total) || 0), 0);
    const avg = transactions.length ? Math.round(total / transactions.length) : 0;
    const refundTotal = returns.reduce((s, r) => s + (Number(r.refundAmount) || 0), 0);
    return {
      txCount: transactions.length,
      txTotal: total,
      avgTicket: avg,
      returnsCount: returns.length,
      refundTotal
    };
  }, [transactions, returns]);

  const loading = storesLoading || txLoading || returnsLoading || enrichLoading;
  const businessName = user?.businessName || 'CargoTrader';

  const sections = [
    {
      label: 'Stores Overview',
      kpis: [
        {
          label: 'Stores',
          value: meta.storeCount || stores.length,
          footer: `${meta.activeCount || 0} active · ${meta.cityCount || 0} cities`,
          accent: 'var(--primary)',
          icon: 'fa-store',
          iconBg: 'rgba(232,93,38,0.12)'
        },
        {
          label: "Today's Sales",
          value: formatXaf(today.total),
          footer: `${today.count} transactions · ${today.units} units`,
          accent: 'var(--success)',
          icon: 'fa-cash-register',
          iconBg: 'rgba(46,204,113,0.12)'
        },
        {
          label: 'Shelf Inventory',
          value: inventory.skuCount.toLocaleString('en-US'),
          footer: `${inventory.itemsCount.toLocaleString('en-US')} units · ${formatXaf(inventory.valueXaf)}`,
          accent: 'var(--secondary)',
          icon: 'fa-boxes',
          iconBg: 'rgba(26,60,94,0.1)'
        },
        {
          label: 'Returns',
          value: txStats.returnsCount,
          footer: `${formatXaf(txStats.refundTotal)} refunded`,
          accent: 'var(--danger)',
          icon: 'fa-undo',
          iconBg: 'rgba(231,76,60,0.12)'
        }
      ]
    },
    {
      label: 'Transactions',
      mini: [
        { label: 'Transactions', value: txStats.txCount.toLocaleString('en-US'), sub: 'loaded records' },
        { label: 'Sales Volume', value: formatXaf(txStats.txTotal), sub: 'from transaction list' },
        { label: 'Avg Ticket', value: formatXaf(txStats.avgTicket), sub: 'per transaction' },
        { label: 'Today Txns', value: today.count, sub: 'across all stores' }
      ]
    }
  ];

  return (
    <QuickStatsShell
      title="Stores & Sales Quick Stats"
      subtitle={`${businessName} · POS, inventory & returns`}
      breadcrumbs={[
        { label: 'CargoTrader', to: '/dashboard' },
        { label: 'Stores', to: '/stores' },
        { label: 'Quick Stats', current: true }
      ]}
      backTo="/stores"
      backLabel="Back to Stores"
      loading={loading}
      sections={sections}
      exportFilename="stores-quick-stats.csv"
      hint={
        <>
          Connected to stores, POS transactions, returns, and shelf inventory.{' '}
          <Link to="/stores/transactions" style={{ color: 'var(--primary)', fontWeight: 600 }}>Transactions</Link>
          {' · '}
          <Link to="/stores/inventory" style={{ color: 'var(--primary)', fontWeight: 600 }}>Store Inventory</Link>
        </>
      }
    />
  );
}
