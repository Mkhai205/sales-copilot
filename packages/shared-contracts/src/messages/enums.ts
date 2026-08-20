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

export enum FileType {
  IMAGE = 'IMAGE',
  AUDIO = 'AUDIO',
  VIDEO = 'VIDEO',
  FILE = 'FILE',
}
