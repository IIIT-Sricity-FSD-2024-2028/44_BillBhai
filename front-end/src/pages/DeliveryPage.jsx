// React port of delivery.html + renderDelivery() / initDeliveryCharts() in dashboard.js.
import DashboardLayout from '../components/dashboard/DashboardLayout.jsx';
import DeliveryContent from '../components/delivery/DeliveryContent.jsx';

export default function DeliveryPage() {
  return (
    <DashboardLayout page="delivery">
      <DeliveryContent />
    </DashboardLayout>
  );
}
