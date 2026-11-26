import useViewState from '../../../shared/hooks/useViewState.js';
import PageHeader from '../../../shared/components/common/PageHeader.jsx';
import FilterToolbar from '../../../shared/components/common/FilterToolbar.jsx';
import DataTable from '../../../shared/components/common/DataTable.jsx';
import UserRow from './UserRow.jsx';
import UserProfile from './UserProfile.jsx';
import UserFormModal from './UserFormModal.jsx';
import useUserActions from './useUserActions.js';
import { useDashboard } from '../../../shared/lib/dashboard/hooks.js';
import { loadObject } from '../../../shared/lib/dashboard/storage.js';

const SORT_OPTIONS = [
  { value: 'name', label: 'Name A-Z' },
  { value: 'role', label: 'Role A-Z' },
  { value: 'status', label: 'Status A-Z' },
];

export default function UsersContent() {
  const { users, activePlan, roleKey } = useDashboard();
  const { canManage, deleteUser, resetPassword, toggleSuspension } = useUserActions();
  const selfId = String(loadObject('currentUser', {}).id || '');

  const [role, setRole] = useViewState('all');
  const [status, setStatus] = useViewState('all');
  const [sortKey, setSortKey] = useViewState('name');
  const [search, setSearch] = useViewState('');
  const [profileId, setProfileId] = useViewState(null);
  const [formUser, setFormUser] = useViewState(null);

  const staff = users.filter((u) => u.roleKey !== 'customer' && u.roleKey !== 'superuser');
  const maxUsers = activePlan && activePlan.limits ? activePlan.limits.maxUsers : Infinity;
  const atLimit = roleKey !== 'superuser' && Number.isFinite(maxUsers) && staff.length >= maxUsers;

  const form = formUser && <UserFormModal user={formUser.id ? formUser : null} onClose={() => setFormUser(null)} />;

  const profileUser = profileId ? users.find((u) => u.id === profileId) : null;
  if (profileUser) {
    return (
      <>
        <UserProfile
          user={profileUser}
          canManage={canManage}
          isSelf={profileUser.id === selfId}
          onBack={() => setProfileId(null)}
          onEdit={setFormUser}
          onPasswordReset={resetPassword}
          onToggleSuspension={toggleSuspension}
          onDelete={(u) => deleteUser(u, () => setProfileId(null))}
        />
        {form}
      </>
    );
  }

  const roleOptions = Array.from(new Set(users.map((u) => u.role))).sort();
  const needle = search.trim().toLowerCase();
  const visible = users
    .filter((u) => role === 'all' || u.role === role)
    .filter((u) => status === 'all' || u.status === status)
    .filter((u) => !needle || [u.name, u.username, u.email, u.phone].some((v) => String(v || '').toLowerCase().includes(needle)))
    .sort((a, b) => {
      if (sortKey === 'role') return a.role.localeCompare(b.role) || a.name.localeCompare(b.name);
      if (sortKey === 'status') return a.status.localeCompare(b.status) || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });

  return (
    <>
      <PageHeader
        title="Users"
        actions={
          canManage ? (
            <button
              className="btn btn-primary"
              id="addUserBtnDyn"
              onClick={() => setFormUser({})}
              disabled={atLimit}
              title={atLimit ? `Your ${activePlan.name} allows ${maxUsers} staff accounts` : undefined}
            >
              + Add User
            </button>
          ) : null
        }
      />
      {atLimit && (
        <p className="text-sm text-muted" style={{ margin: '0 0 12px' }}>
          {`Your ${activePlan.name} allows ${maxUsers} staff accounts and you have ${staff.length}. Upgrade the plan from Profile to add more.`}
        </p>
      )}
      <section className="card" style={{ marginBottom: '14px' }}>
        <FilterToolbar
          filters={[
            { id: 'usersRoleFilter', label: 'Role', value: role, onChange: setRole, options: [{ value: 'all', label: 'All roles' }, ...roleOptions] },
            { id: 'usersStatusFilter', label: 'Status', value: status, onChange: setStatus, options: [{ value: 'all', label: 'All statuses' }, 'Active', 'Suspended'] },
            { id: 'usersSortSelect', label: 'Sort by', value: sortKey, onChange: setSortKey, options: SORT_OPTIONS },
          ]}
        >
          <div className="toolbar-group">
            <label className="toolbar-label" htmlFor="usersSearch">Search</label>
            <input id="usersSearch" className="form-control" placeholder="Name, username, email or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </FilterToolbar>
      </section>
      <section className="card">
        <div className="card-bd">
          <DataTable
            columns={['Name', 'Username', 'Email', 'Mobile', 'Role', 'Status', 'Actions']}
            rows={visible}
            tbodyId="usersTableBodyDyn"
            emptyMessage="No users match the selected filters."
            renderRow={(user) => (
              <UserRow
                key={user.id}
                user={user}
                canManage={canManage}
                isSelf={user.id === selfId}
                onView={(u) => setProfileId(u.id)}
                onEdit={setFormUser}
                onDelete={(u) => deleteUser(u)}
              />
            )}
          />
        </div>
      </section>
      {form}
    </>
  );
}
