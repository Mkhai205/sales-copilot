import type { Metadata } from 'next';
import { LoginForm } from '@/features/auth';

export const metadata: Metadata = {
  title: 'Đăng nhập | Sales Copilot',
  description: 'Đăng nhập để truy cập hộp thư đa kênh và trợ lý hội thoại AI Sales Copilot',
};

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm md:max-w-3xl">
      <LoginForm />
    </div>
  );
}
