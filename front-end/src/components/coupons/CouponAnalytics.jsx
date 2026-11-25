import { Fragment, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ChartCanvas, { getColors } from '../common/ChartCanvas.jsx';
import StatCard from '../common/StatCard.jsx';
import { rupees, shortDay, currencySymbol, convertInrToActiveCurrency } from '../orders/orderFormat.js';

const ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
  </svg>
);
const SUB = { display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' };
const DETAIL_GRID = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', padding: '10px 4px' };
const H4 = { fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', margin: '0 0 6px' };
const MINI = { width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' };

function DailyChart({ code, daily }) {
  const data = () => {
    const c = getColors();
    return {
      labels: daily.map((d) => shortDay(d.day)),
      datasets: [
        { label: 'Uses', data: daily.map((d) => d.uses), backgroundColor: c.blue, yAxisID: 'y' },
        { label: `Discount ${currencySymbol()}`, data: daily.map((d) => Math.round(convertInrToActiveCurrency(d.discount))), type: 'line', borderColor: c.red, tension: 0.3, yAxisID: 'y1' },
      ],
    };
  };
  const options = () => {
    const c = getColors();
    return {
      scales: {
        x: { grid: { display: false }, ticks: { color: c.text } },
        y: { beginAtZero: true, ticks: { color: c.text, precision: 0 }, grid: { color: c.grid } },
        y1: { beginAtZero: true, position: 'right', ticks: { color: c.text }, grid: { display: false } },
      },
    };
  };
  if (!daily.length) return <p className="text-muted text-sm">No uses in this period.</p>;
  return (
    <div style={{ position: 'relative', height: '180px' }}>
      <ChartCanvas key={`${code}-${daily.length}`} id={`cpDaily-${code}`} type="bar" data={data} options={options} />
    </div>
  );
}

function Detail({ row }) {
  return (
    <div style={DETAIL_GRID}>
      <div>
        <h4 style={H4}>Uses per day</h4>
        <DailyChart code={row.code} daily={row.daily} />
      </div>
      <div>
        <h4 style={H4}>Applied by</h4>
        {row.byCashier.length ? (
          <table style={MINI}>
            <tbody>
              {row.byCashier.map((c) => (
                <tr key={c.staff}>
                  <td>{c.staff}</td>
                  <td style={{ textAlign: 'right' }}>{c.uses} uses</td>
                  <td style={{ textAlign: 'right' }}>{rupees(c.discount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-muted text-sm">Nobody yet.</p>
        )}
        <p className="text-muted text-sm" style={{ marginTop: '6px' }}>
          One cashier applying most of a code can be a sign of misuse.
        </p>
      </div>
      <div>
        <h4 style={H4}>Bought with this code</h4>
        {row.topProducts.length ? (
          <table style={MINI}>
            <tbody>
              {row.topProducts.map((p) => (
                <tr key={p.productId}>
                  <td>{p.productName}</td>
                  <td style={{ textAlign: 'right' }}>{p.quantity} units</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-muted text-sm">Nothing yet.</p>
        )}
      </div>
    </div>
  );
}

/** Coupon analytics: totals and one expandable row per coupon. */
export default function CouponAnalytics({ data, loading, error }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(null);

  if (error) return <p className="form-error" style={{ display: 'block' }}>{error}</p>;
  if (!data) return <p className="text-muted">{loading ? 'Working out coupon numbers…' : 'No data.'}</p>;
  const t = data.totals;

  return (
    <>
      <section className="stats-grid">
        <StatCard icon={ICON} label="Bills with a coupon" value={`${t.couponOrders} of ${t.orders}`} color="blue">
          <span className="text-sm text-muted">{t.couponShare}% of bills</span>
        </StatCard>
        <StatCard icon={ICON} label="Discount given" value={rupees(t.discountGiven, { decimals: 0 })} color="red" />
        <StatCard icon={ICON} label="Average bill with coupon" value={rupees(t.avgBillWithCoupon, { decimals: 0 })} color="green">
          <span className="text-sm text-muted">without: {rupees(t.avgBillWithoutCoupon, { decimals: 0 })}</span>
        </StatCard>
        <StatCard
          icon={ICON}
          label="Bill size effect"
          value={
            t.avgBillWithoutCoupon
              ? `${t.avgBillWithCoupon >= t.avgBillWithoutCoupon ? '+' : ''}${Math.round(((t.avgBillWithCoupon - t.avgBillWithoutCoupon) / t.avgBillWithoutCoupon) * 100)}%`
              : '—'
          }
          color="amber"
        >
          <span className="text-sm text-muted">how much larger coupon bills are vs non-coupon bills</span>
        </StatCard>
      </section>
      <section className="card">
        <div className="card-hd">
          <h3>Per coupon</h3>
        </div>
        <div className="card-bd">
          <div className="tbl-wrap">
            <table className="dt">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Uses</th>
                  <th>Customers</th>
                  <th>
                    Sales (before discount)
                    <div className="text-sm text-muted" style={{ fontWeight: 400 }}>Gross item total</div>
                  </th>
                  <th>Discount</th>
                  <th>Net after refunds</th>
                  <th>
                    Discount share
                    <div className="text-sm text-muted" style={{ fontWeight: 400 }}>% of gross sales</div>
                  </th>
                  <th>Average bill</th>
                  <th>Refunded bills</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.coupons.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-muted">
                      No coupons yet.
                    </td>
                  </tr>
                )}
                {data.coupons.map((row) => (
                  <Fragment key={row.id}>
                    <tr>
                      <td className="cell-main">
                        {row.code}
                        <span style={SUB}>{row.type === 'percent' ? `${row.value}% off` : `${rupees(row.value)} off`}{row.active ? '' : ' · off'}</span>
                      </td>
                      <td>
                        {row.uses}
                        {row.usageLimit > 0 && <span style={SUB}>of {row.usageLimit}</span>}
                      </td>
                      <td>
                        {row.uniqueCustomers}
                        <span style={SUB}>
                          {row.newCustomers} new · {row.repeatCustomers} repeat
                        </span>
                      </td>
                      <td>{rupees(row.grossSales, { decimals: 0 })}</td>
                      <td>{rupees(row.discountGiven, { decimals: 0 })}</td>
                      <td>{rupees(row.netRevenue, { decimals: 0 })}</td>
                      <td>{row.discountShare}%</td>
                      <td>{rupees(row.avgBill, { decimals: 0 })}</td>
                      <td>{row.returnRate}%</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ padding: '4px 8px', fontSize: '0.75rem', marginRight: '4px' }}
                          aria-expanded={open === row.id}
                          onClick={() => setOpen(open === row.id ? null : row.id)}
                        >
                          {open === row.id ? 'Hide' : 'Details'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          disabled={!row.uses}
                          onClick={() => navigate(`/orders?coupon=${encodeURIComponent(row.code)}`)}
                        >
                          Orders
                        </button>
                      </td>
                    </tr>
                    {open === row.id && (
                      <tr>
                        <td colSpan={10}>
                          <Detail row={row} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
