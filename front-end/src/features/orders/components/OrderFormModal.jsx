import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Modal from '../../../shared/components/common/Modal.jsx';
import FormField, { controlClass } from '../../../shared/components/common/FormField.jsx';
import Badge from '../../../shared/components/common/Badge.jsx';
import { useDashboard } from '../../../shared/lib/dashboard/hooks.js';
import { ordersRepo } from '../ordersRepo.js';
import {
  placeOrderThunk,
  quoteOrderThunk,
  selectOrderQuote,
  selectOrdersSaving,
} from '../ordersSlice.js';
import { extractErrorMessage } from '../../../store/thunkUtils.js';
import { rupees, scopedCompanyId, currencySymbol } from './orderFormat.js';

const MODES = [
  { value: 'takeaway_now', label: 'Counter (take away)' },
  { value: 'prepaid_delivery', label: 'Delivery (paid now)' },
  { value: 'cod_delivery', label: 'Delivery (COD)' },
];
const PAY_METHODS = ['Cash', 'UPI', 'Card'];

const PICK_LIST = {
  listStyle: 'none',
  margin: '6px 0 0',
  padding: 0,
  border: '1px solid var(--border)',
  borderRadius: '8px',
  maxHeight: '190px',
  overflowY: 'auto',
};
const PICK_ITEM = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '10px',
  width: '100%',
  padding: '7px 10px',
  background: 'transparent',
  border: 0,
  borderBottom: '1px solid var(--border)',
  color: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: '0.85rem',
};
const LINE_TABLE = { width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginTop: '8px' };
const CELL = { padding: '5px 4px', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' };
const TOTAL_ROW = { display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', padding: '2px 0' };

function validPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  const tail = digits.length > 10 && digits.startsWith('91') ? digits.slice(-10) : digits;
  return /^[6-9]\d{9}$/.test(tail) ? tail : '';
}

/**
 * New order from the back office. The server prices every line, checks stock
 * and the coupon and works out the total; this dialog shows its quote before
 * saving and its exact message if anything is refused.
 */
export default function OrderFormModal({ onClose, onCreated }) {
  const dispatch = useDispatch();
  const { inventory, refreshData, showToast, state } = useDashboard();
  const companyId = scopedCompanyId(state);
  const [search, setSearch] = useState('');
  const [lines, setLines] = useState([]);
  const [mode, setMode] = useState('takeaway_now');
  const [payment, setPayment] = useState('Cash');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [deliveryCharge, setDeliveryCharge] = useState('0');
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [tendered, setTendered] = useState('');
  const [notes, setNotes] = useState('');
  const rawQuote = useSelector(selectOrderQuote);
  const quote = lines.length ? rawQuote : null;
  const [quoteError, setQuoteError] = useState('');
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const saving = useSelector(selectOrdersSaving);
  const quoteSeq = useRef(0);

  const isDelivery = mode !== 'takeaway_now';
  const byId = useMemo(() => new Map(inventory.map((p) => [p.productId, p])), [inventory]);
  const products = useMemo(() => inventory.filter((p) => p.active !== false), [inventory]);
  const needle = search.trim().toLowerCase();
  const matches = needle
    ? products
      .filter((p) => `${p.name} ${p.productId} ${p.barcode} ${p.cat}`.toLowerCase().includes(needle))
      .slice(0, 8)
    : [];

  const localSubtotal = lines.reduce((sum, l) => sum + (byId.get(l.productId)?.price || 0) * l.quantity, 0);
  const phoneDigits = validPhone(phone);

  const addProduct = (p) => {
    if (p.stock <= 0) return;
    setLines((cur) => {
      const found = cur.find((l) => l.productId === p.productId);
      if (found) {
        return cur.map((l) => (l.productId === p.productId ? { ...l, quantity: Math.min(p.stock, l.quantity + 1) } : l));
      }
      return [...cur, { productId: p.productId, quantity: 1 }];
    });
    setSearch('');
  };

  const setQty = (productId, value) => {
    const p = byId.get(productId);
    const n = Math.floor(Number(value));
    setLines((cur) =>
      cur.map((l) =>
        l.productId === productId ? { ...l, quantity: Number.isFinite(n) ? Math.max(1, Math.min(p ? p.stock : n, n)) : 1 } : l,
      ),
    );
  };

  const buildBody = () => ({
    companyId,
    checkoutMode: mode,
    items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, itemPrice: byId.get(l.productId)?.price })),
    promoCode: coupon ? coupon.code : undefined,
    deliveryCharge: isDelivery ? Math.max(0, Number(deliveryCharge) || 0) : undefined,
    customer: phoneDigits ? { phone: phoneDigits } : undefined,
  });

  // Ask the server for the real total whenever the cart changes.
  useEffect(() => {
    if (!lines.length) {
      setQuoteError('');
      return undefined;
    }
    const seq = ++quoteSeq.current;
    const timer = setTimeout(() => {
      dispatch(quoteOrderThunk(buildBody()))
        .unwrap()
        .then(() => {
          if (seq !== quoteSeq.current) return;
          setQuoteError('');
        })
        .catch((err) => {
          if (seq !== quoteSeq.current) return;
          setQuoteError(extractErrorMessage(err, 'Could not calculate quote'));
        });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, lines, mode, deliveryCharge, coupon, phoneDigits]);

  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase();
    setCouponError('');
    if (!code) return;
    if (!lines.length) {
      setCouponError('Add items first');
      return;
    }
    try {
      const result = await ordersRepo.validatePromotions({
        companyId,
        code,
        subtotal: localSubtotal,
        customerPhone: phoneDigits || undefined,
      });
      setCoupon(result);
    } catch (err) {
      setCoupon(null);
      setCouponError(err.message);
    }
  };

  const total = quote ? quote.total : null;
  const tenderedNum = Number(tendered);
  const change = payment === 'Cash' && !isDelivery && tendered !== '' && total !== null ? tenderedNum - total : null;

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!lines.length) next.lines = 'Add at least one product';
    if (isDelivery && !phoneDigits) next.phone = 'A delivery needs a 10-digit mobile number';
    if (!isDelivery && phone.trim() && !phoneDigits) next.phone = 'Enter a 10-digit mobile number or leave it empty';
    if (isDelivery && address.trim().length < 8) next.address = 'Enter the full delivery address';
    if (change !== null && change < 0) next.tendered = 'Cash received is less than the bill';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitError('');
    try {
      const body = {
        ...buildBody(),
        paymentMethod: mode === 'cod_delivery' ? 'COD' : payment,
        customer: {
          name: name.trim() || undefined,
          phone: phoneDigits || undefined,
          address: isDelivery ? address.trim() : undefined,
        },
        amountTendered: change !== null ? tenderedNum : undefined,
        notes: notes.trim() || undefined,
      };
      const order = await dispatch(placeOrderThunk(body)).unwrap();
      await refreshData();
      showToast(
        `Order ${order.id} saved – ${rupees(order.total)}${order.changeDue ? `, give back ${rupees(order.changeDue)}` : ''}`,
      );
      onCreated(order);
    } catch (err) {
      setSubmitError(extractErrorMessage(err, 'Failed to place order'));
    }
  };

  return (
    <Modal title="New Order" onClose={onClose} maxWidth="720px" closeOnOverlay={false}>
      <form noValidate onSubmit={submit}>
        <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
          <FormField label="Add products" htmlFor="noSearch" error={errors.lines} invalid={errors.lines ? true : undefined}>
            <input
              id="noSearch"
              className={controlClass(Boolean(errors.lines))}
              placeholder="Product name, code or barcode"
              value={search}
              autoComplete="off"
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (matches[0]) addProduct(matches[0]);
                }
              }}
            />
            {needle && (
              <ul style={PICK_LIST}>
                {matches.length === 0 && <li style={{ ...PICK_ITEM, cursor: 'default' }}>No product matches “{search}”</li>}
                {matches.map((p) => (
                  <li key={p.productId}>
                    <button type="button" style={{ ...PICK_ITEM, opacity: p.stock > 0 ? 1 : 0.5 }} disabled={p.stock <= 0} onClick={() => addProduct(p)}>
                      <span>
                        {p.name} <span className="text-muted">{p.size ? `· ${p.size}` : ''} · {p.productId}</span>
                      </span>
                      <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {rupees(p.price)}
                        <Badge status={p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'} type={p.stock > 0 ? p.status.toLowerCase().replace(/\s/g, '') : 'outofstock'} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </FormField>

          {lines.length > 0 && (
            <table style={LINE_TABLE}>
              <thead>
                <tr className="text-muted">
                  <th style={{ ...CELL, textAlign: 'left' }}>Item</th>
                  <th style={{ ...CELL, textAlign: 'right' }}>Rate</th>
                  <th style={{ ...CELL, textAlign: 'center' }}>Qty</th>
                  <th style={{ ...CELL, textAlign: 'right' }}>Amount</th>
                  <th style={CELL} aria-label="Remove" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const p = byId.get(l.productId);
                  return (
                    <tr key={l.productId}>
                      <td style={CELL}>
                        {p ? p.name : l.productId}
                        <span className="text-muted text-sm" style={{ display: 'block' }}>
                          {p ? `${p.stock} on the shelf` : ''}
                        </span>
                      </td>
                      <td style={{ ...CELL, textAlign: 'right' }}>{rupees(p ? p.price : 0)}</td>
                      <td style={{ ...CELL, textAlign: 'center' }}>
                        <input
                          type="number"
                          min="1"
                          max={p ? p.stock : undefined}
                          aria-label={`Quantity of ${p ? p.name : l.productId}`}
                          className="form-control"
                          style={{ width: '72px', textAlign: 'center' }}
                          value={l.quantity}
                          onChange={(e) => setQty(l.productId, e.target.value)}
                        />
                      </td>
                      <td style={{ ...CELL, textAlign: 'right' }}>{rupees((p ? p.price : 0) * l.quantity)}</td>
                      <td style={{ ...CELL, textAlign: 'right' }}>
                        <button type="button" className="btn btn-outline" style={{ padding: '2px 8px', fontSize: '0.75rem' }} onClick={() => setLines((cur) => cur.filter((x) => x.productId !== l.productId))}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div className="form-row" style={{ marginTop: '14px' }}>
            <FormField label="Checkout" htmlFor="noMode">
              <select id="noMode" className="form-control" value={mode} onChange={(e) => setMode(e.target.value)}>
                {MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Payment" htmlFor="noPay">
              {mode === 'cod_delivery' ? (
                <input id="noPay" className="form-control" value="Cash on delivery" disabled />
              ) : (
                <select id="noPay" className="form-control" value={payment} onChange={(e) => setPayment(e.target.value)}>
                  {PAY_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
          </div>
          <div className="form-row">
            <FormField label={isDelivery ? 'Customer phone *' : 'Customer phone'} htmlFor="noPhone" error={errors.phone} invalid={errors.phone ? true : undefined} hint={!isDelivery ? 'Leave empty for a walk-in customer' : undefined}>
              <input id="noPhone" inputMode="numeric" maxLength={14} className={controlClass(Boolean(errors.phone))} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </FormField>
            <FormField label="Customer name" htmlFor="noName" hint="A saved customer keeps their saved name">
              <input id="noName" maxLength={80} className="form-control" value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
          </div>
          {isDelivery && (
            <div className="form-row">
              <FormField label="Delivery address *" htmlFor="noAddress" error={errors.address} invalid={errors.address ? true : undefined}>
                <textarea id="noAddress" rows={2} maxLength={250} className={controlClass(Boolean(errors.address))} value={address} onChange={(e) => setAddress(e.target.value)} />
              </FormField>
              <FormField label={`Delivery charge (${currencySymbol()})`} htmlFor="noCharge" hint="0 to 500">
                <input id="noCharge" type="number" min="0" max="500" className="form-control" value={deliveryCharge} onChange={(e) => setDeliveryCharge(e.target.value)} />
              </FormField>
            </div>
          )}
          <div className="form-row">
            <FormField label="Coupon" htmlFor="noCoupon" error={couponError} invalid={couponError ? true : undefined} hint={coupon ? `${coupon.code} applied: −${rupees(coupon.discount)}` : undefined}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input id="noCoupon" maxLength={20} className={controlClass(Boolean(couponError))} style={{ textTransform: 'uppercase' }} value={couponInput} onChange={(e) => setCouponInput(e.target.value)} />
                {coupon ? (
                  <button type="button" className="btn btn-outline" onClick={() => { setCoupon(null); setCouponInput(''); }}>
                    Remove
                  </button>
                ) : (
                  <button type="button" className="btn btn-outline" onClick={applyCoupon}>
                    Apply
                  </button>
                )}
              </div>
            </FormField>
            {mode === 'takeaway_now' && payment === 'Cash' ? (
              <FormField label={`Cash received (${currencySymbol()})`} htmlFor="noTendered" error={errors.tendered} invalid={errors.tendered ? true : undefined} hint={change !== null && change >= 0 ? `Give back ${rupees(change)}` : undefined}>
                <input id="noTendered" type="number" min="0" className={controlClass(Boolean(errors.tendered))} value={tendered} onChange={(e) => setTendered(e.target.value)} />
              </FormField>
            ) : (
              <FormField label="Note" htmlFor="noNotes">
                <input id="noNotes" maxLength={300} className="form-control" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </FormField>
            )}
          </div>

          <div className="card" style={{ padding: '12px 14px', marginTop: '6px' }}>
            {quoteError && <p className="form-error" style={{ display: 'block', margin: 0 }}>{quoteError}</p>}
            {!quoteError && !quote && <p className="text-muted text-sm" style={{ margin: 0 }}>{lines.length ? 'Checking prices and stock…' : 'Add products to see the bill.'}</p>}
            {quote && (
              <>
                <div style={TOTAL_ROW}>
                  <span>Subtotal</span>
                  <span>{rupees(quote.subtotal)}</span>
                </div>
                {quote.discountAmount > 0 && (
                  <div style={TOTAL_ROW}>
                    <span>Discount ({quote.promoCode})</span>
                    <span>− {rupees(quote.discountAmount)}</span>
                  </div>
                )}
                {quote.deliveryCharge > 0 && (
                  <div style={TOTAL_ROW}>
                    <span>Delivery charge</span>
                    <span>{rupees(quote.deliveryCharge)}</span>
                  </div>
                )}
                <div style={{ ...TOTAL_ROW, fontWeight: 700, fontSize: '1rem', borderTop: '1px solid var(--border)', marginTop: '4px', paddingTop: '6px' }}>
                  <span>Total</span>
                  <span>{rupees(quote.total)}</span>
                </div>
                <div className="text-muted text-sm" style={TOTAL_ROW}>
                  <span>GST included</span>
                  <span>{rupees(quote.taxAmount)}</span>
                </div>
                <p className="text-muted text-sm" style={{ margin: '4px 0 0' }}>Prices and stock checked by the server just now.</p>
              </>
            )}
          </div>
          {submitError && <p className="form-error" style={{ display: 'block', marginTop: '10px' }}>{submitError}</p>}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || !lines.length || Boolean(quoteError)}>
            {saving ? 'Saving…' : total !== null ? `Save order · ${rupees(total)}` : 'Save order'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
