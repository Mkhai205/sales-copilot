# 03. Channel Adapters Guide

## 1. Omnichannel Adapter Architecture

All channel integrations implement a unified `ChannelAdapter` interface. The application core interacts with external platforms only through these standardized adapters.

```text
┌─────────────────────────────────────────────────────────────┐
│                    Application Core                         │
└──────────────────────────────┬──────────────────────────────┘
                               │ ChannelAdapter Interface
┌──────────────────────────────▼──────────────────────────────┐
│                    Channel Adapter Layer                    │
├───────────────┬────────────────┬──────────────┬─────────────┤
│ Web Chat      │ Facebook       │ Zalo OA      │ Telegram    │
│ Adapter       │ Messenger      │ Adapter      │ Bot Adapter │
└───────────────┴────────────────┴──────────────┴─────────────┘
```

---

## 2. Standard `ChannelAdapter` Interface

```typescript
export interface SendMessagePayload {
  recipientExternalId: string;
  content?: string;
  contentType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE';
  attachments?: {
    fileUrl: string;
    fileName: string;
    fileType: string;
    fileSize: number;
  }[];
  metadata?: Record<string, unknown>;
}

export interface IngestedMessagePayload {
  externalEventId: string;
  externalContactId: string;
  senderName?: string;
  senderAvatarUrl?: string;
  content?: string;
  contentType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE';
  attachments?: {
    fileUrl: string;
    fileName: string;
    fileType: string;
    fileSize: number;
  }[];
  timestamp: Date;
  rawPayload: Record<string, unknown>;
}

export interface ChannelAdapter {
  readonly channelType: ChannelType;

  // Webhook verification & normalization
  verifyWebhookSignature(headers: Record<string, string>, rawBody: Buffer, channel: Channel): boolean;
  normalizeInboundEvent(payload: Record<string, unknown>, channel: Channel): IngestedMessagePayload[];

  // Outbound delivery
  sendOutboundMessage(channel: Channel, payload: SendMessagePayload): Promise<{ externalMessageId: string }>;

  // Contact profile synchronization
  fetchContactProfile(channel: Channel, externalContactId: string): Promise<{ name?: string; avatarUrl?: string }>;
}
```

---

## 3. Channel Credential Security Policy

### Encryption Standard:
- All sensitive credentials in `Channel.credentials` (Access Tokens, App Secrets, Webhook Verification Secrets, Refresh Tokens) MUST be stored encrypted at rest using **AES-256-GCM**.
- **`ChannelCredentialService`**:
  ```typescript
  export interface ChannelCredentialService {
    encryptCredentials(plainCredentials: Record<string, unknown>): Promise<Record<string, unknown>>;
    decryptCredentials(encryptedCredentials: Record<string, unknown>): Promise<Record<string, unknown>>;
  }
  ```
- **Rules**:
  1. Plaintext tokens must never be logged to stdout or APM.
  2. Credentials must never be returned in client-facing REST API responses (masked as `***`).

---

## 4. Supported Channels & Specifications (Phase 1)

### 1. Web Chat (Primary Reference Adapter)
- **Protocol**: WebSocket / HTTP REST Widget API.
- **Identity Key**: Anonymous Session UUID / Fingerprint (`web_session_<uuid>`).
- **Idempotency**: Client-generated message `externalId`.

### 2. Facebook Messenger (Meta Graph API)
- **Protocol**: Meta Webhook (HMAC-SHA256 signature with `X-Hub-Signature-256`).
- **Identity Key**: Page-Scoped User ID (PSID).
- **Outbound**: Meta Send API (`POST https://graph.facebook.com/v26.0/me/messages`).

### 3. Zalo Official Account (Zalo OpenAPI)
- **Protocol**: Zalo OA Webhook.
- **Identity Key**: Zalo User ID (`user_id_by_app`).
- **Outbound**: Zalo OA Messaging API with Access Token refresh flow.

### 4. Telegram Bot
- **Protocol**: Telegram Bot Webhook API (`POST /bot<token>/setWebhook`).
- **Identity Key**: Telegram `chat_id` / `user.id`.
- **Outbound**: `POST https://api.telegram.org/bot<token>/sendMessage`.
