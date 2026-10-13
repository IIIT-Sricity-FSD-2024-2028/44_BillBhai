import { useState } from 'react';
import Modal from '../common/Modal.jsx';
import FormField from '../common/FormField.jsx';
import { isValidEmailAddress, isValidPhoneNumber } from '../../lib/dashboard/helpers.js';

/**
 * Port of openQuickFormModal({ title, submitLabel, fields, initialValues, onSubmit }).
 *
 * fields: [{ name, label, type = 'text' | 'number' | 'email' | 'tel' | 'select' | ...,
 *            options (select), required, placeholder, min, step, maxLength,
 *            inputMode, validation: 'phone', defaultValue }]
 * onSubmit(values, closeModal): the modal only closes when closeModal() is
 * called. A rejected promise keeps it open.
 *
 * Controlled form: every input's value lives in the `values` state object
 * (keyed by field name) and each keystroke goes through handleChange.
 */
export default function QuickFormModal({ config, onClose }) {
  const { title, submitLabel, fields = [], initialValues, onSubmit } = config;
  const [formError, setFormError] = useState(null); // null = hidden

  const valueFor = (f) => (initialValues && Object.prototype.hasOwnProperty.call(initialValues, f.name) ? initialValues[f.name] : (f.defaultValue || ''));

  // A select starts on its matching option, or on the first one (as the browser would).
  const startValue = (f) => {
    const value = String(valueFor(f));
    if (f.type !== 'select') return value;
    const opts = (f.options || []).map(String);
    return opts.includes(value) ? value : (opts[0] || '');
  };

  // Lazy initial state: built once when the modal mounts.
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f.name, startValue(f)])));

  const handleChange = (e) => {
    const { name, value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleaned = {};
    for (const field of fields) {
      const raw = String(values[field.name] ?? '').trim();
      if (field.required && !raw) {
        setFormError(`${field.label} is required.`);
        return;
      }
      if (raw && field.type === 'email' && !isValidEmailAddress(raw)) {
        setFormError(`${field.label} must be a valid email address.`);
        return;
      }
      if (raw && (field.type === 'tel' || field.validation === 'phone') && !isValidPhoneNumber(raw)) {
        setFormError(`${field.label} must be a valid 10-digit phone number.`);
        return;
      }
      if (field.type === 'number' && raw !== '') {
        const n = Number(raw);
        if (Number.isNaN(n) || (field.min !== undefined && n < field.min)) {
          setFormError(`${field.label} is invalid.`);
          return;
        }
        cleaned[field.name] = n;
      } else {
        cleaned[field.name] = raw;
      }
    }
    setFormError(null);
    Promise.resolve(onSubmit(cleaned, onClose)).catch(() => {
      // Keep modal open on submission failure.
    });
  };

  return (
    <Modal title={title} onClose={onClose} maxWidth="540px">
      <form className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }} onSubmit={handleSubmit}>
        {fields.map((f) => {
          if (f.type === 'select') {
            return (
              <FormField label={f.label} key={f.name}>
                <select className="form-control" name={f.name} required={!!f.required} value={values[f.name]} onChange={handleChange}>
                  {(f.options || []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </FormField>
            );
          }
          return (
            <FormField label={f.label} key={f.name}>
              <input
                className="form-control"
                name={f.name}
                type={f.type || 'text'}
                value={values[f.name]}
                onChange={handleChange}
                placeholder={f.placeholder || ''}
                min={f.min}
                step={f.step}
                maxLength={f.maxLength}
                inputMode={f.inputMode || undefined}
                required={!!f.required}
              />
            </FormField>
          );
        })}
        <div className="text-sm" style={{ color: 'var(--red)', display: formError === null ? 'none' : 'block' }} data-form-error="">{formError || ''}</div>
        <div className="modal-footer" style={{ marginTop: '6px' }}>
          <button className="btn btn-outline" type="button" data-action="cancel" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" type="submit">{submitLabel || 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}
