import Link from 'next/link';
import { Sliders, Building2, ScrollText, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function AdminOverviewPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Trung tâm Quản trị Cấp cao</h1>
        <p className="text-sm text-muted-foreground">
          Quản trị nền tảng SaaS Sales Copilot, cấu hình động thời gian thực và giám sát hoạt động.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="flex flex-col justify-between border-border bg-card">
          <CardHeader className="gap-2">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sliders className="size-5" />
            </div>
            <CardTitle className="text-base">Cấu hình Hệ thống</CardTitle>
            <CardDescription className="text-xs">
              Điều chỉnh Feature Flags, LLM Defaults, hạn mức mặc định và thông báo toàn hệ thống.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Link
              href="/admin/settings"
              className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'w-full gap-2')}
            >
              <span>Truy cập Cấu hình</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </CardContent>
        </Card>

        <Card className="flex flex-col justify-between border-border bg-card">
          <CardHeader className="gap-2">
            <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
              <Building2 className="size-5" />
            </div>
            <CardTitle className="text-base">Quản trị Workspaces</CardTitle>
            <CardDescription className="text-xs">
              Quản lý danh sách doanh nghiệp, điều chỉnh gói cước, ghi đè hạn mức quota và khóa tài
              khoản.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Link
              href="/admin/workspaces"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full gap-2')}
            >
              <span>Quản lý Shop</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </CardContent>
        </Card>

        <Card className="flex flex-col justify-between border-border bg-card">
          <CardHeader className="gap-2">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
              <ScrollText className="size-5" />
            </div>
            <CardTitle className="text-base">Nhật ký Kiểm toán</CardTitle>
            <CardDescription className="text-xs">
              Truy vết 100% lịch sử can thiệp của Super Admin, diff thay đổi tham số và an toàn dữ
              liệu.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Link
              href="/admin/audit-logs"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full gap-2')}
            >
              <span>Xem Nhật ký</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
