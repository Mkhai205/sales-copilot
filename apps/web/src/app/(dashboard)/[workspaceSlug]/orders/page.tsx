import { FeaturePlaceholder } from '@/components/placeholder/feature-placeholder';
import { Package } from 'lucide-react';

export default function OrdersPage() {
  return (
    <FeaturePlaceholder
      title="Quản lý Đơn hàng (Orders)"
      subtitle="Theo dõi toàn bộ đơn hàng đa kênh, lọc theo trạng thái, in phiếu gửi K80 và đẩy sang đơn vị vận chuyển."
      icon={Package}
      milestone="Phase 2 Milestone 2A"
      actionLabel="Tạo đơn hàng mới"
      features={[
        {
          title: 'Quản lý vòng đời đơn hàng',
          description:
            'Theo dõi đơn theo các trạng thái DRAFT, CONFIRMED, PAID, SHIPPING, COMPLETED, CANCELLED.',
          status: 'ready',
        },
        {
          title: 'In phiếu gửi nhiệt K80 / K58',
          description:
            'In trực tiếp qua trình duyệt với khổ 80mm/58mm, chuẩn mã vạch Code128, không cần driver.',
          status: 'ready',
        },
        {
          title: 'Tự động gạch nợ VietQR',
          description:
            'Khớp mã đơn với webhook ngân hàng SePay/Casso chuyển trạng thái ĐÃ THANH TOÁN < 1s.',
          status: 'ready',
        },
        {
          title: 'Đẩy đơn vận chuyển tự động (3PL)',
          description:
            'Kết nối API GHTK, GHN tự động lấy mã vận đơn và chuẩn hóa địa chỉ 3 cấp quốc gia.',
          status: 'in_progress',
        },
      ]}
    />
  );
}
