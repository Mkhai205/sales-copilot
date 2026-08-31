import { WebhookDeliveryStatus, WebhookEventType } from '@sales-copilot/shared-contracts';

export interface WebhookEventMeta {
  type: WebhookEventType;
  label: string;
  description: string;
}

export interface WebhookEventCategory {
  id: string;
  name: string;
  description: string;
  events: WebhookEventMeta[];
}

export const WEBHOOK_EVENT_CATEGORIES: WebhookEventCategory[] = [
  {
    id: 'conversations',
    name: 'Conversations',
    description: 'Lifecycle events for conversation threads, status changes, and assignments.',
    events: [
      {
        type: WebhookEventType.CONVERSATION_CREATED,
        label: 'Conversation Created',
        description: 'Triggered when a new conversation thread is initiated.',
      },
      {
        type: WebhookEventType.CONVERSATION_UPDATED,
        label: 'Conversation Updated',
        description: 'Triggered when general conversation properties are modified.',
      },
      {
        type: WebhookEventType.CONVERSATION_STATUS_UPDATED,
        label: 'Status Changed',
        description: 'Triggered on Open, Pending, Resolved, or Snoozed transitions.',
      },
      {
        type: WebhookEventType.CONVERSATION_REOPENED,
        label: 'Conversation Reopened',
        description: 'Triggered when a resolved conversation receives a new customer message.',
      },
      {
        type: WebhookEventType.CONVERSATION_ASSIGNED,
        label: 'Conversation Assigned',
        description: 'Triggered when an agent or team is assigned or re-assigned.',
      },
      {
        type: WebhookEventType.CONVERSATION_PRIORITY_UPDATED,
        label: 'Priority Changed',
        description: 'Triggered when conversation priority changes (Urgent/High/Medium/Low).',
      },
      {
        type: WebhookEventType.CONVERSATION_LABELS_UPDATED,
        label: 'Labels Modified',
        description: 'Triggered when labels are attached or removed from the conversation.',
      },
    ],
  },
  {
    id: 'messages',
    name: 'Messages',
    description: 'Inbound and outbound message events, private notes, and delivery updates.',
    events: [
      {
        type: WebhookEventType.MESSAGE_CREATED,
        label: 'Message Sent / Received',
        description: 'Triggered for every incoming contact message or outgoing agent reply.',
      },
      {
        type: WebhookEventType.MESSAGE_UPDATED,
        label: 'Message Updated',
        description: 'Triggered when a message content or metadata is edited.',
      },
      {
        type: WebhookEventType.MESSAGE_DELETED,
        label: 'Message Deleted',
        description: 'Triggered when a message is deleted.',
      },
      {
        type: WebhookEventType.MESSAGE_DELIVERY_STATUS_UPDATED,
        label: 'Delivery Status Updated',
        description: 'Triggered when delivery state updates (Sent, Delivered, Read, Failed).',
      },
    ],
  },
  {
    id: 'contacts',
    name: 'Contacts',
    description: 'Customer contact profile management and deduplication merge events.',
    events: [
      {
        type: WebhookEventType.CONTACT_CREATED,
        label: 'Contact Created',
        description: 'Triggered when a new customer contact is registered in workspace.',
      },
      {
        type: WebhookEventType.CONTACT_UPDATED,
        label: 'Contact Updated',
        description:
          'Triggered when contact details (name, email, phone, custom attributes) change.',
      },
      {
        type: WebhookEventType.CONTACT_DELETED,
        label: 'Contact Deleted',
        description: 'Triggered when a contact is removed.',
      },
      {
        type: WebhookEventType.CONTACT_MERGED,
        label: 'Contacts Merged',
        description: 'Triggered when two duplicate contacts are consolidated.',
      },
    ],
  },
  {
    id: 'channels',
    name: 'Channels & Identities',
    description: 'Inboxes, channel connections, and customer channel identity links.',
    events: [
      {
        type: WebhookEventType.CHANNEL_CREATED,
        label: 'Channel Created',
        description: 'Triggered when a new inbox or channel integration is connected.',
      },
      {
        type: WebhookEventType.CHANNEL_UPDATED,
        label: 'Channel Updated',
        description: 'Triggered when channel credentials or settings are updated.',
      },
      {
        type: WebhookEventType.CHANNEL_DELETED,
        label: 'Channel Deleted',
        description: 'Triggered when a channel is disconnected.',
      },
      {
        type: WebhookEventType.CHANNEL_IDENTITY_CREATED,
        label: 'Channel Identity Linked',
        description:
          'Triggered when a social identity (e.g. FB PSID, Telegram ID) links to contact.',
      },
      {
        type: WebhookEventType.CHANNEL_IDENTITY_DELETED,
        label: 'Channel Identity Unlinked',
        description: 'Triggered when an identity link is removed.',
      },
    ],
  },
  {
    id: 'labels',
    name: 'Labels',
    description: 'Workspace label taxonomy and tag definitions.',
    events: [
      {
        type: WebhookEventType.LABEL_CREATED,
        label: 'Label Created',
        description: 'Triggered when a new conversation label is created.',
      },
      {
        type: WebhookEventType.LABEL_UPDATED,
        label: 'Label Updated',
        description: 'Triggered when a label title or color is modified.',
      },
      {
        type: WebhookEventType.LABEL_DELETED,
        label: 'Label Deleted',
        description: 'Triggered when a label is deleted from workspace.',
      },
    ],
  },
];

export const ALL_WEBHOOK_EVENT_TYPES: WebhookEventType[] = WEBHOOK_EVENT_CATEGORIES.flatMap(
  category => category.events.map(e => e.type),
);

export interface DeliveryStatusMeta {
  status: WebhookDeliveryStatus;
  label: string;
  badgeStyle: string;
}

export const DELIVERY_STATUS_META: Record<WebhookDeliveryStatus, DeliveryStatusMeta> = {
  [WebhookDeliveryStatus.DELIVERED]: {
    status: WebhookDeliveryStatus.DELIVERED,
    label: 'Delivered',
    badgeStyle: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  },
  [WebhookDeliveryStatus.FAILED]: {
    status: WebhookDeliveryStatus.FAILED,
    label: 'Failed',
    badgeStyle: 'border-rose-500/30 bg-rose-500/10 text-rose-400',
  },
  [WebhookDeliveryStatus.EXHAUSTED]: {
    status: WebhookDeliveryStatus.EXHAUSTED,
    label: 'Exhausted',
    badgeStyle: 'border-red-600/30 bg-red-600/10 text-red-400',
  },
  [WebhookDeliveryStatus.RETRYING]: {
    status: WebhookDeliveryStatus.RETRYING,
    label: 'Retrying',
    badgeStyle: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  },
  [WebhookDeliveryStatus.PENDING]: {
    status: WebhookDeliveryStatus.PENDING,
    label: 'Pending',
    badgeStyle: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
  },
};
