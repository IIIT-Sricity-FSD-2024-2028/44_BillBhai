import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchDeliveriesThunk,
  selectAllDeliveries,
  selectDeliveriesUi,
  setDeliveryDashboardNotice,
  setDeliveryDashboardDetailId,
} from '../deliveriesSlice.js';
import PageHeader from '../../../shared/components/common/PageHeader.jsx';
import DataTable from '../../../shared/components/common/DataTable.jsx';
import { useDashboard } from '../../../shared/lib/dashboard/hooks.js';
import { mapDeliveryRow } from '../../../shared/lib/dashboard/api.js';
import { scopedCompanyId } from '../../orders/components/orderFormat.js';
import { DeliveryStatCards } from './DeliveryStats.jsx';
import DeliveryCharts from './DeliveryCharts.jsx';
import DeliveryRow from './DeliveryRow.jsx';
import DeliveryDetailModal from './DeliveryDetailModal.jsx';
import useDeliveryActions from './useDeliveryActions.jsx';
import { getDeliveryCounts, isOverdue, money } from './deliveryView.js';

const COLUMNS = ['Delivery', 'Customer', 'Items', 'Money', 'Partner', 'Status', 'Next step'];

/** Delivery desk start page: what needs doing now. */
export default function DeliveryOpsDashboard() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const reduxDeliveries = useSelector(selectAllDeliveries);
  const { dashboardNotice: notice, dashboardDetailId: detailId } = useSelector(selectDeliveriesUi);
  const { deliveries: dashDeliveries, scopedBusinessName, hasActionAccess, lastSyncedAt, state } = useDashboard();
  const companyId = scopedCompanyId(state);
  const deliveries = useMemo(
    () => (reduxDeliveries.length ? reduxDeliveries.map(mapDeliveryRow) : dashDeliveries),
    [reduxDeliveries, dashDeliveries],
  );
  const canManage = hasActionAccess('delivery');
  const actions = useDeliveryActions({
    onDone: (msg) => dispatch(setDeliveryDashboardNotice(msg)),
  });

  useEffect(() => {
    dispatch(fetchDeliveriesThunk({ companyId }));
  }, [dispatch, companyId, lastSyncedAt]);

  const counts = getDeliveryCounts(deliveries);
  // Late parcels first, then failed attempts, then parcels with no partner.
  const attention = deliveries
    .filter((d) => isOverdue(d) || d.status === 'Failed Attempt' || d.status === 'Pending')
    .sort((a, b) => {
      const score = (d) => (isOverdue(d) ? 0 : d.status === 'Failed Attempt' ? 1 : 2);
      return score(a) - score(b) || new Date(a.lastChangeAt || 0) - new Date(b.lastChangeAt || 0);
    })
    .slice(0, 12);
  const detail = detailId ? deliveries.find((d) => d.id === detailId) || null : null;
  const run = (kind, d) => {
    dispatch(setDeliveryDashboardDetailId(null));
    actions.start(kind, d);
  };

  return (
    <>
      <PageHeader
        title={`Delivery Dashboard${scopedBusinessName ? ` - ${scopedBusinessName}` : ''}`}
        actions={
          <>
            <button className="btn btn-primary" onClick={() => navigate('/delivery')}>
              Open Delivery
            </button>
            <button className="btn btn-outline" onClick={() => window.print()}>
              Print
            </button>
          </>
        }
      />
      {notice && (
        <div className="card" style={{ marginBottom: '14px' }}>
          <div className="card-bd text-sm" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{notice}</span>
            <button className="btn btn-outline" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => dispatch(setDeliveryDashboardNotice(''))}>
              OK
            </button>
          </div>
        </div>
      )}
      <DeliveryStatCards counts={counts} money={money} />
      <section className="card">
        <div className="card-hd">
          <h3>Needs attention ({attention.length})</h3>
          <span className="text-sm text-muted">Running late, failed attempts, and parcels with no partner.</span>
        </div>
        <div className="card-bd">
          <DataTable
            columns={COLUMNS}
            rows={attention}
            emptyMessage="Nothing needs attention right now."
            emptyColSpan={COLUMNS.length}
            renderRow={(d) => <DeliveryRow key={d.id} d={d} canManage={canManage} onAction={run} onOpen={(x) => dispatch(setDeliveryDashboardDetailId(x.id))} />}
          />
        </div>
      </section>
      <DeliveryCharts deliveries={deliveries} />
      <DeliveryDetailModal
        delivery={detail}
        businessName={scopedBusinessName}
        canManage={canManage}
        onAction={run}
        onClose={() => dispatch(setDeliveryDashboardDetailId(null))}
      />
      {actions.modal}
    </>
  );
}
