# 02 — Luồng dữ liệu & xử lý

> Sequence diagram các luồng nghiệp vụ chính, derive từ code (cập nhật 2026-10-03). Mỗi bước dẫn file trong cột actor.

---

## 1. Tin nhắn vào (inbound webhook → inbox)

Từ Facebook / Zalo OA / Telegram (webhook) — Web Chat đi đường khác (mục 6), Zalo Personal không có webhook (push từ listener nội bộ).

```mermaid
sequenceDiagram
    autonumber
    participant CH as Kênh bên ngoài
    participant WC as webhooks.controller<br/>channels/:channelId/webhook
    participant WS as webhooks.service
    participant Q as BullMQ channel-ingestion
    participant P as ChannelIngestionProcessor
    participant CR as ContactResolutionService
    participant CV as ConversationsService
    participant MS as MessagesService
    participant EV as EventEmitter2
    participant RT as RealtimeEventDispatcher

    CH->>WC: POST raw body
    WC->>WS: handleInboundWebhook
    WS->>WS: adapter.verifyWebhook (signature từng kênh)
    WS->>WS: dedup ChannelEvent (channelId, externalEventId)
    WS-->>CH: HTTP 200 ACK ngay (mục tiêu < 100ms)
    WS->>Q: add job — jobId channelId_eventId
    Q->>P: process (concurrency 5, retry 3 lần backoff)
    P->>P: adapter.parseInboundPayload → tin nhắn chuẩn hoá
    P->>CR: resolveFromChannel
    Note right of CR: tìm ChannelIdentity → match email/phone → merge, hoặc tạo Contact + ChannelIdentity trong 1 transaction
    P->>CV: findOrCreateActiveConversation
    Note right of CV: tìm OPEN theo contact+inbox, SNOOZED tự mở lại
    P->>P: tải media về MinIO attachments/{ws}/inbound/
    P->>MS: create()
    MS->>EV: emit message.created
    EV->>RT: broadcast → room workspace_ + conversation_
    EV->>EV: auto-assignment (mục 5)
    EV->>EV: AI dispatcher (mục 3) — nếu tin từ khách
    P->>P: đánh dấu ChannelEvent.processedAt
```

**Nhánh song song — Facebook Comment Guard:** central webhook `POST /integrations/facebook/webhook` (Meta yêu cầu 1 callback/app) thấy comment mới → queue `comment-guard` (limit 180/giờ) → nếu có SĐT Việt Nam: ẩn comment (`is_hidden`), private reply mời khách nhắn riêng, tạo conversation + message — `comment-guard.processor.ts`.

## 2. Tin nhắn ra (agent trả lời)

```mermaid
sequenceDiagram
    autonumber
    participant UI as Web (composer)
    participant API as messages.controller
    participant MS as MessagesService
    participant DB as PostgreSQL
    participant OL as OutboundMessageListener
    participant Q as BullMQ message-outbound
    participant P as OutboundDeliveryProcessor
    participant AD as ChannelAdapter kênh
    participant RT as Socket /realtime

    UI->>API: POST conversations/:id/messages<br/>multipart, 20/phút
    Note left of UI: UI đã chèn tin "optimistic" với clientTempId, hiển thị PENDING
    API->>MS: create()
    MS->>DB: transaction — Message (PENDING) + Attachment<br/>+ unread/auto-reopen/firstReply
    MS->>OL: emit message.created
    OL->>Q: add jobId out_{messageId}<br/>(attempts 5, backoff 5s)
    MS-->>UI: response trả về ngay (PENDING)
    Q->>P: process (concurrency 5)
    P->>P: lock lock:outbound:conv:{id} — giữ thứ tự<br/>theo conversation (contended → retry sau)
    P->>AD: sendMessage(channel, payload)<br/>attachments re-sign từ storagePath
    AD-->>P: kết quả
    P->>MS: markOutboundDelivery
    MS->>DB: externalId + SENT (hoặc FAILED + deliveryError)
    MS->>RT: emit message.delivery_status_updated<br/>→ UI chuyển PENDING → SENT/FAILED
    Note over P: lỗi provider → throw để BullMQ retry;<br/>lần cuối → FAILED (terminal)
```

Lưu ý: gửi đi là **async qua queue** — provider chậm không block request path; lỗi tạm thời được retry, lỗi chốt ghi `FAILED`. Tin AI/SYSTEM cũng đi qua `MessagesService.create()` nên vào queue như thường, trừ khi `metadata.suppressOutbound` (producer chặn).

## 3. AI autopilot

```mermaid
sequenceDiagram
    autonumber
    participant EV as EventEmitter2
    participant GD as AiGuardrailService
    participant DL as ai-dispatcher.listener
    participant Q as BullMQ ai-autopilot
    participant W as AiAgentWorker
    participant AG as AiAgentService (Gemini)
    participant TL as CommerceToolRegistry
    participant MS as MessagesService

    EV->>GD: message.created (sender CONTACT)
    GD->>GD: blacklist + rate 5 tin/phút + abuse detection<br/>(Redis chết → CHẶN, fail-closed)
    GD->>DL: pass
    DL->>DL: inbox bật AI? kill-switch feature.ai_autopilot_enabled?
    DL->>Q: add (debounce 500ms/conversation,<br/>bỏ job cũ bằng Redis counter)
    Q->>W: process
    W->>W: job cũ hơn tin mới nhất → DROP
    W->>AG: generateText (tối đa 10 bước, temp 0.3)
    loop mỗi bước (đến 10)
        AG->>TL: tool?
        TL->>TL: kiểm tra isAiPaused TRƯỚC MỖI lần chạy tool
        Note over TL: searchKnowledge · searchProducts · getProductDetails<br/>checkInventory · extractShippingInfo · evaluateDiscount<br/>createDraftOrder · confirmAndGenerateQR · updateContactInfo<br/>escalateToHuman
    end
    AG-->>W: text trả lời
    W->>MS: create() với SenderType SYSTEM<br/>metadata isAiGenerated + aiUsage
    W->>Q: schedule job follow-up (5 phút, huỷ được)
    Note over AG,MS: Agent bị ngang giữa chừng khi agent người thật nhắn tin công khai<br/>(isAiPaused) — chặn ở 3 điểm: worker, stopWhen, từng tool
```

