'use client';

import * as React from 'react';
import { ArrowLeft, ArrowRight, Check, Inbox } from 'lucide-react';
import { ChannelType } from '@sales-copilot/shared-contracts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { StepSelectChannel } from './step-select-channel';
import { type ChannelConfigState, StepChannelConfig } from './step-channel-config';
import { StepMembersReview } from './step-members-review';
import { useCreateInbox } from '../hooks/use-inboxes';

interface InboxWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
}

const DEFAULT_CONFIG: ChannelConfigState = {
  name: '',
  greetingMessage: '',
  isAutoAssignmentEnabled: false,
  credentials: {},
  settings: {
    widgetColor: '#2563eb',
  },
};

export function InboxWizardDialog({ open, onOpenChange, workspaceId }: InboxWizardDialogProps) {
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [channelType, setChannelType] = React.useState<ChannelType>(ChannelType.WEB_CHAT);
  const [config, setConfig] = React.useState<ChannelConfigState>(DEFAULT_CONFIG);
  const [selectedMemberIds, setSelectedMemberIds] = React.useState<string[]>([]);
  const [touched, setTouched] = React.useState(false);

  const { mutate: createInbox, isPending } = useCreateInbox(workspaceId);

  // Reset state on open/close
  React.useEffect(() => {
    if (open) {
      setStep(1);
      setChannelType(ChannelType.WEB_CHAT);
      setConfig(DEFAULT_CONFIG);
      setSelectedMemberIds([]);
      setTouched(false);
    }
  }, [open]);

  const handleNext = () => {
    if (step === 1) {
      setStep(2);
      return;
    }

    if (step === 2) {
      setTouched(true);
      if (!config.name.trim()) return;
      setStep(3);
      return;
    }
  };

  const handleBack = () => {
    if (step === 2) setStep(1);
    if (step === 3) setStep(2);
  };

  const handleToggleMember = (userId: string) => {
    setSelectedMemberIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId],
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!config.name.trim() || isPending) return;

    createInbox(
      {
        dto: {
          name: config.name.trim(),
          channelType,
          greetingMessage: config.greetingMessage.trim() || undefined,
          isAutoAssignmentEnabled: config.isAutoAssignmentEnabled,
          settings: config.settings,
          channelCredentials:
            Object.keys(config.credentials).length > 0 ? config.credentials : undefined,
          channelSettings: config.settings,
        },
        memberUserIds: selectedMemberIds,
      },
      {
        onSuccess: () => onOpenChange(false),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 min-h-0 flex-1">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Inbox className="size-4 text-primary" />
              <DialogTitle className="text-sm font-semibold">Create New Inbox</DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Connect a customer communication channel and assign support agents.
            </DialogDescription>

            {/* Wizard Step Indicator */}
            <div className="mt-2 flex items-center justify-between border-y border-border/60 py-2">
              <div className="flex items-center gap-1.5">
                <span
                  className={`flex size-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                    step >= 1
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {step > 1 ? <Check className="size-3" /> : '1'}
                </span>
                <span
                  className={`text-xs ${
                    step === 1 ? 'font-semibold text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  Channel Type
                </span>
              </div>

              <div className="h-px w-6 bg-border" />

              <div className="flex items-center gap-1.5">
                <span
                  className={`flex size-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                    step >= 2
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {step > 2 ? <Check className="size-3" /> : '2'}
                </span>
                <span
                  className={`text-xs ${
                    step === 2 ? 'font-semibold text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  Configuration
                </span>
              </div>

              <div className="h-px w-6 bg-border" />

              <div className="flex items-center gap-1.5">
                <span
                  className={`flex size-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                    step === 3
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  3
                </span>
                <span
                  className={`text-xs ${
                    step === 3 ? 'font-semibold text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  Members & Review
                </span>
              </div>
            </div>
          </DialogHeader>

          {/* Wizard Step Content */}
          <div className="flex-1 overflow-y-auto pr-1">
            {step === 1 && (
              <StepSelectChannel
                selectedType={channelType}
                onSelectType={type => {
                  setChannelType(type);
                  // Update default name based on type
                  if (!config.name || config.name === DEFAULT_CONFIG.name) {
                    if (type === ChannelType.WEB_CHAT)
                      setConfig(prev => ({ ...prev, name: 'Website Live Chat' }));
                    if (type === ChannelType.FACEBOOK_MESSENGER)
                      setConfig(prev => ({ ...prev, name: 'Facebook Messenger' }));
                    if (type === ChannelType.TELEGRAM)
                      setConfig(prev => ({ ...prev, name: 'Telegram Bot' }));
                    if (type === ChannelType.EMAIL)
                      setConfig(prev => ({ ...prev, name: 'Email Support' }));
                    if (type === ChannelType.ZALO)
                      setConfig(prev => ({ ...prev, name: 'Zalo Official Account' }));
                  }
                }}
              />
            )}

            {step === 2 && (
              <StepChannelConfig
                channelType={channelType}
                config={config}
                onChange={setConfig}
                touched={touched}
              />
            )}

            {step === 3 && (
              <StepMembersReview
                workspaceId={workspaceId}
                channelType={channelType}
                config={config}
                selectedMemberIds={selectedMemberIds}
                onToggleMember={handleToggleMember}
              />
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
            {step > 1 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleBack}
                disabled={isPending}
                className="text-xs mr-auto"
              >
                <ArrowLeft className="size-3.5" data-icon="inline-start" />
                Back
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                className="text-xs mr-auto"
              >
                Cancel
              </Button>
            )}

            {step < 3 ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleNext}
                className="text-xs font-medium"
              >
                Next
                <ArrowRight className="size-3.5" data-icon="inline-end" />
              </Button>
            ) : (
              <Button
                type="submit"
                variant="default"
                size="sm"
                disabled={isPending || !config.name.trim()}
                className="text-xs font-medium"
              >
                {isPending ? (
                  <>
                    <Spinner className="size-3.5" data-icon="inline-start" />
                    Creating Inbox...
                  </>
                ) : (
                  <>
                    <Check className="size-3.5" data-icon="inline-start" />
                    Create Inbox
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
