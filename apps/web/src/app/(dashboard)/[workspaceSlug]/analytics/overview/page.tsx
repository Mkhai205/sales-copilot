import { FeaturePlaceholder } from '@/components/placeholder/feature-placeholder';
import { LineChart } from 'lucide-react';

export default function AnalyticsOverviewPage() {
  return (
    <FeaturePlaceholder
      title="Tổng quan Doanh thu & Chuyển đổi"
      subtitle="Thống kê doanh số thuần, số lượng đơn hàng, giá trị đơn trung bình (AOV) và tỷ lệ chuyển đổi VietQR."
      icon={LineChart}
      milestone="Phase 2 Milestone 2B"
      actionLabel="Tùy chỉnh khoảng thời gian"
      features={[
        {
          title: 'Doanh thu thuần thời gian thực (Net GMV)',
          description:
            'Cập nhật trực tiếp số liệu từ các đơn đã thanh toán VietQR và đơn COD đã đối soát.',
          status: 'ready',
        },
        {
          title: 'Khung giờ chốt đơn cao điểm (Peak Hours)',
          description:
            'Phân tích nhiệt lượng bán hàng theo giờ để bố trí ca trực tư vấn viên hiệu quả nhất.',
          status: 'in_progress',
        },
        {
          title: 'Tỷ lệ thanh toán VietQR chuyển khoản',
          description:
            'Đo lường mức độ chuyển dịch từ COD sang chuyển khoản ngân hàng không tiền mặt.',
          status: 'ready',
        },
        {
          title: 'Kiểm soát tỷ lệ bom hàng & Hoàn đơn',
          description:
            'Cảnh báo sớm khi tỷ lệ hoàn hàng của các kênh bán vượt quá ngưỡng an toàn (> 10%).',
          status: 'in_progress',
        },
      ]}
    />
  );
}
