import PageHeader from '../common/PageHeader.jsx';
import DataTable from '../common/DataTable.jsx';
import Badge from '../common/Badge.jsx';

const ROW_BTN_STYLE = { padding: '4px 8px', fontSize: '0.75rem', marginRight: '4px' };
const ROW_DELETE_STYLE = { padding: '4px 8px', fontSize: '0.75rem', color: 'var(--red)', borderColor: 'var(--red)' };
const HEADER_DELETE_STYLE = { color: 'var(--red)', borderColor: 'var(--red)' };
const CARD_HD_STYLE = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const CARD_ADD_STYLE = { padding: '4px 10px' };
const GRID_STYLE = { marginTop: '12px' };
const PROFILE_STYLE = { display: 'flex', flexDirection: 'column', gap: '8px' };

// Icon-less stat card used by renderBusinessDetails (StatCard always renders .stat-icon).
function PlainStat({ label, value }) {
  return <div className="stat-card"><div className="stat-info"><span className="stat-label">{label}</span><span className="stat-value">{value}</span></div></div>;
}

// Card with a header "+ Add ..." button and a 4-column table of nested items.
function NestedCard({ title, addLabel, onAdd, canManage, columns, items, emptyMessage, cells, onEdit, onDelete }) {
  return (
    <div className="card">
      <div className="card-hd" style={CARD_HD_STYLE}>
        <h3>{title}</h3>
        {canManage && <button className="btn btn-outline" data-action="businesses" style={CARD_ADD_STYLE} onClick={onAdd}>{addLabel}</button>}
      </div>
      <div className="card-bd">
        <DataTable
          columns={columns}
          rows={items}
          emptyMessage={emptyMessage}
          emptyColSpan={4}
          renderRow={(item, idx) => {
            const [main, second, status] = cells(item);
            return (
              <tr key={idx}>
                <td className="cell-main">{main}</td>
                <td>{second}</td>
                <td><Badge status={status} /></td>
                <td>
                  {canManage && <button className="btn btn-outline" data-action="businesses" style={ROW_BTN_STYLE} onClick={() => onEdit(idx)}>Edit</button>}
                  {canManage && <button className="btn btn-outline" data-action="businesses" style={ROW_DELETE_STYLE} onClick={() => onDelete(idx)}>Delete</button>}
                </td>
              </tr>
            );
          }}
        />
      </div>
    </div>
  );
}

/** Port of renderBusinessDetails(businessId). */
export default function BusinessDetails({ business: b, canManage, actions }) {
  return (
    <>
      <PageHeader
        title={b.name}
        actions={canManage ? (
          <>
            <button className="btn btn-outline" data-action="businesses" onClick={actions.renderBusinessesHome}>Back to Businesses</button>
            <button className="btn btn-outline" data-action="businesses" onClick={() => actions.editBusiness(b.id)}>Edit</button>
            <button className="btn btn-outline" data-action="businesses" style={HEADER_DELETE_STYLE} onClick={() => actions.deleteBusiness(b.id)}>Delete</button>
          </>
        ) : null}
      />
      <section className="stats-grid">
        <PlainStat label="Using BillBhai" value={`${b.tenureMonths} months`} />
        <PlainStat label="Stores" value={b.storesCount} />
        <PlainStat label="Profit" value={`₹${Number(b.profit || 0).toLocaleString()}`} />
        <PlainStat label="Payment Due" value={`₹${Number(b.paymentDue || 0).toLocaleString()}`} />
      </section>
      <section className="grid-2" style={GRID_STYLE}>
        <div className="card">
          <div className="card-hd"><h3>Business Profile</h3></div>
          <div className="card-bd">
            <div className="text-muted" style={PROFILE_STYLE}>
              <div><strong>Owner:</strong> {b.owner}</div>
              <div><strong>Admin:</strong> {b.adminName}</div>
              <div><strong>Type:</strong> {b.type}</div>
              <div><strong>Email:</strong> {b.email}</div>
              <div><strong>Phone:</strong> {b.phone}</div>
              <div><strong>Plan:</strong> {b.productsPlan}</div>
              <div><strong>Status:</strong> <Badge status={b.status} /></div>
            </div>
          </div>
        </div>
        <NestedCard
          title="Store Locations"
          addLabel="+ Add Store"
          onAdd={() => actions.addBusinessStore(b.id)}
          canManage={canManage}
          columns={['Store Code', 'City', 'Status', 'Actions']}
          items={b.stores || []}
          emptyMessage="No stores found."
          cells={(s) => [s.code, s.city, s.status]}
          onEdit={(idx) => actions.editBusinessStore(b.id, idx)}
          onDelete={(idx) => actions.deleteBusinessStore(b.id, idx)}
        />
      </section>
      <section className="grid-2" style={GRID_STYLE}>
        <NestedCard
          title="Business Users"
          addLabel="+ Add User"
          onAdd={() => actions.addBusinessUser(b.id)}
          canManage={canManage}
          columns={['Name', 'Role', 'Status', 'Actions']}
          items={b.users || []}
          emptyMessage="No users found."
          cells={(u) => [u.name, u.role, u.status]}
          onEdit={(idx) => actions.editBusinessUser(b.id, idx)}
          onDelete={(idx) => actions.deleteBusinessUser(b.id, idx)}
        />
        <NestedCard
          title="Payment History"
          addLabel="+ Add Payment"
          onAdd={() => actions.addBusinessPayment(b.id)}
          canManage={canManage}
          columns={['Month', 'Amount', 'Status', 'Actions']}
          items={b.payments || []}
          emptyMessage="No payments found."
          cells={(p) => [p.month, `₹${Number(p.amount || 0).toLocaleString()}`, p.status]}
          onEdit={(idx) => actions.editBusinessPayment(b.id, idx)}
          onDelete={(idx) => actions.deleteBusinessPayment(b.id, idx)}
        />
      </section>
    </>
  );
}
