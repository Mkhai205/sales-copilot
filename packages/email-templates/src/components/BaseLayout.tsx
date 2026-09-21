import * as React from 'react';
import { Body, Container, Head, Hr, Html, Preview, Section, Text } from '@react-email/components';
import { Tailwind } from '@react-email/tailwind';

export interface BaseLayoutProps {
  previewText?: string;
  children: React.ReactNode;
}

export function BaseLayout({ previewText, children }: BaseLayoutProps) {
  return (
    <Html>
      <Head />
      {previewText && <Preview>{previewText}</Preview>}
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: {
                primary: '#2563eb',
                background: '#f9fafb',
                card: '#ffffff',
                border: '#e5e7eb',
                muted: '#6b7280',
                foreground: '#111827',
              },
            },
          },
        }}
      >
        <Body className="bg-background my-auto mx-auto font-sans px-2">
          <Container className="border border-solid border-border rounded-xl my-[40px] mx-auto p-[32px] max-w-[560px] bg-card shadow-sm">
            {/* Header / Brand */}
            <Section className="text-center pb-6 border-b border-solid border-gray-100">
              <Text className="text-2xl font-bold text-foreground m-0 tracking-tight">
                Sales Copilot
              </Text>
              <Text className="text-xs text-muted mt-1 mb-0 uppercase tracking-widest font-medium">
                Omnichannel Conversational Commerce
              </Text>
            </Section>

            {/* Email Body Content */}
            <Section className="pt-6">{children}</Section>

            {/* Footer */}
            <Hr className="border-border my-6" />
            <Section className="text-center">
              <Text className="text-xs text-muted m-0 leading-5">
                © {new Date().getFullYear()} Sales Copilot. Bảo lưu mọi quyền.
              </Text>
              <Text className="text-[11px] text-gray-400 mt-1 mb-0 leading-4">
                Email này được gửi tự động từ hệ thống Sales Copilot. Vui lòng không trả lời trực
                tiếp email này.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
