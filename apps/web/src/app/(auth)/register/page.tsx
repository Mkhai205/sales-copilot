import type { Metadata } from 'next';
import { RegisterForm } from '@/features/auth';

export const metadata: Metadata = {
  title: 'Đăng ký Shop | Sales Copilot',
  description: 'Đăng ký cửa hàng mới và trải nghiệm trợ lý bán hàng AI Sales Copilot',
};

export default function RegisterPage() {
  return (
    <div className="w-full max-w-sm md:max-w-3xl">
      <RegisterForm />
    </div>
  );
}
