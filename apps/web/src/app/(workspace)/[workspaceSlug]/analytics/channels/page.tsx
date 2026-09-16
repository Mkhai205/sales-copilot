import { FeaturePlaceholder } from '@/components/placeholder/feature-placeholder';
import { PieChart } from 'lucide-react';

export default function AnalyticsChannelsPage() {
  return (
    <FeaturePlaceholder
      title="Báo cáo Doanh thu theo Kênh (Channel Attribution)"
      subtitle="Phân tích doanh thu và số lượng đơn hàng theo từng nguồn kết nối: Facebook Fanpage, Zalo OA và Website Live Chat."
      icon={PieChart}
      milestone="Phase 2 Milestone 2B"
      actionLabel="Lọc theo kênh kết nối"
      features={[
        {
          title: 'Tỷ trọng doanh thu đa kênh (Revenue Share)',
          description:
            'So sánh mức độ đóng góp doanh số giữa Facebook Messenger, Zalo Official Account và Web Chat.',
          status: 'ready',
        },
        {
          title: 'Hiệu quả theo từng Fanpage / Hộp thư',
          description:
            'Xác định trang nào mang lại tỷ lệ ra đơn cao nhất để tối ưu hóa ngân sách tiếp thị.',
          status: 'ready',
        },
        {
          title: 'Phân loại khách hàng theo nguồn đến',
          description:
            'Theo dõi giá trị vòng đời (LTV) của khách hàng đến từ mạng xã hội so với khách truy cập website.',
          status: 'in_progress',
        },
        {
          title: 'Xu hướng tăng trưởng kênh bán lẻ',
          description:
            'Dự báo xu hướng tăng trưởng đơn hàng theo từng kênh để chủ động kế hoạch nhập hàng.',
          status: 'planned',
        },
      ]}
    />
  );
}
