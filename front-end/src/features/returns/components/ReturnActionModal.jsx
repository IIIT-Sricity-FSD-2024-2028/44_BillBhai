import { useDispatch, useSelector } from 'react-redux';
import Modal from '../../../shared/components/common/Modal.jsx';
import FormField from '../../../shared/components/common/FormField.jsx';
import { selectReturnsUi, setReturnActionFormField } from '../returnsSlice.js';
import { REFUND_METHODS, rupees } from './returnStats.js';

const ERROR_BOX = { color: 'var(--red)', marginTop: '8px', fontSize: '0.85rem' };
const CHECK_ROW = { display: 'flex', gap: '8px', alignItems: 'flex-start' };

const COPY = {
  Refunded: { title: 'Refund return', button: 'Refund' },
  Exchanged: { title: 'Hand over replacement', button: 'Complete exchange' },
  Rejected: { title: 'Reject return', button: 'Reject' },
};

/**
 * Completes a return: Refund (how the money goes back, and whether the
 * goods go back on the shelf), Exchange (replacement handed over) or Reject
 * (reason required). The amount is the one the server worked out.
 */
export default function ReturnActionModal({ item, action, order, onClose, onSubmit }) {
  const dispatch = useDispatch();
  const { actionForm } = useSelector(selectReturnsUi);
  const { refundMethod, restock, rejectReason, note, error, saving } = actionForm;
  const setField = (key, value) => dispatch(setReturnActionFormField({ key, value }));
  if (!item || !action) return null;
  const copy = COPY[action];

  const submit = async (e) => {
    e.preventDefault();
    setField('error', '');
    const body = { status: action, version: item.version, note: note.trim() || undefined };
    if (action === 'Refunded') {
      body.refundMethod = refundMethod;
      body.restock = restock;
    }
    if (action === 'Exchanged') body.restock = restock;
    if (action === 'Rejected') {
      if (rejectReason.trim().length < 3) {
        setField('error', 'Say why the return is rejected (the customer will be told).');
        return;
      }
      body.rejectReason = rejectReason.trim();
    }
    setField('saving', true);
    try {
      await onSubmit(item, body);
    } catch (err) {
      setField('error', err.message || 'Could not save');
      setField('saving', false);
    }
  };

  return (
    <Modal open id="returnActionModal" title={`${copy.title} ${item.id}`} onClose={onClose} maxWidth="520px">
      <form onSubmit={submit} noValidate>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ margin: 0 }}>
            <strong>{item.product}</strong> from {item.orderId}
            {item.customer ? ` (${item.customer})` : ''}.
            {action === 'Refunded' && (
              <>
                {' '}Refund due: <strong>{rupees(item.amount)}</strong>.
              </>
            )}
          </p>

          {action === 'Refunded' && order && (order.deliveryCharge > 0 || order.discount > 0 || order.payment) && (
            <div className="text-sm text-muted" style={{ background: 'var(--bg-secondary, rgba(255,255,255,0.04))', padding: '8px 10px', borderRadius: '6px' }}>
              {order.payment && <div>Original payment method: <strong>{order.payment}</strong></div>}
              {order.deliveryCharge > 0 && <div>Delivery charge {rupees(order.deliveryCharge)} is not refunded.</div>}
              {order.discount > 0 && (
                <div>
                  Coupon {order.promoCode || 'discount'} ({rupees(order.discount)}) is shared across items.
                </div>
              )}
            </div>
          )}

          {action === 'Refunded' && (
            <FormField label="Refund by" htmlFor="refundMethod">
              <select id="refundMethod" className="form-control" value={refundMethod} onChange={(e) => setField('refundMethod', e.target.value)}>
                {REFUND_METHODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </FormField>
          )}

          {(action === 'Refunded' || action === 'Exchanged') && (
            <label style={CHECK_ROW} htmlFor="returnRestock">
              <input id="returnRestock" type="checkbox" checked={restock} onChange={(e) => setField('restock', e.target.checked)} />
              <span>
                Put the returned items back on the shelf
                <div className="text-sm text-muted">
                  Untick if they are damaged or expired; they will be written off and stock stays as it is.
                </div>
              </span>
            </label>
          )}

          {action === 'Exchanged' && (
            <p className="text-sm text-muted">The same item is taken off the shelf and handed to the customer.</p>
          )}

          {action === 'Rejected' && (
            <FormField label="Why is it rejected?" htmlFor="rejectReason">
              <textarea id="rejectReason" className="form-control" rows={3} maxLength={200} value={rejectReason} onChange={(e) => setField('rejectReason', e.target.value)} placeholder="e.g. Seal broken, past return window" />
            </FormField>
          )}

          <FormField label="Note (optional)" htmlFor="returnActionNote">
            <input id="returnActionNote" className="form-control" maxLength={300} value={note} onChange={(e) => setField('note', e.target.value)} />
          </FormField>

          {error && (
            <div style={ERROR_BOX} role="alert">
              {error}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : copy.button}
          </button>
        </div>
      </form>
    </Modal>
  );
}
