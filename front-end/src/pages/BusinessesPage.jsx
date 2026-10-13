// React port of businesses.html (renderBusinesses / renderBusinessDetails in dashboard.js).
import DashboardLayout from '../components/dashboard/DashboardLayout.jsx';
import BusinessesContent from '../components/businesses/BusinessesContent.jsx';

export default function BusinessesPage() {
  return (
    <DashboardLayout page="businesses">
      <BusinessesContent />
    </DashboardLayout>
  );
}
