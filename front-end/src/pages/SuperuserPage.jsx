// React port of superuser.html (renderBusinesses / renderBusinessDetails in dashboard.js).
import DashboardLayout from '../components/dashboard/DashboardLayout.jsx';
import BusinessesContent from '../components/businesses/BusinessesContent.jsx';
import usePageSetup from '../hooks/usePageSetup.js';
import superuserInlineCss from '../styles/superuser-inline.css?inline';

export default function SuperuserPage() {
  // superuser.html's own <style> block (hides the sidebar/menu toggle). Mounted
  // after the layout's dashboard.css, as in the original <head>.
  usePageSetup({ styles: [superuserInlineCss] });
  return (
    <DashboardLayout page="superuser">
      <BusinessesContent />
    </DashboardLayout>
  );
}
