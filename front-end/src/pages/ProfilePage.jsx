// React port of profile.html. After start-up the original's renderPage('profile')
// replaced the static markup with renderProfileSettingsUnified(), so that is what
// is ported here (components/profile/ProfileContent.jsx).
import { useState } from 'react';
import DashboardLayout from '../components/dashboard/DashboardLayout.jsx';
import ProfileContent from '../components/profile/ProfileContent.jsx';

function ProfileView() {
  // Bumped after a successful save: renderProfileSettingsUnified() re-rendered the content.
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
