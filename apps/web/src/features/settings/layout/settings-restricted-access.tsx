'use client';

import * as React from 'react';
import Link from 'next/link';
import { Lock, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface SettingsRestrictedAccessProps {
  workspaceSlug: string;
  currentRole?: string | null;
  defaultRoute: string;
}

export function SettingsRestrictedAccess({
  workspaceSlug,
  currentRole,
  defaultRoute,
}: SettingsRestrictedAccessProps) {
  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center p-8 text-center max-w-md mx-auto my-auto min-h-[360px]">
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
        <Lock className="size-6" />
      </div>
      <h3 className="text-lg font-semibold tracking-tight text-foreground">Truy cập bị hạn chế</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Vai trò của bạn{' '}
        {currentRole ? (
          <span className="font-semibold uppercase text-foreground">({currentRole})</span>
        ) : (
          ''
        )}{' '}
        không có quyền xem hoặc chỉnh sửa phần cài đặt này.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button variant="default" size="sm" asChild>
          <Link href={defaultRoute}>Về mục cài đặt được phép</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/${workspaceSlug}/conversations`}>
            <ArrowLeft className="size-3.5" />
            Về trang Hội thoại
          </Link>
        </Button>
      </div>
    </div>
  );
}
