import { Link } from 'react-router-dom';
import { useT } from '../../i18n/LanguageContext';
import { useCurrency } from '../../context/CurrencyContext';
import { formatMoney } from '../../utils/format';
import { toXaf } from '../../constants/financeConstants';

const LINKS = [
  { to: '/inventory/items', accent: 'orange', label: 'Total Inventory Value', key: 'inventory' },
  { to: '/shipping', accent: 'navy', label: 'Items in Transit', key: 'transit' },
  { to: '/stores/pos', accent: 'gold', label: "Today's Sales", key: 'sales' },
  { to: '/finance', accent: 'green', label: 'Net Profit', key: 'profit' },
  { to: '/shipping', accent: 'teal', label: 'Active Shipments', key: 'shipments' }
];

function resolveSalesDisplay(kpis, currency) {
  if (kpis?.todaySalesFmt) return kpis.todaySalesFmt;
  if (kpis?.todaySalesXaf != null) return formatMoney(kpis.todaySalesXaf, currency);
  if (kpis?.todaySales != null && currency) {
    // todaySales is already converted — format as a plain amount with currency code
    return formatMoney(toXaf(kpis.todaySales, currency), currency);
  }
  if (kpis?.todaySalesUsd != null) return formatMoney(toXaf(kpis.todaySalesUsd, 'USD'), currency);
  return formatMoney(0, currency);
}

export default function DashboardKpiRow({ kpis, loading }) {
  const t = useT();
  const { currency } = useCurrency();

  if (loading || !kpis) {
    return (
      <div className="dash-kpi-row">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="dash-kpi-card skeleton" />
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: t('Total Inventory Value'),
      value: kpis.inventoryValueFmt || formatMoney(0, currency),
      accent: 'orange'
    },
    {
      label: t('Items in Transit'),
      value: kpis.itemsInTransit ?? 0,
      accent: 'navy'
    },
    {
      label: t("Today's Sales"),
      value: resolveSalesDisplay(kpis, currency),
      sub: t('{count} transactions', { count: kpis.todayTxnCount ?? 0 }),
      accent: 'gold'
    },
    {
      label: t('Net Profit'),
      value: kpis.netProfitFmt || formatMoney(0, currency),
      accent: 'green'
    },
    {
      label: t('Active Shipments'),
      value: kpis.activeShipments ?? 0,
      accent: 'teal'
    }
  ];

  return (
    <div className="dash-kpi-row">
      {cards.map((c, i) => (
        <Link key={LINKS[i].key} to={LINKS[i].to} className={`dash-kpi-card accent-${c.accent}`}>
          <div className="dash-kpi-label">{c.label}</div>
          <div className="dash-kpi-value">{c.value}</div>
          {c.sub && <div className="dash-kpi-sub">{c.sub}</div>}
        </Link>
      ))}
    </div>
  );
}
