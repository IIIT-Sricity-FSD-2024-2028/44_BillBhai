// Static #addProductModal of inventory.html + handleAddProduct() /
// closeAddProductModal() / field-error helpers from dashboard.js.
// The page opens it through `request` ({ id, mode: 'add' | 'edit', values });
// every new request re-runs the reset done by openAddProductModal()/editProduct().
import { useState } from 'react';
import Modal from '../common/Modal.jsx';
import FormField from '../common/FormField.jsx';
import LegacySelect, { effectiveSelectValue } from '../common/LegacySelect.jsx';
import { useDashboard, useInventory } from '../../lib/dashboard/hooks.js';
import { isNotFoundError } from '../../lib/dashboard/api.js';
import {
  determineStatus,
  getNextSku,
  getSupplierDetails,
  isValidEmailAddress,
  isValidPhoneNumber,
  normalizePhoneDigits,
} from '../../lib/dashboard/helpers.js';

export const CATEGORY_OPTIONS = [
  { value: '', label: 'Select category' },
  'Grocery', 'Dairy', 'Beverages', 'Snacks', 'Personal Care', 'Other',
];
export const STATUS_OPTIONS = ['In Stock', 'Low Stock', 'Critical', 'Out of Stock'];

export const EMPTY_PRODUCT_FORM = {
  sku: '', name: '', category: '', supplier: '', supplierPhone: '', supplierEmail: '',
  leadTime: '', price: '', stock: '', status: 'In Stock',
};

const TEXTS = {
  add: { title: 'Add New Product', submit: 'Add Product' },
  edit: { title: 'Edit Product', submit: 'Save Product' },
};

