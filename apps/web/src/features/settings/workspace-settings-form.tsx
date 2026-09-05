'use client';

import * as React from 'react';
import { Building2, Calendar, Check, Copy, Globe, Save, RotateCcw, Sparkles } from 'lucide-react';
import type { WorkspaceDto } from '@sales-copilot/shared-contracts';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
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
import { LANGUAGE_OPTIONS, TIMEZONE_OPTIONS } from './constants/workspace-settings-options';
import { useUpdateWorkspace } from './hooks/use-workspace-mutations';

interface WorkspaceSettingsFormProps {
  workspace: WorkspaceDto;
}

import { useI18n } from '@/lib/i18n';

export function WorkspaceSettingsForm({ workspace }: WorkspaceSettingsFormProps) {
  const { t } = useI18n();
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
      return 'Workspace name is required';
    }
    if (trimmedName.length < 2) {
      return 'Workspace name must be at least 2 characters';
    }
    if (trimmedName.length > 100) {
      return 'Workspace name must not exceed 100 characters';
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">General Settings</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Configure your workspace profile, regional defaults, and view subscription details.
        </p>
      </div>

      {/* Main Workspace Configuration Card */}
      <Card className="border-border bg-card/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Workspace Profile</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Basic information about your organization and dashboard appearance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="gap-5">
            {/* Workspace Name */}
            <Field data-invalid={!!nameError}>
              <FieldLabel htmlFor="workspace-name">Workspace Name</FieldLabel>
              <Input
                id="workspace-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Acme Corporation"
                maxLength={100}
                aria-invalid={!!nameError}
                className="max-w-md text-xs"
              />
              <FieldDescription>
                The display name of your workspace shown to agents and on outbound communications.
              </FieldDescription>
              {nameError && <FieldError errors={[{ message: nameError }]} />}
            </Field>

            {/* Workspace Slug (Readonly) */}
            <Field>
              <FieldLabel htmlFor="workspace-slug">Workspace Slug</FieldLabel>
              <div className="flex max-w-md items-center gap-2">
                <Input
                  id="workspace-slug"
                  value={workspace.slug}
                  disabled
                  readOnly
                  className="text-xs font-mono bg-muted/50 cursor-not-allowed"
                />
              </div>
              <FieldDescription>
                The unique URL identifier for accessing your workspace dashboard (
                <code className="text-xs">/{workspace.slug}</code>).
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Regional & Localization Settings Card */}
      <Card className="border-border bg-card/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Globe className="size-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Regional & Language</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Set default timezone for timestamps, scheduling rules, and UI language preferences.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="gap-5">
            {/* Timezone */}
            <Field>
              <FieldLabel htmlFor="workspace-timezone">Default Timezone</FieldLabel>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger id="workspace-timezone" className="w-full max-w-md text-xs">
                  <SelectValue placeholder="Select timezone" />
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
                Used for scheduling automation rules, business hours, and analytics timestamps.
              </FieldDescription>
            </Field>

            {/* Default Language */}
            <Field>
              <FieldLabel htmlFor="workspace-language">
                {t('settings.workspace.languageLabel')}
              </FieldLabel>
              <Select value={defaultLanguage} onValueChange={setDefaultLanguage}>
                <SelectTrigger id="workspace-language" className="w-full max-w-md text-xs">
                  <SelectValue placeholder="Select language" />
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
              <FieldDescription>{t('settings.workspace.languageHelp')}</FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Workspace Plan & Metadata Overview Card */}
      <Card className="border-border bg-card/30">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-amber-500" />
              <CardTitle className="text-sm font-semibold">
                Subscription & Workspace Details
              </CardTitle>
            </div>
            <Badge variant="outline" className="px-2 py-0.5 text-xs font-semibold uppercase">
              {workspace.billingPlan || 'FREE'}
            </Badge>
          </div>
          <CardDescription className="text-xs">
            System identifiers and metadata associated with this tenant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
            <div className="flex flex-col gap-1 rounded-lg border border-border/50 bg-background/50 p-3">
              <span className="text-[11px] font-medium text-muted-foreground">Workspace ID</span>
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
                  title="Copy Workspace ID"
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
              <span className="text-[11px] font-medium text-muted-foreground">Created On</span>
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
          {t('common.cancel')}
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
              {t('common.saving')}
            </>
          ) : (
            <>
              <Save className="size-3.5" data-icon="inline-start" />
              {t('settings.workspace.saveChanges')}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
