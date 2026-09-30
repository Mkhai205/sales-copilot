'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, Calendar, Check, Copy, Globe, Sparkles } from 'lucide-react';
import {
  updateWorkspaceSchema,
  type WorkspaceDto,
  type UpdateWorkspaceDto,
} from '@sales-copilot/shared-contracts';
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
import { LANGUAGE_OPTIONS, TIMEZONE_OPTIONS } from '../constants/workspace-options';
import { useUpdateWorkspace } from '../hooks/use-workspace-mutations';
import { SettingsActionBar } from '../../layout/settings-action-bar';

interface WorkspaceSettingsFormProps {
  workspace: WorkspaceDto;
}

export function WorkspaceSettingsForm({ workspace }: WorkspaceSettingsFormProps) {
  const [copiedId, setCopiedId] = React.useState(false);

  const defaultValues: UpdateWorkspaceDto = React.useMemo(
    () => ({
      name: workspace.name,
      timezone: workspace.timezone || 'UTC',
      defaultLanguage: workspace.defaultLanguage || 'en',
    }),
    [workspace.name, workspace.timezone, workspace.defaultLanguage],
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { isDirty, isValid, errors },
  } = useForm<UpdateWorkspaceDto>({
    resolver: zodResolver(updateWorkspaceSchema),
    defaultValues,
    values: defaultValues,
    mode: 'onChange',
  });

  const { mutate: updateWorkspace, isPending } = useUpdateWorkspace(workspace.id);

  const currentTimezone = watch('timezone') || 'UTC';
  const currentLanguage = watch('defaultLanguage') || 'en';

  const onSubmit = (data: UpdateWorkspaceDto) => {
    updateWorkspace(data, {
      onSuccess: updated => {
        reset({
          name: updated.name,
          timezone: updated.timezone || 'UTC',
          defaultLanguage: updated.defaultLanguage || 'en',
        });
      },
    });
  };

  const handleReset = (e?: React.MouseEvent) => {
    e?.preventDefault();
    reset(defaultValues);
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
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6 w-full">
      {/* Main Workspace Configuration Card */}
      <Card className="border-border bg-card/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Thông tin Không gian làm việc</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Thông tin chung về tổ chức và hiển thị bảng điều khiển của bạn.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Workspace Name */}
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="workspace-name">{'Tên không gian làm việc'}</FieldLabel>
              <Input
                id="workspace-name"
                {...register('name')}
                placeholder="e.g. Acme Corporation"
                maxLength={100}
                aria-invalid={!!errors.name}
                className="w-full text-xs"
                disabled={isPending}
              />
              <FieldDescription>
                {
                  'Tên hiển thị của không gian làm việc hiển thị cho nhân viên và trên các trao đổi ra ngoài.'
                }
              </FieldDescription>
              {errors.name?.message && <FieldError errors={[{ message: errors.name.message }]} />}
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
            <Field data-invalid={!!errors.timezone}>
              <FieldLabel htmlFor="workspace-timezone">{'Múi giờ'}</FieldLabel>
              <Select
                value={currentTimezone}
                onValueChange={val =>
                  setValue('timezone', val, { shouldDirty: true, shouldValidate: true })
                }
                disabled={isPending}
              >
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
              {errors.timezone?.message && (
                <FieldError errors={[{ message: errors.timezone.message }]} />
              )}
            </Field>

            {/* Default Language */}
            <Field data-invalid={!!errors.defaultLanguage}>
              <FieldLabel htmlFor="workspace-language">{'Ngôn ngữ mặc định'}</FieldLabel>
              <Select
                value={currentLanguage}
                onValueChange={val =>
                  setValue('defaultLanguage', val, { shouldDirty: true, shouldValidate: true })
                }
                disabled={isPending}
              >
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
              {errors.defaultLanguage?.message && (
                <FieldError errors={[{ message: errors.defaultLanguage.message }]} />
              )}
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Workspace Plan & Metadata Overview Card */}
      <Card className="border-border bg-card/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-warning" />
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
                    <Check className="size-3 text-success" />
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

      <SettingsActionBar
        isDirty={isDirty}
        isPending={isPending}
        isValid={isValid}
        onCancel={handleReset}
        onSave={() => handleSubmit(onSubmit)()}
      />
    </form>
  );
}
