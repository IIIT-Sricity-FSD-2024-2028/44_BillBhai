// "Account Preferences" card (#profileSettingsForm). Fully controlled: the
// parent owns `values`, `errors` (per-field undefined | true | false, see
// FormField) and the notification toggles.
import FormField, { controlClass } from '../common/FormField.jsx';

const TOGGLE_LABEL_STYLE = { display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' };
const TOGGLES_WRAP_STYLE = { marginTop: '6px', paddingTop: '12px', borderTop: '1px solid var(--border)', display: 'grid', gap: '10px' };

export default function AccountPreferencesForm({ values, errors, notificationOptions, onFieldChange, onToggleChange, onSubmit }) {
  const field = (key) => ({ value: values[key], onChange: (e) => onFieldChange(key, e.target.value) });

  return (
    <section className="card" style={{ marginTop: '14px' }}>
      <div className="card-hd"><h3>Account Preferences</h3></div>
      <div className="card-bd">
        <form id="profileSettingsForm" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
          <div className="form-row">
            <FormField label="Full Name" error="Full name is required." invalid={errors.fullName}>
              <input id="psFullName" className={controlClass(errors.fullName)} {...field('fullName')} />
            </FormField>
            <FormField label="Email" error="Enter a valid email address." invalid={errors.email}>
              <input id="psEmail" type="email" className={controlClass(errors.email)} {...field('email')} />
            </FormField>
          </div>
          <div className="form-row">
            <FormField label="Phone" error="Enter a valid 10-digit phone number." invalid={errors.phone}>
              <input id="psPhone" className={controlClass(errors.phone)} maxLength={10} inputMode="numeric" placeholder="10-digit mobile" {...field('phone')} />
            </FormField>
            <FormField label="Location">
              <input id="psLocation" className="form-control" placeholder="Store or city" {...field('location')} />
            </FormField>
          </div>
          <FormField label="Bio">
            <textarea id="psBio" className="form-control" rows={3} style={{ resize: 'vertical' }} {...field('bio')} />
          </FormField>
          <div className="form-row">
            <FormField label="Language">
              <select id="psLanguage" className="form-control" {...field('language')}><option>English (India)</option><option>Hindi</option><option>Tamil</option></select>
            </FormField>
            <FormField label="Currency">
              <select id="psCurrency" className="form-control" {...field('currency')}><option value="INR">INR</option><option value="USD">USD</option></select>
            </FormField>
          </div>
          <div className="form-row">
            <FormField label="Timezone">
              <select id="psTimezone" className="form-control" {...field('timezone')}><option value="Asia/Kolkata">Asia/Kolkata</option><option value="UTC">UTC</option></select>
            </FormField>
            <FormField label="Date Format">
              <select id="psDateFormat" className="form-control" {...field('dateFormat')}><option>DD/MM/YYYY</option><option>MM/DD/YYYY</option></select>
            </FormField>
          </div>
          <div style={TOGGLES_WRAP_STYLE}>
            {notificationOptions.length ? notificationOptions.map((option) => (
              <label className="text-sm" style={TOGGLE_LABEL_STYLE} key={option.key}>
                <span>{option.label}</span>
                <input id={`psNotif_${option.key}`} data-notification-key={option.key} type="checkbox" checked={Boolean(values.notifications[option.key])} onChange={(e) => onToggleChange(option.key, e.target.checked)} />
              </label>
            )) : <div className="text-sm text-muted">No notification preferences available for this role.</div>}
          </div>
        </form>
      </div>
    </section>
  );
}
