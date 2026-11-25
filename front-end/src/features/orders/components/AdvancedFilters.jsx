import { useMemo } from 'react';
import { HOUR_BANDS, PAYMENT_STATUS_OPTIONS, WEEKDAYS } from './orderFilters.js';
import { CHECKOUT_MODE_LABELS, RANGE_PRESETS, rangePreset, currencySymbol } from './orderFormat.js';

const GRID_STYLE = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
  gap: '12px 16px',
  borderTop: '1px solid var(--border)',
  paddingTop: '14px',
};
const FIELD_STYLE = { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 };
const PRESET_ROW = { display: 'flex', flexWrap: 'wrap', gap: '6px', gridColumn: '1 / -1', alignItems: 'center' };
const SMALL_BTN = { padding: '4px 10px', fontSize: '0.75rem' };

function Field({ id, label, children }) {
  return (
    <div style={FIELD_STYLE}>
      <label className="toolbar-label" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Select({ id, value, onChange, options }) {
  return (
    <select id={id} className="toolbar-select" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => {
        const opt = typeof o === 'object' ? o : { value: o, label: o };
        return (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        );
      })}
    </select>
  );
}

/** The "More filters" panel on the Orders page. */
export default function AdvancedFilters({ filters, setFilter, onClear, orders, inventory, coupons }) {
  const cashiers = useMemo(
    () => [...new Set(orders.map((o) => o.staffName).filter(Boolean))].sort(),
    [orders],
  );
  const couponCodes = useMemo(() => {
    const codes = new Set((coupons || []).map((c) => c.code));
    orders.forEach((o) => o.promoCode && codes.add(o.promoCode));
    if (!['all', 'any', 'none'].includes(filters.coupon)) codes.add(filters.coupon);
    return [...codes].sort();
  }, [coupons, orders, filters.coupon]);
  const products = useMemo(
    () => [...inventory].sort((a, b) => a.name.localeCompare(b.name)),
    [inventory],
  );
  const categories = useMemo(() => [...new Set(inventory.map((p) => p.cat))].sort(), [inventory]);

  const applyPreset = (key) => {
    const r = rangePreset(key);
    setFilter('from', r.from);
    setFilter('to', r.to);
  };

  return (
    <div className="card-bd" style={GRID_STYLE}>
      <div style={PRESET_ROW}>
        <span className="toolbar-label">Date:</span>
        {RANGE_PRESETS.map((p) => (
          <button key={p.value} type="button" className="btn btn-outline" style={SMALL_BTN} onClick={() => applyPreset(p.value)}>
            {p.label}
          </button>
        ))}
        <button type="button" className="btn btn-outline" style={SMALL_BTN} onClick={() => applyPreset('')}>
          Any date
        </button>
        <button type="button" className="btn btn-outline" style={{ ...SMALL_BTN, marginLeft: 'auto' }} onClick={onClear}>
          Clear these filters
        </button>
      </div>
      <Field id="ofFrom" label="From">
        <input id="ofFrom" type="date" className="toolbar-select" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} />
      </Field>
      <Field id="ofTo" label="To">
        <input id="ofTo" type="date" className="toolbar-select" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} />
      </Field>
      <Field id="ofCoupon" label="Coupon">
        <Select
          id="ofCoupon"
          value={filters.coupon}
          onChange={(v) => setFilter('coupon', v)}
          options={[
            { value: 'all', label: 'With or without' },
            { value: 'any', label: 'Any coupon used' },
            { value: 'none', label: 'No coupon' },
            ...couponCodes.map((c) => ({ value: c, label: c })),
          ]}
        />
      </Field>
      <Field id="ofDiscount" label="Discount at least (% of bill)">
        <input id="ofDiscount" type="number" min="0" max="100" className="toolbar-select" placeholder="e.g. 10" value={filters.minDiscountPct} onChange={(e) => setFilter('minDiscountPct', e.target.value)} />
      </Field>
      <Field id="ofType" label="Order type">
        <Select
          id="ofType"
          value={filters.type}
          onChange={(v) => setFilter('type', v)}
          options={[
            { value: 'all', label: 'Counter and delivery' },
            { value: 'pickup', label: 'Counter only' },
            { value: 'delivery', label: 'Delivery only' },
          ]}
        />
      </Field>
      <Field id="ofMode" label="Checkout">
        <Select
          id="ofMode"
          value={filters.mode}
          onChange={(v) => setFilter('mode', v)}
          options={[{ value: 'all', label: 'Any checkout' }, ...Object.entries(CHECKOUT_MODE_LABELS).map(([value, label]) => ({ value, label }))]}
        />
      </Field>
      <Field id="ofPayStatus" label="Payment status">
        <Select
          id="ofPayStatus"
          value={filters.paymentStatus}
          onChange={(v) => setFilter('paymentStatus', v)}
          options={[{ value: 'all', label: 'Any' }, ...PAYMENT_STATUS_OPTIONS]}
        />
      </Field>
      <Field id="ofCashier" label="Billed by">
        <Select
          id="ofCashier"
          value={filters.cashier}
          onChange={(v) => setFilter('cashier', v)}
          options={[{ value: 'all', label: 'Anyone' }, ...cashiers]}
        />
      </Field>
      <Field id="ofMin" label={`Bill total from (${currencySymbol()})`}>
        <input id="ofMin" type="number" min="0" className="toolbar-select" value={filters.minAmount} onChange={(e) => setFilter('minAmount', e.target.value)} />
      </Field>
      <Field id="ofMax" label={`Bill total up to (${currencySymbol()})`}>
        <input id="ofMax" type="number" min="0" className="toolbar-select" value={filters.maxAmount} onChange={(e) => setFilter('maxAmount', e.target.value)} />
      </Field>
      <Field id="ofItems" label="At least this many items">
        <input id="ofItems" type="number" min="1" className="toolbar-select" value={filters.minItems} onChange={(e) => setFilter('minItems', e.target.value)} />
      </Field>
      <Field id="ofProduct" label="Contains product">
        <Select
          id="ofProduct"
          value={filters.product}
          onChange={(v) => setFilter('product', v)}
          options={[{ value: 'all', label: 'Any product' }, ...products.map((p) => ({ value: p.productId, label: p.name }))]}
        />
      </Field>
      <Field id="ofCategory" label="Contains category">
        <Select
          id="ofCategory"
          value={filters.category}
          onChange={(v) => setFilter('category', v)}
          options={[{ value: 'all', label: 'Any category' }, ...categories]}
        />
      </Field>
      <Field id="ofWeekday" label="Day of week">
        <Select id="ofWeekday" value={filters.weekday} onChange={(v) => setFilter('weekday', v)} options={[{ value: 'all', label: 'Any day' }, ...WEEKDAYS]} />
      </Field>
      <Field id="ofHour" label="Time of day">
        <Select
          id="ofHour"
          value={filters.hourBand}
          onChange={(v) => setFilter('hourBand', v)}
          options={[{ value: 'all', label: 'Any time' }, ...HOUR_BANDS.map((b) => ({ value: b.value, label: b.label }))]}
        />
      </Field>
      <Field id="ofCustomer" label="Customer">
        <Select
          id="ofCustomer"
          value={filters.customerKind}
          onChange={(v) => setFilter('customerKind', v)}
          options={[
            { value: 'all', label: 'Everyone' },
            { value: 'first', label: 'First-time customers' },
            { value: 'repeat', label: 'Repeat customers' },
          ]}
        />
      </Field>
      <Field id="ofReturned" label="Returns">
        <label htmlFor="ofReturned" style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.85rem' }}>
          <input id="ofReturned" type="checkbox" checked={filters.returnedOnly} onChange={(e) => setFilter('returnedOnly', e.target.checked)} />
          Only orders with a refund
        </label>
      </Field>
    </div>
  );
}
