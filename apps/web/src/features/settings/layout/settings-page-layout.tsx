'use client';

import * as React from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { SettingsPageSkeleton, type SettingsSkeletonVariant } from './settings-page-skeleton';
import { SettingsRestrictedAccess } from './settings-restricted-access';
import { useSettingsRbac } from '../rbac/use-settings-rbac';
import { cn } from '@/lib/utils';

export interface SettingsPageLayoutProps {
  /** Workspace slug để kiểm tra quyền hạn RBAC */
  workspaceSlug?: string;
  /** Tên segment cài đặt để kiểm tra quyền truy cập (vd: 'bank', 'general') */
  segment?: string;
  /** Tiêu đề trang cài đặt (tùy chọn nếu hideHeader = true) */
  title?: string;
  /** Mô tả chi tiết mục đích cấu hình */
  description?: string;
  /** Icon đại diện module cài đặt */
  icon?: React.ComponentType<{ className?: string }>;
  /** Huy hiệu hiển thị cạnh tiêu đề (ví dụ: trạng thái kết nối, BETA) */
  badge?: React.ReactNode;
  /** Đường dẫn điều hướng breadcrumbs (cho các trang con sâu hơn) */
  breadcrumbs?: React.ReactNode;
  /** Các nút thao tác trên thanh header (Thêm mới, Dialog trigger,...) */
  headerActions?: React.ReactNode;
  /** Ẩn header mặc định nếu trang có custom header đặc thù riêng (như Inbox Detail) */
  hideHeader?: boolean;
  /**
   * Giới hạn độ rộng nội dung:
   * - 'form' (mặc định): max-w-5xl mx-auto (~1024px) thống nhất toàn phân hệ Settings
   * - 'full': 100% viewport width
   */
  containerWidth?: 'form' | 'full';
  /** Trạng thái tải dữ liệu của trang */
  isLoading?: boolean;
  /** Dạng skeleton tự động hiển thị khi isLoading = true */
  skeletonVariant?: SettingsSkeletonVariant;
  /** Thanh hành động nổi (Floating Sticky Action Bar khi có thay đổi chưa lưu) */
  actionBar?: React.ReactNode;
  /** Nội dung chính của trang cài đặt */
  children: React.ReactNode;
  /** Class tùy biến cho inner container */
  className?: string;
}

export function SettingsPageLayout({
  workspaceSlug,
  segment,
  title,
  description,
  icon,
  badge,
  breadcrumbs,
  headerActions,
  hideHeader = false,
  containerWidth = 'form',
  isLoading = false,
  skeletonVariant = 'form',
  actionBar,
  children,
  className,
}: SettingsPageLayoutProps) {
  const rbac = useSettingsRbac(workspaceSlug || '');
  const hasRbacCheck = Boolean(workspaceSlug && segment);

  // Gộp trạng thái loading: Chỉ hiển thị 1 skeleton duy nhất từ lúc nạp RBAC cho đến khi dữ liệu trang sẵn sàng
  const isRbacLoading = hasRbacCheck && rbac.isLoading;
  const isAccessDenied = hasRbacCheck && !rbac.isLoading && !rbac.canAccess(segment!);
  const isPageLoading = isLoading || isRbacLoading;

  const isFormWidth = containerWidth === 'form';

  return (
    <div className="flex flex-col flex-1 h-full min-h-0 overflow-y-auto bg-background p-6 relative">
      <div
        className={cn('w-full flex flex-col gap-6', isFormWidth && 'max-w-5xl mx-auto', className)}
      >
        {!hideHeader && title && (
          <PageHeader
            title={title}
            description={description}
            icon={icon}
            badge={badge}
            breadcrumbs={breadcrumbs}
            actions={headerActions}
          />
        )}

        {isPageLoading ? (
          <SettingsPageSkeleton variant={skeletonVariant} />
        ) : isAccessDenied ? (
          <SettingsRestrictedAccess
            workspaceSlug={workspaceSlug!}
            currentRole={rbac.currentRole}
            defaultRoute={rbac.defaultRoute}
          />
        ) : (
          children
        )}

        {!isPageLoading && !isAccessDenied && actionBar}
      </div>
    </div>
  );
}
