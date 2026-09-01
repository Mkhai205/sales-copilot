# Epic 1.10: Frontend Dashboard (Next.js)

## 1. Overview

Xây dựng giao diện ứng dụng web Next.js 16 (App Router) cho Agent Dashboard: bố cục 3 cột tương tác thời gian thực, tích hợp Socket.io client cho live updates, và bảng điều khiển quản trị thiết lập Workspace.

- **ID**: `EPIC-1.10`
- **Status**: 🟢 Done
- **Dependencies**: `EPIC-1.1` (Auth Contracts), `EPIC-1.5` (Conversation API), `EPIC-1.7` (Realtime Gateway), `EPIC-1.8` (Operations), `EPIC-1.9` (Automation)
- **References**:
  - `docs/references/chatwoot/source/app/javascript/dashboard/`

---

## 2. Features Summary

| Feature | Tên | Complexity | Lý do |
| :--- | :--- | :---: | :--- |
| **F-1.10.1** | App Shell & Authentication | 🟡 **Medium** | Login/logout flow, JWT refresh, workspace switcher, layout, dark mode, TanStack Query setup |
| **F-1.10.2** | 3-Column Conversation View | 🔴 **High** | UI phức tạp nhất: 3 panels, conversation list với filters/tabs, message thread với bubbles/attachments, contact detail panel, nhiều trạng thái UI |
| **F-1.10.3** | Live Chat Composer | 🟡 **Medium** | Canned response picker, file upload với preview, private note toggle, keyboard shortcuts, optimistic updates |
| **F-1.10.4** | Realtime Integration | 🔴 **High** | Socket.io client, nhiều event handlers, optimistic updates + reconciliation, browser notifications, reconnect logic |
| **F-1.10.5** | Workspace Administration | 🔴 **High** | Nhiều CRUD pages (7+ sections), Inbox creation wizard, Automation Rule visual builder, Webhook delivery logs, RBAC-based visibility |

---

## 3. Feature Specifications

---

### 📦 Feature F-1.10.1: App Shell & Authentication — 🟡 Medium

#### Objective

Xây dựng application shell bao gồm layout, navigation sidebar, login/logout flow, JWT token management, và workspace switcher.

#### Scope

