import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import DashboardLayout from '../components/dashboard/DashboardLayout.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import ReportStatCard from '../components/reports/ReportStatCard.jsx';
import {
  CategoryChart,
  ChartCard,
  MixChart,
  SalesByDayChart,
  SalesByHourChart,
} from '../components/reports/ReportCharts.jsx';
import { CashierTable, CountTable, DayTable, LowStockTable, ProductTable } from '../components/reports/ReportTables.jsx';
import { fillDays, useReport } from '../components/reports/useSalesReport.js';
import { useDashboard } from '../lib/dashboard/hooks.js';
import { downloadCsv } from '../lib/dashboard/csv.js';
import { RANGE_PRESETS, dayKey, rangePreset, rupees, scopedCompanyId } from '../components/orders/orderFormat.js';
import {
  fetchCouponAnalyticsThunk,
  selectCouponAnalytics,
  selectCouponsError,
} from '../store/slices/couponsSlice.js';

const SALES_ROLES = ['superuser', 'admin', 'cashier'];
const STOCK_ROLES = ['superuser', 'admin', 'inventorymanager'];
const RETURN_ROLES = ['superuser', 'admin', 'returnhandler'];
const COUPON_ROLES = ['superuser', 'admin'];
const DELIVERY_ROLES = ['superuser', 'admin', 'deliveryops'];

const r0 = (v) => rupees(v, { decimals: 0 });
const SECTION_TITLE = { margin: '22px 0 10px', fontSize: '1rem' };

function SalesSection({ range }) {
  const { data, error, loading } = useReport('/reports/sales', range);
  if (error) return <p className="form-error" style={{ display: 'block' }}>{error}</p>;
  if (!data) return <p className="text-muted">{loading ? 'Loading sales…' : ''}</p>;
  const from = range.from || (data.byDay[0] && data.byDay[0].day);
  const to = range.to || dayKey(new Date());
  const days = fillDays(data.byDay, from, to);
  const chartKey = `${from}|${to}|${data.netSales}|${data.totalOrders}`;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
        <button
          className="btn btn-outline"
          onClick={() =>
            downloadCsv(
              `sales-${from || 'all'}-to-${to}.csv`,
              [
                { label: 'Day', value: (d) => d.day },
                { label: 'Bills', value: (d) => d.orders },
                { label: 'Billed', value: (d) => d.gross },
                { label: 'Discount', value: (d) => d.discount },
                { label: 'Refunds', value: (d) => d.refunds },
                { label: 'Net', value: (d) => d.net },
              ],
              days,
            )
          }
        >
          Export daily sales CSV
        </button>
      </div>
      <section className="stats-grid">
        <ReportStatCard label="Net sales" value={r0(data.netSales)} meta={`Billed ${r0(data.grossSales)} − refunds ${r0(data.refunds)}`} color="green" />
        <ReportStatCard label="Bills" value={data.totalOrders} meta={`${data.itemsSold} items sold · ${data.cancelledOrders} cancelled`} color="blue" />
        <ReportStatCard label="Average bill" value={r0(data.avgBill)} meta={`Discount given ${r0(data.totalDiscount)}`} color="amber" />
        <ReportStatCard label="Money collected" value={r0(data.collected)} meta={`COD still to collect ${r0(data.codPending)}`} color="red" />
      </section>
      <section className="stats-grid">
        <ReportStatCard label="GST included in sales" value={r0(data.taxCollected)} meta="Part of the bill totals above" color="purple" />
        <ReportStatCard label="Counter vs delivery" value={`${(data.byOrderType && data.byOrderType.pickup) || 0} / ${(data.byOrderType && data.byOrderType.delivery) || 0}`} meta="bills at the counter / for delivery" color="blue" />
        <ReportStatCard label="Refunds" value={r0(data.refunds)} meta={data.grossSales ? `${Math.round((data.refunds / data.grossSales) * 1000) / 10}% of billed` : '—'} color="red" />
        <ReportStatCard label="Best day" value={days.length ? (() => { const best = [...days].sort((a, b) => b.net - a.net)[0]; return best.net ? r0(best.net) : '—'; })() : '—'} meta={days.length ? (() => { const best = [...days].sort((a, b) => b.net - a.net)[0]; return best.net ? best.day : 'no sales'; })() : ''} color="green" />
      </section>
      <section className="grid-2">
        <ChartCard title="Sales by day">
          <SalesByDayChart key={chartKey} days={days} />
        </ChartCard>
        <ChartCard title="Busy hours (bills per hour)">
          <SalesByHourChart key={chartKey} hours={data.byHour} />
        </ChartCard>
      </section>
      <section className="grid-2">
        <ChartCard title="How customers paid" height="240px">
          <MixChart key={chartKey} id="repPayChart" counts={data.byPaymentMethod} emptyLabel="No sales" />
        </ChartCard>
        <ChartCard title="Sales by category" height="240px">
          <CategoryChart key={chartKey} rows={data.byCategory} />
        </ChartCard>
      </section>
      <section className="grid-2">
        <div className="card">
          <div className="card-hd">
            <h3>Top products</h3>
          </div>
          <div className="card-bd">
            <ProductTable rows={data.topProducts} />
          </div>
        </div>
        <div className="card">
          <div className="card-hd">
            <h3>Sales by staff</h3>
          </div>
          <div className="card-bd">
            <CashierTable rows={data.byCashier} />
          </div>
        </div>
      </section>
      <section className="card">
        <div className="card-hd">
          <h3>Day by day</h3>
        </div>
        <div className="card-bd">
          <DayTable days={days} />
        </div>
      </section>
    </>
  );
}

