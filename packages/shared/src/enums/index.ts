export enum LeadStatus {
  NEW = 'NEW',
  ENGAGED = 'ENGAGED',
  QUALIFIED = 'QUALIFIED',
  HOT = 'HOT',
  CONVERTED = 'CONVERTED',
  LOST = 'LOST',
  DISQUALIFIED = 'DISQUALIFIED',
}

export enum ConversationStatus {
  OPEN = 'OPEN',
  RESOLVED = 'RESOLVED',
  PENDING = 'PENDING',
  SNOOZED = 'SNOOZED',
}

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

export enum SenderType {
  CONTACT = 'CONTACT',
  USER = 'USER',
  AI_AGENT = 'AI_AGENT',
  SYSTEM = 'SYSTEM',
}

export enum ChannelType {
  FACEBOOK_MESSENGER = 'FACEBOOK_MESSENGER',
  ZALO = 'ZALO',
  TELEGRAM = 'TELEGRAM',
  EMAIL = 'EMAIL',
  WEB_CHAT = 'WEB_CHAT',
}

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  AGENT = 'AGENT',
  VIEWER = 'VIEWER',
}

export enum AutonomyLevel {
  OFF = 'OFF',
  ASSISTED = 'ASSISTED',
  AUTONOMOUS = 'AUTONOMOUS',
}

export enum Priority {
  URGENT = 'URGENT',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}
