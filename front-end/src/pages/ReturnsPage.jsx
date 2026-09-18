// React port of returns.html + renderReturnsRefined() / initReturnCharts() in dashboard.js.
// The Starter-plan paywall (renderPlanFeatureLock) is handled by DashboardLayout.
import { useState } from 'react';
import DashboardLayout from '../components/dashboard/DashboardLayout.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import DataTable from '../components/common/DataTable.jsx';
import { FilterSelect } from '../components/common/FilterToolbar.jsx';
import ReturnCharts from '../components/returns/ReturnCharts.jsx';
import ReturnRow from '../components/returns/ReturnRow.jsx';
import ReturnStatCard from '../components/returns/ReturnStatCard.jsx';
import { COMPACT_VALUE_STYLE, RETURN_ICONS } from '../components/returns/returnIcons.jsx';
import { classifyReturnStatus, getReturnProductCounts, summarizeReturns } from '../components/returns/returnStats.js';
import useReturnActions from '../components/returns/useReturnActions.js';
import { useDashboard } from '../lib/dashboard/hooks.js';
import { getReturnView, parseOrderDate } from '../lib/dashboard/helpers.js';

const FILTER_TABS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'rejected', label: 'Rejected' },
];

const SORT_OPTIONS = [
  { value: 'updated_new', label: 'Updated newest' },
  { value: 'updated_old', label: 'Updated oldest' },
  { value: 'amount_high', label: 'Amount high-low' },
  { value: 'amount_low', label: 'Amount low-high' },
  { value: 'qty_high', label: 'Qty high-low' },
];

const COLUMNS = ['Return', 'Order', 'Customer', 'Product', 'Qty', 'Reason', 'Amount', 'Status', 'Requested By', 'Updated', 'Actions'];

const CARD_HD_STYLE = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' };
const CONTROLS_STYLE = { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' };

function matchesFilter(item, filter) {
  return filter === 'all' || classifyReturnStatus(item.status) === filter;
}

function compareReturns(sortKey) {
  const updated = (r) => parseOrderDate(r.updatedAt)?.getTime() || 0;
  const num = (v) => Math.max(0, Number(v || 0));
  return (a, b) => {
    if (sortKey === 'updated_old') return updated(a) - updated(b);
    if (sortKey === 'amount_high') return num(b.amount) - num(a.amount);
    if (sortKey === 'amount_low') return num(a.amount) - num(b.amount);
    if (sortKey === 'qty_high') return num(b.qty) - num(a.qty);
    return updated(b) - updated(a);
  };
}

function ReturnsContent() {
  const { returns, orders, hasActionAccess } = useDashboard();
  const { raiseReturnRequest, editReturn, refundReturn, rejectReturn } = useReturnActions();
  const [filter, setFilter] = useState('all');
  const [sortKey, setSortKey] = useState('updated_new');
  const canManage = hasActionAccess('returns');

  const view = getReturnView({ returns, orders });
  const counts = summarizeReturns(view);
  const topProduct = getReturnProductCounts(view)[0] || null;
  const topProductLabel = topProduct ? `${topProduct[0]} (${topProduct[1]})` : '—';
  const visibleRows = view.filter((r) => matchesFilter(r, filter)).sort(compareReturns(sortKey));

  return (
    <>
      <PageHeader
        title="Returns"
        actions={(
          <>
            {canManage && <button className="btn btn-primary" id="raiseReturnBtnDyn" onClick={raiseReturnRequest}>+ Raise Return</button>}
            <button className="btn btn-outline" onClick={() => window.print()}>Print</button>
          </>
        )}
      />

      <section className="stats-grid">
        <ReturnStatCard icon={RETURN_ICONS.returns} color="red" label="Total Requests" value={counts.total} />
        <ReturnStatCard
          icon={RETURN_ICONS.clock} color="amber" label="Pending / Open" value={counts.pending}
          sub={`Pending ${counts.pending} • Rejected ${counts.rejected}`}
        />
        <ReturnStatCard
          icon={RETURN_ICONS.money} color="green" label="Refunded Value"
          value={`₹${Math.round(counts.valueRefunded).toLocaleString()}`}
          sub={`At risk ₹${Math.round(counts.valueAtRisk).toLocaleString()}`}
        />
        <ReturnStatCard icon={RETURN_ICONS.bars} color="purple" label="Top Product" value={topProductLabel} valueStyle={COMPACT_VALUE_STYLE} />
      </section>

      <ReturnCharts view={view} />

      <section className="card">
        <div className="card-hd" style={CARD_HD_STYLE}>
          <h3>Return Requests</h3>
          <div style={CONTROLS_STYLE}>
            <div className="chart-tabs" id="returnsFilters">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.value}
                  className={`chart-tab${filter === tab.value ? ' active' : ''}`}
                  type="button"
                  data-filter={tab.value}
                  onClick={() => setFilter(tab.value)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <FilterSelect id="returnsSortSelect" value={sortKey} onChange={setSortKey} options={SORT_OPTIONS} />
          </div>
        </div>
        <div className="card-bd">
          <DataTable
            columns={COLUMNS}
            rows={visibleRows}
            tbodyId="returnsTableBody"
            emptyMessage="No return requests found."
            renderRow={(r, i) => (
              <ReturnRow
                key={`${r.id}-${i}`}
                item={r}
                canManage={canManage}
                onEdit={editReturn}
                onRefund={refundReturn}
                onReject={rejectReturn}
              />
            )}
          />
        </div>
      </section>
    </>
  );
}

export default function ReturnsPage() {
  return (
    <DashboardLayout page="returns">
      <ReturnsContent />
    </DashboardLayout>
  );
}
