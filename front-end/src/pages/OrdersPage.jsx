import DashboardLayout from '../components/dashboard/DashboardLayout.jsx';
import OrdersContent from '../components/orders/OrdersContent.jsx';

export default function OrdersPage() {
  return (
    <DashboardLayout page="orders" toast="Order saved">
      <OrdersContent />
    </DashboardLayout>
  );
}
