import * as React from 'react';
import { Button, Section, Text } from '@react-email/components';
import { BaseLayout } from '../components/BaseLayout';

export interface EmployeeCredentialsProps {
  name: string;
  to: string;
  temporaryPassword: string;
  workspaceName: string;
  role: string;
  loginUrl?: string;
}

export function EmployeeCredentialsEmail({
  name = 'Nguyễn Văn A',
  to = 'nhanvien@example.com',
  temporaryPassword = 'TemporaryPassword123!',
  workspaceName = 'Shop Thời Trang Mẫu',
  role = 'AGENT',
  loginUrl = 'http://localhost:3000/login',
}: EmployeeCredentialsProps) {
  const roleName = role === 'ADMIN' ? 'Quản trị viên (Admin)' : 'Nhân viên tư vấn (Agent)';
  const previewText = `Thông tin tài khoản nhân viên tại ${workspaceName} - Sales Copilot`;

  return (
    <BaseLayout previewText={previewText}>
      <Text className="text-lg font-semibold text-foreground mt-0 mb-4">Xin chào {name},</Text>
      <Text className="text-sm text-gray-700 leading-6 mb-5">
        Tài khoản nhân viên của bạn đã được tạo thành công cho không gian làm việc{' '}
        <strong className="text-foreground">{workspaceName}</strong> với vai trò{' '}
        <strong className="text-foreground">{roleName}</strong>.
      </Text>

      {/* Account Details Box */}
      <Section className="bg-gray-50 border border-solid border-border rounded-lg p-5 my-5">
        <Text className="text-sm font-semibold text-foreground m-0 mb-3">
          Thông tin đăng nhập của bạn:
        </Text>
        <Text className="text-sm text-gray-600 m-0 mb-2 leading-5">
          <span className="text-muted">Email:</span>{' '}
          <strong className="text-foreground font-mono">{to}</strong>
        </Text>
        <Text className="text-sm text-gray-600 m-0 leading-5">
          <span className="text-muted">Mật khẩu tạm thời:</span>{' '}
          <strong className="text-red-600 font-mono text-base font-bold tracking-wide">
            {temporaryPassword}
          </strong>
        </Text>
      </Section>

      <Text className="text-xs text-muted italic my-4 leading-5">
        * Lưu ý quan trọng: Vì lý do bảo mật, vui lòng đổi mật khẩu ngay sau khi đăng nhập thành
        công lần đầu tiên.
      </Text>

      {/* CTA Button */}
      <Section className="text-center mt-6 mb-4">
        <Button
          className="bg-primary text-white text-sm font-semibold py-3 px-7 rounded-md no-underline text-center inline-block shadow-sm"
          href={loginUrl}
        >
          Đăng nhập vào hệ thống
        </Button>
      </Section>

      <Text className="text-xs text-gray-400 text-center mt-4 mb-0">
        Nếu nút trên không hoạt động, bạn có thể copy link sau vào trình duyệt:{' '}
        <a href={loginUrl} className="text-primary underline">
          {loginUrl}
        </a>
      </Text>
    </BaseLayout>
  );
}

export default EmployeeCredentialsEmail;