function CouponSummary({ range }) {
  const dispatch = useDispatch();
  const { state, lastSyncedAt } = useDashboard();
  const companyId = scopedCompanyId(state);
  const data = useSelector(selectCouponAnalytics);
  const error = useSelector(selectCouponsError);
  const from = range && range.from;
  const to = range && range.to;

  useEffect(() => {
    dispatch(fetchCouponAnalyticsThunk({ companyId, from: from || undefined, to: to || undefined }));
  }, [dispatch, companyId, from, to, lastSyncedAt]);

  if (error || !data) return null;
  const t = data.totals;
  const top = (data.coupons || []).filter((c) => c.uses).slice(0, 3);
  return (
    <section className="card">
      <div className="card-hd" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h3>Coupons</h3>
        <Link to="/coupons" className="text-sm">
          Coupon analytics
        </Link>
      </div>
      <div className="card-bd" style={{ fontSize: '0.9rem', display: 'grid', gap: '6px' }}>
        <div>
          {t.couponOrders} of {t.orders} bills used a coupon ({t.couponShare}%) · discount given {r0(t.discountGiven)}
        </div>
        <div>
          Average bill with a coupon {r0(t.avgBillWithCoupon)}, without {r0(t.avgBillWithoutCoupon)}
        </div>
        {top.length > 0 && (
          <div className="text-muted">
            Most used: {top.map((c) => `${c.code} (${c.uses})`).join(', ')}
          </div>
        )}
      </div>
    </section>
  );
}

