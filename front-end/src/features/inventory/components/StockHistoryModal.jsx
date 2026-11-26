import { useEffect, useMemo } from 'react';
import useViewState from '../../../shared/hooks/useViewState.js';
import { useDispatch, useSelector } from 'react-redux';
import Modal from '../../../shared/components/common/Modal.jsx';
import DataTable from '../../../shared/components/common/DataTable.jsx';
import {
  fetchMovementsThunk,
  selectMovements,
  selectMovementsStatus,
} from '../inventorySlice.js';
import {
  fetchProductActivityThunk,
  selectActivityByProduct,
} from '../productsSlice.js';
import { extractErrorMessage } from '../../../store/thunkUtils.js';
import { MOVEMENT_LABELS, dateTime } from './inventoryUtils.js';

function StockHistoryBody({ item, canManage, scopeQuery, onClose }) {
  const dispatch = useDispatch();
  const allMovements = useSelector(selectMovements);
  const movementsStatus = useSelector(selectMovementsStatus);
  const activityByProduct = useSelector(selectActivityByProduct);
  const [tab, setTab] = useViewState('stock');
  const [error, setError] = useViewState('');

  useEffect(() => {
    let active = true;
    const jobs = [
      dispatch(fetchProductActivityThunk({ productId: item.productId, query: scopeQuery }))
        .unwrap()
        .catch(() => []),
    ];
    if (canManage) {
      jobs.push(
        dispatch(fetchMovementsThunk({ ...scopeQuery, productId: item.productId, limit: 100 }))
          .unwrap()
          .then(() => {
            if (active) setError('');
          })
          .catch((err) => {
            if (active) setError(extractErrorMessage(err, 'Could not load the history.'));
          }),
      );
    }
    Promise.all(jobs);
    return () => {
      active = false;
    };
  }, [dispatch, item, canManage, scopeQuery, setError]);

  const moves = useMemo(
    () => allMovements.filter((m) => String(m.productId) === String(item.productId)),
    [allMovements, item.productId],
  );
  const activity = activityByProduct[item.productId] || [];

  return (
    <>
      <div className="modal-body">
        <div className="chart-tabs" style={{ marginBottom: '12px' }}>
          <button type="button" className={tab === 'stock' ? 'chart-tab active' : 'chart-tab'} onClick={() => setTab('stock')}>
            Stock movements
          </button>
          <button type="button" className={tab === 'changes' ? 'chart-tab active' : 'chart-tab'} onClick={() => setTab('changes')}>
            Product changes
          </button>
        </div>
        {error && <div className="form-error" style={{ display: 'block' }}>{error}</div>}
        {!error && movementsStatus === 'loading' && <p className="text-muted">Loading…</p>}
        {tab === 'stock' && (!canManage || movementsStatus !== 'loading') && (
          <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
            <DataTable
              columns={[
                { header: 'When', render: (m) => dateTime(m.at) },
                { header: 'Type', render: (m) => MOVEMENT_LABELS[m.type] || m.type },
                {
                  header: 'Change',
                  render: (m) => (
                    <strong style={{ color: m.quantity < 0 ? 'var(--red)' : 'var(--green)' }}>
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                    </strong>
                  ),
                },
                { header: 'Balance', key: 'balanceAfter' },
                { header: 'Reason', key: 'reason' },
                { header: 'By', key: 'by' },
              ]}
              rows={moves}
              getRowKey={(m) => m.id}
              emptyMessage={canManage ? 'No stock movements yet.' : 'Stock movement logs require manager access.'}
            />
          </div>
        )}
        {tab === 'changes' && (
          <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
            <DataTable
              columns={[
                { header: 'When', render: (a) => dateTime(a.at) },
                { header: 'What changed', key: 'summary' },
                { header: 'By', key: 'by' },
              ]}
              rows={activity}
              getRowKey={(a) => a.id}
              emptyMessage="No recorded changes to this product."
            />
          </div>
        )}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Close
        </button>
      </div>
    </>
  );
}

/** Stock ledger and change history (price, supplier, …) of one product. */
export default function StockHistoryModal({ item, canManage = true, scopeQuery, onClose }) {
  return (
    <Modal open={Boolean(item)} id="stockHistoryModal" title={item ? `History — ${item.name} (${item.productId})` : ''} onClose={onClose} maxWidth="860px">
      {item && <StockHistoryBody key={item.productId} item={item} canManage={canManage} scopeQuery={scopeQuery} onClose={onClose} />}
    </Modal>
  );
}
