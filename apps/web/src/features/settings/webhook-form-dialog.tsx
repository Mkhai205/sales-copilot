'use client';

import * as React from 'react';
import {
  Webhook,
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  Check,
  Search,
  CheckCircle2,
  X,
} from 'lucide-react';
import {
  WebhookEventType,
  type CreateWebhookSubscriptionDto,
  type UpdateWebhookSubscriptionDto,
  type WebhookSubscriptionDto,
} from '@sales-copilot/shared-contracts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { WEBHOOK_EVENT_CATEGORIES, ALL_WEBHOOK_EVENT_TYPES } from './constants/webhook-options';
import { useCreateWebhookSubscription, useUpdateWebhookSubscription } from './hooks/use-webhooks';
import { toast } from 'sonner';

interface WebhookFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  subscriptionToEdit?: WebhookSubscriptionDto | null;
}

export function WebhookFormDialog({
  open,
  onOpenChange,
  workspaceId,
  subscriptionToEdit,
}: WebhookFormDialogProps) {
  const isEditing = !!subscriptionToEdit;

  const [url, setUrl] = React.useState('');
  const [secretKey, setSecretKey] = React.useState('');
  const [showSecret, setShowSecret] = React.useState(false);
  const [isActive, setIsActive] = React.useState(true);
  const [selectedEvents, setSelectedEvents] = React.useState<WebhookEventType[]>([]);
  const [eventSearch, setEventSearch] = React.useState('');
  const [touched, setTouched] = React.useState(false);

  const { mutate: createSubscription, isPending: isCreating } =
    useCreateWebhookSubscription(workspaceId);
  const { mutate: updateSubscription, isPending: isUpdating } =
    useUpdateWebhookSubscription(workspaceId);

  const isPending = isCreating || isUpdating;

  // Initialize or reset form state
  React.useEffect(() => {
    if (open) {
      if (subscriptionToEdit) {
        setUrl(subscriptionToEdit.url);
        setSecretKey(subscriptionToEdit.secretKey || '');
        setIsActive(subscriptionToEdit.isActive ?? true);
        const currentSubs = (subscriptionToEdit.subscriptions || []) as WebhookEventType[];
        setSelectedEvents(currentSubs);
      } else {
        setUrl('');
        setSecretKey('');
        setIsActive(true);
        // Default: subscribe to major conversation & message events
        setSelectedEvents([
          WebhookEventType.CONVERSATION_CREATED,
          WebhookEventType.MESSAGE_CREATED,
          WebhookEventType.CONVERSATION_STATUS_UPDATED,
        ]);
      }
      setEventSearch('');
      setShowSecret(false);
      setTouched(false);
    }
  }, [open, subscriptionToEdit]);

  // Generate random 32-character hex secret
  const handleGenerateSecret = () => {
    const arr = new Uint8Array(16);
    window.crypto.getRandomValues(arr);
    const hex = Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
    setSecretKey(hex);
    setShowSecret(true);
    toast.success('Random HMAC secret key generated');
  };

  // URL Validation
  const trimmedUrl = url.trim();
  const urlError = React.useMemo(() => {
    if (!touched) return null;
    if (!trimmedUrl) return 'Webhook URL is required';
    if (!trimmedUrl.startsWith('https://')) return 'Webhook URL must use HTTPS protocol (https://)';
    try {
      new URL(trimmedUrl);
    } catch {
      return 'Invalid URL format';
    }
    return null;
  }, [touched, trimmedUrl]);

  // Secret Validation
  const trimmedSecret = secretKey.trim();
  const secretError = React.useMemo(() => {
    if (!touched) return null;
    if (trimmedSecret && trimmedSecret.length < 8) {
      return 'Secret key must be at least 8 characters';
    }
    return null;
  }, [touched, trimmedSecret]);

  // Events Validation
  const eventsError = React.useMemo(() => {
    if (!touched) return null;
    if (selectedEvents.length === 0) {
      return 'Please select at least one event type to subscribe to';
    }
    return null;
  }, [touched, selectedEvents]);

  const isValid =
    !urlError && !secretError && !eventsError && trimmedUrl && selectedEvents.length > 0;

  // Toggle single event
  const handleToggleEvent = (type: WebhookEventType) => {
    setSelectedEvents(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type],
    );
  };

  // Toggle category
  const handleToggleCategory = (categoryEventTypes: WebhookEventType[]) => {
    const allSelected = categoryEventTypes.every(t => selectedEvents.includes(t));
    if (allSelected) {
      // Deselect all in category
      setSelectedEvents(prev => prev.filter(t => !categoryEventTypes.includes(t)));
    } else {
      // Select all in category
      setSelectedEvents(prev => Array.from(new Set([...prev, ...categoryEventTypes])));
    }
  };

  // Select all / Deselect all global
  const handleSelectAll = () => {
    if (selectedEvents.length === ALL_WEBHOOK_EVENT_TYPES.length) {
      setSelectedEvents([]);
    } else {
      setSelectedEvents([...ALL_WEBHOOK_EVENT_TYPES]);
    }
  };

  const filteredCategories = React.useMemo(() => {
    if (!eventSearch.trim()) return WEBHOOK_EVENT_CATEGORIES;
    const q = eventSearch.trim().toLowerCase();

    return WEBHOOK_EVENT_CATEGORIES.map(cat => {
      const matchingEvents = cat.events.filter(
        e =>
          e.type.toLowerCase().includes(q) ||
          e.label.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q),
      );
      return {
        ...cat,
        events: matchingEvents,
      };
    }).filter(cat => cat.events.length > 0);
  }, [eventSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);

    if (!isValid) return;

    if (isEditing && subscriptionToEdit) {
      const updateDto: UpdateWebhookSubscriptionDto = {
        url: trimmedUrl,
        subscriptions: selectedEvents,
        isActive,
        ...(trimmedSecret ? { secretKey: trimmedSecret } : {}),
      };

      updateSubscription(
        { subscriptionId: subscriptionToEdit.id, dto: updateDto },
        {
          onSuccess: () => onOpenChange(false),
        },
      );
    } else {
      const createDto: CreateWebhookSubscriptionDto = {
        url: trimmedUrl,
        subscriptions: selectedEvents,
        isActive,
        ...(trimmedSecret ? { secretKey: trimmedSecret } : {}),
      };

      createSubscription(createDto, {
        onSuccess: () => onOpenChange(false),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl p-0">
        <form onSubmit={handleSubmit} className="flex max-h-[90vh] flex-col">
          {/* Header */}
          <DialogHeader className="border-b border-border px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Webhook className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-semibold text-foreground">
                    {isEditing ? 'Edit Webhook Subscription' : 'Create Webhook Subscription'}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Configure your HTTPS webhook endpoint to receive real-time JSON event payloads.
                  </DialogDescription>
                </div>
              </div>

              <div className="flex items-center gap-2 pr-6">
                <span className="text-xs font-medium text-muted-foreground">Active</span>
                <Switch checked={isActive} onCheckedChange={setIsActive} disabled={isPending} />
              </div>
            </div>
          </DialogHeader>

          {/* Form Content */}
          <ScrollArea className="flex-1 overflow-y-auto px-6 py-4">
            <div className="flex flex-col gap-6">
              {/* Endpoint Config Card */}
              <FieldGroup className="rounded-xl border border-border/80 bg-card/40 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Endpoint Configuration
                </div>

                <div className="mt-3 flex flex-col gap-4">
                  {/* Webhook URL */}
                  <Field data-invalid={!!urlError}>
                    <FieldLabel className="text-xs">
                      Payload URL (HTTPS) <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                      type="url"
                      value={url}
                      onChange={e => setUrl(e.target.value)}
                      placeholder="https://api.yourdomain.com/webhooks/sales-copilot"
                      className="mt-1 h-8 font-mono text-xs"
                      aria-invalid={!!urlError}
                    />
                    <FieldDescription className="text-[11px] text-muted-foreground">
                      Target server endpoint that will receive HTTP POST requests with JSON
                      payloads.
                    </FieldDescription>
                    {urlError && <FieldError className="text-xs">{urlError}</FieldError>}
                  </Field>

                  {/* Secret Key for HMAC */}
                  <Field data-invalid={!!secretError}>
                    <div className="flex items-center justify-between">
                      <FieldLabel className="text-xs">HMAC Secret Key (Optional)</FieldLabel>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleGenerateSecret}
                        className="h-6 gap-1 px-2 text-[11px] text-primary hover:text-primary"
                      >
                        <Sparkles className="size-3" />
                        Generate Secret
                      </Button>
                    </div>

                    <div className="relative mt-1">
                      <Input
                        type={showSecret ? 'text' : 'password'}
                        value={secretKey}
                        onChange={e => setSecretKey(e.target.value)}
                        placeholder="Enter secret or click generate (min. 8 chars)..."
                        className="h-8 pr-8 font-mono text-xs"
                        aria-invalid={!!secretError}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowSecret(!showSecret)}
                        className="absolute right-1 top-1/2 size-6 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showSecret ? (
                          <EyeOff className="size-3.5" />
                        ) : (
                          <Eye className="size-3.5" />
                        )}
                      </Button>
                    </div>
                    <FieldDescription className="text-[11px] text-muted-foreground">
                      Used to compute SHA-256 HMAC signature passed in `X-SalesCopilot-Signature`
                      header.
                    </FieldDescription>
                    {secretError && <FieldError className="text-xs">{secretError}</FieldError>}
                  </Field>
                </div>
              </FieldGroup>

              {/* Event Subscriptions Checklist Card */}
              <div className="rounded-xl border border-border/80 bg-card/40 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                      Event Subscriptions ({selectedEvents.length} selected)
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      Choose which events will trigger delivery to this endpoint.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Quick Search */}
                    <div className="relative w-44">
                      <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={eventSearch}
                        onChange={e => setEventSearch(e.target.value)}
                        placeholder="Filter events..."
                        className="h-7 pl-7 pr-6 text-[11px] bg-background/50"
                      />
                      {eventSearch && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEventSearch('')}
                          className="absolute right-1 top-1/2 size-5 -translate-y-1/2 p-0 text-muted-foreground"
                        >
                          <X className="size-2.5" />
                        </Button>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAll}
                      className="h-7 text-[11px]"
                    >
                      {selectedEvents.length === ALL_WEBHOOK_EVENT_TYPES.length
                        ? 'Deselect All'
                        : 'Select All'}
                    </Button>
                  </div>
                </div>

                {eventsError && (
                  <p className="mt-2 text-xs font-medium text-destructive">{eventsError}</p>
                )}

                {/* Categories Grid */}
                <div className="mt-4 flex flex-col gap-4">
                  {filteredCategories.map(category => {
                    const categoryTypes = category.events.map(e => e.type);
                    const selectedCount = categoryTypes.filter(t =>
                      selectedEvents.includes(t),
                    ).length;
                    const allCategorySelected =
                      categoryTypes.length > 0 && selectedCount === categoryTypes.length;

                    return (
                      <div
                        key={category.id}
                        className="rounded-lg border border-border/70 bg-card/60 p-3"
                      >
                        <div className="flex items-center justify-between border-b border-border/60 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-foreground">
                              {category.name}
                            </span>
                            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                              {selectedCount} / {category.events.length}
                            </Badge>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleCategory(categoryTypes)}
                            className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                          >
                            {allCategorySelected ? 'Deselect category' : 'Select category'}
                          </Button>
                        </div>

                        <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {category.events.map(event => {
                            const isChecked = selectedEvents.includes(event.type);

                            return (
                              <button
                                key={event.type}
                                type="button"
                                onClick={() => handleToggleEvent(event.type)}
                                className={`flex items-start gap-2.5 rounded-md border p-2.5 text-left transition-all ${
                                  isChecked
                                    ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20'
                                    : 'border-border/60 bg-card/40 hover:border-border'
                                }`}
                              >
                                <div
                                  className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
                                    isChecked
                                      ? 'border-primary bg-primary text-primary-foreground'
                                      : 'border-muted-foreground/40 bg-background'
                                  }`}
                                >
                                  {isChecked && <Check className="size-2.5 stroke-[3]" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-foreground leading-tight">
                                    {event.label}
                                  </p>
                                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground truncate">
                                    {event.type}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </ScrollArea>

          {/* Footer */}
          <DialogFooter className="border-t border-border px-6 py-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending} className="text-xs gap-1.5">
              {isPending && <Spinner className="size-3.5" data-icon="inline-start" />}
              {isEditing ? 'Save Changes' : 'Create Webhook'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
