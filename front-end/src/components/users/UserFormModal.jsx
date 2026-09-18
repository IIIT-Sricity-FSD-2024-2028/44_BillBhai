// Static #addUserModal of users.html + openAddUserModal() / closeAddUserModal() /
// handleAddUser() of dashboard.js (add + edit).
import { useState } from 'react';
import Modal from '../common/Modal.jsx';
import FormField, { controlClass } from '../common/FormField.jsx';
import LegacySelect, { effectiveSelectValue } from '../common/LegacySelect.jsx';
import { EMPTY_USER_FORM } from './UsersContent.jsx';
import { useDashboard, useSession, useUsers } from '../../lib/dashboard/hooks.js';
import { mapRoleLabelToBackendRole } from '../../lib/dashboard/api.js';
import { mapUserRoleToAuthRole, normalizeAuthUserKey, upsertAuthCredentialsForUser } from '../../lib/dashboard/credentials.js';
import { isValidEmailAddress, isValidPhoneNumber, normalizePhoneDigits } from '../../lib/dashboard/helpers.js';

const ROLE_VALUES = ['Admin', 'Cashier', 'Return Handler', 'Inventory Manager', 'Delivery Ops', 'Customer', 'Super User'];
const STATUS_OPTIONS = ['Active', 'Offline', 'Suspended'];
const PHONE_ERROR = 'Enter a valid 10-digit phone number.';

const TEXTS = {
  add: { title: 'Add New User', submit: 'Add User' },
  edit: { title: 'Edit User', submit: 'Save User' },
};

/** Role <option>s; openAddUserModal() hid + disabled the roles the plan lacks. */
function roleOptions(planFeatures) {
  return [
    { value: '', label: 'Select role' },
    ...ROLE_VALUES.map((value) => {
      const locked = !!planFeatures && (
        (value === 'Delivery Ops' && !planFeatures.delivery) || (value === 'Return Handler' && !planFeatures.returns));
      return { value, label: value, hidden: locked, disabled: locked };
    }),
  ];
}

/**
 * Props
 *  open     `.active` on the overlay
 *  request  { id, mode: 'add' | 'edit', values, readOnly, planFeatures } - every new
 *           request re-runs the reset done by openAddUserModal()/editUser()
 *  onClose  closeAddUserModal()
 */
