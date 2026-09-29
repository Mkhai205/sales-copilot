import type { Metadata } from 'next';
import { LoginForm } from '@/features/auth/components/login-form';

export const metadata: Metadata = {
  title: 'Đăng nhập | Sales Copilot',
  description: 'Đăng nhập để truy cập hộp thư đa kênh và trợ lý hội thoại AI Sales Copilot',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  return (
    <div className="w-full max-w-sm md:max-w-4xl">
      <LoginForm redirectTo={redirect} />
    </div>
  );
}
