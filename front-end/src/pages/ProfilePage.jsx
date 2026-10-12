import { useState } from 'react';
import DashboardLayout from '../components/dashboard/DashboardLayout.jsx';
import ProfileContent from '../components/profile/ProfileContent.jsx';

export default function ProfilePage() {
  const [version, setVersion] = useState(0);

  return (
    <DashboardLayout page="profile">
      <ProfileContent key={version} onSaved={() => setVersion((v) => v + 1)} />
    </DashboardLayout>
  );
}
