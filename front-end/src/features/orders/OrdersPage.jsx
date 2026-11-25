import DashboardLayout from '../../shared/components/dashboard/DashboardLayout.jsx';
import OrdersContent from './components/OrdersContent.jsx';

export default function OrdersPage() {
  return (
    <DashboardLayout page="orders" toast="Order saved">
      <OrdersContent />
    </DashboardLayout>
  );
}
