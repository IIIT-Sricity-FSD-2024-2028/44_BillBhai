import DashboardLayout from '../components/dashboard/DashboardLayout.jsx';
import UsersContent from '../components/users/UsersContent.jsx';

export default function UsersPage() {
  return (
    <DashboardLayout page="users" toast="">
      <UsersContent />
    </DashboardLayout>
  );
}
