# Implementation Plan - Redesign & Rewrite New Inbox Creation Flow

## 1. Overview & Goals

Redesign and rewrite the **New Inbox Creation Flow** (`/settings/inboxes/new`) completely from scratch:

- **Scope**: Support only **Web Chat**, **Facebook Fanpage Messenger**, and **Telegram**.
- **Removal**: Completely eliminate **Zalo** and **Email** channels and all related legacy code.
- **Architecture**: Modular channel strategy under a clean `apps/web/src/features/settings/inboxes/new/` directory.
- **Workflow**:
  1. **Stage 1 (Channel Select)**: Clean selection grid for Web Chat, Facebook Messenger, and Telegram.
  2. **Stage 2 (Channel Flow)**: Channel-specific experience:
     - **Web Chat**: Name, optional website domain, avatar preview, with instant validation.
     - **Facebook**: 1-click OAuth redirect to Meta -> Session callback -> Fanpage discovery -> Multi-page selection with connected indicators.
     - **Telegram**: Bot Token input with format validation and BotFather instructions.
  3. **Stage 3 (Collaborators)**: Fast team assignment step defaulting to all workspace members, with search, select-all, and member counts.
  4. **Stage 4 (Success Summary)**: Channel-specific completion screen (Web Chat embed code with 1-click copy, Telegram bot link, Facebook connected badges), with direct actions to navigate to inbox detail or return to list.
- **Code Cleanup**: Delete the entire obsolete `apps/web/src/features/settings/inboxes/wizard/` directory and `new-inbox-wizard-view.tsx`.

---

## 2. Directory & Component Architecture

```
apps/web/src/features/settings/inboxes/new/
├── new-inbox-view.tsx                    # Main entry container (replaces new-inbox-wizard-view.tsx)
├── channel-registry.ts                   # Registry of supported channels (metadata, icons, flow configs)
├── types.ts                              # Flow stage types, form payloads, created inbox state
├── context/
│   └── new-inbox-context.tsx             # Context & custom hook (useNewInbox) managing step state & mutations
├── components/
│   ├── channel-card-grid.tsx             # Stage 1: Channel selection cards
│   ├── collaborator-picker-step.tsx      # Stage 3: Member assignment with search & bulk toggles
│   ├── success-summary-step.tsx          # Stage 4: Channel-specific integration guide & action buttons
│   └── channel-flow-layout.tsx           # Common layout shell for Stage 2 channel setup forms
└── channels/
    ├── channel-renderer.tsx              # Dispatches Stage 2 to the active channel's flow component
    ├── web-chat/
    │   ├── web-chat-schema.ts            # Zod validation schema for Web Chat
    │   └── web-chat-flow.tsx             # Web Chat form (name, websiteUrl, avatar)
    ├── facebook/
    │   └── facebook-flow.tsx             # Facebook OAuth connect & page selection
    └── telegram/
        ├── telegram-schema.ts            # Zod validation schema for Telegram bot token
        └── telegram-flow.tsx             # Telegram form (name, botToken, avatar)
```

---

## 3. Implementation Steps

### Step 1: Update Channel Metadata

- In `apps/web/src/features/settings/inboxes/constants/inbox-channels.ts`:
  - Retain only `FACEBOOK_MESSENGER`, `WEB_CHAT`, and `TELEGRAM`.
  - Remove `ZALO` and `EMAIL` entries.

### Step 2: Create Core Types & Channel Registry

- Create `apps/web/src/features/settings/inboxes/new/types.ts`:
  - `NewInboxStage = 'select_channel' | 'channel_flow' | 'collaborators' | 'success'`
  - `DraftChannelConfig` (name, avatarUrl, credentials, providerAccountId, channelType)
  - `CreatedInboxSummary` (id, name, channelType, providerAccountId, count, avatarUrl)
- Create `apps/web/src/features/settings/inboxes/new/channel-registry.ts`:
  - Export channel configs for `web_chat`, `facebook`, `telegram`.

### Step 3: Implement Context & State Machine

- Create `apps/web/src/features/settings/inboxes/new/context/new-inbox-context.tsx`:
  - Wrap with `NewInboxProvider` and `useNewInbox()`.
  - Synced with URL query params (`?channel=...` and `?sessionId=...`).
  - Integrates `useCreateInbox` and `facebookApi.connectPagesBatch`.
  - Manages stage navigation (`goToStage`, `backToChannelSelect`, `submitChannelDraft`, `completeCreation`).
  - Pre-populates workspace members into selected list automatically.

### Step 4: Implement Channel Schemas & Channel Flow Components

- **Web Chat**:
  - `web-chat-schema.ts`: Zod schema validating optional website URL / domain.
  - `web-chat-flow.tsx`: Form using React Hook Form + Zod, name input, website input, avatar preview.
- **Telegram**:
  - `telegram-schema.ts`: Zod schema validating bot token format (`^\d+:[A-Za-z0-9_-]+$`).
  - `telegram-flow.tsx`: Form using React Hook Form + Zod, bot token input, BotFather instructions card.
- **Facebook**:
  - `facebook-flow.tsx`:
    - Case A: No `sessionId` -> Show OAuth "Tiếp tục với Facebook" CTA with safety notice.
    - Case B: With `sessionId` -> Fetch discovered pages via `facebookApi.discoverPages()`, multi-page selection checklist with select-all toggle, connected badges for existing pages.

### Step 5: Implement Stage Components

- `channel-card-grid.tsx`: Grid showing 3 supported channels with crisp icons, descriptions, and click-to-select.
- `collaborator-picker-step.tsx`: Member picker with instant search filter, select all / unselect all, avatar and role display.
- `success-summary-step.tsx`:
  - Web Chat: Snippet card with `<script>` tag and Copy Code button.
  - Telegram: Bot link card with `@username` and "Mở trong Telegram" button.
  - Facebook: Badge list of successfully connected Fanpages.
  - Action buttons: "Đi tới cài đặt Hộp thư" (redirects to `/settings/inboxes/[inboxId]`) and "Về danh sách Hộp thư" (redirects to `/settings/inboxes`).

### Step 6: Assemble View & Wire Route

- Create `new-inbox-view.tsx`:
  - Skinny view rendering `SettingsPageLayout`, breadcrumbs, header with back button, and step indicator.
  - Clean container rendering the current stage.
- Update `apps/web/src/app/(workspace)/[workspaceSlug]/(settings)/settings/inboxes/new/page.tsx`:
  - Point to `NewInboxView` from `@/features/settings/inboxes/new/new-inbox-view`.

### Step 7: Delete Obsolete Legacy Wizard Files

- Remove entire `apps/web/src/features/settings/inboxes/wizard/` directory.
- Remove `apps/web/src/features/settings/inboxes/new-inbox-wizard-view.tsx`.
- Update tests in `apps/web/src/features/settings/inboxes/__tests__/` to test the new schemas and flow.

---

## 4. Verification Plan

### Automated Tests

1. **Unit tests for schemas**:
   - `node -r @swc-node/register --test "apps/web/src/features/settings/inboxes/__tests__/*.spec.ts"`
2. **TypeScript compilation**:
   - `pnpm --filter @sales-copilot/web exec tsc --noEmit`
3. **Next.js Production Build**:
   - `pnpm nx run web:build`

### Manual Flow Verification

- Open `/settings/inboxes/new`.
- Verify only 3 channels appear (Web Chat, Facebook Messenger, Telegram). No Zalo or Email.
- Test Web Chat: fill form -> assign members -> finish screen with embed code.
- Test Telegram: input bot token -> assign members -> finish screen with bot link.
- Test Facebook: verify OAuth flow button and sessionId return handling.
