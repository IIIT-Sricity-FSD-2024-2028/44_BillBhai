import { useState } from 'react';
import PageHeader from '../common/PageHeader.jsx';
import StatCard from '../common/StatCard.jsx';
import FilterToolbar from '../common/FilterToolbar.jsx';
import DataTable from '../common/DataTable.jsx';
import Badge from '../common/Badge.jsx';

const ICONS = {
  mrr: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1v22" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  businesses: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 21h18" /><rect x="4" y="3" width="7" height="14" rx="1" /><rect x="13" y="7" width="7" height="10" rx="1" /></svg>,
  active: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  pending: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>,
};

const SORT_OPTIONS = [
  { value: 'payment_due', label: 'Payment due' },
  { value: 'profit', label: 'Profit' },
  { value: 'stores', label: 'Stores' },
  { value: 'tenure', label: 'Tenure' },
];

const COLUMNS = ['Business ID', 'Business Name', 'Plan Tier', 'Stores', 'Profit', 'Payment Due', 'Status', 'Actions'];

const NAME_BTN_STYLE = { padding: '2px 8px', fontSize: '0.75rem' };
const ROW_BTN_STYLE = { padding: '4px 8px', fontSize: '0.75rem', marginRight: '4px' };
const ROW_DELETE_STYLE = { padding: '4px 8px', fontSize: '0.75rem', color: 'var(--red)', borderColor: 'var(--red)' };

const planLabelOf = (item) => String((item && (item.productsPlan || item.type)) || 'Unknown').trim() || 'Unknown';
const statusLabelOf = (item) => String((item && item.status) || 'Unknown').trim() || 'Unknown';
const num = (v) => Math.max(0, Number(v || 0));

const SORTERS = {
  profit: (a, b) => num(b.profit) - num(a.profit),
  stores: (a, b) => num(b.storesCount) - num(a.storesCount),
  tenure: (a, b) => num(b.tenureMonths) - num(a.tenureMonths),
  payment_due: (a, b) => num(b.paymentDue) - num(a.paymentDue),
};

/** Port of renderBusinesses(). Filters/sort live in state; rows are derived. */
export default function BusinessesList({ businesses, canManage, actions }) {
  const [status, setStatus] = useState('all');
  const [plan, setPlan] = useState('all');
  const [sortKey, setSortKey] = useState('payment_due');

  const paymentDueTotal = businesses.reduce((sum, b) => sum + Number(b.paymentDue || 0), 0);
  const activeCount = businesses.filter((b) => b.status === 'Active').length;
  const totalMrr = businesses.reduce((sum, b) => {
    const rawPlan = String(b.plan || b.productsPlan || '').toLowerCase();
    const price = rawPlan.includes('enterprise') ? 4999 : (rawPlan.includes('starter') ? 799 : 1999);
    return sum + (b.status === 'Active' ? price : 0);
  }, 0);
  const statusOptions = Array.from(new Set(businesses.map(statusLabelOf))).sort();
  const planOptions = Array.from(new Set(businesses.map(planLabelOf))).sort();

  const visibleRows = businesses
    .filter((item) => {
      if (status !== 'all' && String(item.status || '').trim() !== status) return false;
      if (plan !== 'all' && planLabelOf(item) !== plan) return false;
      return true;
    })
    .slice()
    .sort(SORTERS[sortKey] || SORTERS.payment_due);

  return (
    <>
      <PageHeader
        title="Businesses & SaaS Revenue"
        actions={canManage ? <button className="btn btn-primary" data-action="businesses" onClick={actions.addBusiness}>+ Add Business</button> : null}
      />
      <section className="stats-grid">
        <StatCard icon={ICONS.mrr} label="SaaS MRR (Active Plans)" value={`₹${totalMrr.toLocaleString()}`} color="green" />
        <StatCard icon={ICONS.businesses} label="Total Businesses" value={businesses.length} color="blue" />
        <StatCard icon={ICONS.active} label="Active Stores" value={activeCount} color="amber" />
        <StatCard icon={ICONS.pending} label="Pending Payments" value={`₹${paymentDueTotal.toLocaleString()}`} color="red" />
      </section>
      <section className="card" style={{ marginBottom: '14px' }}>
        <FilterToolbar filters={[
          { id: 'businessStatusFilter', label: 'Status', value: status, onChange: setStatus, options: [{ value: 'all', label: 'All statuses' }, ...statusOptions] },
          { id: 'businessPlanFilter', label: 'Plan / Tier', value: plan, onChange: setPlan, options: [{ value: 'all', label: 'All plans' }, ...planOptions] },
          { id: 'businessSortSelect', label: 'Sort by', value: sortKey, onChange: setSortKey, options: SORT_OPTIONS },
        ]} />
      </section>
      <section className="card">
        <div className="card-hd"><h3>All Client Businesses & Subscriptions</h3></div>
        <div className="card-bd">
          <DataTable
            columns={COLUMNS}
            rows={visibleRows}
            tbodyId="businessesTableBodyDyn"
            emptyMessage="No businesses match the selected filters."
            renderRow={(item) => (
              <tr key={item.id}>
                <td className="cell-main">{item.id}</td>
                <td>{canManage && <button className="btn btn-outline" data-action="businesses" style={NAME_BTN_STYLE} onClick={() => actions.openBusinessDetails(item.id)}>{item.name}</button>}</td>
                <td>{item.tenureMonths} months</td>
                <td>{item.storesCount}</td>
                <td>Rs {Number(item.profit || 0).toLocaleString()}</td>
                <td>Rs {Number(item.paymentDue || 0).toLocaleString()}</td>
                <td><Badge status={item.status} /></td>
                <td>
                  {canManage && <button className="btn btn-outline" data-action="businesses" style={ROW_BTN_STYLE} onClick={() => actions.openBusinessAdminDashboard(item.id)}>View</button>}
                  {canManage && <button className="btn btn-outline" data-action="businesses" style={ROW_BTN_STYLE} onClick={() => actions.editBusiness(item.id)}>Edit</button>}
                  {canManage && <button className="btn btn-outline" data-action="businesses" style={ROW_DELETE_STYLE} onClick={() => actions.deleteBusiness(item.id)}>Delete</button>}
                </td>
              </tr>
            )}
          />
        </div>
      </section>
    </>
  );
}
