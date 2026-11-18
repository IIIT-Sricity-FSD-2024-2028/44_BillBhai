import DashboardLayout from '../components/dashboard/DashboardLayout.jsx';
import CouponsContent from '../components/coupons/CouponsContent.jsx';

export default function CouponsPage() {
  return (
    <DashboardLayout page="coupons" toast="Coupon saved">
      <CouponsContent />
    </DashboardLayout>
  );
}