function StockSection({ range }) {
  const { data, error, loading } = useReport('/reports/inventory', range);
  const { inventory } = useDashboard();
  const nameOf = (id) => (inventory.find((p) => p.productId === id) || {}).name || id;
  if (error) return <p className="form-error" style={{ display: 'block' }}>{error}</p>;
  if (!data) return <p className="text-muted">{loading ? 'Loading stock…' : ''}</p>;
  return (
    <>
      <section className="stats-grid">
        <ReportStatCard label="Stock value at cost" value={r0(data.stockValueAtCost)} meta={`At selling price ${r0(data.stockValueAtPrice)}`} color="green" />
        <ReportStatCard label="Products tracked" value={data.totalItems} meta={`${(data.byStatus && data.byStatus['In Stock']) || 0} in stock`} color="blue" />
        <ReportStatCard label="Low or out of stock" value={data.lowStockCount} meta={`${(data.byStatus && data.byStatus['Out of Stock']) || 0} out of stock`} color="red" />
        <ReportStatCard label="Margin on shelf" value={r0(data.stockValueAtPrice - data.stockValueAtCost)} meta="Selling value minus cost" color="amber" />
      </section>
      <section className="grid-2">
        <div className="card">
          <div className="card-hd">
            <h3>Needs reordering</h3>
          </div>
          <div className="card-bd">
            <LowStockTable rows={data.lowStockItems} nameOf={nameOf} />
          </div>
        </div>
        <div className="card">
          <div className="card-hd">
            <h3>Stock movements (latest 1,000)</h3>
          </div>
          <div className="card-bd">
            <CountTable counts={data.movementsByType} label="Type" emptyMessage="No stock movements yet." />
          </div>
        </div>
      </section>
    </>
  );
}

function ReturnsSection({ range }) {
  const { data, error, loading } = useReport('/reports/returns', range);
  if (error) return <p className="form-error" style={{ display: 'block' }}>{error}</p>;
  if (!data) return <p className="text-muted">{loading ? 'Loading returns…' : ''}</p>;
  return (
    <>
      <section className="stats-grid">
        <ReportStatCard label="Returns raised" value={data.totalReturns} meta={`${(data.byStatus && data.byStatus.Pending) || 0} still pending`} color="amber" />
        <ReportStatCard label="Refunded" value={r0(data.totalRefund)} meta={`${(data.byStatus && data.byStatus.Refunded) || 0} refunds paid`} color="red" />
        <ReportStatCard label="Exchanged" value={(data.byStatus && data.byStatus.Exchanged) || 0} meta={`${(data.byStatus && data.byStatus.Rejected) || 0} rejected`} color="blue" />
        <ReportStatCard
          label="Most returned"
          value={data.topProducts[0] ? data.topProducts[0].productName : '—'}
          meta={data.topProducts[0] ? `${data.topProducts[0].qty} units` : 'no returns'}
          color="purple"
        />
      </section>
      <section className="grid-2">
        <div className="card">
          <div className="card-hd">
            <h3>Why customers return</h3>
          </div>
          <div className="card-bd">
            <CountTable counts={data.byReason} label="Reason" emptyMessage="No returns in this period." />
          </div>
        </div>
        <div className="card">
          <div className="card-hd">
            <h3>Return status</h3>
          </div>
          <div className="card-bd">
            <CountTable counts={data.byStatus} label="Status" emptyMessage="No returns in this period." />
          </div>
        </div>
      </section>
    </>
  );
}

/** Delivery figures from the deliveries already loaded for this business. */
function DeliverySection({ range }) {
  const { deliveries } = useDashboard();
  const rows = deliveries.filter((d) => {
    const created = d.history && d.history[0] ? dayKey(d.history[0].at) : d.dispatchDate;
    return (!range.from || created >= range.from) && (!range.to || created <= range.to);
  });
  const byStatus = rows.reduce((acc, d) => ({ ...acc, [d.status]: (acc[d.status] || 0) + 1 }), {});
  const delivered = rows.filter((d) => d.status === 'Delivered');
  const cod = delivered.reduce((s, d) => s + d.cashCollected, 0);
  const failedAttempts = rows.reduce((s, d) => s + d.attempts, 0);
  const minutes = delivered
    .map((d) => {
      const start = (d.history || []).find((h) => h.status === 'Dispatched');
      const end = (d.history || []).find((h) => h.status === 'Delivered');
      return start && end ? (new Date(end.at) - new Date(start.at)) / 60000 : null;
    })
    .filter((m) => m !== null && m >= 0);
  const avgMinutes = minutes.length ? Math.round(minutes.reduce((s, m) => s + m, 0) / minutes.length) : null;
  return (
    <>
      <section className="stats-grid">
        <ReportStatCard label="Deliveries" value={rows.length} meta={`${delivered.length} delivered`} color="blue" />
        <ReportStatCard label="COD cash collected" value={r0(cod)} meta="Recorded at the door" color="green" />
        <ReportStatCard label="Dispatch to door" value={avgMinutes === null ? '—' : `${avgMinutes} min`} meta="Average, from the status history" color="amber" />
        <ReportStatCard label="Failed attempts" value={failedAttempts} meta={`${byStatus['Returned to Store'] || 0} returned to store`} color="red" />
      </section>
      <section className="card">
        <div className="card-hd">
          <h3>Delivery status</h3>
        </div>
        <div className="card-bd">
          <CountTable counts={byStatus} label="Status" emptyMessage="No deliveries in this period." />
        </div>
      </section>
    </>
  );
}

