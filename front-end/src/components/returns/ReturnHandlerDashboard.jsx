import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../common/PageHeader.jsx';
import DataTable from '../common/DataTable.jsx';
import Badge from '../common/Badge.jsx';
import ReturnCharts from './ReturnCharts.jsx';
import ReturnStatCard from './ReturnStatCard.jsx';
import { COMPACT_VALUE_STYLE, RETURN_ICONS } from './returnIcons.jsx';
import { returnAge, returnBadgeType, returnRaisedAt, rupees, summarizeReturns } from './returnStats.js';
import { useDashboard } from '../../lib/dashboard/hooks.js';
import { api } from '../../lib/http.js';

const COLUMNS = ['Return', 'Order', 'Items', 'Reason', 'Refund', 'Status', 'Age'];

function isoDay(ms) {
  return new Date(ms + 330 * 60000).toISOString().slice(0, 10);
}

/**
 * Return desk start page. Counts come from the loaded returns; the week's
 * refund total, top reasons and top products come from GET /reports/returns
 * (the same numbers the Reports page shows).
 */
export default function ReturnHandlerDashboard() {
  const { returns, scopedBusinessName, lastSyncedAt } = useDashboard();
  const navigate = useNavigate();
  const [week, setWeek] = useState(null);

  useEffect(() => {
    let alive = true;
    const now = Date.now();
    api('/reports/returns', { query: { from: isoDay(now - 6 * 86400000), to: isoDay(now) } })
      .then((data) => alive && setWeek(data))
      .catch(() => alive && setWeek(null));
    return () => {
      alive = false;
    };
  }, [lastSyncedAt]);

  const counts = summarizeReturns(returns);
  const open = returns
    .filter((r) => r.status === 'Pending' || r.status === 'Approved')
    .sort((a, b) => returnRaisedAt(a) - returnRaisedAt(b));
  const oldest = open[0];
  const topReason = week && Object.entries(week.byReason || {}).sort((a, b) => b[1] - a[1])[0];
  const topProduct = week && (week.topProducts || [])[0];

  return (
    <>
      <PageHeader
        title={`Returns Dashboard${scopedBusinessName ? ` - ${scopedBusinessName}` : ''}`}
        actions={
          <>
            <button className="btn btn-primary" onClick={() => navigate('/returns')}>
              Open Returns
            </button>
            <button className="btn btn-outline" onClick={() => window.print()}>
              Print
            </button>
          </>
        }
      />

      <section className="stats-grid">
        <ReturnStatCard icon={RETURN_ICONS.clock} color="amber" label="Waiting for a decision" value={open.length} sub={oldest ? `Oldest: ${oldest.id}, ${returnAge(oldest)} old` : 'Nothing waiting'} />
        <ReturnStatCard icon={RETURN_ICONS.money} color="green" label="Refunded (last 7 days)" value={week ? rupees(Math.round(week.totalRefund)) : '—'} sub={week ? `${week.totalReturns} requests this week` : 'Report unavailable'} />
        <ReturnStatCard icon={RETURN_ICONS.returns} color="red" label="Top reason this week" value={topReason ? topReason[0] : '—'} valueStyle={COMPACT_VALUE_STYLE} sub={topReason ? `${topReason[1]} request(s)` : 'No returns this week'} />
        <ReturnStatCard icon={RETURN_ICONS.bars} color="purple" label="Most returned this week" value={topProduct ? topProduct.productName : '—'} valueStyle={COMPACT_VALUE_STYLE} sub={topProduct ? `${topProduct.qty} units` : `All time: ${counts.total} requests`} />
      </section>

      <ReturnCharts view={returns} />

      <section className="card">
        <div className="card-hd">
          <h3>Waiting for a decision (oldest first)</h3>
        </div>
        <div className="card-bd">
          <DataTable
            columns={COLUMNS}
            rows={open.slice(0, 10)}
            emptyMessage="No returns are waiting."
            renderRow={(r) => (
              <tr key={r.id}>
                <td className="cell-main">{r.id}</td>
                <td>{r.orderId}</td>
                <td>{r.product}</td>
                <td>{r.reason}</td>
                <td>{r.returnType === 'exchange' ? 'Exchange' : rupees(r.amount)}</td>
                <td>
                  <Badge status={r.status} type={returnBadgeType(r.status)} />
                </td>
                <td>{returnAge(r)}</td>
              </tr>
            )}
          />
        </div>
      </section>
    </>
  );
}
