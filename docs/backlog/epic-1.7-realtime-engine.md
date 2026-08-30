# Epic 1.7: Realtime Engine & Presence

## 1. Overview

Hiện thực hệ thống phát tán sự kiện thời gian thực: typed domain event bus qua `EventEmitter2`, NestJS WebSocket Gateway (Socket.io) với Redis Pub/Sub Adapter cho multi-server clustering, phân vùng room theo `workspace_{id}` và `conversation_{id}`, bộ theo dõi trạng thái Online/Offline của Agent (Redis Presence Tracking), và Realtime Event Dispatcher kết nối domain events với WebSocket broadcasts.

- **ID**: `EPIC-1.7`
- **Status**: ✅ Done
- **Dependencies**: `EPIC-1.5` (Conversation & Messaging Core), `EPIC-1.1` (Identity & Auth)
- **References**:
  - `docs/references/chatwoot/source/app/dispatchers/`
  - `docs/references/chatwoot/source/app/listeners/`
  - `docs/api/websocket-contract.md`

---

## 2. Features Summary

| Feature | Tên | Complexity | Lý do |
| :--- | :--- | :---: | :--- |
| **F-1.7.1** | Domain Event Bus & Typed Events | 🟢 **Low** | Type definitions, EventEmitter2 config, không có runtime logic phức tạp |
| **F-1.7.2** | WebSocket Gateway & Room Architecture | 🔴 **High** | JWT auth handshake, room join/leave management, connection lifecycle, tenant-scoped rooms, authorization checks |
| **F-1.7.3** | Redis Pub/Sub Adapter | 🟢 **Low** | Configuration-based, socket.io redis adapter plugin |
| **F-1.7.4** | Agent Online Presence Tracking | 🟡 **Medium** | Redis presence store, heartbeat mechanism, idle detection, TTL cleanup, broadcast |
| **F-1.7.5** | Realtime Event Dispatcher | 🟡 **Medium** | Nhiều event listeners, routing logic room-based, payload transformation, error isolation |

---

## 3. Feature Specifications

---

### 📦 Feature F-1.7.1: Domain Event Bus & Typed Events — 🟢 Low

#### Objective

Định nghĩa typed event definitions cho tất cả domain events trong hệ thống, chuẩn hóa event payload types, và thiết lập pattern cho event listener registration.

#### Scope

- Typed event enums/constants:
  - `message.created`, `message.updated`
  - `conversation.created`, `conversation.status_updated`, `conversation.assigned`
  - `contact.created`, `contact.updated`, `contact.deleted`, `contact.merged`
  - `presence.updated`
- Typed event payload interfaces cho mỗi event
- `EventEmitter2` configuration (async mode, wildcard support)
- Event listener registration pattern với `@OnEvent()` decorator

#### Acceptance Criteria

- [x] Tất cả domain events có typed payload interfaces
- [x] Events phát tán asynchronously (non-blocking)
- [x] Event types export từ shared contracts package cho frontend consumption
- [x] Wildcard support cho debug/logging listeners (`*.created`, etc.)

#### Dependencies

- `EPIC-1.0` (Foundation — shared contracts)

---

### 📦 Feature F-1.7.2: WebSocket Gateway & Room Architecture — 🔴 High

#### Objective

Xây dựng NestJS Socket.io Gateway tại `/realtime` với JWT authentication handshake và room-based broadcasting architecture.

#### Scope

- Socket.io Gateway endpoint: `/realtime`
- JWT authentication trong handshake (`auth: { token }`)
- Room architecture:
  - `workspace_{workspaceId}` — broadcast workspace-wide events
  - `conversation_{conversationId}` — broadcast conversation-specific events
  - `user_{userId}` — direct notifications (assignment, mentions)
- Room join/leave management:
  - Auto-join `workspace_{id}` on connect (based on JWT workspace membership)
  - Join `conversation_{id}` khi Agent mở conversation
  - Leave `conversation_{id}` khi Agent đóng conversation
- Connection lifecycle: connect, disconnect, reconnect handling

#### Acceptance Criteria

