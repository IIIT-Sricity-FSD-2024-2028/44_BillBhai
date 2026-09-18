// window.deleteUser / changeUserRole / sendUserPasswordReset / toggleUserSuspension
// of dashboard.js. Handlers take the encoded user token, like the original onclick handlers.
import { useDashboard, useUsers } from '../../lib/dashboard/hooks.js';
import { getState } from '../../lib/dashboard/store.js';
import { mapRoleLabelToBackendRole } from '../../lib/dashboard/api.js';
import { USER_MANAGED_ROLE_OPTIONS } from '../../lib/dashboard/constants.js';
import {
  decodeUserToken,
  generateTemporaryPassword,
  mapUserRoleToAuthRole,
  removeAuthCredentialsForUser,
  upsertAuthCredentialsForUser,
} from '../../lib/dashboard/credentials.js';

const findUser = (name) => getState().users.find((user) => user.name === name);

export default function useUserActions() {
  const {
    hasActionAccess, denyAction, apiRequest, openConfirm, openQuickForm, showCredentialsModal,
    showMutationError, showToast, renderPage,
  } = useDashboard();
  const { remove, setRows } = useUsers();

  // users[userIndex] = next (the original mutated the user object in place).
  const replaceUser = (name, patch) => setRows((rows) => {
    const idx = rows.findIndex((user) => user.name === name);
    return idx === -1 ? rows : rows.map((user, i) => (i === idx ? { ...user, ...patch } : user));
  });

  const deleteUser = (token) => {
    if (!hasActionAccess('users')) {
      denyAction('User delete');
      return;
    }
    const name = decodeUserToken(token);
    openConfirm({
      title: 'Delete User',
      message: `Delete User ${name}?`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        const targetUser = findUser(name);
        if (!targetUser) return true;
        if (!targetUser.id) throw new Error('Missing backend user id');
        await remove(targetUser.id, { role: 'admin' });
        removeAuthCredentialsForUser(targetUser);
        renderPage();
        showToast(`User "${name}" deleted!`);
        return true;
      },
    });
  };

  const changeUserRole = (token) => {
    if (!hasActionAccess('users')) {
      denyAction('User update');
      return;
    }
    const user = findUser(decodeUserToken(token));
    if (!user) return;
    openQuickForm({
      title: `Change Role - ${user.name}`,
      submitLabel: 'Update Role',
      fields: [
        { name: 'role', label: 'Role', type: 'select', required: true, options: USER_MANAGED_ROLE_OPTIONS },
      ],
      initialValues: { role: mapUserRoleToAuthRole(user.role) },
      onSubmit: async (values, closeModal) => {
        try {
          const nextRole = String(values.role || '').trim();
          if (!user.id) throw new Error('Missing backend user id');
          await apiRequest(`/users/${encodeURIComponent(String(user.id))}`, {
            method: 'PUT',
            role: 'admin',
            body: { role: mapRoleLabelToBackendRole(nextRole) },
          });
          const updated = { ...user, role: nextRole };
          const credential = upsertAuthCredentialsForUser(getState().users, updated, { existingUsername: user.username });
          replaceUser(user.name, { role: nextRole, username: credential.username });
          closeModal();
          showToast(`${user.name}'s role updated to ${nextRole}.`);
        } catch (error) {
          showMutationError('User role update', error);
        }
      },
    });
  };

  const sendUserPasswordReset = async (token) => {
    if (!hasActionAccess('users')) {
      denyAction('User password reset');
      return;
    }
    const user = findUser(decodeUserToken(token));
    if (!user) return;
    const tempPassword = generateTemporaryPassword();
    const credential = upsertAuthCredentialsForUser(getState().users, user, {
      existingUsername: user.username,
      forcePassword: tempPassword,
    });
    try {
      if (!user.id) throw new Error('Missing backend user id');
      await apiRequest(`/users/${encodeURIComponent(String(user.id))}`, {
        method: 'PUT',
        role: 'admin',
        body: { password: credential.password },
      });
      replaceUser(user.name, { username: credential.username });
      showCredentialsModal('Temporary Password Generated', {
        name: user.name,
        username: credential.username,
        password: credential.password,
        role: mapUserRoleToAuthRole(user.role),
        email: user.email,
      });
      showToast(`Temporary password generated for ${user.name}.`);
    } catch (error) {
      showMutationError('Password reset', error);
    }
  };

  const toggleUserSuspension = async (token) => {
    if (!hasActionAccess('users')) {
      denyAction('User status update');
      return;
    }
    const user = findUser(decodeUserToken(token));
    if (!user) return;
    const currentlySuspended = String(user.status || '').toLowerCase() === 'suspended';
    try {
      const nextStatus = currentlySuspended ? 'Active' : 'Suspended';
      if (!user.id) throw new Error('Missing backend user id');
      await apiRequest(`/users/${encodeURIComponent(String(user.id))}`, {
        method: 'PUT',
        role: 'admin',
        body: { status: nextStatus },
      });
      const updated = { ...user, status: nextStatus };
      const credential = upsertAuthCredentialsForUser(getState().users, updated, { existingUsername: user.username });
      replaceUser(user.name, { status: nextStatus, username: credential.username });
      showToast(currentlySuspended ? `${user.name} reactivated.` : `${user.name} suspended.`);
    } catch (error) {
      showMutationError('User status update', error);
    }
  };

  return { deleteUser, changeUserRole, sendUserPasswordReset, toggleUserSuspension };
}
