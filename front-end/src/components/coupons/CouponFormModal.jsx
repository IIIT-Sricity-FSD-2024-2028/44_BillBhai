import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Modal from '../common/Modal.jsx';
import FormField, { controlClass } from '../common/FormField.jsx';
import { useDashboard } from '../../lib/dashboard/hooks.js';
import { createCouponThunk, selectCouponsSaving, updateCouponThunk } from '../../store/slices/couponsSlice.js';
import { extractErrorMessage } from '../../store/thunkUtils.js';
import { addDays, dayKey, scopedCompanyId, currencySymbol } from '../orders/orderFormat.js';

function initialValues(coupon) {
  if (!coupon) {
    return {
      code: '',
      description: '',
      type: 'percent',
      value: '10',
      minOrder: '0',
      maxDiscount: '0',
      validFrom: dayKey(new Date()),
      validTo: dayKey(addDays(new Date(), 30)),
      usageLimit: '0',
      perCustomerLimit: '0',
      active: true,
    };
  }
  return {
    code: coupon.code,
    description: coupon.description || '',
    type: coupon.type,
    value: String(coupon.value),
    minOrder: String(coupon.minOrder ?? 0),
    maxDiscount: String(coupon.maxDiscount ?? 0),
    validFrom: coupon.validFrom,
    validTo: coupon.validTo,
    usageLimit: String(coupon.usageLimit ?? 0),
    perCustomerLimit: String(coupon.perCustomerLimit ?? 0),
    active: coupon.active !== false,
  };
}

function validate(v) {
  const e = {};
  if (!/^[A-Z0-9]{3,20}$/.test(v.code.trim().toUpperCase())) e.code = '3 to 20 letters or digits, no spaces';
  const value = Number(v.value);
  if (!(value > 0)) e.value = 'Must be more than 0';
  else if (v.type === 'percent' && value > 90) e.value = 'At most 90% off';
  if (!(Number(v.minOrder) >= 0)) e.minOrder = 'Must be 0 or more';
  if (!(Number(v.maxDiscount) >= 0)) e.maxDiscount = 'Must be 0 or more';
  if (!v.validFrom) e.validFrom = 'Pick a start date';
  if (!v.validTo) e.validTo = 'Pick an end date';
  else if (v.validFrom && v.validTo < v.validFrom) e.validTo = 'Must be on or after the start date';
  if (!Number.isInteger(Number(v.usageLimit)) || Number(v.usageLimit) < 0) e.usageLimit = 'Whole number, 0 = no limit';
  if (!Number.isInteger(Number(v.perCustomerLimit)) || Number(v.perCustomerLimit) < 0) e.perCustomerLimit = 'Whole number, 0 = no limit';
  return e;
}