function ReportsContent() {
  const { roleKey, scopedBusinessName } = useDashboard();
  const [presetKey, setPresetKey] = useState('30d');
  const [custom, setCustom] = useState(() => rangePreset('30d'));
  const range = useMemo(() => {
    if (presetKey === 'custom') return custom;
    if (presetKey === 'all') return { from: '', to: '' };
    return rangePreset(presetKey);
  }, [presetKey, custom]);
  const invalid = presetKey === 'custom' && custom.from && custom.to && custom.from > custom.to;
  const has = (roles) => roles.includes(roleKey);

  return (
    <>
      <PageHeader
        title={`Reports${scopedBusinessName ? ` - ${scopedBusinessName}` : ''}`}
        actions={
          <button className="btn btn-outline" onClick={() => window.print()}>
            Print
          </button>
        }
      />
      <section className="card" style={{ marginBottom: '14px' }}>
        <div className="card-bd table-toolbar">
          <div className="toolbar-group">
            <label className="toolbar-label" htmlFor="reportsTimeRange">
              Period
            </label>
            <select id="reportsTimeRange" className="toolbar-select" value={presetKey} onChange={(e) => setPresetKey(e.target.value)}>
              {RANGE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
              <option value="all">All time</option>
              <option value="custom">Custom dates</option>
            </select>
          </div>
          {presetKey === 'custom' && (
            <>
              <div className="toolbar-group">
                <label className="toolbar-label" htmlFor="reportsFrom">
                  From
                </label>
                <input id="reportsFrom" type="date" className="toolbar-select" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} />
              </div>
              <div className="toolbar-group">
                <label className="toolbar-label" htmlFor="reportsTo">
                  To
                </label>
                <input id="reportsTo" type="date" className="toolbar-select" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} />
              </div>
            </>
          )}
          <div className="toolbar-group" style={{ alignSelf: 'flex-end' }}>
            <span className="text-sm text-muted">
              {range.from ? `${range.from} to ${range.to || 'today'}` : 'All recorded sales'} · India time
            </span>
          </div>
        </div>
      </section>
      {invalid ? (
        <p className="form-error" style={{ display: 'block' }}>
          The start date must be on or before the end date.
        </p>
      ) : (
        <>
          {has(SALES_ROLES) && (
            <>
              <h3 style={SECTION_TITLE}>Sales</h3>
              <SalesSection range={range} />
            </>
          )}
          {has(COUPON_ROLES) && <CouponSummary range={range} />}
          {has(STOCK_ROLES) && (
            <>
              <h3 style={SECTION_TITLE}>Stock</h3>
              <StockSection range={range} />
            </>
          )}
          {has(RETURN_ROLES) && (
            <>
              <h3 style={SECTION_TITLE}>Returns</h3>
              <ReturnsSection range={range} />
            </>
          )}
          {has(DELIVERY_ROLES) && (
            <>
              <h3 style={SECTION_TITLE}>Deliveries</h3>
              <DeliverySection range={range} />
            </>
          )}
        </>
      )}
    </>
  );
}

export default function ReportsPage() {
  return (
    <DashboardLayout page="reports">
      <ReportsContent />
    </DashboardLayout>
  );
}
