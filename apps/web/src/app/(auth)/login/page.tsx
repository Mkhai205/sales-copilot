import type { Metadata } from 'next';
import { LoginForm } from '@/features/auth/login-form';

export const metadata: Metadata = {
  title: 'Sign In | Sales Copilot',
  description: 'Sign in to access your omnichannel conversation dashboard and AI copilot',
};

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm md:max-w-3xl">
      <LoginForm />
    </div>
  );
}
