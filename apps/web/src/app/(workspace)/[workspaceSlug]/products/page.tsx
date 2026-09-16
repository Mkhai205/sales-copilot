import { FeaturePlaceholder } from '@/components/placeholder/feature-placeholder';
import { Tag } from 'lucide-react';

export default function ProductsPage() {
  return (
    <FeaturePlaceholder
      title="Danh mục Sản phẩm (Products & Catalog)"
      subtitle="Quản lý sản phẩm, danh mục, bảng giá bán lẻ, giá vốn và các thuộc tính biến thể SKU (Màu sắc, Kích cỡ)."
      icon={Tag}
      milestone="Phase 2 Milestone 2A"
      actionLabel="Thêm sản phẩm mới"
      features={[
        {
          title: 'Quản lý biến thể đa thuộc tính (Variants)',
          description:
            'Tự động sinh mã SKU theo Màu sắc / Kích cỡ / Chất liệu với hình ảnh và mã vạch riêng.',
          status: 'ready',
        },
        {
          title: 'Bảng giá & Quản lý giá vốn',
          description:
            'Cấu hình giá niêm yết, giá khuyến mãi và giá vốn an toàn để kiểm soát lợi nhuận.',
          status: 'ready',
        },
        {
          title: 'Tìm kiếm siêu tốc trong khung chat (< 50ms)',
          description:
            'Tra cứu SKU tức thì bằng phím tắt Ctrl+K hoặc lệnh /sp khi đang tư vấn khách hàng.',
          status: 'ready',
        },
        {
          title: 'Đồng bộ danh mục lên kênh mạng xã hội',
          description: 'Xuất danh mục chuẩn bị sẵn sàng cho Facebook Shop và Zalo Mini App.',
          status: 'planned',
        },
      ]}
    />
  );
}
