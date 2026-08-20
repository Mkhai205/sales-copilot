export enum WsServerEvent {
  CONVERSATION_CREATED = 'conversation.created',
  CONVERSATION_UPDATED = 'conversation.updated',
  CONVERSATION_STATUS_CHANGED = 'conversation.status_changed',
  CONVERSATION_ASSIGNED = 'conversation.assigned',
  MESSAGE_CREATED = 'message.created',
  MESSAGE_UPDATED = 'message.updated',
  PRESENCE_UPDATE = 'presence.update',
  TYPING_START = 'typing.start',
  TYPING_STOP = 'typing.stop',
}

export enum WsClientEvent {
  JOIN_WORKSPACE = 'join_workspace',
  LEAVE_WORKSPACE = 'leave_workspace',
  JOIN_CONVERSATION = 'join_conversation',
  LEAVE_CONVERSATION = 'leave_conversation',
  START_TYPING = 'start_typing',
  STOP_TYPING = 'stop_typing',
}

export interface WsEventPayload<T = unknown> {
  event: WsServerEvent;
  workspaceId: string;
  timestamp: string;
  data: T;
}