export default function CouponFormModal({ coupon, onClose }) {
  const dispatch = useDispatch();
  const { refreshData, showToast, state } = useDashboard();
  const [v, setV] = useState(() => initialValues(coupon));
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const saving = useSelector(selectCouponsSaving);
  const used = coupon ? Number(coupon.usedCount) || 0 : 0;
  const set = (key) => (e) => setV((cur) => ({ ...cur, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const found = validate(v);
    setErrors(found);
    if (Object.keys(found).length) return;
    const body = {
      code: v.code.trim().toUpperCase(),
      description: v.description.trim(),
      type: v.type,
      value: Number(v.value),
      minOrder: Number(v.minOrder),
      maxDiscount: v.type === 'percent' ? Number(v.maxDiscount) : 0,
      validFrom: v.validFrom,
      validTo: v.validTo,
      usageLimit: Number(v.usageLimit),
      perCustomerLimit: Number(v.perCustomerLimit),
      active: v.active,
    };
    setServerError('');
    try {
      if (coupon) {
        if (used > 0) delete body.code;
        await dispatch(updateCouponThunk({ id: coupon.id, body: { ...body, version: coupon.version } })).unwrap();
        showToast(`Coupon ${coupon.code} saved`);
      } else {
        await dispatch(createCouponThunk({ ...body, companyId: scopedCompanyId(state) })).unwrap();
        showToast(`Coupon ${body.code} created`);
      }
      await refreshData();
      onClose(true);
    } catch (err) {
      setServerError(extractErrorMessage(err, 'Failed to save coupon'));
    }
  };

  const field = (key, label, input, hint) => (
    <FormField label={label} htmlFor={`cp_${key}`} error={errors[key]} invalid={errors[key] ? true : undefined} hint={hint}>
      {input}
    </FormField>
  );

  return (
    <Modal title={coupon ? `Edit coupon ${coupon.code}` : 'New coupon'} onClose={() => onClose(false)} maxWidth="600px">
      <form noValidate onSubmit={submit}>
        <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
          <div className="form-row">
            {field(
              'code',
              'Code *',
              <input id="cp_code" maxLength={20} disabled={used > 0} style={{ textTransform: 'uppercase' }} className={controlClass(errors.code)} value={v.code} onChange={set('code')} />,
              used > 0 ? `Used on ${used} bill(s), so the code is fixed` : 'What the customer tells the cashier',
            )}
            {field('description', 'Description', <input id="cp_description" maxLength={120} className="form-control" value={v.description} onChange={set('description')} />)}
          </div>
          <div className="form-row">
            {field(
              'type',
              'Type',
              <select id="cp_type" className="form-control" value={v.type} onChange={set('type')}>
                <option value="percent">Percent off</option>
                <option value="flat">Flat {currencySymbol()} off</option>
              </select>,
            )}
            {field('value', v.type === 'percent' ? 'Percent off *' : 'Amount off *', <input id="cp_value" type="number" min="0" step="0.01" className={controlClass(errors.value)} value={v.value} onChange={set('value')} />)}
          </div>
          <div className="form-row">
            {field('minOrder', `Minimum bill (${currencySymbol()})`, <input id="cp_minOrder" type="number" min="0" className={controlClass(errors.minOrder)} value={v.minOrder} onChange={set('minOrder')} />, '0 = any bill')}
            {v.type === 'percent'
              ? field('maxDiscount', `Largest discount (${currencySymbol()})`, <input id="cp_maxDiscount" type="number" min="0" className={controlClass(errors.maxDiscount)} value={v.maxDiscount} onChange={set('maxDiscount')} />, '0 = no cap')
              : <div />}
          </div>
          <div className="form-row">
            {field('validFrom', 'Valid from *', <input id="cp_validFrom" type="date" className={controlClass(errors.validFrom)} value={v.validFrom} onChange={set('validFrom')} />)}
            {field('validTo', 'Valid until *', <input id="cp_validTo" type="date" className={controlClass(errors.validTo)} value={v.validTo} onChange={set('validTo')} />)}
          </div>
          <div className="form-row">
            {field('usageLimit', 'Total uses allowed', <input id="cp_usageLimit" type="number" min="0" step="1" className={controlClass(errors.usageLimit)} value={v.usageLimit} onChange={set('usageLimit')} />, '0 = unlimited')}
            {field('perCustomerLimit', 'Uses per customer', <input id="cp_perCustomerLimit" type="number" min="0" step="1" className={controlClass(errors.perCustomerLimit)} value={v.perCustomerLimit} onChange={set('perCustomerLimit')} />, '0 = unlimited; counted by phone number')}
          </div>
          <label htmlFor="cp_active" style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.9rem' }}>
            <input id="cp_active" type="checkbox" checked={v.active} onChange={set('active')} />
            Switched on (the till accepts it within the dates above)
          </label>
          {serverError && <p className="form-error" style={{ display: 'block', marginTop: '10px' }}>{serverError}</p>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={() => onClose(false)}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : coupon ? 'Save coupon' : 'Create coupon'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
