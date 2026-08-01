import Item from '../models/Item.js';
import { Warehouse } from '../models/Warehouse.js';
import Shipment from '../models/Shipment.js';
import FinanceEntry from '../models/FinanceEntry.js';
import PosTransaction from '../models/PosTransaction.js';
import { ensureFinanceSynced, invalidateFinanceSync } from './financeSync.service.js';
import { getDashboard } from './financeAggregation.service.js';
import { batchWarehouseStockCounts, flagForCountry } from '../utils/warehouseHelpers.js';
import { startOfToday } from '../utils/posHelpers.js';
import { fromXaf, fmtCurrency, toBusinessObjectId } from '../utils/financeHelpers.js';

const CATEGORY_COLORS = ['#E85D26', '#1A3C5E', '#F5A623', '#8A97A8'];
const EXPENSE_SEGMENT_COLORS = ['#E85D26', '#1A3C5E', '#F5A623', '#16A085', '#9B59B6', '#8A97A8'];

function looseFilter(businessId) {
  return { business: toBusinessObjectId(businessId), status: { $nin: ['Sold', 'Returned'] } };
}

function aggregateCategories(categoryGroups) {
  const merged = {};
  categoryGroups.forEach((g) => {
    const name = g._id || 'Other';
    const key = ['Bags', 'Accessories', 'Other'].includes(name) ? 'Bags + Other' : name;
    merged[key] = (merged[key] || 0) + (g.units || 0);
  });

  const totalUnits = Object.values(merged).reduce((s, v) => s + v, 0) || 1;
  return Object.entries(merged)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, units], i) => ({
      name,
      pct: Math.round((units / totalUnits) * 100),
      units,
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length]
    }));
}

function sumGroup(rows, valueFn) {
  return rows.reduce(
    (acc, row) => {
      acc.totalXaf += valueFn(row) || 0;
      acc.count += 1;
      return acc;
    },
    { totalXaf: 0, count: 0 }
  );
}

