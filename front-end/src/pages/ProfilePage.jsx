import { useState } from 'react';
import DashboardLayout from '../components/dashboard/DashboardLayout.jsx';
import ProfileContent from '../components/profile/ProfileContent.jsx';

function ProfileView() {
  const [version, setVersion] = useState(0);
  return <ProfileContent key={version} onSaved={() => setVersion((v) => v + 1)} />;
}

export default function ProfilePage() {
  return (
    <DashboardLayout page="profile">
      <ProfileView />
    </DashboardLayout>
  );
}
