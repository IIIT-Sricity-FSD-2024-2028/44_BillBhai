import useViewState from '../../hooks/useViewState.js';
import Modal from '../common/Modal.jsx';
import FormField from '../common/FormField.jsx';
import { isValidEmailAddress, isValidPhoneNumber } from '../../lib/dashboard/helpers.js';

/** A select option may be a plain string or { value, label }. */
const optionValue = (opt) => String(opt && typeof opt === 'object' ? opt.value : opt);
const optionLabel = (opt) => String(opt && typeof opt === 'object' ? opt.label : opt);

export default function QuickFormModal({ config, onClose }) {
  const { title, submitLabel, fields = [], initialValues, onSubmit } = config;
  const [formError, setFormError] = useViewState(null); // null = hidden

  const valueFor = (f) =>
    initialValues && Object.prototype.hasOwnProperty.call(initialValues, f.name)
      ? initialValues[f.name]
      : f.defaultValue || '';

  const startValue = (f) => {
    const value = String(valueFor(f));
    if (f.type !== 'select') return value;
    const opts = (f.options || []).map(optionValue);
    return opts.includes(value) ? value : opts[0] || '';
  };

  // Lazy initial state: built once when the modal mounts.
  const [values, setValues] = useViewState(() =>
    Object.fromEntries(fields.map((f) => [f.name, startValue(f)])),
  );

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
      if (
        raw &&
        (field.type === 'tel' || field.validation === 'phone') &&
        !isValidPhoneNumber(raw)
      ) {
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
      <form onSubmit={handleSubmit}>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {fields.map((f) => {
          if (f.type === 'select') {
            return (
              <FormField label={f.label} key={f.name}>
                <select
                  className="form-control"
                  name={f.name}
                  required={!!f.required}
                  value={values[f.name]}
                  onChange={handleChange}
                >
                  {(f.options || []).map((opt) => (
                    <option key={optionValue(opt)} value={optionValue(opt)}>
                      {optionLabel(opt)}
                    </option>
                  ))}
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
        <div
          className="text-sm"
          style={{ color: 'var(--red)', display: formError === null ? 'none' : 'block' }}
          data-form-error=""
        >
          {formError || ''}
        </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" type="button" data-action="cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit">
            {submitLabel || 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
