// React port of renderProfileSettingsUnified() in dashboard.js (what
// renderPage('profile') renders; it replaces the static profile.html markup).
import { useState } from 'react';
import PageHeader from '../common/PageHeader.jsx';
import ProfileIdentityCard from './ProfileIdentityCard.jsx';
import SecurityCard from './SecurityCard.jsx';
import SubscriptionPlanCard from './SubscriptionPlanCard.jsx';
import RecentActivityCard from './RecentActivityCard.jsx';
import AccountPreferencesForm from './AccountPreferencesForm.jsx';
import { useDashboard } from '../../lib/dashboard/hooks.js';
import { ROLE_LABELS } from '../../lib/dashboard/constants.js';
import {
  getRecentProfileActivity,
  isValidEmailAddress,
  isValidPhoneNumber,
  normalizeEditablePhone,
  normalizePhoneDigits,
} from '../../lib/dashboard/helpers.js';
import {
  getNotificationPreferenceConfig,
  normalizeNotificationPreferences,
  updatePasswordOverrideForCurrentUser,
} from '../../lib/dashboard/notifications.js';

const COLUMN_STYLE = { display: 'flex', flexDirection: 'column', gap: '16px' };

// A <select> whose saved value matches no option shows (and later saves) its first option.
function pickOption(value, options) {
  return options.includes(value) ? value : options[0];
}

function initialFormValues(profile) {
  return {
    fullName: profile.fullName,
    email: profile.email,
    phone: normalizeEditablePhone(profile.phone),
    location: profile.location,
    bio: profile.bio,
    language: pickOption(profile.language, ['English (India)', 'Hindi', 'Tamil']),
    currency: pickOption(profile.currency, ['INR', 'USD']),
    timezone: pickOption(profile.timezone, ['Asia/Kolkata', 'UTC']),
    dateFormat: pickOption(profile.dateFormat, ['DD/MM/YYYY', 'MM/DD/YYYY']),
    notifications: { ...profile.notifications },
  };
}

/**
 * `onSaved` re-mounts this component (the original re-ran
 * renderProfileSettingsUnified() after a successful save).
 */
export default function ProfileContent({ onSaved }) {
  const {
    state, roleKey, orders, returns, deliveries, inventory, users, activePlan,
    loadProfileSettingsRecord, saveProfileSettings, showToast, openPlanUpgrade, cancelSubscription,
  } = useDashboard();

  const [profile] = useState(() => loadProfileSettingsRecord());
  const [values, setValues] = useState(() => initialFormValues(profile));
  const [errors, setErrors] = useState({});
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const notificationOptions = getNotificationPreferenceConfig(roleKey);
  const activityItems = getRecentProfileActivity({ orders, returns, deliveries, inventory });
  const showPlanCard = roleKey === 'admin' || roleKey === 'superuser';

  // Every .form-control in the form cleared its own error on input.
  const onFieldChange = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (key === 'fullName' || key === 'email' || key === 'phone') {
      setErrors((prev) => ({ ...prev, [key]: false }));
    }
  };
  const onToggleChange = (key, checked) => {
    setValues((prev) => ({ ...prev, notifications: { ...prev.notifications, [key]: checked } }));
  };

  const saveProfile = () => {
    const cleared = { fullName: false, email: false, phone: false };
    const fullName = String(values.fullName || '').trim();
    const email = String(values.email || '').trim();
    const phone = normalizePhoneDigits(values.phone || '');
    if (!fullName) {
      setErrors({ ...cleared, fullName: true });
      return;
    }
    if (!isValidEmailAddress(email)) {
      setErrors({ ...cleared, email: true });
      return;
    }
    if (phone && !isValidPhoneNumber(phone)) {
      setErrors({ ...cleared, phone: true });
      return;
    }
    setErrors(cleared);

    const nextRecord = {
      key: profile.key,
      fullName,
      email,
      phone,
      location: String(values.location || '').trim(),
      bio: String(values.bio || '').trim(),
      language: String(values.language || 'English (India)').trim(),
      currency: String(values.currency || 'INR').trim(),
      timezone: String(values.timezone || 'Asia/Kolkata').trim(),
      dateFormat: String(values.dateFormat || 'DD/MM/YYYY').trim(),
      notifications: normalizeNotificationPreferences(
        notificationOptions.reduce((acc, option) => {
          acc[option.key] = Boolean(values.notifications[option.key]);
          return acc;
        }, {}),
        roleKey,
      ),
    };

    saveProfileSettings(nextRecord);
    showToast('Profile and settings saved.');
    onSaved();
  };

  const updatePassword = () => {
    const nextPassword = String(newPassword || '').trim();
    const confirm = String(confirmPassword || '').trim();
    if (!nextPassword || nextPassword.length < 6) {
      showToast('Password must be at least 6 characters.');
      return;
    }
    if (nextPassword !== confirm) {
      showToast('Password confirmation does not match.');
      return;
    }
    if (!updatePasswordOverrideForCurrentUser(state, nextPassword)) {
      showToast('Could not map current account for password update.');
      return;
    }
    setNewPassword('');
    setConfirmPassword('');
    showToast('Password updated for next login.');
  };

  return (
    <>
      <PageHeader
        title="Profile & Settings"
        actions={<button className="btn btn-primary" id="saveProfileSettingsBtn" onClick={saveProfile}>Save Changes</button>}
      />
      <section className="grid-2">
        <div style={COLUMN_STYLE}>
          <ProfileIdentityCard fullName={profile.fullName} roleLabel={ROLE_LABELS[roleKey] || 'Team Member'} email={profile.email} />
          <SecurityCard
            newPassword={newPassword}
            confirmPassword={confirmPassword}
            onNewPasswordChange={setNewPassword}
            onConfirmPasswordChange={setConfirmPassword}
            onUpdate={updatePassword}
          />
        </div>
        <div style={COLUMN_STYLE}>
          {showPlanCard && (
            <SubscriptionPlanCard
              plan={activePlan}
              usersCount={users.length}
              productsCount={inventory.length}
              onUpgrade={openPlanUpgrade}
              onCancel={cancelSubscription}
            />
          )}
          <RecentActivityCard items={activityItems} />
        </div>
      </section>
      <AccountPreferencesForm
        values={values}
        errors={errors}
        notificationOptions={notificationOptions}
        onFieldChange={onFieldChange}
        onToggleChange={onToggleChange}
        onSubmit={saveProfile}
      />
    </>
  );
}