- [x] WebSocket connection yêu cầu valid JWT token
- [x] Invalid/expired token → connection rejected
- [x] User tự động join đúng workspace rooms based on membership
- [x] Join conversation room chỉ cho phép nếu user là member của workspace chứa conversation
- [x] Disconnect cleanup: remove từ tất cả rooms, update presence
- [x] NFR-1: Latency phát tán event < 200ms

#### Dependencies

- `EPIC-1.1` (Identity — JWT authentication)

---

### 📦 Feature F-1.7.3: Redis Pub/Sub Adapter — 🟢 Low

#### Objective

Cấu hình Socket.io Redis Adapter để hỗ trợ broadcasting across multiple NestJS server instances (horizontal scaling).

#### Scope

- `@socket.io/redis-adapter` integration
- Redis Pub/Sub channel cho Socket.io room broadcasts
- Configuration qua environment variables

#### Acceptance Criteria

- [x] Messages broadcast từ server A được nhận bởi clients connected tới server B
- [x] Redis connection failure graceful degradation (fallback to single-server)
- [x] No sticky sessions required

#### Dependencies

- `F-1.7.2` (WebSocket Gateway)
- `EPIC-1.0` (Foundation — Redis infrastructure)

---

### 📦 Feature F-1.7.4: Agent Online Presence Tracking — 🟡 Medium

#### Objective

Theo dõi trạng thái Online/Offline/Away của Agent trong Workspace bằng Redis, phục vụ cho auto-assignment algorithm (Epic 1.8) và UI hiển thị.

#### Scope

- Redis-based presence store: `SET workspace:{id}:presence` → `{ userId, status, lastSeenAt }`
- Presence statuses: `ONLINE`, `OFFLINE`, `AWAY` (auto after idle timeout)
- Heartbeat mechanism: client gửi heartbeat mỗi 30s, server mark `OFFLINE` nếu miss 2 heartbeats
- Presence change events: broadcast `presence.updated` tới `workspace_{id}` room
- API endpoint: `GET /api/v1/presence` — list online agents in workspace

#### Acceptance Criteria

- [x] Agent connect → status `ONLINE`, broadcast to workspace room
- [x] Agent disconnect → status `OFFLINE` after heartbeat timeout
- [x] Idle > 5 minutes → status `AWAY`
- [x] Presence query trả về danh sách agents online trong workspace
- [x] Presence data scoped by workspace (tenant isolation)
- [x] Redis TTL tự động cleanup stale presence entries

#### Dependencies

- `F-1.7.2` (WebSocket Gateway — heartbeat mechanism)
- `EPIC-1.0` (Foundation — Redis)

---

### 📦 Feature F-1.7.5: Realtime Event Dispatcher — 🟡 Medium

#### Objective

Kết nối domain events (từ `EventEmitter2`) với WebSocket broadcasting — khi domain event xảy ra, dispatcher tự động gửi typed payload tới đúng rooms.

#### Scope

- Event listeners consume domain events → broadcast qua WebSocket Gateway:
  - `message.created` → broadcast to `conversation_{id}` + `workspace_{id}`
  - `conversation.created` → broadcast to `workspace_{id}`
  - `conversation.status_updated` → broadcast to `conversation_{id}` + `workspace_{id}`
  - `conversation.assigned` → broadcast to `user_{assigneeId}` + `workspace_{id}`
  - `contact.created/updated/deleted` → broadcast to `workspace_{id}`
  - `presence.updated` → broadcast to `workspace_{id}`
- Event payload transformation: domain event → WebSocket payload (theo `docs/api/websocket-contract.md`)

#### Acceptance Criteria

- [x] Mỗi domain event type có dedicated listener
- [x] Events broadcast đúng rooms (conversation-specific vs workspace-wide)
- [x] Assignment events notify cả old và new assignee qua `user_{id}` room
- [x] WebSocket payload format match contract trong `websocket-contract.md`
- [x] Failed broadcasts không crash event processing pipeline (error isolation)

#### Dependencies

- `F-1.7.1` (Domain Event Bus)
- `F-1.7.2` (WebSocket Gateway)
