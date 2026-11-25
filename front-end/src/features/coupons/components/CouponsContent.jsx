import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../../shared/components/common/PageHeader.jsx';
import DataTable from '../../../shared/components/common/DataTable.jsx';
import Badge from '../../../shared/components/common/Badge.jsx';
import CouponFormModal from './CouponFormModal.jsx';
import CouponAnalytics from './CouponAnalytics.jsx';
import { useDashboard } from '../../../shared/lib/dashboard/hooks.js';
import {
  deleteCouponThunk,
  fetchCouponAnalyticsThunk,
  selectCouponAnalytics,
  selectCouponAnalyticsStatus,
  selectCouponsError,
  updateCouponThunk,
} from '../couponsSlice.js';
import { RANGE_PRESETS, rangePreset, rupees, scopedCompanyId, todayKey } from '../../orders/components/orderFormat.js';

const BTN = { padding: '4px 8px', fontSize: '0.75rem', marginRight: '4px' };
const SUB = { display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)' };

/** Where a coupon stands today, from its switch, dates and limit. */
export function couponState(c) {
  const today = todayKey();
  if (!c.active) return { label: 'Switched off', type: 'cancelled' };
  if (today < c.validFrom) return { label: 'Starts later', type: 'pending' };
  if (today > c.validTo) return { label: 'Expired', type: 'inactive' };
  if (c.usageLimit > 0 && (c.usedCount || 0) >= c.usageLimit) return { label: 'Used up', type: 'inactive' };
  return { label: 'Live', type: 'active' };
}

function describe(c) {
  const off = c.type === 'percent' ? `${c.value}% off` : `${rupees(c.value)} off`;
  const parts = [off];
  if (c.minOrder > 0) parts.push(`bill ≥ ${rupees(c.minOrder)}`);
  if (c.type === 'percent' && c.maxDiscount > 0) parts.push(`max ${rupees(c.maxDiscount)}`);
  return parts.join(', ');
}

