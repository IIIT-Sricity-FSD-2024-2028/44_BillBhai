import { useEffect, useState } from 'react';
import Modal from '../common/Modal.jsx';
import FormField, { controlClass } from '../common/FormField.jsx';
import { api } from '../../lib/http.js';
import { currencySymbol } from '../../lib/currency.js';
import {
  BARCODE,
  CATEGORY_SUGGESTIONS,
  GST_RATES,
  MONEY,
  WHOLE,
  mobileDigits,
} from './inventoryUtils.js';

const NEW_SUPPLIER = '__new__';

function blankForm() {
  return {
    name: '',
    category: '',
    supplierId: '',
    barcode: '',
    price: '',
    costPrice: '',
    gstRate: '5',
    size: '',
    openingStock: '0',
    reorderLevel: '10',
    location: 'Shelf',
    newSupplierName: '',
    newSupplierPhone: '',
    newSupplierContact: '',
  };
}

function formFromItem(item) {
  return {
    ...blankForm(),
    name: item.name,
    category: item.cat,
    supplierId: item.supplierId,
    barcode: item.barcode || '',
    price: String(item.price ?? ''),
    costPrice: item.costPrice === undefined || item.costPrice === null ? '' : String(item.costPrice),
    gstRate: String(item.gstRate ?? 5),
    size: item.size || '',
    reorderLevel: String(item.reorderLevel ?? 10),
    location: item.location || 'Shelf',
  };
}

/** Returns { field: message } for every problem in the form. */
function validate(form, mode, stockItem) {
  const e = {};
  const name = form.name.trim();
  if (name.length < 2 || name.length > 80) e.name = 'Name must be 2–80 characters.';
  const cat = form.category.trim();
  if (cat.length < 2 || cat.length > 40) e.category = 'Category must be 2–40 characters.';
  if (!form.supplierId) e.supplierId = 'Pick a supplier.';
  if (form.supplierId === NEW_SUPPLIER) {
    if (form.newSupplierName.trim().length < 2) e.newSupplierName = 'Supplier name must be at least 2 characters.';
    if (!mobileDigits(form.newSupplierPhone)) e.newSupplierPhone = 'Enter a 10-digit mobile number.';
  }
  if (form.barcode.trim() && !BARCODE.test(form.barcode.trim()))
    e.barcode = 'Barcode: 3–20 letters, digits or hyphens.';
  const price = form.price.trim();
  if (!MONEY.test(price) || Number(price) <= 0) e.price = 'Price must be more than 0, with at most 2 decimals.';
  else if (Number(price) > 1000000) e.price = 'Price is too high.';
  const cost = form.costPrice.trim();
  if (cost) {
    if (!MONEY.test(cost)) e.costPrice = 'Cost must be a number with at most 2 decimals.';
    else if (MONEY.test(price) && Number(cost) > Number(price)) e.costPrice = 'Cost cannot be more than the selling price.';
  }
  if (form.size.trim().length > 40) e.size = 'Size must be at most 40 characters.';
  if (mode === 'add') {
    if (!WHOLE.test(form.openingStock.trim()) || Number(form.openingStock) > 1000000)
      e.openingStock = 'Opening stock must be a whole number (0 or more).';
  }
  if (!WHOLE.test(form.reorderLevel.trim()) || Number(form.reorderLevel) > 100000)
    e.reorderLevel = 'Reorder level must be a whole number (0 or more).';
  const loc = form.location.trim();
  if (!loc || loc.length > 60) e.location = 'Location is required (up to 60 characters).';
  if (mode === 'edit' && !stockItem) e.form = 'This product is no longer in the list. Close and try again.';
  return e;
}

/**
 * Add or edit a product. Stock is never typed here: a new product gets an
 * opening stock, and later changes go through Receive / Adjust so every
 * change has a reason in the stock ledger.
 */
