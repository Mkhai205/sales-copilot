import { GhostNotFound } from '@/components/ui/ghost-404-page-1';

export default function NotFound() {
  return (
    <GhostNotFound
      homeHref="/"
      homeText="Về trang chủ"
      title="Hư ảo! Trang này biến mất rồi!"
      subtitle="Rất tiếc! Trang này chỉ là bóng ma — nó không tồn tại ở đâu cả!"
    />
  );
}
