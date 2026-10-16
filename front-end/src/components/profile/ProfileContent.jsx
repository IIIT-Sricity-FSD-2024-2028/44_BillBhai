import { useState } from 'react';
import PageHeader from '../common/PageHeader.jsx';
import ProfileIdentityCard from './ProfileIdentityCard.jsx';
import SecurityCard from './SecurityCard.jsx';
import SubscriptionPlanCard from './SubscriptionPlanCard.jsx';
import RecentActivityCard from './RecentActivityCard.jsx';
import AccountPreferencesForm from './AccountPreferencesForm.jsx';
import { useDashboard } from '../../lib/dashboard/hooks.js';
import { loadObject } from '../../lib/dashboard/storage.js';
import { ROLE_LABELS } from '../../lib/dashboard/constants.js';
import {
  getRecentProfileActivity,
  isValidEmailAddress,
  isValidPhoneNumber,
  normalizeEditablePhone,
  normalizePhoneDigits,
  validatePasswordCriteria,
} from '../../lib/dashboard/helpers.js';
import {
  getCurrentUserIdentity,
  getNotificationPreferenceConfig,
  normalizeNotificationPreferences,
  updatePasswordOverrideForCurrentUser,
} from '../../lib/dashboard/notifications.js';

const COLUMN_STYLE = { display: 'flex', flexDirection: 'column', gap: '16px' };

function pickOption(value, options) {
  return options.includes(value) ? value : options[0];
}

function initialFormValues(profile) {
  return {
    fullName: profile.fullName || '',
    email: profile.email || '',
    phone: normalizeEditablePhone(profile.phone),
    location: profile.location || '',
    bio: profile.bio || '',
    language: pickOption(profile.language, ['English (India)', 'Hindi', 'Tamil']),
    currency: pickOption(profile.currency, ['INR', 'USD']),
    timezone: pickOption(profile.timezone, ['Asia/Kolkata', 'UTC']),
    dateFormat: pickOption(profile.dateFormat, ['DD/MM/YYYY', 'MM/DD/YYYY']),
    notifications: { ...(profile.notifications || {}) },
  };
}

export default function ProfileContent({ onSaved }) {
  const {
    state,
    roleKey,
    orders,
    returns,
    deliveries,
    inventory,
    users,
    activePlan,
    loadProfileSettingsRecord,
    saveProfileSettings,
    showToast,
    openPlanUpgrade,
    cancelSubscription,
    apiRequest,
  } = useDashboard();

  const [profile, setProfile] = useState(() => loadProfileSettingsRecord());
  const [values, setValues] = useState(() => initialFormValues(profile));
  const [errors, setErrors] = useState({});
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const notificationOptions = getNotificationPreferenceConfig(roleKey);
  const activityItems = getRecentProfileActivity({ orders, returns, deliveries, inventory });
  const showPlanCard = roleKey === 'admin' || roleKey === 'superuser';

  const onFieldChange = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (key === 'fullName' || key === 'email' || key === 'phone') {
      setErrors((prev) => ({ ...prev, [key]: false }));
    }
  };

  const onToggleChange = (key, checked) => {
    setValues((prev) => ({ ...prev, notifications: { ...prev.notifications, [key]: checked } }));
  };

  const saveProfile = async () => {
    const cleared = { fullName: false, email: false, phone: false };
    const fullName = String(values.fullName || '').trim();
    const email = String(values.email || '').trim();
    const phone = normalizePhoneDigits(values.phone || '');
    if (!fullName) {
      setErrors({ ...cleared, fullName: true });
      showToast('Full name is required.', 'error');
      return;
    }
    if (!isValidEmailAddress(email)) {
      setErrors({ ...cleared, email: true });
      showToast('Please enter a valid email address.', 'error');
      return;
    }
    if (phone && !isValidPhoneNumber(phone)) {
      setErrors({ ...cleared, phone: true });
      showToast('Please enter a valid 10-digit phone number.', 'error');
      return;
    }
    setErrors(cleared);

    setIsSaving(true);
    try {
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
      setProfile(nextRecord);

      // Sync user record to backend if user ID is known
      const identity = getCurrentUserIdentity(state);
      const currentUser = loadObject('currentUser', {});
      const targetUser =
        (currentUser && currentUser.id && users.find((u) => u.id === currentUser.id)) ||
        users.find(
          (u) =>
            u.username === identity.username ||
            u.email === identity.email ||
            u.role === roleKey,
        );

      const userId = (currentUser && currentUser.id) || (targetUser && targetUser.id);
      if (userId && apiRequest) {
        try {
          const body = { name: fullName, email };
          if (phone && phone.length === 10) body.mobileNo = phone;
          await apiRequest(`/users/${encodeURIComponent(String(userId))}`, {
            method: 'PUT',
            body,
          });
        } catch (apiErr) {
          console.warn('Backend user profile update notice (local storage preserved):', apiErr);
        }
      }

      showToast('Profile and settings saved.', 'success');
      if (typeof onSaved === 'function') {
        onSaved();
      }
    } catch (err) {
      console.error('Save profile failed:', err);
      showToast('Failed to save profile changes.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const updatePassword = async () => {
    const nextPassword = String(newPassword || '').trim();
    const confirm = String(confirmPassword || '').trim();
    const criteriaError = validatePasswordCriteria(nextPassword);
    if (criteriaError) {
      return;
    }
    if (nextPassword !== confirm) {
      return;
    }
    setIsUpdatingPassword(true);
    try {
      if (!updatePasswordOverrideForCurrentUser(state, nextPassword)) {
        showToast('Could not map current account for password update.', 'error');
        return;
      }

      // Sync new password to backend
      const identity = getCurrentUserIdentity(state);
      const currentUser = loadObject('currentUser', {});
      const targetUser =
        (currentUser && currentUser.id && users.find((u) => u.id === currentUser.id)) ||
        users.find(
          (u) =>
            u.username === identity.username ||
            u.email === identity.email ||
            u.role === roleKey,
        );

      const userId = (currentUser && currentUser.id) || (targetUser && targetUser.id);
      if (userId && apiRequest) {
        try {
          await apiRequest(`/users/${encodeURIComponent(String(userId))}`, {
            method: 'PUT',
            body: { password: nextPassword },
          });
        } catch (apiErr) {
          console.warn('Backend user password update notice (local override preserved):', apiErr);
        }
      }

      setNewPassword('');
      setConfirmPassword('');
      showToast('Password updated successfully.', 'success');
    } catch (err) {
      console.error('Password update error:', err);
      showToast('Failed to update password.', 'error');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Profile & Settings"
        actions={
          <button
            className="btn btn-primary"
            id="saveProfileSettingsBtn"
            onClick={saveProfile}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        }
      />
      <section className="grid-2">
        <div style={COLUMN_STYLE}>
          <ProfileIdentityCard
            fullName={values.fullName || profile.fullName}
            roleLabel={ROLE_LABELS[roleKey] || 'Team Member'}
            email={values.email || profile.email}
          />
          <SecurityCard
            newPassword={newPassword}
            confirmPassword={confirmPassword}
            onNewPasswordChange={setNewPassword}
            onConfirmPasswordChange={setConfirmPassword}
            onUpdate={updatePassword}
            isUpdating={isUpdatingPassword}
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
