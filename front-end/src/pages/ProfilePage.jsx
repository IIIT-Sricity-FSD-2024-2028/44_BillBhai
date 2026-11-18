import DashboardLayout from '../components/dashboard/DashboardLayout.jsx';
import ProfileContent from '../components/profile/ProfileContent.jsx';

export default function ProfilePage() {
  return (
    <DashboardLayout page="profile" toast="">
      <ProfileContent />
    </DashboardLayout>
  );
}
