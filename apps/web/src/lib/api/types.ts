export type {
  // Auth & User
  LoginDto,
  LoginResponseDto,
  AuthTokensDto,
  UserDto,
  UpdateUserProfileDto,

  // Workspaces
  WorkspaceDto,
  UserWorkspaceDto,
  WorkspaceMemberDto,
  CreateWorkspaceDto,
  UpdateWorkspaceDto,
  AddWorkspaceMemberDto,
  UpdateWorkspaceMemberRoleDto,

  // Teams
  TeamDto,
  TeamMemberDto,
  CreateTeamDto,
  UpdateTeamDto,
  AddTeamMembersDto,

  // Conversations
  ConversationResponseDto,
  CreateConversationDto,
  UpdateConversationStatusDto,
  AssignConversationDto,
  UpdateConversationPriorityDto,
  AssignLabelsDto,
  ConversationListQueryDto,
  ConversationSortBy,

  // Messages & Attachments
  MessageResponseDto,
  CreateMessageDto,
  SendMessageDto,
  UpdateDeliveryStatusDto,
  MessageListQueryDto,
  AttachmentDto,
  CreateAttachmentInputDto,

  // Contacts & Channel Identities
  ContactDto,
  ContactResponseDto,
  CreateContactDto,
  UpdateContactDto,
  ContactListQueryDto,
  ContactSearchQueryDto,
  MergeContactsDto,
  ChannelIdentityDto,
  CreateChannelIdentityDto,
  LookupChannelIdentityDto,

  // Labels
  LabelDto,
  CreateLabelDto,
  UpdateLabelDto,
  LabelListQueryDto,

  // Canned Responses
  CannedResponseDto,
  CreateCannedResponseDto,
  UpdateCannedResponseDto,
  CannedResponseListQueryDto,

  // Automation Rules
  AutomationRuleDto,
  CreateAutomationRuleDto,
  UpdateAutomationRuleDto,
  AutomationRuleListQueryDto,
  AutomationCondition,
  AutomationAction,

  // Webhooks
  WebhookSubscriptionDto,
  CreateWebhookSubscriptionDto,
  UpdateWebhookSubscriptionDto,
  WebhookSubscriptionListQueryDto,
  WebhookDeliveryDto,
  WebhookDeliveryDetailDto,
  WebhookDeliveryListQueryDto,

  // Presence
  PresenceEntry,
  PresenceUpdatedEvent,

  // Common
  PaginationMeta,
  ApiSuccessResponse,
  ApiErrorResponse,
} from '@sales-copilot/shared-contracts';

export {
  WorkspaceRole,
  ConversationStatus,
  ConversationPriority,
  Priority,
  MessageType,
  MessageContentType,
  SenderType,
  DeliveryStatus,
  FileType,
  ChannelType,
  PresenceStatus,
  AutomationEventTrigger,
  AutomationAttribute,
  AutomationOperator,
  AutomationActionType,
  WebhookDeliveryStatus,
  WebhookEventType,
} from '@sales-copilot/shared-contracts';

export interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}
