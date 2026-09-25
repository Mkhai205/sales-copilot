'use client';

import * as React from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { ChannelType } from '@sales-copilot/shared-contracts';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { inboxKeys } from '@/lib/query-keys';
import { inboxesApi } from './api/inboxes';
import { SettingsPageLayout } from '../layout/settings-page-layout';
import { useSettingsRbac } from '../rbac/use-settings-rbac';
import { useWorkspaceMembers } from '../members/hooks/use-workspace-members';
import { InboxVerticalStepper } from './wizard/inbox-vertical-stepper';
import { StepChannelGrid } from './wizard/step-channel-grid';
import { StepFacebookOAuth } from './wizard/step-facebook-oauth';
import { StepGenericForm, type GenericFormValues } from './wizard/step-generic-form';
import { StepCollaborators } from './wizard/step-collaborators';
import { StepFinishGuide } from './wizard/step-finish-guide';
import { CHANNEL_CARDS, type CreatedResult, type ChannelCardItem } from './wizard/types';

interface NewInboxWizardViewProps {
  workspaceSlug?: string;
}

export function NewInboxWizardView({ workspaceSlug }: NewInboxWizardViewProps) {
  return (
    <React.Suspense
      fallback={
        <div className="flex h-96 items-center justify-center">
          <Spinner className="size-6 text-primary" />
        </div>
      }
    >
      <NewInboxPageContent initialWorkspaceSlug={workspaceSlug} />
    </React.Suspense>
  );
}

const DEFAULT_GENERIC_FORM: GenericFormValues = {
  genericInboxName: '',
  genericAvatarUrl: '',
  telegramBotToken: '',
  webChatDomain: '',
  zaloOaId: '',
  zaloSecretKey: '',
  emailAddress: '',
};

