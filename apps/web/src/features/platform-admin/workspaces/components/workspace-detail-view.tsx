'use client';

import * as React from 'react';
import {
  Building2,
  Users,
  Radio,
  HardDrive,
  Cpu,
  Clock,
  Globe,
  Copy,
  Check,
  ShieldAlert,
} from 'lucide-react';
import type { PlatformWorkspaceDetailDto } from '@sales-copilot/shared-contracts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  formatDateTime,
  formatStorage,
  formatTokens,
  getPlanBadgeConfig,
  getStatusBadgeConfig,
} from '../utils/workspace-helpers';

export interface WorkspaceDetailViewProps {
  workspace: PlatformWorkspaceDetailDto;
}

export function WorkspaceDetailView({ workspace }: WorkspaceDetailViewProps) {
  const [copiedSlug, setCopiedSlug] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState(false);

  const planBadge = getPlanBadgeConfig(workspace.billingPlan);
  const statusBadge = getStatusBadgeConfig(workspace.isSuspended);

  const copyToClipboard = (text: string, type: 'slug' | 'id') => {
    navigator.clipboard.writeText(text);
    if (type === 'slug') {
      setCopiedSlug(true);
      setTimeout(() => setCopiedSlug(false), 2000);
    } else {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  // Quota percentages: raw calculated percentage vs progress bar percentage (clamped 0 - 100)
  const rawAgentPercent = Math.round(
    ((workspace.usage.currentAgents || 0) / (workspace.quotas.maxAgents || 1)) * 100,
  );
  const agentPercent = Math.min(100, Math.max(0, rawAgentPercent));

  const rawChannelPercent = Math.round(
    ((workspace.usage.currentChannels || 0) / (workspace.quotas.maxChannels || 1)) * 100,
  );
  const channelPercent = Math.min(100, Math.max(0, rawChannelPercent));

  const rawStoragePercent = Math.round(
    ((workspace.usage.storageUsedMb || 0) / (workspace.quotas.storageLimitMb || 1)) * 100,
  );
  const storagePercent = Math.min(100, Math.max(0, rawStoragePercent));

  const rawTokenPercent = Math.round(
    ((workspace.usage.aiUsedTokens || 0) / (workspace.quotas.aiMonthlyTokens || 1)) * 100,
  );
  const tokenPercent = Math.min(100, Math.max(0, rawTokenPercent));

  return (
    <div className="flex flex-col gap-5">
      {/* Suspension Alert Banner if suspended */}
      {workspace.isSuspended && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
          <ShieldAlert className="size-4 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <span className="font-semibold">Workspace đang bị tạm khóa</span>
            <span>
              Lý do: {workspace.suspendedReason || 'Chưa ghi chú'} (Khóa vào:{' '}
              {formatDateTime(workspace.suspendedAt)})
            </span>
          </div>
        </div>
      )}

      {/* Header Profile Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold text-base">
                {workspace.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold tracking-tight text-foreground">
                    {workspace.name}
                  </h2>
                  <Badge variant={planBadge.variant} className={planBadge.className}>
                    {planBadge.label}
                  </Badge>
                  <Badge variant={statusBadge.variant} className={statusBadge.className}>
                    {statusBadge.label}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    Slug: <code className="rounded bg-muted px-1 py-0.5">{workspace.slug}</code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-5 text-muted-foreground hover:text-foreground"
                      onClick={() => copyToClipboard(workspace.slug, 'slug')}
                      title="Copy slug"
                    >
                      {copiedSlug ? (
                        <Check className="size-3 text-emerald-600" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </Button>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    ID:{' '}
                    <code className="rounded bg-muted px-1 py-0.5 text-[10px]">{workspace.id}</code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-5 text-muted-foreground hover:text-foreground"
                      onClick={() => copyToClipboard(workspace.id, 'id')}
                      title="Copy ID"
                    >
                      {copiedId ? (
                        <Check className="size-3 text-emerald-600" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </Button>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-border/50 pt-3 text-xs">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Clock className="size-3.5" /> Múi giờ
            </span>
            <span className="font-medium text-foreground">{workspace.timezone}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Globe className="size-3.5" /> Ngôn ngữ mặc định
            </span>
            <span className="font-medium text-foreground uppercase">
              {workspace.defaultLanguage}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Clock className="size-3.5" /> Ngày tạo
            </span>
            <span className="font-medium text-foreground">
              {formatDateTime(workspace.createdAt)}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Clock className="size-3.5" /> Cập nhật lần cuối
            </span>
            <span className="font-medium text-foreground">
              {formatDateTime(workspace.updatedAt)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Quotas vs Usage Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Agents Quota */}
        <Card className="p-3.5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium flex items-center gap-1.5">
              <Users className="size-3.5 text-blue-500" /> Nhân sự (Agents)
            </span>
            <span className="font-semibold text-foreground">
              {workspace.usage.currentAgents} / {workspace.quotas.maxAgents}
            </span>
          </div>
          <Progress value={agentPercent} className="h-1.5" />
          <span
            className={`text-[11px] ${rawAgentPercent > 100 ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}
          >
            Đã sử dụng {rawAgentPercent}%{rawAgentPercent > 100 ? ' (Vượt hạn mức)' : ''}
          </span>
        </Card>

        {/* Channels Quota */}
        <Card className="p-3.5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium flex items-center gap-1.5">
              <Radio className="size-3.5 text-emerald-500" /> Kênh kết nối
            </span>
            <span className="font-semibold text-foreground">
              {workspace.usage.currentChannels} / {workspace.quotas.maxChannels}
            </span>
          </div>
          <Progress value={channelPercent} className="h-1.5" />
          <span
            className={`text-[11px] ${rawChannelPercent > 100 ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}
          >
            Đã sử dụng {rawChannelPercent}%{rawChannelPercent > 100 ? ' (Vượt hạn mức)' : ''}
          </span>
        </Card>

        {/* Storage Quota */}
        <Card className="p-3.5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium flex items-center gap-1.5">
              <HardDrive className="size-3.5 text-amber-500" /> Lưu trữ MinIO
            </span>
            <span className="font-semibold text-foreground">
              {formatStorage(workspace.usage.storageUsedMb)} /{' '}
              {formatStorage(workspace.quotas.storageLimitMb)}
            </span>
          </div>
          <Progress value={storagePercent} className="h-1.5" />
          <span
            className={`text-[11px] ${rawStoragePercent > 100 ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}
          >
            Đã sử dụng {rawStoragePercent}%{rawStoragePercent > 100 ? ' (Vượt hạn mức)' : ''}
          </span>
        </Card>

        {/* AI Tokens Quota */}
        <Card className="p-3.5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium flex items-center gap-1.5">
              <Cpu className="size-3.5 text-purple-500" /> Token AI / Tháng
            </span>
            <span className="font-semibold text-foreground">
              {formatTokens(workspace.usage.aiUsedTokens)} /{' '}
              {formatTokens(workspace.quotas.aiMonthlyTokens)}
            </span>
          </div>
          <Progress value={tokenPercent} className="h-1.5" />
          <span
            className={`text-[11px] ${rawTokenPercent > 100 ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}
          >
            Đã sử dụng {rawTokenPercent}%{rawTokenPercent > 100 ? ' (Vượt hạn mức)' : ''}
          </span>
        </Card>
      </div>

      {/* Workspace Members Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="size-4 text-primary" />
            <span>Danh sách thành viên ({workspace.members.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs">Thành viên</TableHead>
                <TableHead className="text-xs">Email</TableHead>
                <TableHead className="text-xs">Vai trò</TableHead>
                <TableHead className="text-xs">Ngày tham gia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workspace.members.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6 text-xs text-muted-foreground">
                    Chưa có thành viên nào trong workspace này
                  </TableCell>
                </TableRow>
              ) : (
                workspace.members.map(member => (
                  <TableRow key={member.id} className="text-xs">
                    <TableCell className="font-medium text-foreground">{member.name}</TableCell>
                    <TableCell className="text-muted-foreground">{member.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          member.role === 'OWNER'
                            ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            : member.role === 'ADMIN'
                              ? 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                              : 'border-border text-muted-foreground'
                        }
                      >
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(member.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
