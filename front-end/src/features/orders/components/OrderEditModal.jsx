import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Modal from '../../../shared/components/common/Modal.jsx';
import FormField, { controlClass } from '../../../shared/components/common/FormField.jsx';
import { useDashboard } from '../../../shared/lib/dashboard/hooks.js';
import { selectOrdersSaving, updateOrderThunk } from '../ordersSlice.js';
import { extractErrorMessage } from '../../../store/thunkUtils.js';

/**
 * Edits only what may change on a saved bill: the customer's contact details
 * and a note. Items, total and payment stay as they were billed.
 */
export default function OrderEditModal({ order, onClose }) {
  const dispatch = useDispatch();
  const { refreshData, showToast } = useDashboard();
  const [name, setName] = useState(order.customer || '');
  const [phone, setPhone] = useState(order.customerPhone || '');
  const [address, setAddress] = useState(order.address || '');
  const [notes, setNotes] = useState(order.notes || '');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const saving = useSelector(selectOrdersSaving);
  const isDelivery = order.orderType === 'delivery';
  const addressLocked = ['Shipped', 'Delivered', 'Partially Returned', 'Returned'].includes(order.status);

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (name.trim().length < 2) next.name = true;
    const digits = phone.replace(/\D/g, '');
    if (phone.trim() && !/^[6-9]\d{9}$/.test(digits.slice(-10))) next.phone = true;
    if (isDelivery && !addressLocked && address.trim().length < 8) next.address = true;
    setErrors(next);
    if (Object.keys(next).length) return;

    const body = { version: order.version };
    if (name.trim() !== order.customer) body.customerName = name.trim();
    if (digits !== (order.customerPhone || '')) body.customerPhone = digits;
    if (isDelivery && !addressLocked && address.trim() !== order.address) body.customerAddress = address.trim();
    if (notes.trim() !== (order.notes || '')) body.notes = notes.trim();
    if (Object.keys(body).length === 1) {
      onClose();
      return;
    }
    setServerError('');
    try {
      await dispatch(updateOrderThunk({ id: order.id, body })).unwrap();
      await refreshData();
      showToast(`Order ${order.id} updated`);
      onClose();
    } catch (err) {
      setServerError(extractErrorMessage(err, 'Failed to update order'));
    }
  };

  return (
    <Modal title={`Edit ${order.id}`} onClose={onClose} maxWidth="520px">
      <form noValidate onSubmit={submit}>
        <div className="modal-body">
          <p className="text-sm text-muted" style={{ marginBottom: '12px' }}>
            Items, total and payment of a saved bill cannot change. To correct them, cancel the order and bill again, or raise a return.
          </p>
          <FormField label="Customer name *" htmlFor="oeName" error="Enter at least 2 characters" invalid={errors.name}>
            <input id="oeName" className={controlClass(errors.name)} value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <FormField label="Phone" htmlFor="oePhone" error="Enter a 10-digit mobile number" invalid={errors.phone}>
            <input id="oePhone" inputMode="numeric" maxLength={14} className={controlClass(errors.phone)} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </FormField>
          {isDelivery && (
            <FormField
              label="Delivery address"
              htmlFor="oeAddress"
              error="Enter the full address"
              invalid={errors.address}
              hint={addressLocked ? 'The parcel has left the store, so the address is fixed.' : undefined}
            >
              <textarea id="oeAddress" rows={2} disabled={addressLocked} className={controlClass(errors.address)} value={address} onChange={(e) => setAddress(e.target.value)} />
            </FormField>
          )}
          <FormField label="Note" htmlFor="oeNotes">
            <input id="oeNotes" maxLength={300} className="form-control" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormField>
          {serverError && <p className="form-error" style={{ display: 'block' }}>{serverError}</p>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
