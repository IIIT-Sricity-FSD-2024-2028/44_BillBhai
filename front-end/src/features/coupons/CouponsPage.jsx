import DashboardLayout from '../../shared/components/dashboard/DashboardLayout.jsx';
import CouponsContent from './components/CouponsContent.jsx';

export default function CouponsPage() {
  return (
    <DashboardLayout page="coupons" toast="Coupon saved">
      <CouponsContent />
    </DashboardLayout>
  );
}
