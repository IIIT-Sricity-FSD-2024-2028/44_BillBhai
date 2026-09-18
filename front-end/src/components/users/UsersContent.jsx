// renderUsers() + window.renderUserProfile / window.editUser of dashboard.js.
import { useState } from 'react';
import PageHeader from '../common/PageHeader.jsx';
import FilterToolbar from '../common/FilterToolbar.jsx';
import DataTable from '../common/DataTable.jsx';
import UserRow from './UserRow.jsx';
import UserProfile from './UserProfile.jsx';
import useUserActions from './useUserActions.js';
import { useDashboard, useUsers } from '../../lib/dashboard/hooks.js';
import { decodeUserToken } from '../../lib/dashboard/credentials.js';
import { normalizeEditablePhone } from '../../lib/dashboard/helpers.js';

const SORT_OPTIONS = [
  { value: 'name', label: 'Name A-Z' },
  { value: 'role', label: 'Role A-Z' },
  { value: 'status', label: 'Status A-Z' },
];

export const EMPTY_USER_FORM = { name: '', email: '', role: '', phone: '', username: '', password: '', status: 'Active' };

/**
 * Props (from UsersPage)
 *  onOpenModal  open #addUserModal: ({ mode: 'add' | 'edit', values, readOnly, planFeatures })
 *  onBack       the profile's back arrow (clicked the sidebar "Users" link = page reload)
 */
export default function UsersContent({ onOpenModal, onBack }) {
  const { hasActionAccess, denyAction, activePlan } = useDashboard();
  const { rows: users } = useUsers();
  const actions = useUserActions();

  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [sortKey, setSortKey] = useState('name');
  // renderUserProfile() replaced the page content with the "User Details" view.
  const [profileName, setProfileName] = useState(null);

  const canManage = hasActionAccess('users');

  // openAddUserModal(isEdit)
  const openModal = (mode, values, readOnly) => {
    if (!hasActionAccess('users')) {
      denyAction('User create');
      return;
    }
    onOpenModal({ mode, values, readOnly, planFeatures: activePlan.features });
  };

  // "+ Add User" was wired as addEventListener('click', openAddUserModal): the click
  // event arrived as a truthy `isEdit`, so the plan-cap check never ran from here.
  const addUser = () => openModal('add', EMPTY_USER_FORM, false);

  const editUser = (token) => {
    if (!hasActionAccess('users')) {
      denyAction('User update');
      return;
    }
    const u = users.find((item) => item.name === decodeUserToken(token));
    if (!u) return;
    openModal('edit', {
      ...EMPTY_USER_FORM,
      name: u.name,
      email: u.email || '',
      role: u.role,
      status: u.status,
      phone: normalizeEditablePhone(u.phone || ''),
      username: String(u.username || '').trim(),
    }, true);
  };

  const viewUser = (token) => {
    const name = decodeUserToken(token);
    if (users.some((u) => u.name === name)) setProfileName(name);
  };

  const profileUser = profileName !== null ? users.find((u) => u.name === profileName) : null;
  if (profileUser) {
    return (
      <UserProfile
        user={profileUser}
        onBack={onBack}
        onChangeRole={actions.changeUserRole}
        onPasswordReset={actions.sendUserPasswordReset}
        onToggleSuspension={actions.toggleUserSuspension}
        onDelete={actions.deleteUser}
      />
    );
  }

  const userRows = users.map((user) => ({
    ...user,
    normalizedRole: String((user && user.role) || 'Unassigned').trim() || 'Unassigned',
    normalizedStatus: String((user && user.status) || 'Inactive').trim() || 'Inactive',
  }));
  const roleOptions = Array.from(new Set(userRows.map((item) => item.normalizedRole))).sort();
  const statusOptions = Array.from(new Set(userRows.map((item) => item.normalizedStatus))).sort();

  const visibleRows = userRows
    .filter((item) => {
      if (role !== 'all' && item.normalizedRole !== role) return false;
      if (status !== 'all' && item.normalizedStatus !== status) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortKey === 'role') return a.normalizedRole.localeCompare(b.normalizedRole);
      if (sortKey === 'status') return a.normalizedStatus.localeCompare(b.normalizedStatus);
      return String(a.name || '').localeCompare(String(b.name || ''));
    });

  return (
    <>
      <PageHeader
        title="Users"
        actions={canManage ? <button className="btn btn-primary" id="addUserBtnDyn" onClick={addUser}>+ Add User</button> : null}
      />
      <section className="card" style={{ marginBottom: '14px' }}>
        <FilterToolbar
          filters={[
            { id: 'usersRoleFilter', label: 'Role', value: role, onChange: setRole, options: [{ value: 'all', label: 'All roles' }, ...roleOptions] },
            { id: 'usersStatusFilter', label: 'Status', value: status, onChange: setStatus, options: [{ value: 'all', label: 'All statuses' }, ...statusOptions] },
            { id: 'usersSortSelect', label: 'Sort by', value: sortKey, onChange: setSortKey, options: SORT_OPTIONS },
          ]}
        />
      </section>
      <section className="card">
        <div className="card-bd">
          <DataTable
            columns={['Name', 'Email', 'Role', 'Status', 'Actions']}
            rows={visibleRows}
            tbodyId="usersTableBodyDyn"
            emptyMessage="No users match the selected filters."
            emptyColSpan={5}
            renderRow={(user, index) => (
              <UserRow
                key={`${user.id ?? user.name}-${index}`}
                user={user}
                canManage={canManage}
                onView={viewUser}
                onEdit={editUser}
                onDelete={actions.deleteUser}
              />
            )}
          />
        </div>
      </section>
    </>
  );
}
