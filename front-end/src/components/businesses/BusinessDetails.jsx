import { useEffect, useState } from 'react';
import PageHeader from '../common/PageHeader.jsx';
import DataTable from '../common/DataTable.jsx';
import Badge from '../common/Badge.jsx';
import { api } from '../../lib/http.js';
import { PLAN_LABEL, planOf, rupees, statusType } from './BusinessesList.jsx';

const ROW_BTN_STYLE = { padding: '4px 8px', fontSize: '0.75rem', marginRight: '4px' };
const ROW_DELETE_STYLE = { ...ROW_BTN_STYLE, color: 'var(--red)', borderColor: 'var(--red)' };
const HEADER_DELETE_STYLE = { color: 'var(--red)', borderColor: 'var(--red)' };
const CARD_HD_STYLE = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' };
const CARD_ADD_STYLE = { padding: '4px 10px' };
const GRID_STYLE = { marginTop: '12px' };
const PROFILE_STYLE = { display: 'flex', flexDirection: 'column', gap: '8px' };

function PlainStat({ label, value, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-info">
        <span className="stat-label">{label}</span>
        <span className="stat-value">{value}</span>
        {sub && <span className="text-sm text-muted">{sub}</span>}
      </div>
    </div>
  );
}

function ListCard({ title, addLabel, onAdd, canManage, columns, items, emptyMessage, cells, onEdit, onDelete }) {
  return (
    <div className="card">
      <div className="card-hd" style={CARD_HD_STYLE}>
        <h3>{title}</h3>
        {canManage && (
          <button className="btn btn-outline" data-action="businesses" style={CARD_ADD_STYLE} onClick={onAdd}>
            {addLabel}
          </button>
        )}
      </div>
      <div className="card-bd">
        <DataTable
          columns={columns}
          rows={items}
          emptyMessage={emptyMessage}
          renderRow={(item, idx) => {
            const [main, second, status] = cells(item);
            return (
              <tr key={idx}>
                <td className="cell-main">{main}</td>
                <td>{second}</td>
                <td>
                  <Badge status={status} />
                </td>
                <td>
                  {canManage && (
                    <button className="btn btn-outline" style={ROW_BTN_STYLE} onClick={() => onEdit(idx)}>
                      Edit
                    </button>
                  )}
                  {canManage && (
                    <button className="btn btn-outline" style={ROW_DELETE_STYLE} onClick={() => onDelete(idx)}>
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            );
          }}
        />
      </div>
    </div>
  );
}

function when(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * One business: profile, subscription, real staff accounts (managed on the
 * Users page of that business), stores, billing history and change log.
 */
export default function BusinessDetails({ company: c, staff, canManage, actions }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    let alive = true;
    api('/activity', { query: { companyId: c.id, entity: 'company', entityId: c.id, limit: 20 } })
      .then((rows) => alive && setHistory(Array.isArray(rows) ? rows : []))
      .catch(() => alive && setHistory([]));
    return () => {
      alive = false;
    };
  }, [c.id, c.version]);

  const staffOnly = staff.filter((u) => u.roleKey !== 'customer');
  const subActive = String(c.subscriptionStatus || 'Active') === 'Active';

  return (
    <>
      <PageHeader
        title={c.name}
        actions={
          <>
            <button className="btn btn-outline" onClick={actions.backToList}>
              Back
            </button>
            <button className="btn btn-outline" onClick={() => actions.openBusiness(c.id)}>
              Open dashboard
            </button>
            {canManage && (
              <>
                <button className="btn btn-outline" data-action="businesses" onClick={() => actions.editBusiness(c.id)}>
                  Edit
                </button>
                {c.status === 'Active' ? (
                  <button className="btn btn-outline" data-action="businesses" onClick={() => actions.setStatus(c.id, 'Paused')}>
                    Pause
                  </button>
                ) : (
                  <button className="btn btn-outline" data-action="businesses" onClick={() => actions.setStatus(c.id, 'Active')}>
                    Resume
                  </button>
                )}
                <button className="btn btn-outline" data-action="businesses" style={HEADER_DELETE_STYLE} onClick={() => actions.deleteBusiness(c.id)}>
                  Delete
                </button>
              </>
            )}
          </>
        }
      />
      <section className="stats-grid">
        <PlainStat label="Plan" value={PLAN_LABEL[planOf(c)]} sub={`${rupees(c.monthlyPrice)}/month`} />
        <PlainStat label="Subscription" value={c.subscriptionStatus || 'Active'} sub={c.renewalDate ? `Renews ${c.renewalDate}` : 'No renewal date'} />
        <PlainStat label="Profit (from sales)" value={rupees(c.profit)} />
        <PlainStat label="Payment due" value={rupees(c.paymentDue)} />
      </section>
      <section className="grid-2" style={GRID_STYLE}>
        <div className="card">
          <div className="card-hd" style={CARD_HD_STYLE}>
            <h3>Business profile</h3>
            {canManage && (
              <span>
                <button className="btn btn-outline" style={CARD_ADD_STYLE} onClick={() => actions.changePlan(c.id)}>
                  Change plan
                </button>{' '}
                {subActive && (
                  <button className="btn btn-outline" style={{ ...CARD_ADD_STYLE, ...HEADER_DELETE_STYLE }} onClick={() => actions.cancelSubscription(c.id)}>
                    Cancel subscription
                  </button>
                )}
              </span>
            )}
          </div>
          <div className="card-bd">
            <div className="text-muted" style={PROFILE_STYLE}>
              <div><strong>ID:</strong> {c.id}</div>
              <div><strong>Owner:</strong> {c.owner || '—'}</div>
              <div><strong>Admin:</strong> {c.adminName || '—'}</div>
              <div><strong>Type:</strong> {c.type || '—'}</div>
              <div><strong>Email:</strong> {c.email}</div>
              <div><strong>Phone:</strong> {c.phone}</div>
              <div><strong>GSTIN:</strong> {c.gstNo || 'Not given'}</div>
              <div><strong>Address:</strong> {c.address || '—'}</div>
              <div><strong>Months on BillBhai:</strong> {Number(c.tenureMonths || 0)}</div>
              <div>
                <strong>Status:</strong> <Badge status={c.status} type={statusType(c.status)} />
                {c.status !== 'Active' && <span className="text-sm"> Staff cannot sign in.</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-hd" style={CARD_HD_STYLE}>
            <h3>Staff accounts ({staffOnly.length})</h3>
            <button className="btn btn-outline" style={CARD_ADD_STYLE} onClick={() => actions.openBusiness(c.id, '/users')}>
              Manage users
            </button>
          </div>
          <div className="card-bd">
            <DataTable
              columns={['Name', 'Username', 'Role', 'Status']}
              rows={staffOnly}
              emptyMessage="No staff accounts yet. Use Manage users to add the admin."
              renderRow={(u) => (
                <tr key={u.id}>
                  <td className="cell-main">{u.name}</td>
                  <td>{u.username}</td>
                  <td>{u.role}</td>
                  <td>
                    <Badge status={u.status} type={u.status === 'Active' ? 'active' : 'cancelled'} />
                  </td>
                </tr>
              )}
            />
          </div>
        </div>
      </section>
      <section className="grid-2" style={GRID_STYLE}>
        <ListCard
          title="Store locations"
          addLabel="+ Add store"
          onAdd={() => actions.addStore(c.id)}
          canManage={canManage}
          columns={['Store code', 'City', 'Status', 'Actions']}
          items={Array.isArray(c.stores) ? c.stores : []}
          emptyMessage="No stores recorded."
          cells={(s) => [s.code, s.city, s.status]}
          onEdit={(i) => actions.editStore(c.id, i)}
          onDelete={(i) => actions.deleteStore(c.id, i)}
        />
        <ListCard
          title="Subscription payments"
          addLabel="+ Add payment"
          onAdd={() => actions.addPayment(c.id)}
          canManage={canManage}
          columns={['Month', 'Amount', 'Status', 'Actions']}
          items={Array.isArray(c.payments) ? c.payments : []}
          emptyMessage="No payments recorded."
          cells={(p) => [p.month, rupees(p.amount), p.status]}
          onEdit={(i) => actions.editPayment(c.id, i)}
          onDelete={(i) => actions.deletePayment(c.id, i)}
        />
      </section>
      <section className="card" style={GRID_STYLE}>
        <div className="card-hd">
          <h3>Change history</h3>
        </div>
        <div className="card-bd">
          {!history.length && <p className="text-muted">No changes recorded.</p>}
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.85rem' }}>
            {history.map((h) => (
              <li key={h.id} style={{ marginBottom: '4px' }}>
                <span className="text-muted">{when(h.at)}</span> · <strong>{h.by}</strong>: {h.summary}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
