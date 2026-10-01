'use client';

import * as React from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ChannelType, type WorkspaceMemberDto } from '@sales-copilot/shared-contracts';
import { useSettingsRbac } from '@/features/settings/rbac/use-settings-rbac';
import { useWorkspaceMembers } from '@/features/settings/members/hooks/use-workspace-members';
import {
  useCreateInbox,
  useConnectFacebookBatch,
  useConnectZaloOa,
  useConnectZaloPersonal,
} from '@/features/settings/inboxes/hooks/use-inboxes';
import {
  type ChannelDefinition,
  getChannelDefinition,
  isSupportedChannelKey,
} from '../channel-registry';
import type {
  CreatedInboxSummary,
  DraftChannelConfig,
  NewInboxStage,
  SupportedChannelKey,
} from '../types';
import { getAppUrl } from '@/lib/config/app-url';

interface NewInboxContextValue {
  workspaceId: string;
  workspaceSlug: string;
  origin: string;
  currentStage: NewInboxStage;
  selectedChannelKey: SupportedChannelKey | null;
  selectedChannel: ChannelDefinition | undefined;
  selectedMemberUserIds: string[];
  setSelectedMemberUserIds: React.Dispatch<React.SetStateAction<string[]>>;
  draftConfig: DraftChannelConfig | null;
  pendingFbPageIds: string[];
  setPendingFbPageIds: React.Dispatch<React.SetStateAction<string[]>>;
  createdSummary: CreatedInboxSummary | null;
  workspaceMembers: WorkspaceMemberDto[] | undefined;
  isLoadingMembers: boolean;
  isSubmitting: boolean;
  sessionIdParam: string | null;
  setSessionId: (id: string | null) => void;

  selectChannel: (key: SupportedChannelKey) => void;
  backToChannelSelect: () => void;
  goToStage: (stage: NewInboxStage) => void;
  submitChannelDraft: (config: DraftChannelConfig) => void;
  proceedToCollaboratorsForFacebook: (pageIds: string[]) => void;
  connectFacebookBatch: (pageIds: string[], assignAll?: boolean) => Promise<void>;
  completeCreation: () => Promise<void>;
  resetFlow: () => void;
}

const NewInboxContext = React.createContext<NewInboxContextValue | null>(null);

export function useNewInbox(): NewInboxContextValue {
  const context = React.useContext(NewInboxContext);
  if (!context) {
    throw new Error('useNewInbox must be used within a NewInboxProvider');
  }
  return context;
}

interface NewInboxProviderProps {
  children: React.ReactNode;
  initialWorkspaceSlug?: string;
}

