'use client';

import * as React from 'react';
import { Building2, Calendar, Check, Copy, Globe, Save, RotateCcw, Sparkles } from 'lucide-react';
import type { WorkspaceDto } from '@sales-copilot/shared-contracts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Separator } from '@/components/ui/separator';
import { LANGUAGE_OPTIONS, TIMEZONE_OPTIONS } from '../../constants/workspace-settings-options';
import { useUpdateWorkspace } from '../../hooks/use-workspace-mutations';

interface WorkspaceSettingsFormProps {
  workspace: WorkspaceDto;
}

export function WorkspaceSettingsForm({ workspace }: WorkspaceSettingsFormProps) {
  const [name, setName] = React.useState(workspace.name);
  const [timezone, setTimezone] = React.useState(workspace.timezone || 'UTC');
  const [defaultLanguage, setDefaultLanguage] = React.useState(workspace.defaultLanguage || 'en');
  const [copiedId, setCopiedId] = React.useState(false);

  // Sync state if workspace prop updates from query
  React.useEffect(() => {
    setName(workspace.name);
    setTimezone(workspace.timezone || 'UTC');
    setDefaultLanguage(workspace.defaultLanguage || 'en');
  }, [workspace]);

  const { mutate: updateWorkspace, isPending } = useUpdateWorkspace(workspace.id);

  // Validation logic
  const trimmedName = name.trim();
  const nameError = React.useMemo(() => {
    if (trimmedName.length === 0) {
      return 'Tên không gian làm việc là bắt buộc';
    }
    if (trimmedName.length < 2) {
      return 'Tên không gian làm việc phải có ít nhất 2 ký tự';
    }
    if (trimmedName.length > 100) {
      return 'Tên không gian làm việc không được vượt quá 100 ký tự';
    }
    return null;
  }, [trimmedName]);

  const isValid = !nameError;

  // Dirty check
  const isDirty =
    trimmedName !== workspace.name ||
    timezone !== (workspace.timezone || 'UTC') ||
    defaultLanguage !== (workspace.defaultLanguage || 'en');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || !isDirty || isPending) return;

    updateWorkspace({
      name: trimmedName,
      timezone,
      defaultLanguage,
    });
  };

  const handleReset = () => {
    setName(workspace.name);
    setTimezone(workspace.timezone || 'UTC');
    setDefaultLanguage(workspace.defaultLanguage || 'en');
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(workspace.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const formattedCreatedAt = React.useMemo(() => {
    if (!workspace.createdAt) return '—';
    const date = new Date(workspace.createdAt);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, [workspace.createdAt]);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 w-full">
      {/* Main Workspace Configuration Card */}
      <Card className="border-border bg-card/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-primary" />
            <CardTitle className="text-sm font-semibold">
              {'Thông tin Không gian làm việc'}
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            {'Thông tin chung về tổ chức và hiển thị bảng điều khiển của bạn.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Workspace Name */}
            <Field data-invalid={!!nameError}>
              <FieldLabel htmlFor="workspace-name">{'Tên không gian làm việc'}</FieldLabel>
              <Input
                id="workspace-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Acme Corporation"
                maxLength={100}
                aria-invalid={!!nameError}
                className="w-full text-xs"
              />
              <FieldDescription>
                {
                  'Tên hiển thị của không gian làm việc hiển thị cho nhân viên và trên các trao đổi ra ngoài.'
                }
              </FieldDescription>
              {nameError && <FieldError errors={[{ message: nameError }]} />}
            </Field>

            {/* Workspace Slug (Readonly) */}
            <Field>
              <FieldLabel htmlFor="workspace-slug">{'Định danh (Slug)'}</FieldLabel>
              <div className="flex w-full items-center gap-2">
                <Input
                  id="workspace-slug"
                  value={workspace.slug}
                  disabled
                  readOnly
                  className="w-full text-xs font-mono bg-muted/50 cursor-not-allowed"
                />
              </div>
              <FieldDescription>
                {'Định danh URL duy nhất để truy cập bảng điều khiển không gian làm việc.'}
              </FieldDescription>
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Regional & Localization Settings Card */}
      <Card className="border-border bg-card/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-primary" />
            <CardTitle className="text-sm font-semibold">{'Khu vực & Ngôn ngữ'}</CardTitle>
          </div>
          <CardDescription className="text-xs">
            {
              'Thiết lập múi giờ mặc định cho mốc thời gian, quy tắc tự động và tùy chọn ngôn ngữ giao diện.'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Timezone */}
            <Field>
              <FieldLabel htmlFor="workspace-timezone">{'Múi giờ'}</FieldLabel>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger id="workspace-timezone" className="w-full text-xs">
                  <SelectValue placeholder={'Chọn múi giờ'} />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-72">
                  {TIMEZONE_OPTIONS.map(group => (
                    <SelectGroup key={group.group}>
                      <SelectLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {group.group}
                      </SelectLabel>
                      {group.options.map(opt => (
                        <SelectItem key={opt.value} value={opt.value} className="text-xs">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription>
                {'Dùng cho lên lịch quy tắc tự động, giờ làm việc và báo cáo thống kê.'}
              </FieldDescription>
            </Field>

            {/* Default Language */}
            <Field>
              <FieldLabel htmlFor="workspace-language">{'Ngôn ngữ mặc định'}</FieldLabel>
              <Select value={defaultLanguage} onValueChange={setDefaultLanguage}>
                <SelectTrigger id="workspace-language" className="w-full text-xs">
                  <SelectValue placeholder={'Chọn ngôn ngữ'} />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-72">
                  <SelectGroup>
                    {LANGUAGE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldDescription>
                {'Ngôn ngữ chính sử dụng cho thông báo hệ thống và mẫu gửi tin.'}
              </FieldDescription>
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Workspace Plan & Metadata Overview Card */}
      <Card className="border-border bg-card/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-amber-500" />
              <CardTitle className="text-sm font-semibold">
                {'Gói cước & Chi tiết Không gian làm việc'}
              </CardTitle>
            </div>
            <Badge variant="outline" className="px-2 py-0.5 text-xs font-semibold uppercase">
              {workspace.billingPlan || 'FREE'}
            </Badge>
          </div>
          <CardDescription className="text-xs">
            {'Định danh hệ thống và siêu dữ liệu gắn với đơn vị thuê này.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
            <div className="flex flex-col gap-1 rounded-lg border border-border/50 bg-background/50 p-3">
              <span className="text-[11px] font-medium text-muted-foreground">
                {'Mã Không gian làm việc'}
              </span>
              <div className="flex items-center justify-between gap-2">
                <code className="truncate font-mono text-[11px] text-foreground">
                  {workspace.id}
                </code>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyId}
                  className="size-6 p-0 hover:bg-muted"
                  title={'Sao chép mã'}
                >
                  {copiedId ? (
                    <Check className="size-3 text-green-500" />
                  ) : (
                    <Copy className="size-3 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-1 rounded-lg border border-border/50 bg-background/50 p-3">
              <span className="text-[11px] font-medium text-muted-foreground">{'Ngày tạo'}</span>
              <div className="flex items-center gap-2 text-foreground font-medium">
                <Calendar className="size-3.5 text-muted-foreground" />
                <span>{formattedCreatedAt}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Footer */}
      <Separator />

      <div className="flex items-center justify-end gap-3 pb-8">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleReset}
          disabled={!isDirty || isPending}
          className="text-xs"
        >
          <RotateCcw className="size-3.5" data-icon="inline-start" />
          {'Hủy'}
        </Button>

        <Button
          type="submit"
          variant="default"
          size="sm"
          disabled={!isDirty || !isValid || isPending}
          className="text-xs font-medium"
        >
          {isPending ? (
            <>
              <Spinner className="size-3.5" data-icon="inline-start" />
              {'Đang lưu...'}
            </>
          ) : (
            <>
              <Save className="size-3.5" data-icon="inline-start" />
              {'Lưu thay đổi'}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