export async function getDashboardSummary(businessId, { financePeriod = 'month', currency = 'XAF' } = {}) {
  await ensureFinanceSynced(businessId);
  const filter = looseFilter(businessId);
  const today = startOfToday();

  const [items, warehouses, shipments, activeList, allShipmentsForLanded, todayRevenue, todayPos, financeData] =
    await Promise.all([
      Item.find(filter).lean(),
      Warehouse.find({ business: businessId }).lean(),
      Shipment.find({ business: businessId }).lean(),
      Shipment.find({
        business: businessId,
        $or: [
          { mode: 'active' },
          { status: { $nin: ['Delivered', 'Closed', 'Cancelled', 'Offloaded'] } }
        ]
      })
        .sort({ updatedAt: -1 })
        .limit(6)
        .lean(),
      Shipment.find({ business: businessId })
        .select('goodsCost shippingCost dutiesCost')
        .limit(200)
        .lean(),
      FinanceEntry.find({
        business: businessId,
        type: 'revenue',
        source: 'POS',
        date: { $gte: today }
      }).lean(),
      PosTransaction.find({
        business: businessId,
        paymentStatus: 'paid',
        date: { $gte: today }
      }).lean(),
      getDashboard(businessId, { period: financePeriod, currency })
    ]);

  const itemStats = [
    {
      itemCount: items.length,
      totalValueXaf: items.reduce((s, it) => {
        const price = it.targetPrice ?? it.priceXaf ?? 0;
        return s + price * (it.qty || 0);
      }, 0)
    }
  ];

  const catMap = {};
  for (const it of items) {
    const cat = it.category || 'Other';
    catMap[cat] = (catMap[cat] || 0) + (it.qty || 1);
  }
  const categoryGroups = Object.entries(catMap)
    .map(([_id, units]) => ({ _id, units }))
    .sort((a, b) => b.units - a.units)
    .slice(0, 20);

  const statusMap = {};
  for (const s of shipments) {
    const st = s.status || 'Unknown';
    statusMap[st] = (statusMap[st] || 0) + 1;
  }
  const shipmentStats = Object.entries(statusMap).map(([_id, count]) => ({ _id, count }));

  const landedSample = allShipmentsForLanded
    .filter((sh) => (sh.goodsCost || 0) + (sh.shippingCost || 0) + (sh.dutiesCost || 0) > 0)
    .slice(0, 100);

  const todayRevenueStats = [sumGroup(todayRevenue, (e) => e.amountXaf || 0)];
  const todayPosStats = [sumGroup(todayPos, (e) => e.total || 0)];

  const stockByWh = await batchWarehouseStockCounts(businessId, warehouses);
  const stats = itemStats[0] || { itemCount: 0, totalValueXaf: 0 };
  const totalValueXaf = stats.totalValueXaf || 0;
  const inventoryValueUsd = Math.round(fromXaf(totalValueXaf, 'USD'));
  const inventoryValueFmt = fmtCurrency(currency, totalValueXaf);
  const itemCount = stats.itemCount || 0;

  const warehouseRows = warehouses.map((w) => {
    const counts = stockByWh[String(w._id)] || { itemsCount: 0 };
    return {
      id: w.warehouseId || String(w._id),
      name: w.name,
      country: w.country || 'Cameroon',
      flag: w.flag || flagForCountry(w.country),
      itemsCount: counts.itemsCount
    };
  });

  const statusCounts = Object.fromEntries(shipmentStats.map((s) => [s._id || 'Unknown', s.count]));
  const inTransitCount = (statusCounts['In Transit'] || 0) + (statusCounts.Delayed || 0);
  const delayedCount = statusCounts.Delayed || 0;
  const arrivedCount = statusCounts.Arrived || 0;
  const activeCount = activeList.length;

  const shipmentList = activeList.map((s) => ({
    id: s.shipmentId,
    origin: s.origin,
    destination: s.dest,
    originFlag: s.originFlag || '🇨🇳',
    destFlag: s.destFlag || '🇨🇲',
    status: s.status,
    eta: s.eta || '—',
    routeLabel: `${s.originFlag || '🇨🇳'} ${s.origin} → ${s.destFlag || '🇨🇲'} ${s.dest}`
  }));

  const avgLandedXaf = landedSample.length
    ? Math.round(
        landedSample.reduce(
          (s, sh) => s + (sh.goodsCost || 0) + (sh.shippingCost || 0) + (sh.dutiesCost || 0),
          0
        ) / landedSample.length
      )
    : 0;
  const avgLandedUsd = Math.round(fromXaf(avgLandedXaf, 'USD'));
  const avgLandedFmt = fmtCurrency(currency, avgLandedXaf);

  const financeTodayXaf = todayRevenueStats[0]?.totalXaf || 0;
  const financeTodayCount = todayRevenueStats[0]?.count || 0;
  const posTodayXaf = todayPosStats[0]?.totalXaf || 0;
  const posTodayCount = todayPosStats[0]?.count || 0;
  const todayTotalXaf = posTodayCount > 0 ? posTodayXaf : financeTodayXaf;
  const todayTxnCount = posTodayCount > 0 ? posTodayCount : financeTodayCount;
  const todaySalesFmt = fmtCurrency(currency || 'XAF', todayTotalXaf);
  const { kpis, revenueBySource, expenseByCategory, cashFlow, plSummary } = financeData;

  return {
    kpis: {
      inventoryValueUsd,
      inventoryValue: fromXaf(totalValueXaf, currency),
      inventoryValueFmt,
      inventoryTrendPct: null,
      itemsInTransit: inTransitCount,
      transitOnTime: Math.max(0, inTransitCount - delayedCount),
      transitDelayed: delayedCount,
      todaySalesUsd: Math.round(fromXaf(todayTotalXaf, 'USD')),
      todaySales: fromXaf(todayTotalXaf, currency),
      todaySalesFmt,
      todaySalesXaf: todayTotalXaf,
      todayTxnCount,
      netProfitUsd: fromXaf(kpis.profitXaf || 0, 'USD'),
      netProfitFmt: kpis.profit,
      netProfitMarginPct: kpis.marginPct,
      activeShipments: activeCount,
      shipmentsOnTime: activeList.filter((s) => s.status === 'In Transit').length,
      shipmentsDelayed: delayedCount,
      shipmentsArrived: arrivedCount
    },
    inventory: {
      totalItems: itemCount,
      totalRecords: itemCount,
      warehouseCount: warehouses.length,
      totalValueUsd: inventoryValueUsd,
      totalValue: fromXaf(totalValueXaf, currency),
      totalValueFmt: inventoryValueFmt,
      byCategory: aggregateCategories(categoryGroups)
    },
    warehouses: warehouseRows,
    shipping: {
      shipments: shipmentList,
      stats: {
        active: activeCount,
        delayed: delayedCount,
        arrived: arrivedCount,
        avgLandedUsd,
        avgLandedFmt
      }
    },
    finance: {
      period: financePeriod,
      revenue: kpis.revenue,
      revenueXaf: kpis.revenueXaf,
      expenses: kpis.expenses,
      expensesXaf: kpis.expensesXaf,
      profit: kpis.profit,
      profitXaf: kpis.profitXaf,
      revenueTxnCount: kpis.revenueTxnCount,
      topExpenseCategory: kpis.topExpenseCategory,
      marginPct: kpis.marginPct,
      revenueBySource: (revenueBySource || []).slice(0, 4),
      expenseByCategory: (expenseByCategory || []).slice(0, 4).map((c, i) => ({
        ...c,
        color: EXPENSE_SEGMENT_COLORS[i % EXPENSE_SEGMENT_COLORS.length]
      })),
      cashFlow: {
        inXaf: cashFlow?.inXaf || 0,
        outXaf: cashFlow?.outXaf || 0,
        netXaf: cashFlow?.netXaf || 0,
        inFmt: cashFlow?.inFmt || '—',
        outFmt: cashFlow?.outFmt || '—',
        netFmt: cashFlow?.netFmt || '—',
        transactions: (cashFlow?.recentTransactions || []).slice(0, 3)
      },
      plSummary: plSummary || null
    },
    badges: {
      inventoryLowStock: 0,
      shippingActive: activeCount
    }
  };
}

export async function refreshDashboardSummary(businessId, options = {}) {
  invalidateFinanceSync(businessId);
  await ensureFinanceSynced(businessId, { force: true });
  return getDashboardSummary(businessId, options);
}
