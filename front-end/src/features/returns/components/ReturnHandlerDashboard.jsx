import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchReturnsThunk,
  fetchReturnsWeekReportThunk,
  openReturnActionModal,
  closeReturnActionModal,
  selectAllReturns,
  selectReturnsSaving,
  selectReturnsUi,
} from '../returnsSlice.js';
import PageHeader from '../../../shared/components/common/PageHeader.jsx';
import DataTable from '../../../shared/components/common/DataTable.jsx';
import Badge from '../../../shared/components/common/Badge.jsx';
import ReturnCharts from './ReturnCharts.jsx';
import ReturnStatCard from './ReturnStatCard.jsx';
import ReturnActionModal from './ReturnActionModal.jsx';
import useReturnActions from './useReturnActions.js';
import { COMPACT_VALUE_STYLE, RETURN_ICONS } from './returnIcons.jsx';
import { returnAge, returnBadgeType, returnRaisedAt, rupees, summarizeReturns } from './returnStats.js';
import { useDashboard } from '../../../shared/lib/dashboard/hooks.js';
import { mapReturnRow } from '../../../shared/lib/dashboard/api.js';
import { scopedCompanyId } from '../../orders/components/orderFormat.js';

const COLUMNS = ['Return', 'Order', 'Items', 'Reason', 'Refund', 'Status', 'Age', 'Action'];

function isoDay(ms) {
  return new Date(ms + 330 * 60000).toISOString().slice(0, 10);
}

export default function ReturnHandlerDashboard() {
  const reduxReturns = useSelector(selectAllReturns);
  const { weekReport: week, actionModal: action } = useSelector(selectReturnsUi);
  const { returns: dashReturns, orders, scopedBusinessName, lastSyncedAt, state } = useDashboard();
  const companyId = scopedCompanyId(state);
  const returns = useMemo(
    () => (reduxReturns.length ? reduxReturns.map(mapReturnRow) : dashReturns),
    [reduxReturns, dashReturns],
  );
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isProcessing = useSelector(selectReturnsSaving);
  const { transition } = useReturnActions();

  useEffect(() => {
    dispatch(fetchReturnsThunk({ companyId }));
  }, [dispatch, companyId, lastSyncedAt]);

  const handleProcessRefund = (r) => {
    dispatch(openReturnActionModal({ item: r, status: 'Refunded', order: orders.find((o) => o.id === r.orderId) }));
  };

  useEffect(() => {
    const now = Date.now();
    dispatch(fetchReturnsWeekReportThunk({ from: isoDay(now - 6 * 86400000), to: isoDay(now) }));
  }, [dispatch, lastSyncedAt]);

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
      {action && (
        <ReturnActionModal
          item={action.item}
          action={action.status}
          order={action.order}
          onClose={() => dispatch(closeReturnActionModal())}
          onSubmit={async (item, body) => {
            await transition(item, body);
            dispatch(closeReturnActionModal());
          }}
        />
      )}
    </>
  );
}
