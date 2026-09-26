'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { SettingsPageLayout } from '@/features/settings/layout/settings-page-layout';
import { NewInboxProvider, useNewInbox } from './context/new-inbox-context';
import { ChannelCardGrid } from './components/channel-card-grid';
import { ChannelRenderer } from './channels/channel-renderer';
import { CollaboratorPickerStep } from './components/collaborator-picker-step';
import { SuccessSummaryStep } from './components/success-summary-step';
import { InboxTimelineStepper } from './components/inbox-timeline-stepper';
import type { NewInboxStage } from './types';

interface NewInboxViewProps {
  workspaceSlug?: string;
}

export function NewInboxView({ workspaceSlug }: NewInboxViewProps) {
  return (
    <React.Suspense
      fallback={
        <div className="flex h-96 items-center justify-center">
          <Spinner className="size-6 text-primary" />
        </div>
      }
    >
      <NewInboxProvider initialWorkspaceSlug={workspaceSlug}>
        <NewInboxContainer initialWorkspaceSlug={workspaceSlug} />
      </NewInboxProvider>
    </React.Suspense>
  );
}

function stageToNumber(stage: NewInboxStage): number {
  switch (stage) {
    case 'select_channel':
      return 1;
    case 'channel_flow':
      return 2;
    case 'collaborators':
      return 3;
    case 'success':
      return 4;
  }
}

function NewInboxContainer({ initialWorkspaceSlug }: { initialWorkspaceSlug?: string }) {
  const router = useRouter();
  const {
    workspaceSlug: contextSlug,
    currentStage,
    selectedChannel,
    backToChannelSelect,
    goToStage,
  } = useNewInbox();

  const workspaceSlug = contextSlug || initialWorkspaceSlug || '';
  const currentStepNumber = stageToNumber(currentStage);

  const handleBackNavigation = () => {
    if (currentStage === 'select_channel' || currentStage === 'success') {
      router.push(`/${workspaceSlug}/settings/inboxes`);
    } else if (currentStage === 'channel_flow') {
      backToChannelSelect();
    } else if (currentStage === 'collaborators') {
      goToStage('channel_flow');
    }
  };

  const backButtonLabel =
    currentStage === 'select_channel'
      ? 'Quay lại danh sách Hộp thư'
      : currentStage === 'success'
        ? 'Về danh sách Hộp thư'
        : currentStage === 'channel_flow'
          ? 'Chọn loại kênh khác'
          : 'Quay lại cấu hình kênh';

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
            onClick={handleBackNavigation}
            className="w-fit -ml-2 h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            {backButtonLabel}
          </Button>
        </div>

        {/* 2-Column Side-by-Side Grid */}
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] items-start gap-8 lg:gap-12 w-full">
          {/* Left Column: Vertical Stepper Sidebar */}
          <aside className="w-full md:sticky md:top-6">
            <InboxTimelineStepper
              currentStage={currentStage}
              currentStepNumber={currentStepNumber}
              onStepClick={stage => {
                if (stage === 'select_channel') {
                  backToChannelSelect();
                } else if (stage === 'channel_flow') {
                  goToStage('channel_flow');
                }
              }}
            />
          </aside>

          {/* Right Column: Step Content Area */}
          <div className="w-full min-w-0 flex flex-col gap-6">
            {currentStage !== 'select_channel' && currentStage !== 'success' && selectedChannel && (
              <div className="flex flex-col gap-1 pb-1">
                <h1 className="text-lg font-semibold tracking-tight text-foreground">
                  {currentStage === 'collaborators'
                    ? 'Phân bổ nhân sự tiếp nhận'
                    : `Kết nối ${selectedChannel.title}`}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {currentStage === 'collaborators'
                    ? 'Chỉ định các thành viên có quyền tiếp nhận và phản hồi tin nhắn trong hộp thư này.'
                    : selectedChannel.description}
                </p>
              </div>
            )}

            {currentStage === 'select_channel' && <ChannelCardGrid />}
            {currentStage === 'channel_flow' && <ChannelRenderer />}
            {currentStage === 'collaborators' && <CollaboratorPickerStep />}
            {currentStage === 'success' && <SuccessSummaryStep />}
          </div>
        </div>
      </div>
    </SettingsPageLayout>
  );
}