export default function ProductFormModal({ request, onClose, suppliers, categories, onSaved, onAdjust, onReceive, onRefresh }) {
  const open = Boolean(request);
  const mode = request ? request.mode : 'add';
  const item = request ? request.item : null;
  const [form, setForm] = useState(blankForm);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!request) return;
    setForm(request.mode === 'edit' && request.item ? formFromItem(request.item) : blankForm());
    setErrors({});
    setServerError('');
    setSaving(false);
  }, [request]);

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const problems = validate(form, mode, item);
    setErrors(problems);
    if (Object.keys(problems).length) return;
    setSaving(true);
    setServerError('');
    try {
      let supplierId = form.supplierId;
      if (supplierId === NEW_SUPPLIER) {
        const created = await api('/suppliers', {
          method: 'POST',
          body: {
            name: form.newSupplierName.trim(),
            mobileNo: mobileDigits(form.newSupplierPhone),
            contactPerson: form.newSupplierContact.trim() || undefined,
          },
        });
        supplierId = created.id;
        setForm((f) => ({ ...f, supplierId }));
        if (onRefresh) onRefresh();
      }
      const product = {
        name: form.name.trim(),
        category: form.category.trim(),
        supplierId,
        price: Number(form.price),
        gstRate: Number(form.gstRate),
        size: form.size.trim() || undefined,
      };
      if (form.costPrice.trim()) product.costPrice = Number(form.costPrice);
      if (form.barcode.trim()) product.barcode = form.barcode.trim();

      if (mode === 'add') {
        const created = await api('/products', {
          method: 'POST',
          body: {
            ...product,
            openingStock: Number(form.openingStock),
            reorderLevel: Number(form.reorderLevel),
            location: form.location.trim(),
          },
        });
        onSaved(`${created.name} added (${created.id}) with ${Number(form.openingStock)} in stock.`);
      } else {
        // Only send what changed, with the version the form was opened at.
        const changes = {};
        if (product.name !== item.name) changes.name = product.name;
        if (product.category !== item.cat) changes.category = product.category;
        if (product.supplierId !== item.supplierId) changes.supplierId = product.supplierId;
        if (product.price !== Number(item.price)) changes.price = product.price;
        if (product.gstRate !== Number(item.gstRate)) changes.gstRate = product.gstRate;
        if ((product.size || '') !== (item.size || '')) changes.size = product.size || '';
        if (product.costPrice !== undefined && product.costPrice !== item.costPrice) changes.costPrice = product.costPrice;
        if ((product.barcode || '') !== (item.barcode || '') && product.barcode) changes.barcode = product.barcode;
        const shelf = {};
        if (Number(form.reorderLevel) !== Number(item.reorderLevel)) shelf.reorderLevel = Number(form.reorderLevel);
        if (form.location.trim() !== item.location) shelf.location = form.location.trim();
        if (!Object.keys(changes).length && !Object.keys(shelf).length) {
          onClose();
          return;
        }
        if (Object.keys(changes).length) {
          await api(`/products/${encodeURIComponent(item.productId)}`, {
            method: 'PUT',
            body: { ...changes, version: item.productVersion },
          });
        }
        if (Object.keys(shelf).length) {
          await api(`/inventory/${encodeURIComponent(item.inventoryId)}`, {
            method: 'PUT',
            // No version here: stock movements bump the row's version, and a
            // sale since the form opened should not block a reorder-level edit.
            body: shelf,
          });
        }
        onSaved(`${product.name} updated.`);
      }
    } catch (err) {
      setServerError(err.message || 'Could not save the product.');
      setSaving(false);
    }
  };

  const err = (key) => errors[key];
  const categoryOptions = Array.from(new Set([...CATEGORY_SUGGESTIONS, ...categories])).sort();

  return (
    <Modal open={open} id="productFormModal" title={mode === 'edit' ? `Edit ${item ? item.name : 'product'}` : 'Add product'} onClose={onClose} maxWidth="640px">
      <form noValidate onSubmit={submit}>
        <div className="modal-body">
          {serverError && (
            <div className="form-error" style={{ display: 'block', marginBottom: '12px' }}>
              {serverError}
            </div>
          )}
          {errors.form && (
            <div className="form-error" style={{ display: 'block', marginBottom: '12px' }}>
              {errors.form}
            </div>
          )}
          <div className="form-row">
            <FormField label="Product name *" htmlFor="pfName" error={err('name') || ''} invalid={err('name') ? true : undefined}>
              <input id="pfName" className={controlClass(err('name'))} value={form.name} onChange={set('name')} maxLength={80} />
            </FormField>
            <FormField label="Category *" htmlFor="pfCategory" error={err('category') || ''} invalid={err('category') ? true : undefined}>
              <input id="pfCategory" list="pfCategoryList" className={controlClass(err('category'))} value={form.category} onChange={set('category')} maxLength={40} />
              <datalist id="pfCategoryList">
                {categoryOptions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </FormField>
          </div>

          <FormField label="Supplier *" htmlFor="pfSupplier" error={err('supplierId') || ''} invalid={err('supplierId') ? true : undefined}>
            <select id="pfSupplier" className={controlClass(err('supplierId'))} value={form.supplierId} onChange={set('supplierId')}>
              <option value="">Select supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.contactPerson ? ` (${s.contactPerson})` : ''}
                </option>
              ))}
              <option value={NEW_SUPPLIER}>+ New supplier…</option>
            </select>
          </FormField>
          {form.supplierId === NEW_SUPPLIER && (
            <div className="form-row">
              <FormField label="New supplier name *" htmlFor="pfNewSupName" error={err('newSupplierName') || ''} invalid={err('newSupplierName') ? true : undefined}>
                <input id="pfNewSupName" className={controlClass(err('newSupplierName'))} value={form.newSupplierName} onChange={set('newSupplierName')} />
              </FormField>
              <FormField label="Supplier mobile *" htmlFor="pfNewSupPhone" error={err('newSupplierPhone') || ''} invalid={err('newSupplierPhone') ? true : undefined}>
                <input id="pfNewSupPhone" type="tel" inputMode="numeric" className={controlClass(err('newSupplierPhone'))} value={form.newSupplierPhone} onChange={set('newSupplierPhone')} placeholder="10-digit mobile" />
              </FormField>
            </div>
          )}

          <div className="form-row">
            <FormField label={`Selling price (${currencySymbol()}, incl. GST) *`} htmlFor="pfPrice" error={err('price') || ''} invalid={err('price') ? true : undefined}>
              <input id="pfPrice" inputMode="decimal" className={controlClass(err('price'))} value={form.price} onChange={set('price')} placeholder="e.g. 120" />
            </FormField>
            <FormField label={`Cost price (${currencySymbol()})`} htmlFor="pfCost" error={err('costPrice') || ''} invalid={err('costPrice') ? true : undefined} hint="What you pay the supplier per unit.">
              <input id="pfCost" inputMode="decimal" className={controlClass(err('costPrice'))} value={form.costPrice} onChange={set('costPrice')} />
            </FormField>
          </div>
          <div className="form-row">
            <FormField label="GST rate *" htmlFor="pfGst">
              <select id="pfGst" className="form-control" value={form.gstRate} onChange={set('gstRate')}>
                {GST_RATES.map((r) => (
                  <option key={r} value={String(r)}>
                    {r}%
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Pack size" htmlFor="pfSize" error={err('size') || ''} invalid={err('size') ? true : undefined}>
              <input id="pfSize" className={controlClass(err('size'))} value={form.size} onChange={set('size')} placeholder="e.g. 1kg, 500ml" />
            </FormField>
          </div>
          <FormField label="Barcode" htmlFor="pfBarcode" error={err('barcode') || ''} invalid={err('barcode') ? true : undefined} hint="Leave empty to generate one.">
            <input id="pfBarcode" className={controlClass(err('barcode'))} value={form.barcode} onChange={set('barcode')} />
          </FormField>

          <div className="form-row">
            {mode === 'add' ? (
              <FormField label="Opening stock *" htmlFor="pfStock" error={err('openingStock') || ''} invalid={err('openingStock') ? true : undefined} hint="Units on the shelf right now.">
                <input id="pfStock" inputMode="numeric" className={controlClass(err('openingStock'))} value={form.openingStock} onChange={set('openingStock')} />
              </FormField>
            ) : (
              <FormField label="Stock on hand" htmlFor="pfStockRO" hint="Change stock with Receive or Adjust, so the reason is recorded.">
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input id="pfStockRO" className="form-control" value={item ? item.stock : ''} readOnly style={{ maxWidth: '90px' }} />
                  <button type="button" className="btn btn-outline" onClick={() => onReceive(item)}>
                    Receive
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => onAdjust(item)}>
                    Adjust
                  </button>
                </div>
              </FormField>
            )}
            <FormField label="Reorder level *" htmlFor="pfReorder" error={err('reorderLevel') || ''} invalid={err('reorderLevel') ? true : undefined} hint="Alert when stock falls to this.">
              <input id="pfReorder" inputMode="numeric" className={controlClass(err('reorderLevel'))} value={form.reorderLevel} onChange={set('reorderLevel')} />
            </FormField>
          </div>
          <FormField label="Shelf location *" htmlFor="pfLocation" error={err('location') || ''} invalid={err('location') ? true : undefined}>
            <input id="pfLocation" className={controlClass(err('location'))} value={form.location} onChange={set('location')} />
          </FormField>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Add product'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