export default function UserFormModal({ open, request, onClose }) {
  const {
    hasActionAccess, denyAction, activePlan, apiRequest, showToast, showMutationError, showCredentialsModal, renderPage,
  } = useDashboard();
  const { activeBusinessId } = useSession();
  const { rows: users, setRows } = useUsers();

  const [values, setValues] = useState(EMPTY_USER_FORM);
  const [readOnly, setReadOnly] = useState(false);
  const [planFeatures, setPlanFeatures] = useState(null);
  // `.has-error` / `.error` per field (cleared on input and on every open).
  const [errors, setErrors] = useState({});
  // Inline `.form-error` of the phone field (setFieldError/clearFieldError): never reset by open.
  const [phoneError, setPhoneError] = useState({ display: undefined, message: undefined });
  const [seenRequest, setSeenRequest] = useState(null);

  if (request && request.id !== seenRequest) {
    setSeenRequest(request.id);
    setValues(request.values);
    setReadOnly(!!request.readOnly);
    setPlanFeatures(request.planFeatures || null);
    setErrors({});
  }

  const texts = TEXTS[request && request.mode === 'edit' ? 'edit' : 'add'];
  const roleOpts = roleOptions(planFeatures);

  const bind = (key) => ({
    value: values[key],
    onChange: (e) => {
      const next = e.target.value;
      setValues((v) => ({ ...v, [key]: next }));
      setErrors((errs) => (errs[key] ? { ...errs, [key]: false } : errs));
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hasActionAccess('users')) {
      denyAction('User create/update');
      return;
    }
    const roleValue = effectiveSelectValue(roleOpts, values.role);
    const statusValue = effectiveSelectValue(STATUS_OPTIONS, values.status);

    let valid = true;
    const next = { ...errors };
    [
      ['name', values.name.trim() !== ''],
      ['email', isValidEmailAddress(values.email)],
      ['role', roleValue !== ''],
    ].forEach(([key, ok]) => {
      next[key] = !ok;
      if (!ok) valid = false;
    });

    const features = activePlan.features;
    if ((roleValue === 'Delivery Ops' && !features.delivery) || (roleValue === 'Return Handler' && !features.returns)) {
      showToast('Role not allowed on your current plan.');
      valid = false;
    }
    const typedEmail = String(values.email || '').trim();
    const typedPhone = normalizePhoneDigits(values.phone || '');
    const typedUsername = String(values.username || '').trim();
    const typedPassword = String(values.password || '').trim();
    const normalizedTypedUsername = normalizeAuthUserKey(typedUsername);
    if (typedUsername && typedUsername !== normalizedTypedUsername) {
      next.username = true;
      valid = false;
    }
    if (typedPhone && !isValidPhoneNumber(typedPhone)) {
      next.phone = true;
      setPhoneError({ display: 'block', message: PHONE_ERROR });
      valid = false;
    } else {
      next.phone = false;
      setPhoneError((p) => ({ ...p, display: 'none' }));
    }
    if (typedPassword && typedPassword.length < 6) {
      next.password = true;
      valid = false;
    }
    setErrors(next);
    if (!valid) return;

    const uname = values.name.trim();
    const existingIdx = users.findIndex((u) => u.name === uname);
    const existingUser = existingIdx !== -1 ? users[existingIdx] : null;

    const uData = {
      ...(existingUser || {}),
      name: uname,
      role: roleValue,
      status: statusValue,
      email: typedEmail,
      phone: typedPhone,
    };

    let credential;
    try {
      credential = upsertAuthCredentialsForUser(users, uData, {
        existingUsername: existingUser && existingUser.username,
        preferredUsername: normalizedTypedUsername,
        forcePassword: typedPassword,
      });
    } catch (error) {
      showToast(error && error.message ? error.message : 'Could not create credentials.');
      return;
    }
    uData.username = credential.username;

    try {
      if (existingUser && existingUser.id) {
        const backendUser = await apiRequest(`/users/${encodeURIComponent(String(existingUser.id))}`, {
          method: 'PUT',
          role: 'admin',
          body: {
            name: uData.name,
            role: mapRoleLabelToBackendRole(uData.role),
            email: uData.email,
            mobileNo: uData.phone || '',
            status: uData.status,
            ...(typedPassword ? { password: typedPassword } : {}),
          },
        });
        uData.id = backendUser.id || existingUser.id;
      } else {
        const backendUser = await apiRequest('/users', {
          method: 'POST',
          role: 'admin',
          body: {
            companyId: String(activeBusinessId || 'BIZ-101').trim() || 'BIZ-101',
            name: uData.name,
            role: mapRoleLabelToBackendRole(uData.role),
            email: uData.email,
            mobileNo: uData.phone || '0000000000',
            username: uData.username,
            password: credential.password || 'user123',
          },
        });
        uData.id = backendUser.id;
      }
    } catch (error) {
      showMutationError('User save', error);
      return;
    }

    setRows((rows) => {
      const idx = rows.findIndex((u) => u.name === uname);
      if (existingIdx !== -1 && idx !== -1) return rows.map((u, i) => (i === idx ? uData : u));
      return [...rows, uData];
    });

    onClose();
    renderPage();
    showToast(`User "${uData.name}" saved successfully!`);

    if (existingIdx === -1 || credential.generated) {
      showCredentialsModal(existingIdx === -1 ? 'New User Credentials' : 'User Credentials', {
        name: uData.name,
        username: credential.username,
        password: credential.password,
        role: mapUserRoleToAuthRole(uData.role),
        email: uData.email,
      });
    }
  };

  return (
    <Modal open={open} id="addUserModal" title={texts.title} onClose={onClose} closeButtonId="userModalClose" closeButtonType={null}>
      <form id="addUserForm" noValidate onSubmit={handleSubmit}>
        <div className="modal-body">
          <FormField label="Full Name *" htmlFor="userName" error="Full name is required" hasError={errors.name}>
            <input type="text" className={controlClass(errors.name)} id="userName" placeholder="e.g. Rahul Sharma" required readOnly={readOnly} {...bind('name')} />
          </FormField>
          <FormField label="Email *" htmlFor="userEmail" error="Valid email is required" hasError={errors.email}>
            <input type="email" className={controlClass(errors.email)} id="userEmail" placeholder="e.g. rahul.s@billbhai.com" required {...bind('email')} />
          </FormField>
          <div className="form-row">
            <FormField label="Role *" htmlFor="userRole" error="Please select a role" hasError={errors.role}>
              <LegacySelect className={controlClass(errors.role)} id="userRole" required options={roleOpts} {...bind('role')} />
            </FormField>
            <FormField
              label="Phone"
              htmlFor="userPhone"
              error="Enter a valid 10-digit phone number"
              hasError={errors.phone}
              errorDisplay={phoneError.display}
              errorMessage={phoneError.message}
            >
              <input type="tel" className={controlClass(errors.phone)} id="userPhone" placeholder="e.g. 9876543210" maxLength={10} inputMode="numeric" {...bind('phone')} />
            </FormField>
          </div>
          <div className="form-row">
            <FormField label="Username" htmlFor="userUsername" error="Use only letters, numbers, dot, underscore, or hyphen" hasError={errors.username}>
              <input type="text" className={controlClass(errors.username)} id="userUsername" placeholder="e.g. rahul.sharma" readOnly={readOnly} {...bind('username')} />
            </FormField>
            <FormField label="Password" htmlFor="userPassword" error="Password must be at least 6 characters" hasError={errors.password}>
              <input type="password" className={controlClass(errors.password)} id="userPassword" placeholder="Minimum 6 characters" {...bind('password')} />
            </FormField>
          </div>
          <FormField label="Status" htmlFor="userStatus">
            <LegacySelect className="form-control" id="userStatus" options={STATUS_OPTIONS} {...bind('status')} />
          </FormField>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-outline" id="userModalCancel" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary">{texts.submit}</button>
        </div>
      </form>
    </Modal>
  );
}
