import { useEffect, useState } from 'react';
import FormField, { controlClass } from '../common/FormField.jsx';
import { api, errorText } from '../../lib/http.js';

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/;
const ROW_STYLE = { display: 'flex', flexDirection: 'column', gap: '8px' };

/**
 * Name, email and mobile as the server holds them. Admins (and the super
 * user) may edit their own details through PUT /users/:id; other staff see
 * them read-only and ask their admin.
 */
export default function ProfileDetailsCard({ me, canEdit, businessName, onSaved }) {
  const [values, setValues] = useState({ name: '', email: '', phone: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState({ text: '', ok: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (me) setValues({ name: me.name || '', email: me.email || '', phone: me.mobileNo || '' });
  }, [me]);

  if (!me) {
    return (
      <div className="card">
        <div className="card-bd text-muted">Loading your details…</div>
      </div>
    );
  }

  const save = async (e) => {
    e.preventDefault();
    setMessage({ text: '', ok: false });
    const next = {};
    if (values.name.trim().length < 2) next.name = true;
    if (!EMAIL_RE.test(values.email.trim())) next.email = true;
    const phone = values.phone.replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(phone)) next.phone = true;
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    try {
      const saved = await api(`/users/${encodeURIComponent(me.id)}`, {
        method: 'PUT',
        body: { name: values.name.trim(), email: values.email.trim(), mobileNo: phone, version: me.version },
      });
      setMessage({ text: 'Your details are saved.', ok: true });
      onSaved(saved);
    } catch (err) {
      setMessage({ text: errorText(err, 'Could not save'), ok: false });
    } finally {
      setSaving(false);
    }
  };

  const set = (key) => (e) => {
    setValues((prev) => ({ ...prev, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: false }));
  };

  return (
    <div className="card">
      <div className="card-hd">
        <h3>Your details</h3>
      </div>
      <form className="card-bd" onSubmit={save} noValidate>
        {canEdit ? (
          <>
            <FormField label="Full name" htmlFor="psFullName" error="Enter your full name." invalid={errors.name}>
              <input id="psFullName" className={controlClass(errors.name)} maxLength={80} value={values.name} onChange={set('name')} />
            </FormField>
            <FormField label="Email" htmlFor="psEmail" error="Enter a valid email address." invalid={errors.email}>
              <input id="psEmail" type="email" className={controlClass(errors.email)} value={values.email} onChange={set('email')} />
            </FormField>
            <FormField label="Mobile" htmlFor="psPhone" error="Enter a 10-digit mobile number." invalid={errors.phone}>
              <input id="psPhone" inputMode="numeric" maxLength={14} className={controlClass(errors.phone)} value={values.phone} onChange={set('phone')} />
            </FormField>
          </>
        ) : (
          <div className="text-muted" style={ROW_STYLE}>
            <div><strong>Name:</strong> {me.name}</div>
            <div><strong>Email:</strong> {me.email || '—'}</div>
            <div><strong>Mobile:</strong> {me.mobileNo || '—'}</div>
            <div className="text-sm">To change these, ask your admin.</div>
          </div>
        )}
        <div className="text-muted" style={{ ...ROW_STYLE, marginTop: '10px' }}>
          <div><strong>Username:</strong> {me.username}</div>
          {businessName && <div><strong>Business:</strong> {businessName}</div>}
        </div>
        {message.text && (
          <p className="text-sm" role="status" style={{ color: message.ok ? 'var(--green)' : 'var(--red)', margin: '10px 0 0' }}>
            {message.text}
          </p>
        )}
        {canEdit && (
          <button type="submit" className="btn btn-primary" style={{ marginTop: '12px' }} disabled={saving}>
            {saving ? 'Saving…' : 'Save details'}
          </button>
        )}
      </form>
    </div>
  );
}
