import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import Modal from '../../../shared/components/common/Modal.jsx';
import FormField, { controlClass } from '../../../shared/components/common/FormField.jsx';
import {
  transitionDeliveryThunk,
  updateDeliveryThunk,
  createDeliveryThunk,
} from '../deliveriesSlice.js';
import { useDashboard } from '../../../shared/lib/dashboard/hooks.js';
import {
  DEFAULT_ETA_MIN,
  FAILURE_REASONS,
  MAX_ATTEMPTS,
  TRANSITIONS,
  formatMobile,
  itemsSummary,
  mobileDigits,
  money,
  partnerDirectory,
} from './deliveryView.js';

/** Buttons that make sense for a delivery in its current status. */
export function actionsFor(d) {
  const next = TRANSITIONS[d.status] || [];
  const list = [];
  if (d.status === 'Pending') list.push({ kind: 'assign', label: 'Assign partner', primary: true });
  if (d.status === 'Assigned') list.push({ kind: 'dispatch', label: 'Dispatch', primary: true });
  if (d.status === 'Dispatched') list.push({ kind: 'out', label: 'Out for delivery', primary: true });
  if (next.includes('Delivered')) list.push({ kind: 'deliver', label: 'Mark delivered', primary: d.status === 'Out for Delivery' });
  if (next.includes('Failed Attempt')) list.push({ kind: 'fail', label: 'Failed attempt' });
  if (d.status === 'Failed Attempt') {
    if ((d.attempts || 0) < MAX_ATTEMPTS) list.push({ kind: 'retry', label: `Retry (${d.attempts}/${MAX_ATTEMPTS})`, primary: true });
    list.push({ kind: 'return', label: 'Return to store' });
  }
  if (d.status === 'Assigned') list.push({ kind: 'unassign', label: 'Unassign' });
  if (next.includes('Cancelled')) list.push({ kind: 'cancel', label: 'Cancel', danger: true });
  if (['Pending', 'Assigned', 'Dispatched', 'Out for Delivery', 'Failed Attempt'].includes(d.status)) {
    list.push({ kind: 'edit', label: 'Edit details' });
  }
  return list;
}

const TITLES = {
  assign: 'Assign delivery partner',
  retry: 'Retry delivery',
  unassign: 'Unassign partner',
  dispatch: 'Dispatch parcel',
  out: 'Out for delivery',
  deliver: 'Mark delivered',
  fail: 'Record failed attempt',
  return: 'Return to store',
  cancel: 'Cancel delivery',
  edit: 'Edit delivery details',
  create: 'Create delivery',
};

function initialForm(kind, d) {
  return {
    partnerChoice: d && d.partner ? d.partner : '',
    partnerName: (d && d.partner) || '',
    partnerPhone: (d && d.partnerPhone) || '',
    partnerAgency: (d && d.partnerAgency) || '',
    partnerVehicle: (d && d.partnerVehicle) || '',
    etaMin: String((d && d.etaMin) || DEFAULT_ETA_MIN),
    receiverName: kind === 'deliver' && d ? d.customer || '' : '',
    cashCollected: kind === 'deliver' && d && d.codAmount ? String(d.codAmount) : '',
    failureReason: FAILURE_REASONS[0],
    failureDetails: '',
    note: '',
    address: (d && d.address) || '',
    customerPhone: (d && d.customerPhone) || '',
  };
}