export default function AddProductModal({ open, request, onClose }) {
  const { hasActionAccess, denyAction, apiRequest, showMutationError, renderPage, showToast } = useDashboard();
  const { rows: inventory, setRows } = useInventory();

  const [values, setValues] = useState(EMPTY_PRODUCT_FORM);
  // `.has-error` / `.error` per field (cleared on input and on every open).
  const [errors, setErrors] = useState({});
  // Inline `.form-error` state written by setFieldError/clearFieldError (never reset by open, as in the original).
  const [fieldErrorUi, setFieldErrorUi] = useState({});
  const [seenRequest, setSeenRequest] = useState(null);

  if (request && request.id !== seenRequest) {
    setSeenRequest(request.id);
    setValues(request.values);
    setErrors({});
  }

  const mode = request && request.mode === 'edit' ? 'edit' : 'add';
  const texts = TEXTS[mode];

  const bind = (key) => ({
    value: values[key],
    onChange: (e) => {
      const next = e.target.value;
      setValues((v) => ({ ...v, [key]: next }));
      setErrors((errs) => (errs[key] ? { ...errs, [key]: false } : errs));
    },
  });
  const cls = (key) => (errors[key] ? 'form-control error' : 'form-control');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!hasActionAccess('inventory')) {
      denyAction('Inventory create/update');
      return;
    }
    let valid = true;
    const nextErrors = { ...errors };
    const nextUi = { ...fieldErrorUi };
    const category = effectiveSelectValue(CATEGORY_OPTIONS, values.category);
    const checks = [
      { key: 'name', ok: values.name.trim() !== '' },
      { key: 'category', ok: category !== '' },
      { key: 'supplier', ok: values.supplier.trim() !== '' },
      { key: 'price', ok: values.price !== '' && parseFloat(values.price) >= 0 },
      { key: 'stock', ok: values.stock !== '' && parseInt(values.stock, 10) >= 0 },
    ];
    checks.forEach(({ key, ok }) => {
      nextErrors[key] = !ok;
      if (!ok) valid = false;
    });

    const supplierPhoneRaw = values.supplierPhone.trim();
    const supplierEmailRaw = values.supplierEmail.trim();
    const supplierLeadTimeRaw = values.leadTime.trim();

    if (supplierEmailRaw && !isValidEmailAddress(supplierEmailRaw)) {
      nextErrors.supplierEmail = true;
      nextUi.supplierEmail = { display: 'block', message: 'Enter a valid email address.' };
      valid = false;
    } else {
      nextErrors.supplierEmail = false;
      nextUi.supplierEmail = { ...(nextUi.supplierEmail || {}), display: 'none' };
    }

    if (supplierPhoneRaw && !isValidPhoneNumber(supplierPhoneRaw)) {
      nextErrors.supplierPhone = true;
      nextUi.supplierPhone = { display: 'block', message: 'Enter a valid 10-digit phone number.' };
      valid = false;
    } else {
      nextErrors.supplierPhone = false;
      nextUi.supplierPhone = { ...(nextUi.supplierPhone || {}), display: 'none' };
    }

    if (supplierLeadTimeRaw) {
      const leadTimeValue = Number(supplierLeadTimeRaw);
      if (!Number.isFinite(leadTimeValue) || leadTimeValue < 1) {
        nextErrors.leadTime = true;
        valid = false;
      }
    }

    setErrors(nextErrors);
    setFieldErrorUi(nextUi);
    if (!valid) return;

    const stock = parseInt(values.stock, 10);
    const selectedStatus = effectiveSelectValue(STATUS_OPTIONS, values.status);
    const sku = values.sku || getNextSku(inventory);
    const supplierName = values.supplier.trim();
    const supplierDefaults = getSupplierDetails({ supplier: supplierName });
    const leadTimeDays = supplierLeadTimeRaw
      ? Math.max(1, Math.round(Number(supplierLeadTimeRaw)))
      : supplierDefaults.leadTimeDays;

    const existingRecord = inventory.find((i) => i.sku === sku) || null;
    const pData = {
      ...(existingRecord || {}),
      sku,
      name: values.name.trim(),
      cat: category,
      supplier: supplierName,
      price: parseFloat(values.price),
      stock,
      status: determineStatus(stock, selectedStatus),
      supplierPhone: supplierPhoneRaw ? normalizePhoneDigits(supplierPhoneRaw) : supplierDefaults.phone,
      supplierEmail: supplierEmailRaw || supplierDefaults.email,
      leadTimeDays,
      supplierDetails: {
        contact: supplierDefaults.contact,
        phone: supplierPhoneRaw ? normalizePhoneDigits(supplierPhoneRaw) : supplierDefaults.phone,
        email: supplierEmailRaw || supplierDefaults.email,
        leadTimeDays,
        moq: supplierDefaults.moq,
        rating: supplierDefaults.rating,
      },
    };

    const productBody = (base) => ({
      name: pData.name,
      category: pData.cat,
      price: Number(pData.price || 0),
      barcode: String(base?.barcode || pData.sku || '').trim(),
      size: String(base?.size || '1 unit').trim(),
      description: String(base?.description || `${pData.name} (${pData.cat})`).trim(),
    });

    const createProductInBackend = async () => {
      const supplierRows = await apiRequest('/suppliers', { role: 'inventorymanager' });
      const normalizedSupplier = String(pData.supplier || '').trim().toLowerCase();
      const matchedSupplier = (Array.isArray(supplierRows) ? supplierRows : []).find((row) =>
        String((row && row.name) || '').trim().toLowerCase() === normalizedSupplier);

      const createdProduct = await apiRequest('/products', {
        method: 'POST',
        role: 'inventorymanager',
        body: {
          supplierId: String((matchedSupplier && matchedSupplier.id) || existingRecord?.supplierId || 'SUP-001').trim() || 'SUP-001',
          ...productBody(existingRecord),
        },
      });

      if (createdProduct && createdProduct.id) {
        pData.productId = createdProduct.id;
        pData.supplierId = createdProduct.supplierId || pData.supplierId;
        pData.barcode = createdProduct.barcode || pData.barcode || pData.sku;
        pData.size = createdProduct.size || pData.size || '1 unit';
        pData.description = createdProduct.description || pData.description || `${pData.name} (${pData.cat})`;
      }
    };

    try {
      if (existingRecord && existingRecord.productId) {
        try {
          await apiRequest(`/products/${encodeURIComponent(String(existingRecord.productId))}`, {
            method: 'PUT',
            role: 'inventorymanager',
            body: {
              supplierId: String(existingRecord.supplierId || 'SUP-001').trim() || 'SUP-001',
              ...productBody(existingRecord),
            },
          });
        } catch (error) {
          // Backend may have restarted and lost older in-memory product IDs.
          if (isNotFoundError(error)) await createProductInBackend();
          else throw error;
        }
      } else {
        await createProductInBackend();
      }
    } catch (error) {
      showMutationError('Product save', error);
      return;
    }

    if (existingRecord && pData.inventoryId) {
      try {
        await apiRequest(`/inventory/${encodeURIComponent(String(pData.inventoryId))}`, {
          method: 'PUT',
          role: 'inventorymanager',
          body: {
            stockAvailable: pData.stock,
            reorderLevel: Number(pData.reorderLevel || 10),
            location: String(pData.location || 'Shelf').trim(),
          },
        });
      } catch (error) {
        if (isNotFoundError(error)) {
          // Stale local pointer after backend restart; stop retrying this missing inventory row.
          pData.inventoryId = undefined;
        } else {
          showMutationError('Inventory update', error);
          return;
        }
      }
    }

    setRows((rows) => {
      const idx = rows.findIndex((i) => i.sku === sku);
      if (idx === -1) return [...rows, pData];
      return rows.map((row, i) => (i === idx ? pData : row));
    });
    renderPage();
    onClose();
    showToast(`Product "${pData.name}" saved successfully!`);
  }

  return (
    <Modal open={open} id="addProductModal" title={texts.title} onClose={onClose} closeButtonId="modalClose" closeButtonType={null}>
      <form id="addProductForm" noValidate onSubmit={handleSubmit}>
        <div className="modal-body">
          <FormField label="Product Name *" htmlFor="prodName" error="Product name is required" hasError={errors.name}>
            <input type="text" className={cls('name')} id="prodName" placeholder="e.g. Basmati Rice (5kg)" required {...bind('name')} />
          </FormField>
          <div className="form-row">
            <FormField label="SKU" htmlFor="prodSku" hint="Auto-generated based on product count">
              <input type="text" className="form-control" id="prodSku" placeholder="Auto-generated" readOnly value={values.sku} />
            </FormField>
            <FormField label="Category *" htmlFor="prodCategory" error="Please select a category" hasError={errors.category}>
              <LegacySelect className={cls('category')} id="prodCategory" required options={CATEGORY_OPTIONS} {...bind('category')} />
            </FormField>
          </div>
          <FormField label="Supplier *" htmlFor="prodSupplier" error="Supplier is required" hasError={errors.supplier}>
            <input type="text" className={cls('supplier')} id="prodSupplier" placeholder="e.g. Sharma Wholesale" required {...bind('supplier')} />
          </FormField>
          <div className="form-row">
            <FormField
              label="Supplier Phone" htmlFor="prodSupplierPhone" error="Enter a valid supplier phone" hasError={errors.supplierPhone}
              errorDisplay={fieldErrorUi.supplierPhone?.display} errorMessage={fieldErrorUi.supplierPhone?.message}
            >
              <input type="tel" className={cls('supplierPhone')} id="prodSupplierPhone" placeholder="10-digit phone" maxLength={10} inputMode="numeric" {...bind('supplierPhone')} />
            </FormField>
            <FormField
              label="Supplier Email" htmlFor="prodSupplierEmail" error="Enter a valid supplier email" hasError={errors.supplierEmail}
              errorDisplay={fieldErrorUi.supplierEmail?.display} errorMessage={fieldErrorUi.supplierEmail?.message}
            >
              <input type="email" className={cls('supplierEmail')} id="prodSupplierEmail" placeholder="supplier@domain.com" {...bind('supplierEmail')} />
            </FormField>
          </div>
          <FormField
            label="Lead Time (Days)" htmlFor="prodLeadTime" hasError={errors.leadTime} hintFirst
            hint="How many days this supplier usually takes to deliver." error="Lead time should be at least 1 day"
          >
            <input type="number" className={cls('leadTime')} id="prodLeadTime" placeholder="e.g. 3" min="1" step="1" {...bind('leadTime')} />
          </FormField>
          <div className="form-row">
            <FormField label="Unit Price (?) *" htmlFor="prodPrice" error="Enter a valid price" hasError={errors.price}>
              <input type="number" className={cls('price')} id="prodPrice" placeholder="0.00" min="0" step="0.01" required {...bind('price')} />
            </FormField>
            <FormField label="Stock Quantity *" htmlFor="prodStock" error="Enter stock quantity" hasError={errors.stock}>
              <input type="number" className={cls('stock')} id="prodStock" placeholder="0" min="0" step="1" required {...bind('stock')} />
            </FormField>
          </div>
          <FormField label="Status" htmlFor="prodStatus" hint={'Will be auto-determined by stock quantity if left as "In Stock"'}>
            <LegacySelect className={cls('status')} id="prodStatus" options={STATUS_OPTIONS} {...bind('status')} />
          </FormField>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-outline" id="modalCancel" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">{texts.submit}</button>
        </div>
      </form>
    </Modal>
  );
}
