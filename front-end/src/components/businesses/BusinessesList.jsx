import { useState } from 'react';
import PageHeader from '../common/PageHeader.jsx';
import StatCard from '../common/StatCard.jsx';
import FilterToolbar from '../common/FilterToolbar.jsx';
import DataTable from '../common/DataTable.jsx';
import Badge from '../common/Badge.jsx';
import { ICONS } from './businessIcons.jsx';
import { formatCurrency } from '../../lib/currency.js';

const num = (v) => Number(v) || 0;

const SORT_OPTIONS = [
  { value: 'name', label: 'Name A-Z' },
  { value: 'payment_due', label: 'Payment due' },
  { value: 'profit', label: 'Profit' },
  { value: 'renewal', label: 'Renewal date' },
  { value: 'staff', label: 'Staff accounts' },
];

const COLUMNS = ['Business', 'Plan', 'Subscription', 'Staff', 'Stores', 'Profit', 'Payment due', 'Status', 'Actions'];

const ROW_BTN_STYLE = { padding: '4px 8px', fontSize: '0.75rem', marginRight: '4px', marginBottom: '2px' };

const ROW_DELETE_STYLE = { ...ROW_BTN_STYLE, color: 'var(--red)', borderColor: 'var(--red)' };
export const PLAN_LABEL = { starter: 'Starter', pro: 'Growth / Pro', enterprise: 'Enterprise' };

export const rupees = (v) => formatCurrency(v);