export function NewInboxProvider({ children, initialWorkspaceSlug }: NewInboxProviderProps) {
  const params = useParams();
  const searchParams = useSearchParams();

  const workspaceSlug = initialWorkspaceSlug || (params?.workspaceSlug as string) || '';
  const { currentWorkspace } = useSettingsRbac(workspaceSlug);
  const workspaceId = currentWorkspace?.id || '';
  const { data: workspaceMembers, isLoading: isLoadingMembers } = useWorkspaceMembers(workspaceId);

  const createInboxMutation = useCreateInbox(workspaceId);
  const connectFacebookBatchMutation = useConnectFacebookBatch(workspaceId);
  const connectZaloOaMutation = useConnectZaloOa(workspaceId);
  const connectZaloPersonalMutation = useConnectZaloPersonal(workspaceId);

  const initialChannelParam = searchParams.get('channel');
  const urlSessionId = searchParams.get('sessionId');
  const [sessionIdState, setSessionIdState] = React.useState<string | null>(() => urlSessionId);

  React.useEffect(() => {
    if (urlSessionId) {
      setSessionIdState(urlSessionId);
    }
  }, [urlSessionId]);

  const sessionIdParam = sessionIdState || urlSessionId;

  const resolvedInitialChannel: SupportedChannelKey | null = React.useMemo(() => {
    if (sessionIdParam) return 'facebook';
    if (isSupportedChannelKey(initialChannelParam)) return initialChannelParam;
    return null;
  }, [sessionIdParam, initialChannelParam]);

  const [currentStage, setCurrentStage] = React.useState<NewInboxStage>(() =>
    resolvedInitialChannel ? 'channel_flow' : 'select_channel',
  );

  const [selectedChannelKey, setSelectedChannelKey] = React.useState<SupportedChannelKey | null>(
    resolvedInitialChannel,
  );

  const setSessionId = React.useCallback((id: string | null) => {
    // Caller's channel is already selected; the session id alone identifies the OAuth grant.
    setSessionIdState(id);
  }, []);

  const [selectedMemberUserIds, setSelectedMemberUserIds] = React.useState<string[]>([]);
  const [draftConfig, setDraftConfig] = React.useState<DraftChannelConfig | null>(null);
  const [pendingFbPageIds, setPendingFbPageIds] = React.useState<string[]>([]);
  const [createdSummary, setCreatedSummary] = React.useState<CreatedInboxSummary | null>(null);

  const selectedChannel = React.useMemo(
    () => getChannelDefinition(selectedChannelKey),
    [selectedChannelKey],
  );

  const hasInitializedMembersRef = React.useRef(false);

  // Pre-populate all workspace members automatically when members list loads
  React.useEffect(() => {
    if (workspaceMembers && workspaceMembers.length > 0 && !hasInitializedMembersRef.current) {
      hasInitializedMembersRef.current = true;
      setSelectedMemberUserIds(workspaceMembers.map(m => m.userId));
    }
  }, [workspaceMembers]);

  // Synchronize state on browser Back / Forward buttons (popstate)
  React.useEffect(() => {
    const handlePopState = () => {
      if (typeof window === 'undefined') return;
      const currentUrlParams = new URLSearchParams(window.location.search);
      const channelParam = currentUrlParams.get('channel');
      const sessId = currentUrlParams.get('sessionId');

      if (sessId) {
        setSelectedChannelKey('facebook');
        setCurrentStage('channel_flow');
      } else if (channelParam && isSupportedChannelKey(channelParam)) {
        setSelectedChannelKey(channelParam);
        setDraftConfig(null);
        setPendingFbPageIds([]);
        setCurrentStage('channel_flow');
      } else {
        setSelectedChannelKey(null);
        setDraftConfig(null);
        setPendingFbPageIds([]);
        setCurrentStage('select_channel');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const origin = getAppUrl();

  const selectChannel = React.useCallback(
    (channelKey: SupportedChannelKey) => {
      setSelectedChannelKey(channelKey);
      setPendingFbPageIds([]);
      setDraftConfig(null);
      setCurrentStage('channel_flow');
      if (typeof window !== 'undefined') {
        const targetUrl = `/${workspaceSlug}/settings/inboxes/new?channel=${channelKey}`;
        window.history.pushState(null, '', targetUrl);
      }
    },
    [workspaceSlug],
  );

  const backToChannelSelect = React.useCallback(() => {
    setSelectedChannelKey(null);
    setPendingFbPageIds([]);
    setDraftConfig(null);
    setSessionIdState(null);
    setCurrentStage('select_channel');
    if (typeof window !== 'undefined') {
      const targetUrl = `/${workspaceSlug}/settings/inboxes/new`;
      window.history.pushState(null, '', targetUrl);
    }
  }, [workspaceSlug]);

  const goToStage = React.useCallback(
    (stage: NewInboxStage) => {
      if (stage === 'select_channel') {
        backToChannelSelect();
      } else {
        setCurrentStage(stage);
      }
    },
    [backToChannelSelect],
  );

  const submitChannelDraft = React.useCallback((config: DraftChannelConfig) => {
    setDraftConfig(config);
    setCurrentStage('collaborators');
  }, []);

  const proceedToCollaboratorsForFacebook = React.useCallback((pageIds: string[]) => {
    setPendingFbPageIds(pageIds);
    setCurrentStage('collaborators');
  }, []);

  const connectFacebookBatch = React.useCallback(
    async (pageIds: string[], assignAll?: boolean) => {
      if (!workspaceId || !sessionIdParam || pageIds.length === 0) return;

      const isAllSelected =
        Boolean(workspaceMembers && workspaceMembers.length > 0) &&
        selectedMemberUserIds.length === workspaceMembers?.length;

      try {
        const res = await connectFacebookBatchMutation.mutateAsync({
          pageIds,
          sessionId: sessionIdParam,
          assignAllMembers: assignAll ?? isAllSelected,
          memberUserIds: selectedMemberUserIds,
        });

        const inboxes = res.inboxes || [];
        const count = inboxes.length;
        const firstInbox = inboxes[0];

        setCreatedSummary({
          id: firstInbox?.inboxId || '',
          name:
            count === 1 ? firstInbox?.pageName || 'Facebook Fanpage' : `${count} Fanpage Facebook`,
          channelType: ChannelType.FACEBOOK_MESSENGER,
          providerAccountId: firstInbox?.pageId,
          count,
          connectedItems: inboxes.map(i => ({
            id: i.inboxId,
            name: i.pageName,
            pageId: i.pageId,
          })),
        });
        setCurrentStage('success');
      } catch {
        // Toast notification handled by mutation onError
      }
    },
    [
      workspaceId,
      sessionIdParam,
      selectedMemberUserIds,
      workspaceMembers,
      connectFacebookBatchMutation,
    ],
  );

  const connectZaloPersonal = React.useCallback(
    async (assignAll?: boolean) => {
      if (!workspaceId || !draftConfig) return;

      const sessionId = draftConfig.credentials?.sessionId as string | undefined;
      if (!sessionId) return;

      const isAllSelected =
        Boolean(workspaceMembers && workspaceMembers.length > 0) &&
        selectedMemberUserIds.length === workspaceMembers?.length;

      try {
        const res = await connectZaloPersonalMutation.mutateAsync({
          sessionId,
          memberUserIds: selectedMemberUserIds,
          assignAllMembers: assignAll ?? isAllSelected,
        });

        setCreatedSummary({
          id: res.inboxId,
          name: res.zaloName,
          channelType: ChannelType.ZALO_PERSONAL,
          providerAccountId: res.ownId,
          connectedItems: [{ id: res.inboxId, name: res.zaloName, pageId: res.ownId }],
        });
        setCurrentStage('success');
      } catch {
        // Toast notification handled by mutation onError
      }
    },
    [
      workspaceId,
      draftConfig,
      selectedMemberUserIds,
      workspaceMembers,
      connectZaloPersonalMutation,
    ],
  );

  const connectZaloOa = React.useCallback(
    async (assignAll?: boolean) => {
      if (!workspaceId || !draftConfig) return;

      const sessionId = draftConfig.credentials?.sessionId as string | undefined;
      if (!sessionId) return;
      const oaSecretKey = draftConfig.credentials?.oaSecretKey as string | undefined;

      const isAllSelected =
        Boolean(workspaceMembers && workspaceMembers.length > 0) &&
        selectedMemberUserIds.length === workspaceMembers?.length;

      try {
        const res = await connectZaloOaMutation.mutateAsync({
          sessionId,
          oaSecretKey,
          memberUserIds: selectedMemberUserIds,
          assignAllMembers: assignAll ?? isAllSelected,
        });

        setCreatedSummary({
          id: res.inboxId,
          name: res.oaName,
          channelType: ChannelType.ZALO,
          providerAccountId: res.oaId,
          avatarUrl: draftConfig.avatarUrl,
          connectedItems: [{ id: res.inboxId, name: res.oaName, pageId: res.oaId }],
        });
        setCurrentStage('success');
      } catch {
        // Toast notification handled by mutation onError
      }
    },
    [workspaceId, draftConfig, selectedMemberUserIds, workspaceMembers, connectZaloOaMutation],
  );

  const completeCreation = React.useCallback(async () => {
    if (!workspaceId) return;

    // Flow 1: Facebook batch
    if (selectedChannelKey === 'facebook' && pendingFbPageIds.length > 0) {
      await connectFacebookBatch(pendingFbPageIds);
      return;
    }

    // Flow 2: Zalo OA (OAuth session parked server-side + OA Secret Key)
    if (selectedChannelKey === 'zalo') {
      await connectZaloOa();
      return;
    }

    // Flow 3: Zalo personal (QR session parked server-side)
    if (selectedChannelKey === 'zalo_personal') {
      await connectZaloPersonal();
      return;
    }

    // Flow 4: Web Chat or Telegram
    if (!draftConfig) return;

    try {
      const defaultName =
        draftConfig.channelType === ChannelType.WEB_CHAT
          ? 'Website Live Chat'
          : draftConfig.channelType === ChannelType.TELEGRAM
            ? 'Telegram Support Bot'
            : 'Hộp thư mới';

      const finalName = draftConfig.name || defaultName;

      const newInbox = await createInboxMutation.mutateAsync({
        dto: {
          name: finalName,
          channelType: draftConfig.channelType,
          avatarUrl: draftConfig.avatarUrl?.trim() || undefined,
          channelCredentials: draftConfig.credentials,
          providerAccountId: draftConfig.providerAccountId,
        },
        memberUserIds: selectedMemberUserIds,
      });

      setCreatedSummary({
        id: newInbox.id,
        name: newInbox.name || finalName,
        channelType: draftConfig.channelType,
        providerAccountId: newInbox.channel?.providerAccountId || draftConfig.providerAccountId,
        avatarUrl: newInbox.avatarUrl || draftConfig.avatarUrl,
        connectedItems: [
          {
            id: newInbox.id,
            name: newInbox.name || finalName,
            pageId:
              newInbox.channel?.providerAccountId || draftConfig.providerAccountId || undefined,
          },
        ],
      });
      setCurrentStage('success');
    } catch {
      // Toast notification is handled by createInboxMutation.onError
    }
  }, [
    workspaceId,
    selectedChannelKey,
    pendingFbPageIds,
    draftConfig,
    selectedMemberUserIds,
    connectFacebookBatch,
    connectZaloOa,
    connectZaloPersonal,
    createInboxMutation,
  ]);

  const resetFlow = React.useCallback(() => {
    hasInitializedMembersRef.current = true;
    setSelectedMemberUserIds(workspaceMembers?.map(m => m.userId) ?? []);
    setCreatedSummary(null);
    setPendingFbPageIds([]);
    setDraftConfig(null);
    backToChannelSelect();
  }, [backToChannelSelect, workspaceMembers]);

  const isSubmitting =
    createInboxMutation.isPending ||
    connectFacebookBatchMutation.isPending ||
    connectZaloOaMutation.isPending ||
    connectZaloPersonalMutation.isPending;

  const value: NewInboxContextValue = React.useMemo(
    () => ({
      workspaceId,
      workspaceSlug,
      origin,
      currentStage,
      selectedChannelKey,
      selectedChannel,
      selectedMemberUserIds,
      setSelectedMemberUserIds,
      draftConfig,
      pendingFbPageIds,
      setPendingFbPageIds,
      createdSummary,
      workspaceMembers,
      isLoadingMembers,
      isSubmitting,
      sessionIdParam,
      setSessionId,
      selectChannel,
      backToChannelSelect,
      goToStage,
      submitChannelDraft,
      proceedToCollaboratorsForFacebook,
      connectFacebookBatch,
      completeCreation,
      resetFlow,
    }),
    [
      workspaceId,
      workspaceSlug,
      origin,
      currentStage,
      selectedChannelKey,
      selectedChannel,
      selectedMemberUserIds,
      draftConfig,
      pendingFbPageIds,
      createdSummary,
      workspaceMembers,
      isLoadingMembers,
      isSubmitting,
      sessionIdParam,
      setSessionId,
      selectChannel,
      backToChannelSelect,
      goToStage,
      submitChannelDraft,
      proceedToCollaboratorsForFacebook,
      connectFacebookBatch,
      completeCreation,
      resetFlow,
    ],
  );

  return <NewInboxContext.Provider value={value}>{children}</NewInboxContext.Provider>;
}
