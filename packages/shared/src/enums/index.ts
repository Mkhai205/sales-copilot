export enum PlatformRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  USER = 'USER',
}

export enum WorkspaceRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  AGENT = 'AGENT',
  VIEWER = 'VIEWER',
}

// UserRole union type for backward compatibility
export type UserRole = PlatformRole | WorkspaceRole;
export const UserRole = { ...PlatformRole, ...WorkspaceRole };

export enum BillingPlanType {
  FREE = 'FREE',
  STANDARD = 'STANDARD',
  ENTERPRISE = 'ENTERPRISE',
}

export enum ChannelType {
  FACEBOOK_MESSENGER = 'FACEBOOK_MESSENGER',
  ZALO = 'ZALO',
  TELEGRAM = 'TELEGRAM',
  EMAIL = 'EMAIL',
  WEB_CHAT = 'WEB_CHAT',
}

export enum ConversationStatus {
  OPEN = 'OPEN',
  RESOLVED = 'RESOLVED',
  PENDING = 'PENDING',
  SNOOZED = 'SNOOZED',
}

export enum Priority {
  URGENT = 'URGENT',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export type ConversationPriority = Priority;
export const ConversationPriority = Priority;

export enum MessageType {
  INCOMING = 'INCOMING',
  OUTGOING = 'OUTGOING',
  ACTIVITY = 'ACTIVITY',
  TEMPLATE = 'TEMPLATE',
}

export enum MessageContentType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  FILE = 'FILE',
}

export enum DeliveryStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
}

export enum SenderType {
  CONTACT = 'CONTACT',
  USER = 'USER',
  SYSTEM = 'SYSTEM',
}

export enum WebhookDeliveryStatus {
  PENDING = 'PENDING',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
  EXHAUSTED = 'EXHAUSTED',
}

export enum FileType {
  IMAGE = 'IMAGE',
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  FILE = 'FILE',
}
