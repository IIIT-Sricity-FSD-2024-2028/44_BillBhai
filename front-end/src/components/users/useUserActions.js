import { api, errorText } from '../../lib/http.js';
import { useDashboard } from '../../lib/dashboard/hooks.js';
import { roleLabel } from '../../lib/dashboard/credentials.js';

/**
 * Staff account actions. Every action names the user by id and sends the
 * version the screen loaded; the server enforces who may do what (no self
 * delete, last admin kept, super users untouchable for store admins).
 */
export default function useUserActions() {
  const { hasActionAccess, denyAction, openConfirm, showCredentialsModal, showToast, refreshData } = useDashboard();
  const canManage = hasActionAccess('users');

  const guard = (label) => {
    if (canManage) return true;
    denyAction(label);
    return false;
  };

  const deleteUser = (user, after) => {
    if (!guard('User delete')) return;
    openConfirm({
      title: 'Delete User',
      message: `Delete ${user.name} (${user.username})? They will be signed out and cannot sign in again. To keep their history but block sign-in, suspend them instead.`,
      confirmLabel: 'Delete',
      onConfirm: async () => {
        try {
          await api(`/users/${encodeURIComponent(user.id)}`, { method: 'DELETE' });
        } catch (err) {
          showToast(`Delete failed: ${errorText(err)}`);
          return false;
        }
        await refreshData();
        showToast(`${user.name} deleted`);
        if (after) after();
        return true;
      },
    });
  };

  const resetPassword = (user) => {
    if (!guard('Password reset')) return;
    openConfirm({
      title: 'Reset Password',
      message: `Give ${user.name} a new temporary password? Their old password stops working at once.`,
      confirmLabel: 'Reset password',
      onConfirm: async () => {
        let result;
        try {
          result = await api(`/users/${encodeURIComponent(user.id)}/reset-password`, { method: 'POST', body: {} });
        } catch (err) {
          showToast(`Reset failed: ${errorText(err)}`);
          return false;
        }
        await refreshData();
        // Shown after this dialog closes.
        setTimeout(
          () =>
            showCredentialsModal('New Temporary Password', {
              name: result.name,
              username: result.username,
              password: result.temporaryPassword,
              role: roleLabel(result.role),
            }),
          0,
        );
        return true;
      },
    });
  };

  const toggleSuspension = async (user) => {
    if (!guard('User status update')) return;
    const next = String(user.status).toLowerCase() === 'suspended' ? 'Active' : 'Suspended';
    try {
      await api(`/users/${encodeURIComponent(user.id)}`, {
        method: 'PUT',
        body: { status: next, version: user.version },
      });
      await refreshData();
      showToast(next === 'Active' ? `${user.name} can sign in again` : `${user.name} is suspended and signed out`);
    } catch (err) {
      showToast(`Status change failed: ${errorText(err)}`);
    }
  };

  return { canManage, deleteUser, resetPassword, toggleSuspension };
}
