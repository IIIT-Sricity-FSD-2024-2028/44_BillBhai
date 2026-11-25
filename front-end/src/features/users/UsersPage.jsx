import DashboardLayout from '../../shared/components/dashboard/DashboardLayout.jsx';
import UsersContent from './components/UsersContent.jsx';

export default function UsersPage() {
  return (
    <DashboardLayout page="users" toast="">
      <UsersContent />
    </DashboardLayout>
  );
}