- Login page (email/password → JWT tokens)
- Token refresh flow (auto-refresh khi access token sắp hết hạn)
- Protected route guard (redirect to login nếu unauthenticated)
- App layout: left sidebar navigation + main content area
- Sidebar navigation: Conversations, Contacts, Settings
- Workspace switcher (list user's workspaces, switch context)
- User profile dropdown (avatar, name, logout)
- TanStack Query setup cho server state management
- Dark mode / Light mode toggle

#### Acceptance Criteria

- [x] Login thành công → redirect tới Conversation view
- [x] Token expired → auto-refresh transparently
- [x] Unauthenticated access → redirect tới login
- [x] Workspace switcher hiển thị danh sách workspaces của user
- [x] Switch workspace → reload data context
- [x] Logout → clear tokens, redirect tới login
- [x] Responsive layout (desktop-first, minimum support 1280px)

#### Dependencies

- `EPIC-1.1` (Auth API)

---

### 📦 Feature F-1.10.2: 3-Column Conversation View — 🔴 High

#### Objective

Hiện thực giao diện chính của Agent Dashboard theo layout 3 cột để quản lý hội thoại hiệu quả.

#### Scope

- **Column 1 — Conversation List**:
  - Tab filters: Mine (assigned to me), Unassigned, All
  - Status filters: Open, Pending, Resolved, Snoozed
  - Conversation card: contact avatar, name, last message preview, timestamp, unread badge, priority indicator
  - Search conversations
  - Infinite scroll / load more pagination
- **Column 2 — Chat Thread**:
  - Message list (chronological, auto-scroll to bottom)
  - Message bubbles: inbound (left), outbound (right), system messages (center)
  - Private notes (yellow/highlighted)
  - Attachments display (image preview, file download link)
  - Delivery status indicators (sent, delivered, read)
  - Date separators
- **Column 3 — Contact & Conversation Detail Panel**:
  - Contact info (name, email, phone, avatar, custom attributes)
  - Conversation details (status, priority, assignee, team)
  - Conversation actions (change status, assign, set priority)
  - Labels management (add/remove labels)
  - Channel identity list
  - Previous conversations with same contact

#### Acceptance Criteria

- [x] Conversation list loads và hiển thị đúng với filters
- [x] Click conversation → load messages trong column 2
- [x] Messages hiển thị đúng sender type (contact/agent/system)
- [x] Unread badge hiển thị đúng count
- [x] Contact panel hiển thị đầy đủ thông tin
- [x] Conversation actions (status change, assignment) hoạt động
- [x] Empty states cho: no conversations, no messages, unassigned
- [x] Loading states cho tất cả data fetching

#### Dependencies

- `EPIC-1.5` (Conversation & Message APIs)
- `EPIC-1.2` (Contact API)
- `F-1.10.1` (App Shell)

---

### 📦 Feature F-1.10.3: Live Chat Composer — 🟡 Medium

#### Objective

Xây dựng chat composer đầy đủ tính năng: soạn tin nhắn, chèn canned responses, upload file, và toggle private notes.

#### Scope

- Message input area (auto-resize textarea)
- Send message (Enter or click button)
- Canned response picker: gõ `/` trigger search popup, chọn response insert vào input
- File attachment upload: drag-and-drop hoặc click button
  - Image preview trước khi gửi
  - Progress indicator khi uploading
- Private note toggle: switch giữa Reply (outbound) và Note (private)
- Emoji picker (optional, nice-to-have)
- Keyboard shortcuts: `Cmd/Ctrl + Enter` send, `Cmd/Ctrl + Shift + Enter` toggle note

#### Acceptance Criteria

- [x] Gõ `/` trigger canned response search popup
- [x] Chọn canned response → insert content vào input
- [x] File upload → preview (image) + progress bar
- [x] Toggle private note → visual indicator (yellow background)
- [x] Send message → message appears in thread immediately (optimistic update)
- [x] Empty message (no text, no attachment) → disable send button
- [x] Keyboard shortcuts hoạt động

#### Dependencies

- `F-1.10.2` (3-Column View — embedded in column 2)
- `F-1.8.3` (Canned Responses API)
- `F-1.5.5` (Attachment API)

---

### 📦 Feature F-1.10.4: Realtime Integration — 🔴 High

#### Objective

Tích hợp Socket.io client vào dashboard để nhận live updates: tin nhắn mới, status changes, assignment changes, và online presence.

#### Scope

- Socket.io client connection (JWT auth, auto-reconnect)
- Event handlers:
  - `message.created` → prepend/append message in conversation thread
  - `conversation.created` → add to conversation list
  - `conversation.status_updated` → update conversation card status
  - `conversation.assigned` → update assignment, move to/from "Mine" tab
  - `presence.updated` → update online/offline indicators
- Optimistic updates: gửi message hiển thị ngay, reconcile khi nhận server confirmation
- Notification: browser notification / sound cho tin nhắn mới khi tab không active
- Typing indicators (nice-to-have)

#### Acceptance Criteria

- [x] New message from contact → appears realtime in conversation thread
- [x] Conversation status change by another agent → reflected immediately
- [x] Assignment change → conversation moves between tabs
- [x] Agent online/offline → indicator updated in real-time
- [x] Reconnect after network interruption → resume receiving events
- [x] Browser notification cho tin nhắn mới khi tab inactive

#### Dependencies

- `EPIC-1.7` (Realtime Engine — WebSocket Gateway)
- `F-1.10.2` (3-Column View)

---

### 📦 Feature F-1.10.5: Workspace Administration — 🔴 High

#### Objective

Cung cấp giao diện quản trị Workspace: cài đặt chung, quản lý Inboxes/Channels, Teams, Members, Labels, Canned Responses, Automation Rules, và Webhook Subscriptions.

#### Scope

- Settings layout: sidebar navigation cho các section
- **Workspace Settings**: name, slug, logo
- **Inboxes & Channels**: list, create (wizard), edit, delete. Channel credentials form per type.
- **Teams**: list, create, edit members, delete
- **Members & Roles**: list, invite, change role, remove
- **Labels**: list, create (color picker), edit, delete
- **Canned Responses**: list, create, edit, delete
- **Automation Rules**: list, create (visual builder cho conditions/actions), edit, toggle active, delete
- **Webhook Subscriptions**: list, create (URL, events picker), edit, delete. Delivery logs view.

#### Acceptance Criteria

- [x] ADMIN và OWNER có access đầy đủ vào Settings
- [x] AGENT chỉ xem được limited settings (tùy RBAC policy)
- [x] VIEWER bị redirect khỏi Settings
- [x] Inbox creation wizard: chọn channel type → nhập credentials → review → create
- [x] Automation Rule builder: chọn trigger → thêm conditions → thêm actions → save
- [x] Webhook delivery logs hiển thị status, attempts, response code
- [x] Form validation errors hiển thị rõ ràng
- [x] Confirmation dialog cho destructive actions (delete)

#### Dependencies

- `F-1.10.1` (App Shell)
- Tất cả backend APIs từ Epic 1.1–1.9
