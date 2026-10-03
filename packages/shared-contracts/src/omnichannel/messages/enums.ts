// MessageType = direction of the message (axis 1);
// SenderType = who authored it (axis 2). They are orthogonal, NOT duplicates:
// AI replies are SenderType.SYSTEM + MessageType.OUTGOING.
export const MessageType = {
  INCOMING: 'INCOMING',
  OUTGOING: 'OUTGOING',
  ACTIVITY: 'ACTIVITY',
} as const;

export type MessageType = (typeof MessageType)[keyof typeof MessageType];

export const MessageContentType = {
  TEXT: 'TEXT',
  IMAGE: 'IMAGE',
  VIDEO: 'VIDEO',
  AUDIO: 'AUDIO',
  FILE: 'FILE',
} as const;

export type MessageContentType = (typeof MessageContentType)[keyof typeof MessageContentType];

export const DeliveryStatus = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  READ: 'READ',
  FAILED: 'FAILED',
} as const;

export type DeliveryStatus = (typeof DeliveryStatus)[keyof typeof DeliveryStatus];

export const SenderType = {
  CONTACT: 'CONTACT',
  USER: 'USER',
  SYSTEM: 'SYSTEM',
} as const;

export type SenderType = (typeof SenderType)[keyof typeof SenderType];

export const FileType = {
  IMAGE: 'IMAGE',
  AUDIO: 'AUDIO',
  VIDEO: 'VIDEO',
  FILE: 'FILE',
} as const;

export type FileType = (typeof FileType)[keyof typeof FileType];
