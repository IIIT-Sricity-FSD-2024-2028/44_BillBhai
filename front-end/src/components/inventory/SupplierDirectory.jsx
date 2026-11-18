import { useEffect, useState } from 'react';
import DataTable from '../common/DataTable.jsx';
import Modal from '../common/Modal.jsx';
import FormField, { controlClass } from '../common/FormField.jsx';
import { api } from '../../lib/http.js';
import { DANGER_BTN, EMAIL, GSTIN, SMALL_BTN, WHOLE, formatMobile, mobileDigits } from './inventoryUtils.js';

const BLANK = { name: '', contactPerson: '', mobileNo: '', email: '', address: '', gstNo: '', leadTimeDays: '2', moq: '0' };

function SupplierFormModal({ supplier, open, onClose, onSaved }) {
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      supplier
        ? {
            name: supplier.name || '',
            contactPerson: supplier.contactPerson || '',
            mobileNo: supplier.mobileNo || '',
            email: supplier.email || '',
            address: supplier.address || '',
            gstNo: supplier.gstNo || '',
            leadTimeDays: String(supplier.leadTimeDays ?? 2),
            moq: String(supplier.moq ?? 0),
          }
        : BLANK,
    );
    setErrors({});
    setServerError('');
    setSaving(false);
  }, [open, supplier]);

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((p) => ({ ...p, [key]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const p = {};
    if (form.name.trim().length < 2) p.name = 'Name must be at least 2 characters.';
    if (!mobileDigits(form.mobileNo)) p.mobileNo = 'Enter a 10-digit mobile number.';
    if (form.email.trim() && !EMAIL.test(form.email.trim())) p.email = 'Enter a valid email address.';
    if (form.gstNo.trim() && !GSTIN.test(form.gstNo.trim().toUpperCase())) p.gstNo = 'GSTIN must be 15 characters, e.g. 07AABCF1234K1Z5.';
    if (!WHOLE.test(form.leadTimeDays.trim()) || Number(form.leadTimeDays) > 90) p.leadTimeDays = 'Lead time: whole days, 0–90.';
    if (!WHOLE.test(form.moq.trim())) p.moq = 'Minimum order: a whole number.';
    setErrors(p);
    if (Object.keys(p).length) return;
    const body = {
      name: form.name.trim(),
      contactPerson: form.contactPerson.trim(),
      mobileNo: mobileDigits(form.mobileNo),
      email: form.email.trim(),
      address: form.address.trim(),
      gstNo: form.gstNo.trim().toUpperCase(),
      leadTimeDays: Number(form.leadTimeDays),
      moq: Number(form.moq),
    };
    setSaving(true);
    setServerError('');
    try {
      if (supplier) {
        await api(`/suppliers/${encodeURIComponent(supplier.id)}`, { method: 'PUT', body: { ...body, version: supplier.version } });
        onSaved(`${body.name} updated.`);
      } else {
        const created = await api('/suppliers', { method: 'POST', body });
        onSaved(`${created.name} added (${created.id}).`);
      }
    } catch (err) {
      setServerError(err.message || 'Could not save the supplier.');
      setSaving(false);
    }
  };

  const field = (key, label, props = {}) => (
    <FormField label={label} htmlFor={`sup_${key}`} error={errors[key] || ''} invalid={errors[key] ? true : undefined} hint={props.hint}>
      <input id={`sup_${key}`} className={controlClass(errors[key])} value={form[key]} onChange={set(key)} inputMode={props.inputMode} placeholder={props.placeholder} maxLength={props.maxLength} />
    </FormField>
  );

  return (
    <Modal open={open} id="supplierFormModal" title={supplier ? `Edit ${supplier.name}` : 'Add supplier'} onClose={onClose} maxWidth="600px">
      <form noValidate onSubmit={submit}>
        <div className="modal-body">
          {serverError && <div className="form-error" style={{ display: 'block', marginBottom: '12px' }}>{serverError}</div>}
          <div className="form-row">
            {field('name', 'Supplier name *', { maxLength: 80 })}
            {field('contactPerson', 'Contact person', { maxLength: 60 })}
          </div>
          <div className="form-row">
            {field('mobileNo', 'Mobile *', { inputMode: 'numeric', placeholder: '10-digit mobile' })}
            {field('email', 'Email', { maxLength: 120 })}
          </div>
          {field('address', 'Address', { maxLength: 200 })}
          <div className="form-row">
            {field('gstNo', 'GSTIN', { maxLength: 15, placeholder: '07AABCF1234K1Z5' })}
            {field('leadTimeDays', 'Lead time (days) *', { inputMode: 'numeric', hint: 'Days from order to delivery.' })}
          </div>
          {field('moq', 'Minimum order quantity *', { inputMode: 'numeric' })}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : supplier ? 'Save changes' : 'Add supplier'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** The business's real supplier records, with how many products each supplies. */
export default function SupplierDirectory({ suppliers, canManage, onSaved, onError, openConfirm }) {
  const [editing, setEditing] = useState({ open: false, supplier: null });
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const rows = suppliers
    .filter((s) => !q || `${s.name} ${s.contactPerson || ''} ${s.mobileNo} ${s.email || ''} ${s.gstNo || ''}`.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name));

  const remove = (s) =>
    openConfirm({
      title: 'Delete supplier',
      message: `Delete ${s.name}? This cannot be undone.`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          await api(`/suppliers/${encodeURIComponent(s.id)}`, { method: 'DELETE' });
        } catch (err) {
          onError(err.message || 'Could not delete the supplier.');
          return true;
        }
        onSaved(`${s.name} deleted.`);
        return true;
      },
    });

  return (
    <section className="card">
      <div className="card-hd" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <h3>Suppliers ({suppliers.length})</h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input type="search" className="toolbar-select" placeholder="Search suppliers" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search suppliers" />
          {canManage && (
            <button className="btn btn-primary" onClick={() => setEditing({ open: true, supplier: null })}>
              + Add supplier
            </button>
          )}
        </div>
      </div>
      <div className="card-bd">
        <DataTable
          columns={[
            { header: 'Supplier', render: (s) => (<>{s.name}<div className="text-sm text-muted">{s.id}</div></>), cellClassName: 'cell-main' },
            {
              header: 'Contact',
              render: (s) => (
                <>
                  {s.contactPerson || '—'}
                  <div className="text-sm text-muted nowrap">{formatMobile(s.mobileNo)}</div>
                  {s.email && <div className="text-sm text-muted">{s.email}</div>}
                </>
              ),
            },
            { header: 'GSTIN', render: (s) => s.gstNo || '—' },
            { header: 'Lead time', render: (s) => `${s.leadTimeDays ?? '—'} days` },
            { header: 'Min. order', render: (s) => s.moq ?? '—' },
            { header: 'Products', render: (s) => s.productCount ?? 0 },
            {
              header: '',
              render: (s) =>
                canManage ? (
                  <>
                    <button className="btn btn-outline" style={SMALL_BTN} onClick={() => setEditing({ open: true, supplier: s })}>
                      Edit
                    </button>
                    <button className="btn btn-outline" style={DANGER_BTN} onClick={() => remove(s)} title={s.productCount ? 'Move its products to another supplier first' : undefined}>
                      Delete
                    </button>
                  </>
                ) : null,
            },
          ]}
          rows={rows}
          getRowKey={(s) => s.id}
          emptyMessage={suppliers.length ? 'No suppliers match the search.' : 'No suppliers yet. Add one to start adding products.'}
        />
      </div>
      <SupplierFormModal
        open={editing.open}
        supplier={editing.supplier}
        onClose={() => setEditing({ open: false, supplier: null })}
        onSaved={(msg) => {
          setEditing({ open: false, supplier: null });
          onSaved(msg);
        }}
      />
    </section>
  );
}