/** 2026-10-19 as 19 Oct 2026. */
function shortDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function CouponsContent() {
  const dispatch = useDispatch();
  const { coupons, state, lastSyncedAt, openConfirm, showToast, showMutationError, refreshData } = useDashboard();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(undefined);
  const [rangeKey, setRangeKey] = useState('30d');
  const [range, setRange] = useState(() => rangePreset('30d'));
  const analytics = useSelector(selectCouponAnalytics);
  const analyticsStatus = useSelector(selectCouponAnalyticsStatus);
  const loading = analyticsStatus === 'loading';
  const error = useSelector(selectCouponsError) || '';
  const companyId = scopedCompanyId(state);

  useEffect(() => {
    dispatch(
      fetchCouponAnalyticsThunk({
        companyId,
        from: range.from || undefined,
        to: range.to || undefined,
      }),
    );
  }, [dispatch, companyId, range.from, range.to, lastSyncedAt]);

  const pickPreset = (key) => {
    setRangeKey(key);
    if (key !== 'custom') setRange(key === 'all' ? { from: '', to: '' } : rangePreset(key));
  };

  const switchOff = (c) => {
    const used = Number(c.usedCount) || 0;
    openConfirm({
      title: used ? `Switch off ${c.code}` : `Delete ${c.code}`,
      message: used
        ? `${c.code} is on ${used} bill(s), so it is kept for the records and switched off. The till will stop accepting it.`
        : `Delete ${c.code}? It has never been used.`,
      confirmLabel: used ? 'Switch off' : 'Delete',
      onConfirm: async () => {
        try {
          const { response } = await dispatch(deleteCouponThunk(c.id)).unwrap();
          showToast(response && response.message ? response.message : 'Done');
        } catch (err) {
          showMutationError('Coupon', err);
          return false;
        }
        await refreshData();
        dispatch(
          fetchCouponAnalyticsThunk({
            companyId,
            from: range.from || undefined,
            to: range.to || undefined,
          }),
        );
        return true;
      },
    });
  };

  const switchOn = async (c) => {
    try {
      await dispatch(updateCouponThunk({ id: c.id, body: { active: true, version: c.version } })).unwrap();
      showToast(`${c.code} switched on`);
      await refreshData();
      dispatch(
        fetchCouponAnalyticsThunk({
          companyId,
          from: range.from || undefined,
          to: range.to || undefined,
        }),
      );
    } catch (err) {
      showMutationError('Coupon', err);
    }
  };

  const sorted = [...coupons].sort((a, b) => (b.usedCount || 0) - (a.usedCount || 0) || a.code.localeCompare(b.code));

  return (
    <>
      <PageHeader
        title="Coupons"
        actions={
          <button className="btn btn-primary" onClick={() => setEditing(null)}>
            + New coupon
          </button>
        }
      />
      <section className="card" style={{ marginBottom: '14px' }}>
        <div className="card-bd">
          <DataTable
            columns={['Code', 'Offer', 'Valid', 'Used', 'Status', 'Actions']}
            rows={sorted}
            emptyMessage="No coupons yet. Create one to offer discounts at the till."
            renderRow={(c) => {
              const s = couponState(c);
              return (
                <tr key={c.id}>
                  <td className="cell-main">
                    {c.code}
                    {c.description && <span style={SUB}>{c.description}</span>}
                  </td>
                  <td>{describe(c)}</td>
                  <td>
                    <span className="nowrap">{shortDate(c.validFrom)}</span> to{' '}
                    <span className="nowrap">{shortDate(c.validTo)}</span>
                  </td>
                  <td>
                    {c.usedCount || 0}
                    {c.usageLimit > 0 ? ` of ${c.usageLimit}` : ''}
                    {c.perCustomerLimit > 0 && <span style={SUB}>max {c.perCustomerLimit} per customer</span>}
                  </td>
                  <td>
                    <Badge status={s.label} type={s.type} />
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn-outline" style={BTN} onClick={() => setEditing(c)}>
                      Edit
                    </button>
                    <button className="btn btn-outline" style={BTN} disabled={!c.usedCount} onClick={() => navigate(`/orders?coupon=${encodeURIComponent(c.code)}`)}>
                      Orders
                    </button>
                    {c.active ? (
                      <button className="btn btn-outline" style={{ ...BTN, color: 'var(--red)', borderColor: 'var(--red)' }} onClick={() => switchOff(c)}>
                        {c.usedCount ? 'Switch off' : 'Delete'}
                      </button>
                    ) : (
                      <button className="btn btn-outline" style={BTN} onClick={() => switchOn(c)}>
                        Switch on
                      </button>
                    )}
                  </td>
                </tr>
              );
            }}
          />
        </div>
      </section>

      <section className="card" style={{ marginBottom: '14px' }}>
        <div className="card-bd table-toolbar">
          <div className="toolbar-group">
            <label className="toolbar-label" htmlFor="cpRange">
              Analytics period
            </label>
            <select id="cpRange" className="toolbar-select" value={rangeKey} onChange={(e) => pickPreset(e.target.value)}>
              {RANGE_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
              <option value="all">All time</option>
              <option value="custom">Custom dates</option>
            </select>
          </div>
          {rangeKey === 'custom' && (
            <>
              <div className="toolbar-group">
                <label className="toolbar-label" htmlFor="cpFrom">
                  From
                </label>
                <input id="cpFrom" type="date" className="toolbar-select" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
              </div>
              <div className="toolbar-group">
                <label className="toolbar-label" htmlFor="cpTo">
                  To
                </label>
                <input id="cpTo" type="date" className="toolbar-select" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
              </div>
            </>
          )}
        </div>
      </section>
      <CouponAnalytics data={analytics} loading={loading} error={error} />

      {editing !== undefined && <CouponFormModal coupon={editing} onClose={() => setEditing(undefined)} />}
    </>
  );
}
