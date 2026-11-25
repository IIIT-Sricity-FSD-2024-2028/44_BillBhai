import DashboardLayout from '../../shared/components/dashboard/DashboardLayout.jsx';
import ProfileContent from './components/ProfileContent.jsx';

export default function ProfilePage() {
  return (
    <DashboardLayout page="profile" toast="">
      <ProfileContent />
    </DashboardLayout>
  );
}