function DeliveryActionModal({ request, partners, onClose, onDone }) {
  const dispatch = useDispatch();
  const kind = request ? request.kind : null;
  const d = request ? request.delivery : null;
  const order = request ? request.order : null;
  const [form, setForm] = useState(() => initialForm(null, null));
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!request) return;
    setForm(initialForm(request.kind, request.delivery));
    setErrors({});
    setServerError('');
    setSaving(false);
  }, [request]);

  if (!request) return <Modal open={false} title="" onClose={onClose} />;

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((p) => ({ ...p, [key]: undefined }));
  };
  const pickPartner = (e) => {
    const name = e.target.value;
    const known = partners.find((p) => p.name === name);
    setForm((f) => ({
      ...f,
      partnerChoice: name,
      partnerName: known ? known.name : name === '__new__' ? '' : f.partnerName,
      partnerPhone: known ? known.phone : name === '__new__' ? '' : f.partnerPhone,
      partnerAgency: known ? known.agency : name === '__new__' ? '' : f.partnerAgency,
      partnerVehicle: known ? known.vehicle : name === '__new__' ? '' : f.partnerVehicle,
    }));
    setErrors({});
  };

  const needsPartner =
    kind === 'assign' || kind === 'retry' || kind === 'create' || (kind === 'edit' && d && d.status !== 'Pending');
  const partnerRequired = kind === 'assign' || kind === 'retry';

  const check = () => {
    const e = {};
    if (needsPartner) {
      const name = form.partnerName.trim();
      const phoneGiven = form.partnerPhone.trim();
      if (partnerRequired && name.length < 2) e.partnerName = 'Enter the partner’s name.';
      if ((partnerRequired || name || phoneGiven) && !mobileDigits(form.partnerPhone)) e.partnerPhone = 'Enter a 10-digit mobile number.';
      if (kind === 'create' && phoneGiven && name.length < 2) e.partnerName = 'Enter the partner’s name, or leave both empty.';
      if (kind === 'edit' && d && d.status !== 'Pending' && name.length < 2) e.partnerName = 'An assigned delivery needs a partner.';
      const eta = form.etaMin.trim();
      if (!/^\d+$/.test(eta) || Number(eta) < 5 || Number(eta) > 1440) e.etaMin = 'ETA: whole minutes, 5 to 1440.';
    }
    if (kind === 'edit' && d && !['Dispatched', 'Out for Delivery'].includes(d.status)) {
      if (form.address.trim().length < 8) e.address = 'Enter the full address (at least 8 characters).';
      if (!mobileDigits(form.customerPhone)) e.customerPhone = 'Enter a 10-digit mobile number.';
    }
    if (kind === 'deliver') {
      if (form.receiverName.trim().length < 2) e.receiverName = 'Who received the parcel?';
      if (d && d.codAmount > 0) {
        const cash = form.cashCollected.trim();
        if (!/^\d+(\.\d{1,2})?$/.test(cash)) e.cashCollected = 'Enter the cash collected.';
        else if (Math.abs(Number(cash) - d.codAmount) > 0.009) e.cashCollected = `Collect exactly ${money(d.codAmount)}.`;
      }
    }
    if (kind === 'fail' && form.failureReason === 'Other' && form.failureDetails.trim().length < 3) {
      e.failureDetails = 'Describe what happened.';
    }
    if (kind === 'cancel' && form.note.trim().length < 3) e.note = 'Say why the delivery is cancelled.';
    return e;
  };

  const partnerBody = () => ({
    partnerName: form.partnerName.trim(),
    partnerPhone: mobileDigits(form.partnerPhone),
    partnerAgency: form.partnerAgency.trim(),
    partnerVehicle: form.partnerVehicle.trim(),
    etaMinutes: Number(form.etaMin),
  });

  const submit = async (e) => {
    e.preventDefault();
    const problems = check();
    setErrors(problems);
    if (Object.keys(problems).length) return;
    setSaving(true);
    setServerError('');
    const status = async (body) => {
      const action = await dispatch(
        transitionDeliveryThunk({
          id: d.id,
          body: { ...body, version: d.version },
        }),
      );
      if (transitionDeliveryThunk.rejected.match(action)) {
        throw new Error(action.payload || 'Failed to update delivery status');
      }
      return action.payload;
    };
    try {
      let message = '';
      if (kind === 'assign' || kind === 'retry') {
        await status({ status: 'Assigned', ...partnerBody(), note: kind === 'retry' ? `Retry ${(d.attempts || 0) + 1}` : undefined });
        message = `${d.id} assigned to ${form.partnerName.trim()}.`;
      } else if (kind === 'unassign') {
        await status({ status: 'Pending', note: form.note.trim() || undefined });
        message = `${d.id} is waiting for a partner again.`;
      } else if (kind === 'dispatch') {
        await status({ status: 'Dispatched', note: form.note.trim() || undefined });
        message = `${d.id} dispatched with ${d.partner}.`;
      } else if (kind === 'out') {
        await status({ status: 'Out for Delivery', note: form.note.trim() || undefined });
        message = `${d.id} is out for delivery.`;
      } else if (kind === 'deliver') {
        const body = { status: 'Delivered', receiverName: form.receiverName.trim() };
        if (d.codAmount > 0) body.cashCollected = Number(form.cashCollected);
        await status(body);
        message = `${d.id} delivered${d.codAmount > 0 ? `, ${money(d.codAmount)} cash collected` : ''}.`;
      } else if (kind === 'fail') {
        const reason = form.failureDetails.trim()
          ? `${form.failureReason}: ${form.failureDetails.trim()}`
          : form.failureReason;
        await status({ status: 'Failed Attempt', failureReason: reason });
        message = `Failed attempt recorded for ${d.id} (${reason}).`;
      } else if (kind === 'return') {
        await status({ status: 'Returned to Store', note: form.note.trim() || undefined });
        message = `${d.id} returned to store. Order ${d.orderId} is cancelled and its stock is back on the shelf.`;
      } else if (kind === 'cancel') {
        await status({ status: 'Cancelled', note: form.note.trim() });
        message = `${d.id} cancelled. Order ${d.orderId} is cancelled and its stock is back on the shelf.`;
      } else if (kind === 'edit') {
        const body = { version: d.version };
        const p = partnerBody();
        if (p.partnerName !== d.partner) body.partnerName = p.partnerName;
        if (form.partnerPhone.trim() && p.partnerPhone !== d.partnerPhone) body.partnerPhone = p.partnerPhone;
        if (p.partnerAgency !== d.partnerAgency) body.partnerAgency = p.partnerAgency;
        if (p.partnerVehicle !== d.partnerVehicle) body.partnerVehicle = p.partnerVehicle;
        if (p.etaMinutes !== Number(d.etaMin)) body.etaMinutes = p.etaMinutes;
        if (!['Dispatched', 'Out for Delivery'].includes(d.status)) {
          if (form.address.trim() !== d.address) body.address = form.address.trim();
          if (mobileDigits(form.customerPhone) !== d.customerPhone) body.customerPhone = mobileDigits(form.customerPhone);
        }
        if (Object.keys(body).length === 1) {
          onClose();
          return;
        }
        const action = await dispatch(updateDeliveryThunk({ id: d.id, body }));
        if (updateDeliveryThunk.rejected.match(action)) {
          throw new Error(action.payload || 'Failed to update delivery');
        }
        message = `${d.id} updated.`;
      } else if (kind === 'create') {
        const body = { orderId: order.id };
        const p = partnerBody();
        if (p.partnerName) Object.assign(body, p);
        else body.etaMinutes = p.etaMinutes;
        const action = await dispatch(createDeliveryThunk(body));
        if (createDeliveryThunk.rejected.match(action)) {
          throw new Error(action.payload || 'Failed to create delivery');
        }
        const created = action.payload;
        message = `Delivery ${created.id} created for ${order.id}.`;
      }
      onDone(message, { kind, deliveryId: d?.id, rider: form.partnerName.trim() });
    } catch (err) {
      setServerError(err.message || 'Could not save.');
      setSaving(false);
    }
  };

  const err = (k) => errors[k];
  const field = (key, label, props = {}) => (
    <FormField label={label} htmlFor={`da_${key}`} error={err(key) || ''} invalid={err(key) ? true : undefined} hint={props.hint}>
      <input
        id={`da_${key}`}
        className={controlClass(err(key))}
        value={form[key]}
        onChange={set(key)}
        inputMode={props.inputMode}
        placeholder={props.placeholder}
        maxLength={props.maxLength}
        readOnly={props.readOnly}
      />
    </FormField>
  );

  const subject = d
    ? `${d.id} · ${d.orderId} · ${d.customer}`
    : order
      ? `${order.id} · ${order.customer}`
      : '';

  return (
    <Modal open id="deliveryActionModal" title={TITLES[kind]} onClose={onClose} maxWidth="560px">
      <form noValidate onSubmit={submit}>
        <div className="modal-body">
          <div className="text-sm text-muted" style={{ marginBottom: '10px' }}>
            {subject}
            {d && d.items && d.items.length ? <div>{itemsSummary(d.items)}</div> : null}
          </div>
          {serverError && <div className="form-error" style={{ display: 'block', marginBottom: '12px' }}>{serverError}</div>}

          {needsPartner && (
            <>
              <FormField label={partnerRequired ? 'Partner *' : 'Partner'} htmlFor="da_partnerChoice">
                <select id="da_partnerChoice" className="form-control" value={form.partnerChoice} onChange={pickPartner}>
                  <option value="">{partnerRequired ? 'Pick a partner' : 'No partner yet'}</option>
                  {partners.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                      {p.agency ? ` (${p.agency})` : ''}
                      {p.load ? ` · ${p.load} open` : ''}
                    </option>
                  ))}
                  <option value="__new__">+ Someone else…</option>
                </select>
              </FormField>
              <div className="form-row">
                {field('partnerName', partnerRequired ? 'Partner name *' : 'Partner name', { maxLength: 60 })}
                {field('partnerPhone', partnerRequired ? 'Partner mobile *' : 'Partner mobile', { inputMode: 'numeric', placeholder: '10-digit mobile' })}
              </div>
              <div className="form-row">
                {field('partnerAgency', 'Agency', { maxLength: 60, placeholder: 'In-house, courier name…' })}
                {field('partnerVehicle', 'Vehicle', { maxLength: 40, placeholder: 'Bike DL3S AB 1234' })}
              </div>
              {field('etaMin', 'ETA after dispatch (minutes) *', { inputMode: 'numeric' })}
            </>
          )}

          {kind === 'edit' && d && (
            <>
              {['Dispatched', 'Out for Delivery'].includes(d.status) ? (
                <p className="text-sm text-muted">The address and customer phone cannot change while the parcel is on the road.</p>
              ) : (
                <>
                  {field('address', 'Delivery address *', { maxLength: 250 })}
                  {field('customerPhone', 'Customer mobile *', { inputMode: 'numeric' })}
                </>
              )}
            </>
          )}

          {kind === 'deliver' && d && (
            <>
              {field('receiverName', 'Received by *', { maxLength: 60, hint: 'Name of the person who took the parcel.' })}
              {d.codAmount > 0 ? (
                field('cashCollected', `Cash collected (COD ${money(d.codAmount)}) *`, { inputMode: 'decimal' })
              ) : (
                <p className="text-sm text-muted">Prepaid order ({d.paymentMethod}): no cash to collect.</p>
              )}
            </>
          )}

          {kind === 'fail' && (
            <>
              <FormField label="What happened? *" htmlFor="da_failureReason">
                <select id="da_failureReason" className="form-control" value={form.failureReason} onChange={set('failureReason')}>
                  {FAILURE_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </FormField>
              {field('failureDetails', form.failureReason === 'Other' ? 'Details *' : 'Details', { maxLength: 150 })}
              <p className="text-sm text-muted">
                Attempt {(d.attempts || 0) + 1} of {MAX_ATTEMPTS}. After a failed attempt you can retry or return the parcel to the store.
              </p>
            </>
          )}

          {kind === 'dispatch' && d && (
            <p className="text-sm">
              Hand the parcel to <strong>{d.partner}</strong> ({formatMobile(d.partnerPhone)}). The order will show as Shipped.
              {d.codAmount > 0 ? ` They must collect ${money(d.codAmount)} in cash.` : ''}
            </p>
          )}
          {kind === 'return' && (
            <p className="text-sm">
              The parcel is back in the store. Order <strong>{d.orderId}</strong> will be cancelled, its items go back on the shelf, and a prepaid amount is marked for refund.
            </p>
          )}
          {kind === 'unassign' && <p className="text-sm">{d.partner} will no longer have this delivery. It goes back to “Needs partner”.</p>}
          {kind === 'cancel' && (
            <p className="text-sm">
              Order <strong>{d.orderId}</strong> will be cancelled and its items go back on the shelf.
            </p>
          )}
          {['dispatch', 'out', 'return', 'unassign', 'cancel'].includes(kind) &&
            field('note', kind === 'cancel' ? 'Reason *' : 'Note', { maxLength: 200 })}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Close
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : TITLES[kind]}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Delivery actions for any screen. `start(kind, delivery)` opens the right
 * dialog; `startCreate(order)` creates a delivery for an order that has none.
 * Render `modal` once on the page.
 */
export default function useDeliveryActions({ onDone } = {}) {
  const { deliveries, showToast, refreshData } = useDashboard();
  const [request, setRequest] = useState(null);
  const load = new Map();
  deliveries
    .filter((x) => x.partner && ['Assigned', 'Dispatched', 'Out for Delivery'].includes(x.status))
    .forEach((x) => load.set(x.partner, (load.get(x.partner) || 0) + 1));
  const partners = partnerDirectory(deliveries).map((p) => ({ ...p, load: load.get(p.name) || 0 }));

  const done = (message, meta) => {
    setRequest(null);
    if (onDone) onDone(message, meta);
    showToast(message);
    refreshData();
  };

  return {
    start: (kind, delivery) => setRequest({ kind, delivery }),
    startCreate: (order) => setRequest({ kind: 'create', order }),
    modal: <DeliveryActionModal request={request} partners={partners} onClose={() => setRequest(null)} onDone={done} />,
  };
}