function NewInboxPageContent({ initialWorkspaceSlug }: { initialWorkspaceSlug?: string }) {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const workspaceSlug = initialWorkspaceSlug || (params?.workspaceSlug as string) || '';
  const { currentWorkspace } = useSettingsRbac(workspaceSlug);
  const workspaceId = currentWorkspace?.id;
  const { data: workspaceMembers } = useWorkspaceMembers(workspaceId);

  const initialChannelParam = searchParams.get('channel');
  const sessionIdParam = searchParams.get('sessionId');

  // Wizard state: current step (1: Channel, 2: Config, 3: Members, 4: Finish)
  const [currentStep, setCurrentStep] = React.useState<1 | 2 | 3 | 4>(() => {
    if (sessionIdParam) return 2;
    if (initialChannelParam) return 2;
    return 1;
  });

  // Selected Channel State
  const [selectedChannelKey, setSelectedChannelKey] = React.useState<string | null>(
    initialChannelParam || null,
  );

  // Generic Form State (for non-Facebook channels)
  const [genericFormValues, setGenericFormValues] =
    React.useState<GenericFormValues>(DEFAULT_GENERIC_FORM);

  // Selected Members State (for Step 3)
  const [selectedMemberUserIds, setSelectedMemberUserIds] = React.useState<string[]>([]);
  const [isSubmittingGeneric, setIsSubmittingGeneric] = React.useState(false);

  // Created Result for Step 4
  const [createdResult, setCreatedResult] = React.useState<CreatedResult | null>(null);

  const selectedChannel = CHANNEL_CARDS.find((c: ChannelCardItem) => c.key === selectedChannelKey);

  // Auto-select all workspace members by default when members load
  React.useEffect(() => {
    if (workspaceMembers && selectedMemberUserIds.length === 0) {
      setSelectedMemberUserIds(workspaceMembers.map(m => m.userId));
    }
  }, [workspaceMembers, selectedMemberUserIds.length]);

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://app.salescopilot.vn';

  // ─── Step Navigation Handlers ────────────────────────────────────────────────

  const handleSelectChannel = (channelKey: string) => {
    setSelectedChannelKey(channelKey);
    setCurrentStep(2);
    router.push(`/${workspaceSlug}/settings/inboxes/new?channel=${channelKey}`);
  };

  const handleCancelToStep1 = () => {
    setSelectedChannelKey(null);
    setCurrentStep(1);
    router.replace(`/${workspaceSlug}/settings/inboxes/new`);
  };

  const handleCreateGenericInbox = async () => {
    if (!workspaceId || !selectedChannel) return;

    setIsSubmittingGeneric(true);
    try {
      let credentials: Record<string, unknown> = {};
      let defaultName = genericFormValues.genericInboxName.trim();
      let providerAccountId: string | undefined;

      switch (selectedChannel.type) {
        case ChannelType.TELEGRAM: {
          credentials = { botToken: genericFormValues.telegramBotToken.trim() };
          if (!defaultName) defaultName = 'Telegram Support Bot';
          break;
        }
        case ChannelType.WEB_CHAT: {
          credentials = { websiteUrl: genericFormValues.webChatDomain.trim() };
          if (!defaultName) defaultName = 'Website Live Chat';
          break;
        }
        case ChannelType.ZALO: {
          credentials = {
            oaId: genericFormValues.zaloOaId.trim(),
            secretKey: genericFormValues.zaloSecretKey.trim(),
          };
          providerAccountId = genericFormValues.zaloOaId.trim();
          if (!defaultName) defaultName = 'Zalo Official Account';
          break;
        }
        case ChannelType.EMAIL: {
          credentials = { emailAddress: genericFormValues.emailAddress.trim() };
          providerAccountId = genericFormValues.emailAddress.trim();
          if (!defaultName) defaultName = `Email (${genericFormValues.emailAddress.trim()})`;
          break;
        }
      }

      const res = await inboxesApi.create(workspaceId, {
        name: defaultName,
        channelType: selectedChannel.type,
        avatarUrl: genericFormValues.genericAvatarUrl.trim() || undefined,
        channelCredentials: credentials,
        providerAccountId,
      });

      const newInbox = res.data;

      // Add selected members concurrently
      if (selectedMemberUserIds.length > 0) {
        await Promise.allSettled(
          selectedMemberUserIds.map(userId =>
            inboxesApi.addMember(workspaceId, newInbox.id, userId),
          ),
        );
      }

      toast.success(`Đã tạo hộp thư ${selectedChannel.title} thành công!`);
      queryClient.invalidateQueries({ queryKey: inboxKeys.list(workspaceId) });

      setCreatedResult({
        id: newInbox.id,
        name: defaultName,
        channelType: selectedChannel.type,
        providerAccountId: newInbox.channel?.providerAccountId,
      });
      setCurrentStep(4);
    } catch (err: any) {
      toast.error(err.message || 'Không thể tạo hộp thư');
    } finally {
      setIsSubmittingGeneric(false);
    }
  };

  return (
    <SettingsPageLayout
      workspaceSlug={workspaceSlug}
      segment="inboxes"
      hideHeader={true}
      skeletonVariant="detail"
      containerWidth="wide"
    >
      <div className="flex flex-col gap-6 w-full">
        {/* Top Back Navigation */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (currentStep === 4) {
                router.push(`/${workspaceSlug}/settings/inboxes`);
              } else if (currentStep === 3) {
                setCurrentStep(2);
              } else if (currentStep === 2) {
                handleCancelToStep1();
              } else {
                router.push(`/${workspaceSlug}/settings/inboxes`);
              }
            }}
            className="w-fit -ml-2 h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            {currentStep === 1
              ? 'Quay lại danh sách Hộp thư'
              : currentStep === 4
                ? 'Về danh sách Hộp thư'
                : 'Quay lại bước trước'}
          </Button>
        </div>

        {/* 2-Column Side-by-Side Grid */}
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] items-start gap-8 lg:gap-12 w-full">
          {/* Left Column: Vertical Stepper Sidebar */}
          <aside className="w-full md:sticky md:top-6">
            <InboxVerticalStepper
              currentStep={currentStep}
              onStepClick={step => {
                if (step === 1) {
                  handleCancelToStep1();
                } else if (step === 2) {
                  setCurrentStep(2);
                } else if (step === 3) {
                  setCurrentStep(3);
                }
              }}
            />
          </aside>

          {/* Right Column: Step Content Area */}
          <div className="w-full min-w-0 flex flex-col gap-6">
            {currentStep > 1 && (
              <div className="flex flex-col gap-1 pb-1">
                <h1 className="text-lg font-semibold tracking-tight text-foreground">
                  {currentStep === 4
                    ? 'Hộp thư đã sẵn sàng!'
                    : selectedChannel
                      ? `Kết nối ${selectedChannel.title}`
                      : 'Cấu hình Hộp thư'}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {currentStep === 4
                    ? 'Kênh liên lạc đã được tạo và liên kết thành công vào không gian làm việc của bạn.'
                    : selectedChannel
                      ? selectedChannel.description
                      : 'Hoàn thiện thông tin cần thiết để khởi tạo hộp thư đến.'}
                </p>
              </div>
            )}

            {/* Step 1: Channel Grid */}
            {currentStep === 1 && <StepChannelGrid onSelectChannel={handleSelectChannel} />}

            {/* Step 2: Facebook OAuth */}
            {currentStep === 2 && selectedChannelKey === 'facebook' && workspaceId && (
              <StepFacebookOAuth
                workspaceId={workspaceId}
                workspaceSlug={workspaceSlug}
                sessionIdParam={sessionIdParam}
                selectedMemberUserIds={selectedMemberUserIds}
                onCancel={handleCancelToStep1}
                onSuccess={result => {
                  setCreatedResult(result);
                  setCurrentStep(4);
                }}
              />
            )}

            {/* Step 2: Generic Channels Form */}
            {currentStep === 2 &&
              selectedChannelKey &&
              selectedChannelKey !== 'facebook' &&
              selectedChannel &&
              workspaceId && (
                <StepGenericForm
                  workspaceId={workspaceId}
                  selectedChannel={selectedChannel}
                  formValues={genericFormValues}
                  onChangeValues={setGenericFormValues}
                  onCancel={handleCancelToStep1}
                  onProceed={() => setCurrentStep(3)}
                />
              )}

            {/* Step 3: Collaborators Selection */}
            {currentStep === 3 && selectedChannel && (
              <StepCollaborators
                selectedChannel={selectedChannel}
                workspaceMembers={workspaceMembers}
                selectedMemberUserIds={selectedMemberUserIds}
                onChangeSelectedMembers={setSelectedMemberUserIds}
                isSubmitting={isSubmittingGeneric}
                onBack={() => setCurrentStep(2)}
                onSubmit={handleCreateGenericInbox}
              />
            )}

            {/* Step 4: Finish & Integration Guide */}
            {currentStep === 4 && createdResult && (
              <StepFinishGuide
                createdResult={createdResult}
                workspaceSlug={workspaceSlug}
                origin={origin}
                onCreateAnother={() => {
                  setCreatedResult(null);
                  handleCancelToStep1();
                }}
              />
            )}
          </div>
        </div>
      </div>
    </SettingsPageLayout>
  );
}