/** 2026-12-08 becomes 8 Dec 2026. */
const renewalLabel = (value) => {
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
export const planOf = (c) => {
  const raw = String(c.plan || c.productsPlan || '').toLowerCase();
  if (raw.includes('enterprise')) return 'enterprise';
  if (raw.includes('starter') || raw.includes('free')) return 'starter';
  return 'pro';
};
const billable = (c) => c.status === 'Active' && String(c.subscriptionStatus || 'Active') === 'Active';
export const statusType = (s) => (s === 'Active' ? 'active' : s === 'Paused' ? 'pending' : 'cancelled');

/** All client businesses with their subscription and money position. */
export default function BusinessesList({ companies, users, loading, canManage, actions }) {
  const [status, setStatus] = useState('all');
  const [plan, setPlan] = useState('all');
  const [subscription, setSubscription] = useState('all');
  const [sortKey, setSortKey] = useState('name');
  const [search, setSearch] = useState('');

  const staffCount = (id) =>
    users.filter((u) => u.companyId === id && u.roleKey !== 'customer' && u.roleKey !== 'superuser').length;
  // Starter is free, so it adds ₹0; cancelled or paused businesses add nothing.
  const mrr = companies.filter(billable).reduce((sum, c) => sum + num(c.monthlyPrice), 0);
  const dueTotal = companies.reduce((sum, c) => sum + num(c.paymentDue), 0);
  const activeCount = companies.filter((c) => c.status === 'Active').length;
  const staffTotal = companies.reduce((sum, c) => sum + staffCount(c.id), 0);

  const sorters = {
    name: (a, b) => a.name.localeCompare(b.name),
    payment_due: (a, b) => num(b.paymentDue) - num(a.paymentDue),
    profit: (a, b) => num(b.profit) - num(a.profit),
    renewal: (a, b) => String(a.renewalDate || '9999').localeCompare(String(b.renewalDate || '9999')),
    staff: (a, b) => staffCount(b.id) - staffCount(a.id),
  };
  const needle = search.trim().toLowerCase();
  const rows = companies
    .filter((c) => status === 'all' || c.status === status)
    .filter((c) => plan === 'all' || planOf(c) === plan)
    .filter((c) => subscription === 'all' || String(c.subscriptionStatus || 'Active') === subscription)
    .filter(
      (c) =>
        !needle ||
        [c.id, c.name, c.owner, c.email, c.phone, c.gstNo].some((v) => String(v || '').toLowerCase().includes(needle)),
    )
    .sort(sorters[sortKey] || sorters.name);

  return (
    <>
      <PageHeader
        title="Businesses & SaaS Revenue"
        actions={
          canManage ? (
            <button className="btn btn-primary" data-action="businesses" onClick={actions.addBusiness}>
              + Add Business
            </button>
          ) : null
        }
      />
      <section className="stats-grid">
        <StatCard icon={ICONS.mrr} label="Monthly recurring revenue" value={rupees(mrr)} color="green" />
        <StatCard icon={ICONS.businesses} label="Active businesses" value={`${activeCount} of ${companies.length}`} color="blue" />
        <StatCard icon={ICONS.active} label="Staff accounts" value={staffTotal} color="amber" />
        <StatCard icon={ICONS.pending} label="Payments due" value={rupees(dueTotal)} color="red" />
      </section>
      <section className="card" style={{ marginBottom: '14px' }}>
        <FilterToolbar
          filters={[
            {
              id: 'businessStatusFilter',
              label: 'Status',
              value: status,
              onChange: setStatus,
              options: [{ value: 'all', label: 'All statuses' }, 'Active', 'Paused', 'Suspended'],
            },
            {
              id: 'businessPlanFilter',
              label: 'Plan',
              value: plan,
              onChange: setPlan,
              options: [
                { value: 'all', label: 'All plans' },
                { value: 'starter', label: 'Starter' },
                { value: 'pro', label: 'Growth / Pro' },
                { value: 'enterprise', label: 'Enterprise' },
              ],
            },
            {
              id: 'businessSubFilter',
              label: 'Subscription',
              value: subscription,
              onChange: setSubscription,
              options: [{ value: 'all', label: 'Any' }, 'Active', 'Cancelled', 'Past Due'],
            },
            { id: 'businessSortSelect', label: 'Sort by', value: sortKey, onChange: setSortKey, options: SORT_OPTIONS },
          ]}
        >
          <div className="toolbar-group">
            <label className="toolbar-label" htmlFor="businessSearch">
              Search
            </label>
            <input
              id="businessSearch"
              className="form-control"
              placeholder="Name, owner, email, GSTIN"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </FilterToolbar>
      </section>
      <section className="card">
        <div className="card-hd">
          <h3>Client businesses and subscriptions</h3>
        </div>
        <div className="card-bd">
          <DataTable
            columns={COLUMNS}
            rows={rows}
            tbodyId="businessesTableBodyDyn"
            emptyMessage={loading ? 'Loading businesses…' : 'No businesses match the selected filters.'}
            renderRow={(c) => (
              <tr key={c.id}>
                <td className="cell-main">
                  {c.name}
                  <div className="text-sm text-muted">
                    {c.id} · {c.owner || '—'}
                  </div>
                </td>
                <td>{PLAN_LABEL[planOf(c)]}</td>
                <td>
                  <Badge
                    status={c.subscriptionStatus || 'Active'}
                    type={(c.subscriptionStatus || 'Active') === 'Active' ? 'active' : 'cancelled'}
                  />
                  <div className="text-sm text-muted">
                    {rupees(c.monthlyPrice)}/mo{c.renewalDate ? ` · renews ${renewalLabel(c.renewalDate)}` : ''}
                  </div>
                </td>
                <td>{staffCount(c.id)}</td>
                <td>{num(c.storesCount)}</td>
                <td>{rupees(c.profit)}</td>
                <td>{rupees(c.paymentDue)}</td>
                <td>
                  <Badge status={c.status} type={statusType(c.status)} />
                </td>
                <td>
                  <div className="row-actions">
                  <button className="btn btn-outline" style={ROW_BTN_STYLE} onClick={() => actions.openBusinessDetails(c.id)}>
                    Details
                  </button>
                  <button className="btn btn-outline" style={ROW_BTN_STYLE} onClick={() => actions.openBusiness(c.id)}>
                    Open dashboard
                  </button>
                  {canManage && (
                    <button
                      className="btn btn-outline"
                      data-action="businesses"
                      style={ROW_BTN_STYLE}
                      onClick={() => actions.editBusiness(c.id)}
                    >
                      Edit
                    </button>
                  )}
                  {canManage && (
                    <button
                      className="btn btn-outline"
                      data-action="businesses"
                      style={ROW_DELETE_STYLE}
                      onClick={() => actions.deleteBusiness(c.id)}
                    >
                      Delete
                    </button>
                  )}
                  </div>
                </td>
              </tr>
            )}
          />
        </div>
      </section>
    </>
  );
}
