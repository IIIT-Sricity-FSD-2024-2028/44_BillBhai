import DashboardLayout from '../../shared/components/dashboard/DashboardLayout.jsx';
import DeliveryContent from './components/DeliveryContent.jsx';

export default function DeliveryPage() {
  return (
    <DashboardLayout page="delivery" toast="Saved">
      <DeliveryContent />
    </DashboardLayout>
  );
}
