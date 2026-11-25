import DashboardLayout from '../../shared/components/dashboard/DashboardLayout.jsx';
import BusinessesContent from './components/businesses/BusinessesContent.jsx';
import usePageSetup from '../../shared/hooks/usePageSetup.js';
import superuserInlineCss from '../../shared/styles/superuser-inline.css?inline';

export default function SuperuserPage() {
  usePageSetup({ styles: [superuserInlineCss] });
  return (
    <DashboardLayout page="superuser">
      <BusinessesContent />
    </DashboardLayout>
  );
}
