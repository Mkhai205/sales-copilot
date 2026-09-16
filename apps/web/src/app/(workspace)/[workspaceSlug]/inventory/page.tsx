import { FeaturePlaceholder } from '@/components/placeholder/feature-placeholder';
import { Boxes } from 'lucide-react';

export default function InventoryPage() {
  return (
    <FeaturePlaceholder
      title="Quản lý Tồn kho & Sổ kho (Inventory)"
      subtitle="Kiểm soát số lượng tồn kho khả dụng, theo dõi hàng đang tạm giữ cho đơn chat và lịch sử xuất nhập kho."
      icon={Boxes}
      milestone="Phase 2 Milestone 2A"
      actionLabel="Tạo phiếu nhập kho"
      features={[
        {
          title: 'Công thức tồn kho 3 trạng thái chuẩn bán lẻ',
          description:
            'Tồn thực tế (On-hand) trừ Tạm giữ đơn hàng (Reserved) bằng Tồn khả dụng (Available).',
          status: 'ready',
        },
        {
          title: 'Khóa kho nguyên tử (Atomic Stock Reservation)',
          description:
            'Bảo vệ bằng PostgreSQL transaction và Redis lock, ngăn ngừa 100% tình trạng bán âm hoặc bán trùng.',
          status: 'ready',
        },
        {
          title: 'Sổ kho & Nhật ký biến động (Stock Ledger)',
          description:
            'Truy vết minh bạch từng lượt nhập kho (Stock In), chốt đơn (Commit Sale) và trả hàng (Return Restock).',
          status: 'ready',
        },
        {
          title: 'Cảnh báo hết hàng tự động',
          description:
            'Gợi ý nhập thêm hàng khi số lượng tồn khả dụng chạm ngưỡng an toàn (Low Stock Alert).',
          status: 'in_progress',
        },
      ]}
    />
  );
}
