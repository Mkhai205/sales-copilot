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
} from '@sales-copilot/shared-contracts';
