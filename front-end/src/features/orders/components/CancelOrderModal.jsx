import useViewState from '../../../shared/hooks/useViewState.js';
import { useDispatch } from 'react-redux';
import Modal from '../../../shared/components/common/Modal.jsx';
import FormField, { controlClass } from '../../../shared/components/common/FormField.jsx';
import { useDashboard } from '../../../shared/lib/dashboard/hooks.js';
import { cancelOrderThunk } from '../ordersSlice.js';
import { rupees } from './orderFormat.js';

const REASONS = ['Customer changed mind', 'Billing mistake', 'Out of stock after billing', 'Duplicate bill', 'Other'];

/** Admin-only void of a bill. The server puts the stock back and marks the money refunded or voided. */
export default function CancelOrderModal({ order, onClose }) {
  const dispatch = useDispatch();
  const { refreshData, showToast } = useDashboard();
  const [preset, setPreset] = useViewState(REASONS[0]);
  const [detail, setDetail] = useViewState('');
  const [error, setError] = useViewState('');
  const [saving, setSaving] = useViewState(false);
  const reason = preset === 'Other' ? detail.trim() : detail.trim() ? `${preset}: ${detail.trim()}` : preset;
  const paid = order.paymentStatus === 'Paid';

  const submit = async (e) => {
    e.preventDefault();
    if (reason.length < 3) {
      setError('Say why the order is being cancelled');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await dispatch(
        cancelOrderThunk({
          orderId: order.id,
          reason,
          version: order.version,
        }),
      ).unwrap();
      await refreshData();
      showToast(`Order ${order.id} cancelled; stock put back`);
      onClose();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Cancel ${order.id}`} onClose={onClose} maxWidth="480px">
      <form noValidate onSubmit={submit}>
        <div className="modal-body">
          <p style={{ marginBottom: '12px', fontSize: '0.9rem' }}>
            {order.items} item(s) go back on the shelf.{' '}
            {paid ? `Give the customer back ${rupees(order.total)}.` : 'No money was collected, so the bill is voided.'}
          </p>
          <FormField label="Reason *" htmlFor="coReason">
            <select id="coReason" className="form-control" value={preset} onChange={(e) => setPreset(e.target.value)}>
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label={preset === 'Other' ? 'Details *' : 'Details'} htmlFor="coDetail" error={error} invalid={error ? true : undefined}>
            <input id="coDetail" maxLength={150} className={controlClass(Boolean(error))} value={detail} onChange={(e) => setDetail(e.target.value)} />
          </FormField>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Keep order
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ background: 'var(--red)', borderColor: 'var(--red)' }}>
            {saving ? 'Cancelling…' : 'Cancel order'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
