import { useMemo, useState } from 'react';
import DashboardLayout from '../components/dashboard/DashboardLayout.jsx';
import PageHeader from '../components/common/PageHeader.jsx';
import DataTable from '../components/common/DataTable.jsx';
import { FilterSelect } from '../components/common/FilterToolbar.jsx';
import ReturnCharts from '../components/returns/ReturnCharts.jsx';
import ReturnRow from '../components/returns/ReturnRow.jsx';
import ReturnStatCard from '../components/returns/ReturnStatCard.jsx';
import RaiseReturnModal from '../components/returns/RaiseReturnModal.jsx';
import ReturnActionModal from '../components/returns/ReturnActionModal.jsx';
import ReturnDetailModal from '../components/returns/ReturnDetailModal.jsx';
import { COMPACT_VALUE_STYLE, RETURN_ICONS } from '../components/returns/returnIcons.jsx';
import {
  classifyReturnStatus,
  getReturnProductCounts,
  returnRaisedAt,
  rupees,
  summarizeReturns,
} from '../components/returns/returnStats.js';
import useReturnActions from '../components/returns/useReturnActions.js';
import { useDashboard } from '../lib/dashboard/hooks.js';

const STATUS_TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'exchanged', label: 'Exchanged' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];

const SORT_OPTIONS = [
  { value: 'new', label: 'Newest first' },
  { value: 'old', label: 'Oldest first' },
  { value: 'amount_high', label: 'Refund high-low' },
  { value: 'amount_low', label: 'Refund low-high' },
  { value: 'qty_high', label: 'Qty high-low' },
];

const COLUMNS = ['Return', 'Order', 'Customer', 'Items', 'Reason', 'Refund', 'Status', 'Age', 'Actions'];

