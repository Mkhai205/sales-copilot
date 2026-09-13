'use client';

import * as React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Clock,
  Copy,
  FileCode,
  Globe,
  Layers,
  ShieldCheck,
  Sliders,
  User,
} from 'lucide-react';
import type { PlatformAuditLogDto } from '@sales-copilot/shared-contracts';
import { PlatformAuditAction } from '@sales-copilot/shared-contracts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  formatDateTime,
  getActionBadgeConfig,
  getTargetTypeBadgeConfig,
} from '../utils/audit-log-helpers';
import { useI18n } from '@/lib/i18n';

export interface AuditLogDiffDialogProps {
  log: PlatformAuditLogDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuditLogDiffDialog({ log, open, onOpenChange }: AuditLogDiffDialogProps) {
  const { t } = useI18n();
  const [copiedJson, setCopiedJson] = React.useState(false);

  if (!log) return null;

  const actionBadge = getActionBadgeConfig(log.action);
  const targetBadge = getTargetTypeBadgeConfig(log.targetType);
  const metadata = (log.metadata as Record<string, any>) || {};

  const actionLabel =
    log.action === 'WORKSPACE_SUSPENDED'
      ? t('admin.auditLogs.actionSuspended')
      : log.action === 'WORKSPACE_ACTIVATED'
        ? t('admin.auditLogs.actionActivated')
        : log.action === 'PLAN_CHANGED'
          ? t('admin.auditLogs.actionPlanChanged')
          : log.action === 'QUOTA_UPDATED'
            ? t('admin.auditLogs.actionQuotaUpdated')
            : log.action === 'SYSTEM_SETTING_UPDATED'
              ? t('admin.auditLogs.actionSettingUpdated')
              : actionBadge.label;

  const targetLabel =
    log.targetType === 'WORKSPACE'
      ? t('admin.auditLogs.targetWorkspace')
      : log.targetType === 'SYSTEM_SETTING'
        ? t('admin.auditLogs.targetSetting')
        : log.targetType === 'USER'
          ? t('admin.auditLogs.targetUser')
          : targetBadge.label;

  const handleCopyJson = () => {
    try {
      navigator.clipboard?.writeText(JSON.stringify(log, null, 2));
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    } catch {
      // Ignore clipboard write failures
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-4 overflow-hidden">
        {/* Header */}
        <DialogHeader className="gap-1 border-b border-border pb-3 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant={actionBadge.variant}
              className={`text-xs font-semibold px-2 py-0.5 ${actionBadge.className}`}
            >
              {actionLabel}
            </Badge>
            <Badge
              variant={targetBadge.variant}
              className={`text-[11px] font-medium px-2 py-0.5 ${targetBadge.className}`}
            >
              {targetLabel}: {log.targetId || '-'}
            </Badge>
          </div>
          <DialogTitle className="text-base font-bold text-foreground">
            {t('admin.auditLogs.diffDialogTitle')}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {t('admin.auditLogs.diffDialogRecordId', { id: log.id })}
          </DialogDescription>
        </DialogHeader>

        {/* Metadata summary bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 rounded-lg border border-border bg-muted/40 p-2.5 text-xs shrink-0">
          <div>
            <span className="text-[11px] text-muted-foreground block">
              {t('admin.auditLogs.diffDialogActor')}
            </span>
            <div
              className="flex items-center gap-1 font-medium text-foreground truncate mt-0.5"
              title={log.actorEmail}
            >
              <User className="size-3 text-muted-foreground shrink-0" />
              <span className="truncate">{log.actorEmail}</span>
            </div>
          </div>
          <div>
            <span className="text-[11px] text-muted-foreground block">
              {t('admin.auditLogs.diffDialogTimestamp')}
            </span>
            <div className="flex items-center gap-1 font-medium text-foreground mt-0.5">
              <Clock className="size-3 text-muted-foreground shrink-0" />
              <span>{formatDateTime(log.createdAt)}</span>
            </div>
          </div>
          <div>
            <span className="text-[11px] text-muted-foreground block">
              {t('admin.auditLogs.diffDialogIp')}
            </span>
            <div className="flex items-center gap-1 font-mono text-foreground mt-0.5">
              <Globe className="size-3 text-muted-foreground shrink-0" />
              <span>{log.ipAddress || t('admin.auditLogs.unknown')}</span>
            </div>
          </div>
          <div>
            <span className="text-[11px] text-muted-foreground block">
              {t('admin.auditLogs.diffDialogClient')}
            </span>
            <div
              className="text-muted-foreground truncate mt-0.5 text-[11px]"
              title={log.userAgent || t('admin.auditLogs.unknown')}
            >
              {log.userAgent || t('admin.auditLogs.unknown')}
            </div>
          </div>
        </div>

        {/* Tabs: Visual Diff vs Raw JSON */}
        <Tabs defaultValue="diff" className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between border-b border-border pb-2 shrink-0">
            <TabsList className="h-8">
              <TabsTrigger value="diff" className="text-xs gap-1.5 px-3">
                <Layers className="size-3.5" />
                <span>{t('admin.auditLogs.diffTabVisual')}</span>
              </TabsTrigger>
              <TabsTrigger value="json" className="text-xs gap-1.5 px-3">
                <FileCode className="size-3.5" />
                <span>{t('admin.auditLogs.diffTabRaw')}</span>
              </TabsTrigger>
            </TabsList>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyJson}
              className="h-7 text-xs gap-1.5 px-2.5"
            >
              {copiedJson ? (
                <>
                  <Check className="size-3 text-emerald-600" />
                  <span>{t('admin.auditLogs.copiedJson')}</span>
                </>
              ) : (
                <>
                  <Copy className="size-3" />
                  <span>{t('admin.auditLogs.copyJson')}</span>
                </>
              )}
            </Button>
          </div>

          {/* Visual Diff Content */}
          <TabsContent value="diff" className="flex-1 overflow-y-auto pt-3">
            {renderVisualDiff(log.action, metadata, t)}
          </TabsContent>

          {/* Raw JSON Content */}
          <TabsContent value="json" className="flex-1 overflow-y-auto pt-3">
            <div className="rounded-lg border border-border bg-muted/60 p-3 font-mono text-xs text-foreground overflow-x-auto">
              <pre className="text-xs">{JSON.stringify(log, null, 2)}</pre>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Renders domain-specific visual diff widgets based on audit action.
 */
function renderVisualDiff(
  action: string,
  metadata: Record<string, any>,
  t: (key: any, params?: any) => string,
) {
  switch (action) {
    case PlatformAuditAction.WORKSPACE_SUSPENDED:
      return (
        <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="size-5 shrink-0 mt-0.5 text-destructive" />
            <div className="flex flex-col gap-1">
              <h4 className="font-semibold text-sm">{t('admin.auditLogs.diffSuspendedTitle')}</h4>
              <p className="text-xs text-destructive/90">
                {t('admin.auditLogs.diffSuspendedDesc')}
              </p>
            </div>
          </div>
          <div className="rounded-md border border-destructive/20 bg-background/80 p-3 text-foreground">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
              {t('admin.auditLogs.diffSuspendedReasonLabel')}
            </span>
            <p className="text-xs font-medium text-foreground whitespace-pre-wrap">
              {metadata.reason || t('admin.auditLogs.diffSuspendedNoReason')}
            </p>
          </div>
        </div>
      );

    case PlatformAuditAction.WORKSPACE_ACTIVATED:
      return (
        <div className="flex flex-col gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-800 dark:text-emerald-300">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="size-5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
            <div className="flex flex-col gap-1">
              <h4 className="font-semibold text-sm">{t('admin.auditLogs.diffActivatedTitle')}</h4>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                {t('admin.auditLogs.diffActivatedDesc')}
              </p>
            </div>
          </div>
          {metadata.reason && (
            <div className="rounded-md border border-emerald-500/20 bg-background/80 p-3 text-foreground">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                {t('admin.auditLogs.diffActivatedReasonLabel')}
              </span>
              <p className="text-xs font-medium text-foreground whitespace-pre-wrap">
                {metadata.reason}
              </p>
            </div>
          )}
        </div>
      );

    case PlatformAuditAction.PLAN_CHANGED:
      return (
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
          <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
            {t('admin.auditLogs.diffPlanTitle')}
          </h4>
          <div className="flex items-center justify-center gap-6 py-4">
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-xs text-muted-foreground">
                {t('admin.auditLogs.diffPlanOld')}
              </span>
              <Badge variant="outline" className="text-sm font-semibold px-3 py-1">
                {metadata.oldPlan || 'N/A'}
              </Badge>
            </div>

            <ArrowRight className="size-5 text-muted-foreground" />

            <div className="flex flex-col items-center gap-1.5">
              <span className="text-xs text-muted-foreground">
                {t('admin.auditLogs.diffPlanNew')}
              </span>
              <Badge
                variant="default"
                className="text-sm font-semibold px-3 py-1 bg-primary text-primary-foreground"
              >
                {metadata.newPlan || 'N/A'}
              </Badge>
            </div>
          </div>
        </div>
      );

    case PlatformAuditAction.QUOTA_UPDATED: {
      const oldQuotas = (metadata.oldQuotas as Record<string, any>) || {};
      const newQuotas = (metadata.newQuotas as Record<string, any>) || {};
      const allKeys = Array.from(new Set([...Object.keys(oldQuotas), ...Object.keys(newQuotas)]));

      const quotaLabels: Record<string, string> = {
        maxAgents: t('admin.workspaces.staffAgents'),
        maxChannels: t('admin.workspaces.connectedChannels'),
        storageLimitMb: t('admin.workspaces.storageMinio'),
        aiMonthlyTokens: t('admin.workspaces.aiTokensMonthly'),
      };

      return (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Sliders className="size-4 text-primary" />
            <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
              {t('admin.auditLogs.diffQuotaTitle')}
            </h4>
          </div>

          <div className="rounded-md border border-border overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                <tr>
                  <th className="py-2 px-3">{t('admin.auditLogs.diffQuotaHeaderLimit')}</th>
                  <th className="py-2 px-3 text-center">
                    {t('admin.auditLogs.diffQuotaHeaderBefore')}
                  </th>
                  <th className="py-2 px-3 text-center">
                    {t('admin.auditLogs.diffQuotaHeaderAfter')}
                  </th>
                  <th className="py-2 px-3 text-center">
                    {t('admin.auditLogs.diffQuotaHeaderDiff')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allKeys.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-3 text-center text-muted-foreground">
                      {t('admin.auditLogs.diffQuotaEmpty')}
                    </td>
                  </tr>
                ) : (
                  allKeys.map(key => {
                    const oldVal = oldQuotas[key];
                    const newVal = newQuotas[key];
                    const label = quotaLabels[key] || key;
                    const diff =
                      typeof oldVal === 'number' && typeof newVal === 'number'
                        ? newVal - oldVal
                        : null;

                    return (
                      <tr key={key} className="hover:bg-muted/20">
                        <td className="py-2 px-3 font-medium text-foreground">{label}</td>
                        <td className="py-2 px-3 text-center font-mono text-muted-foreground">
                          {oldVal !== undefined ? oldVal : '-'}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-semibold text-foreground">
                          {newVal !== undefined ? newVal : '-'}
                        </td>
                        <td className="py-2 px-3 text-center font-mono">
                          {diff !== null ? (
                            diff > 0 ? (
                              <span className="text-emerald-600 font-semibold">+{diff}</span>
                            ) : diff < 0 ? (
                              <span className="text-destructive font-semibold">{diff}</span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    case PlatformAuditAction.SYSTEM_SETTING_UPDATED:
      return (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
              {t('admin.auditLogs.diffSettingKey', { key: metadata.key || '-' })}
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Old Value */}
            <div className="flex flex-col gap-1.5 rounded-md border border-border bg-muted/40 p-3">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                {t('admin.auditLogs.diffSettingOld')}
              </span>
              <div className="rounded bg-background p-2 font-mono text-xs overflow-x-auto text-muted-foreground border border-border min-h-[50px]">
                <pre>
                  {metadata.oldValue !== undefined
                    ? JSON.stringify(metadata.oldValue, null, 2)
                    : t('admin.auditLogs.diffSettingNoVal')}
                </pre>
              </div>
            </div>

            {/* New Value */}
            <div className="flex flex-col gap-1.5 rounded-md border border-border bg-muted/40 p-3">
              <span className="text-[11px] font-semibold text-primary uppercase">
                {t('admin.auditLogs.diffSettingNew')}
              </span>
              <div className="rounded bg-background p-2 font-mono text-xs overflow-x-auto text-foreground font-semibold border border-border min-h-[50px]">
                <pre>
                  {metadata.newValue !== undefined
                    ? JSON.stringify(metadata.newValue, null, 2)
                    : t('admin.auditLogs.diffSettingEmpty')}
                </pre>
              </div>
            </div>
          </div>
        </div>
      );

    default:
      return (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
          <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
            {t('admin.auditLogs.diffMetadataTitle')}
          </h4>
          <div className="rounded-md border border-border bg-muted/40 p-3 font-mono text-xs overflow-x-auto">
            <pre>{JSON.stringify(metadata, null, 2)}</pre>
          </div>
        </div>
      );
  }
}
