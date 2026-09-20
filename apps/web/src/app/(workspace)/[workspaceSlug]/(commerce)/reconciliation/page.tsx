import { FeaturePlaceholder } from '@/components/placeholder/feature-placeholder';
import { QrCode } from 'lucide-react';

export default function ReconciliationPage() {
  return (
    <FeaturePlaceholder
      title="Đối soát Thanh toán VietQR (Reconciliation)"
      subtitle="Nhật ký biến động số dư tài khoản ngân hàng, tự động khớp mã đơn và gạch nợ tức thì."
      icon={QrCode}
      milestone="Phase 2 Milestone 2A"
      actionLabel="Kiểm tra kết nối ngân hàng"
      features={[
        {
          title: 'Khớp mã đơn & Gạch nợ tự động (< 1s)',
          description:
            'Hệ thống nhận webhook từ SePay/Casso, phân tích cú pháp mã đơn DH... và cập nhật ĐÃ THANH TOÁN.',
          status: 'ready',
        },
        {
          title: 'Bảo vệ giao dịch kép (Idempotency Guard)',
          description:
            'Ràng buộc khóa phân tán Redis loại bỏ 100% rủi ro cộng tiền nhiều lần khi ngân hàng retry webhook.',
          status: 'ready',
        },
        {
          title: 'Xử lý chuyển thiếu & cọc một phần',
          description:
            'Tự động tính toán phần tiền còn thiếu và chuyển đơn sang trạng thái ĐÃ CỌC (Partially Paid).',
          status: 'ready',
        },
        {
          title: 'Triệt tiêu 100% rủi ro hóa đơn giả (Fake Bill)',
          description: 'Chỉ xác nhận đơn khi tiền thực sự đã vào tài khoản ngân hàng của chủ shop.',
          status: 'ready',
        },
      ]}
    />
  );
}