const CARD_HD_STYLE = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' };
const CONTROLS_STYLE = { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' };
const TOOLBAR_STYLE = { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end', padding: '12px 16px', borderBottom: '1px solid var(--border, rgba(0,0,0,0.08))' };
const FIELD_STYLE = { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem' };

function istDay(ms) {
  return new Date(ms + 330 * 60000).toISOString().slice(0, 10);
}

function sorter(sortKey) {
  const num = (v) => Math.max(0, Number(v || 0));
  return (a, b) => {
    if (sortKey === 'old') return returnRaisedAt(a) - returnRaisedAt(b);
    if (sortKey === 'amount_high') return num(b.amount) - num(a.amount);
    if (sortKey === 'amount_low') return num(a.amount) - num(b.amount);
    if (sortKey === 'qty_high') return num(b.qty) - num(a.qty);
    return returnRaisedAt(b) - returnRaisedAt(a);
  };
}

function ReturnsContent() {
  const { returns, orders, refreshData, showToast } = useDashboard();
  const { canManage, transition, approve, withdraw } = useReturnActions();
  const [tab, setTab] = useState('pending');
  const [sortKey, setSortKey] = useState('new');
  const [search, setSearch] = useState('');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [raiseOpen, setRaiseOpen] = useState(false);
  const [action, setAction] = useState(null);
  const [detail, setDetail] = useState(null);

  const counts = summarizeReturns(returns);
  const topProduct = getReturnProductCounts(returns)[0] || null;
  const reasons = useMemo(() => [...new Set(returns.map((r) => r.reason).filter(Boolean))].sort(), [returns]);

  const weekAgo = Date.now() - 7 * 86400000;
  const refundedThisWeek = returns
    .filter((r) => r.status === 'Refunded' && r.resolvedAt && new Date(r.resolvedAt).getTime() >= weekAgo)
    .reduce((s, r) => s + Number(r.amount || 0), 0);

  // Orders a return can be raised on: handed over and paid, last 30 days.
  const recentOrders = useMemo(() => {
    const cutoff = Date.now() - 30 * 86400000;
    return orders
      .filter((o) => ['Delivered', 'Partially Returned'].includes(o.status) && o.paymentStatus !== 'Pending')
      .filter((o) => new Date(o.orderDate).getTime() >= cutoff)
      .sort((a, b) => String(b.orderDate).localeCompare(String(a.orderDate)))
      .slice(0, 40);
  }, [orders]);

  const needle = search.trim().toLowerCase();
  const visible = returns
    .filter((r) => tab === 'all' || classifyReturnStatus(r.status) === tab)
    .filter((r) => reasonFilter === 'all' || r.reason === reasonFilter)
    .filter((r) => typeFilter === 'all' || r.returnType === typeFilter)
    .filter((r) => {
      if (!from && !to) return true;
      const at = returnRaisedAt(r);
      if (!at) return false;
      const day = istDay(at);
      return (!from || day >= from) && (!to || day <= to);
    })
    .filter((r) => {
      if (!needle) return true;
      return [r.id, r.orderId, r.customer, r.customerPhone, r.product, r.requestedBy]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    })
    .sort(sorter(sortKey));

  const tabCount = (value) => (value === 'all' ? counts.total : counts[value] || 0);
  const filtersActive = needle || reasonFilter !== 'all' || typeFilter !== 'all' || from || to;

  return (
    <>
      <PageHeader
        title="Returns"
        actions={
          <>
            {canManage && (
              <button className="btn btn-primary" id="raiseReturnBtnDyn" onClick={() => setRaiseOpen(true)}>
                + Raise Return
              </button>
            )}
            <button className="btn btn-outline" onClick={() => window.print()}>
              Print
            </button>
          </>
        }
      />

      <section className="stats-grid">
        <ReturnStatCard icon={RETURN_ICONS.clock} color="amber" label="Waiting for a decision" value={counts.pending + counts.approved} sub={`Pending ${counts.pending} • Approved ${counts.approved}`} />
        <ReturnStatCard icon={RETURN_ICONS.money} color="green" label="Refunded this week" value={rupees(Math.round(refundedThisWeek))} sub={`Still to refund ${rupees(Math.round(counts.valueAtRisk))}`} />
        <ReturnStatCard icon={RETURN_ICONS.returns} color="red" label="All requests" value={counts.total} sub={`Exchanged ${counts.exchanged} • Rejected ${counts.rejected}`} />
        <ReturnStatCard icon={RETURN_ICONS.bars} color="purple" label="Most returned" value={topProduct ? topProduct[0] : '—'} valueStyle={COMPACT_VALUE_STYLE} sub={topProduct ? `${topProduct[1]} units` : 'No returns yet'} />
      </section>

      <ReturnCharts view={returns} />

      <section className="card">
        <div className="card-hd" style={CARD_HD_STYLE}>
          <h3>Return Requests</h3>
          <div style={CONTROLS_STYLE}>
            <div className="chart-tabs" id="returnsFilters">
              {STATUS_TABS.map((t) => (
                <button
                  key={t.value}
                  className={`chart-tab${tab === t.value ? ' active' : ''}`}
                  type="button"
                  data-filter={t.value}
                  onClick={() => setTab(t.value)}
                >
                  {t.label} ({tabCount(t.value)})
                </button>
              ))}
            </div>
            <FilterSelect id="returnsSortSelect" value={sortKey} onChange={setSortKey} options={SORT_OPTIONS} />
          </div>
        </div>
        <div style={TOOLBAR_STYLE}>
          <label style={{ ...FIELD_STYLE, flex: '1 1 220px' }} htmlFor="returnsSearch">
            <span className="toolbar-label">Search</span>
            <input id="returnsSearch" className="form-control" placeholder="Order, customer or item" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <label style={FIELD_STYLE} htmlFor="returnsReasonFilter">
            <span className="toolbar-label">Reason</span>
            <select id="returnsReasonFilter" className="toolbar-select" value={reasonFilter} onChange={(e) => setReasonFilter(e.target.value)}>
              <option value="all">All reasons</option>
              {reasons.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          <label style={FIELD_STYLE} htmlFor="returnsTypeFilter">
            <span className="toolbar-label">Type</span>
            <select id="returnsTypeFilter" className="toolbar-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">Refund and exchange</option>
              <option value="refund">Refund</option>
              <option value="exchange">Exchange</option>
            </select>
          </label>
          <label style={FIELD_STYLE} htmlFor="returnsFrom">
            <span className="toolbar-label">Raised from</span>
            <input id="returnsFrom" type="date" className="form-control" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label style={FIELD_STYLE} htmlFor="returnsTo">
            <span className="toolbar-label">to</span>
            <input id="returnsTo" type="date" className="form-control" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          {filtersActive && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setSearch('');
                setReasonFilter('all');
                setTypeFilter('all');
                setFrom('');
                setTo('');
              }}
            >
              Clear filters
            </button>
          )}
        </div>
        <div className="card-bd">
          <DataTable
            columns={COLUMNS}
            rows={visible}
            tbodyId="returnsTableBody"
            emptyMessage={filtersActive ? 'No returns match these filters.' : 'No return requests here.'}
            renderRow={(r) => (
              <ReturnRow
                key={r.id}
                item={r}
                canManage={canManage}
                onView={setDetail}
                onApprove={approve}
                onAction={(item, status) => setAction({ item, status })}
                onWithdraw={withdraw}
              />
            )}
          />
        </div>
      </section>

      <RaiseReturnModal
        open={raiseOpen}
        recentOrders={recentOrders}
        onClose={() => setRaiseOpen(false)}
        onCreated={(created) => {
          setRaiseOpen(false);
          setTab('pending');
          refreshData();
          showToast(
            created.returnType === 'exchange'
              ? `Return ${created.id} raised for exchange`
              : `Return ${created.id} raised: refund ${rupees(created.refundAmount)} once approved`,
          );
        }}
      />
      {action && (
        <ReturnActionModal
          item={action.item}
          action={action.status}
          onClose={() => setAction(null)}
          onSubmit={async (item, body) => {
            await transition(item, body);
            setAction(null);
          }}
        />
      )}
      {detail && <ReturnDetailModal item={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

export default function ReturnsPage() {
  return (
    <DashboardLayout page="returns" toast="">
      <ReturnsContent />
    </DashboardLayout>
  );
}
