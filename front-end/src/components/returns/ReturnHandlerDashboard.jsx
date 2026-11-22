import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { processRefundThunk, selectPendingReturns, selectDeliveryLoading } from '../../store/slices/deliverySlice.js';
import { showToast } from '../../store/slices/uiSlice.js';
import PageHeader from '../common/PageHeader.jsx';
import DataTable from '../common/DataTable.jsx';
import Badge from '../common/Badge.jsx';
import ReturnCharts from './ReturnCharts.jsx';
import ReturnStatCard from './ReturnStatCard.jsx';
import { COMPACT_VALUE_STYLE, RETURN_ICONS } from './returnIcons.jsx';
import { returnAge, returnBadgeType, returnRaisedAt, rupees, summarizeReturns } from './returnStats.js';
import { useDashboard } from '../../lib/dashboard/hooks.js';
import { api } from '../../lib/http.js';

const COLUMNS = ['Return', 'Order', 'Items', 'Reason', 'Refund', 'Status', 'Age', 'Action'];

function isoDay(ms) {
  return new Date(ms + 330 * 60000).toISOString().slice(0, 10);
}

export default function ReturnHandlerDashboard() {
  const { returns, scopedBusinessName, lastSyncedAt } = useDashboard();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isProcessing = useSelector(selectDeliveryLoading);
  const pendingReturns = useSelector(selectPendingReturns);
  const [week, setWeek] = useState(null);

  // Handler: process a refund via Redux thunk
  const handleProcessRefund = async (r) => {
    const result = await dispatch(processRefundThunk({ returnId: r.id, amount: r.amount }));
    if (processRefundThunk.fulfilled.match(result)) {
      dispatch(showToast({ message: `Refund of ${rupees(r.amount)} processed for ${r.id}`, type: 'success' }));
    } else {
      dispatch(showToast({ message: `Failed to process refund for ${r.id}`, type: 'error' }));
    }
  };

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
                <td>
                  {r.status === 'Approved' ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                      disabled={isProcessing}
                      onClick={() => handleProcessRefund(r)}
                    >
                      Process Refund
                    </button>
                  ) : (
                    <span className="text-muted text-sm">—</span>
                  )}
                </td>
              </tr>
            )}
          />
        </div>
      </section>
    </>
  );
}
