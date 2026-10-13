import DashboardLayout from '../components/dashboard/DashboardLayout.jsx';
import BusinessesContent from '../components/businesses/BusinessesContent.jsx';
import usePageSetup from '../hooks/usePageSetup.js';
import superuserInlineCss from '../styles/superuser-inline.css?inline';

export default function SuperuserPage() {
  usePageSetup({ styles: [superuserInlineCss] });
  return (
    <DashboardLayout page="superuser">
      <BusinessesContent />
    </DashboardLayout>
  );
}
