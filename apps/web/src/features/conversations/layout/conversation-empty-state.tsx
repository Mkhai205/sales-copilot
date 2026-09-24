'use client';

import * as React from 'react';
import Image from 'next/image';

export function ConversationEmptyState() {
  return (
    <div className="relative flex h-full flex-1 flex-col items-center justify-center overflow-hidden p-8 text-center bg-background/50">
      {/* Subtle ambient backdrop */}
      <div className="pointer-events-none absolute -top-24 size-96 rounded-full bg-primary/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 size-96 rounded-full bg-accent/5 blur-3xl" />

      <div className="relative z-10 flex max-w-md flex-col items-center">
        <div className="mb-4 flex items-center justify-center">
          <Image
            src="/empty-conversations.svg"
            alt={'Không có cuộc hội thoại nào'}
            width={240}
            height={200}
            priority
            style={{ width: 'auto', height: 'auto' }}
            className="max-h-44 w-auto object-contain drop-shadow-xs"
          />
        </div>

        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {'Không có cuộc hội thoại nào'}
        </h2>

        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          {'Chọn một cuộc hội thoại từ danh sách bên trái hoặc chờ tin nhắn mới từ khách hàng.'}
        </p>
      </div>
    </div>
  );
}