Chống lạm dụng chiết khấu: `DiscountGuardService` — `maxAllowed = min(total × maxDiscountPercent%, maxDiscountVnd)`, thiếu chính sách = cấm. Trích địa chỉ: tier 1 regex + `vietnam-divisions-js` (&lt;5ms); điểm tin cậy &lt; 70 thì tier 2 gọi LLM `generateObject` 5s, lỗi thì rớt về tier 1.

## 4. Bán hàng + thu tiền VietQR

```mermaid
sequenceDiagram
    autonumber
    participant AG as Agent / AI
    participant OS as OrdersService
    participant VS as VietQrService
    participant CU as Khách hàng
    participant BK as Ngân hàng (SePay/Casso)
    participant PW as PaymentWebhooksController
    participant Q as BullMQ commerce-reconciliation
    participant M as auto-reconciliation.matcher
    participant SM as stock-movement.service

    AG->>OS: POST orders (draft) → PATCH → POST :id/confirm
    Note over OS: $transaction + reservation tồn kho,<br/>emit order.created/confirmed
    AG->>VS: POST orders/:id/vietqr
    VS->>VS: build payload EMVCo/NAPAS 247<br/>(amount còn lại, memo ORD {displayId}, CRC-16)
    VS-->>CU: đẩy card QR vào conversation
    CU->>BK: chuyển khoản theo memo
    BK->>PW: POST webhook (secret/HMAC)
    PW-->>BK: HTTP 200 ACK nhanh (~50ms)
    PW->>Q: add jobId ws:gateway:txId (idempotent BullMQ)
    Q->>M: process (Redlock ws:{id}:order:{orderId}:payment)
    M->>M: parse memo → tìm order trong workspace
    alt khớp
        M->>M: idempotencyKey gateway:transactionCode
        M->>M: PAID / PARTIALLY_PAID / OVERPAID / DUPLICATE
        M->>SM: COMMIT_SALE (chốt kho)
        M->>M: emit order.paid
        Note over M: đơn đã SHIPPING/COMPLETED không bao giờ bị đẩy lùi
    else không khớp
        M->>M: lưu PaymentTransaction PENDING<br/>→ manual-match từ UI reconciliation
    end
```

Sau `order.paid`, `commerce-event.listener` tự nhắn tin SYSTEM vào conversation ("Đã nhận thanh toán…").

## 5. Auto-assignment (round-robin)

```mermaid
sequenceDiagram
    autonumber
    participant EV as EventEmitter2
    participant AL as auto-assignment.listener
    participant AA as auto-assignment.service
    participant RD as Redis
    participant PR as PresenceService

    EV->>AL: conversation.created / reopened
    AL->>AA: assign
    AA->>RD: lock lock:auto_assign:inbox:{id} (TTL 3s)
    AA->>PR: candidate = member inbox ∩ team ∩ ONLINE
    AA->>RD: chọn người có ít OPEN nhất,<br/>hoà thì lấy từ vòng quay round_robin:inbox:{id}
    AA->>AA: assign + emit conversation.assigned
```

## 6. Web Chat (widget) — vào/ra không qua webhook

- **Khách gửi**: `widget-sdk` → Socket.io `/widget` event `widget:send_message` → `web-chat.gateway.ts` → tạo Contact/Conversation/Message như pipeline chuẩn (sender CONTACT) → ack `widget:message_sent` (echo `tempId` cho optimistic UI).
- **Shop trả lời**: tin ra qua queue `message-outbound` → `OutboundDeliveryProcessor` → `WebChatAdapter.sendMessage` *emit nội bộ* `widget:message` → gateway đẩy tới room của khách (idempotency theo `metadata.messageId` nên retry không phát trùng).
- **Auth khách**: widget token (JWT 180 ngày, `WIDGET_TOKEN_SECRET`); identify tuỳ chọn có HMAC signature.

## 7. Fan-out realtime (mọi luồng converge về đây)

```mermaid
flowchart LR
    E["DomainEvent (EventEmitter2)"] --> D["RealtimeEventDispatcher<br/>realtime-event.dispatcher.ts"]
    D --> R1["room workspace_{id}<br/>mọi agent của shop"]
    D --> R2["room conversation_{id}<br/>ai đang mở hội thoại"]
    D --> R3["room user_{id}<br/>conversation.assigned → assignee cũ/mới"]
    R1 & R2 & R3 --> C["web: use-realtime-sync.ts<br/>ghi thẳng vào cache TanStack Query<br/>(setQueriesData) — không refetch"]
```

Web nhận event nào phải khai ở 2 chỗ: `SocketEventPayloadMap` (shared-contracts) + `use-realtime-sync.ts` (apps/web).