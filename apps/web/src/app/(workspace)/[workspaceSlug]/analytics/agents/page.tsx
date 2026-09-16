import { FeaturePlaceholder } from '@/components/placeholder/feature-placeholder';
import { Award } from 'lucide-react';

export default function AnalyticsAgentsPage() {
  return (
    <FeaturePlaceholder
      title="Hiệu suất Nhân viên & Bảng xếp hạng"
      subtitle="Đo lường năng suất chốt đơn của đội ngũ telesales: doanh số cá nhân, tỷ lệ chốt đơn (CR%) và thời gian phản hồi (FRT)."
      icon={Award}
      milestone="Phase 2 Milestone 2B"
      actionLabel="Xuất báo cáo KPI"
      features={[
        {
          title: 'Bảng vinh danh Top Doanh số (Leaderboard)',
          description:
            'Xếp hạng tư vấn viên theo tổng doanh thu chốt được, tạo động lực cạnh tranh lành mạnh trong đội ngũ.',
          status: 'ready',
        },
        {
          title: 'Tỷ lệ chốt đơn chuyển đổi (Closing Rate %)',
          description:
            'Tính toán tỷ lệ phần trăm khách hàng phát sinh đơn trên tổng số cuộc hội thoại được gán.',
          status: 'ready',
        },
        {
          title: 'Tốc độ phản hồi khách hàng (First Response Time)',
          description:
            'Giám sát chỉ số phản hồi dưới 30 giây để đảm bảo khách hàng không phải chờ đợi lâu.',
          status: 'ready',
        },
        {
          title: 'Kiểm toán mức chiết khấu của tư vấn viên',
          description:
            'Theo dõi các đơn hàng có giảm giá đặc biệt để tránh thất thoát biên lợi nhuận của shop.',
          status: 'in_progress',
        },
      ]}
    />
  );
}
