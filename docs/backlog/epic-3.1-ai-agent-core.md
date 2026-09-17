# Epic 3.1 — AI Agent Core: Vercel AI SDK Integration + Agent Loop + Dispatcher

> **Mục tiêu**: Xây dựng bộ khung AI Agent hoàn chỉnh — nhận tin nhắn khách hàng, chạy vòng lặp reasoning multi-step qua LLM + Tool Calling, và gửi phản hồi tự động.\
> **Tiên quyết**: Epic 3.0 (Legacy Cleanup)\
> **Ước lượng**: 2-3 tuần\
> **Tham chiếu**: [RFC Architecture](../architecture/rfc-ai-agent-framework.md) · [PRD](../product/prd-ai-agent-framework.md)

---

## 1. Mô Tả Tổng Quan

Epic này xây dựng **xương sống** của hệ thống AI Agent — bao gồm:

- **AI Agent Service**: Core wrapper quanh Vercel AI SDK `generateText()` — thực hiện vòng lặp agent tự động (LLM gọi tool → execute → feed result back → lặp lại).
- **AI Dispatcher Listener**: Lắng nghe event `message.created`, phân luồng tin nhắn CONTACT vào queue AI hoặc để nhân viên xử lý.
- **AI Agent Worker**: BullMQ processor chạy nền, xử lý job từ queue `ai-autopilot`.
- **Context Builder**: Tổng hợp system prompt + conversation history + shop config.
- **Human Takeover**: Cơ chế nhân viên tiếp quản tức thì, AI dừng ngay.
- **Prisma Migration**: Thêm field `isAiPaused` vào Conversation.
- **Shared Contracts**: Schema mới cho AI Agent (job data, config, events).

**Kết quả mong đợi**: Khi chế độ AUTOPILOT được bật cho Inbox, AI tự động nhận và trả lời tin nhắn khách hàng. Chưa cần có tools commerce (Epic 3.2), AI chỉ trả lời text dựa trên system prompt.

---

## 2. Quy Tắc Nghiệp Vụ

### 2.1. Chế độ AUTOPILOT (duy nhất trong Phase này)

- `inbox.settings.aiCommercePolicy.enabled === true` → AI xử lý tin nhắn CONTACT.
- `enabled === false` hoặc không có `aiCommercePolicy` → Tin nhắn đi vào flow nhân viên bình thường.
- **Không có** mode COPILOT, HYBRID, OVERFLOW trong Phase này.

### 2.2. AI Dispatcher — Điều kiện dispatch

Khi nhận event `message.created`:

1. **Bỏ qua** nếu `senderType !== 'CONTACT'` (tin nhắn của Agent/System/AI).
2. **Bỏ qua** nếu `conversation.isAiPaused === true` (nhân viên đã Takeover).
3. **Bỏ qua** nếu inbox không có `aiCommercePolicy` hoặc `enabled === false`.
4. **Enqueue** job vào `ai-autopilot` queue nếu tất cả điều kiện hợp lệ.

### 2.3. Debounce — Chống xử lý trùng

- Khi khách gửi 3 tin nhắn liên tiếp trong 2 giây, AI chỉ xử lý tin cuối cùng.
- Cơ chế: Redis key `ws:{workspaceId}:ai:debounce:{conversationId}` lưu timestamp mới nhất. Worker kiểm tra trước khi xử lý.
- Delay mặc định: 500ms.

### 2.4. Human Takeover

| Sự kiện | Hành vi |
|---|---|
| Nhân viên gửi tin nhắn vào conversation | Set `isAiPaused = true` → AI dừng |
| Nhân viên bấm nút "Takeover" trên UI | Set `isAiPaused = true` → AI dừng |
| AI đang xử lý giữa chừng | `onStepFinish` check `isAiPaused` → abort agent loop ngay |
| Nhân viên Resolve conversation | Set `isAiPaused = false` → AI sẵn sàng cho lần sau |
| Khách nhắn tin mở lại conversation (re-open) | AI hoạt động bình thường (nếu `enabled`) |

### 2.5. AI Message Attribution

- Tin nhắn AI gửi: `senderType: 'SYSTEM'`, `messageType: 'OUTGOING'`.
- UI hiển thị badge "AI" trên tin nhắn system.
- `metadata.isAiGenerated = true` để phân biệt với system notifications khác.
- `OutboundMessageListener` tự động gửi tin nhắn OUTGOING ra kênh (Facebook/Zalo/Webchat) — không cần code thêm.

### 2.6. Giới hạn Agent Loop

- `maxSteps: 10` — Tối đa 10 vòng lặp LLM per conversation turn.
- Nếu vượt 10 steps → AI trả text response mặc định: *"Em chưa thể xử lý yêu cầu này, để em chuyển cho nhân viên hỗ trợ ạ"* + set `isAiPaused = true`.

### 2.7. Error Handling

- **LLM API lỗi** (timeout, 500, rate limit): Không gửi tin nhắn cho khách. Log error. Job fail → BullMQ retry (2 attempts, exponential backoff).
- **Tool execution lỗi**: Tool trả JSON error → LLM tự xử lý context → có thể gọi `escalateToHuman`.
- **Tất cả LLM providers đều lỗi**: AI im lặng. Notification cho admin workspace.

---

## 3. Kiến Trúc

### 3.1. Module Layout

```
apps/server/src/modules/intelligence/
├── ai-agent/
│   ├── ai-agent.module.ts            # NestJS Module
│   ├── ai-agent.service.ts           # Core: Vercel AI SDK wrapper
│   ├── ai-agent.worker.ts            # BullMQ Processor
│   ├── ai-dispatcher.listener.ts     # @OnEvent('message.created')
│   ├── ai-takeover.listener.ts       # Set isAiPaused khi Agent gửi tin
│   ├── ai-context.builder.ts         # System prompt + history builder
│   └── tools/                        # Tool definitions (placeholder, Epic 3.2)
│       └── index.ts                  # Empty initially
└── intelligence.module.ts            # Re-export
```

### 3.2. Luồng Xử Lý (Sequence)

```
Khách nhắn tin
  → ChannelIngestionProcessor (existing) → MessagesService.create()
  → EventEmitter: message.created
  → AiDispatcherListener: check senderType, isAiPaused, aiPolicy.enabled
  → BullMQ enqueue: ai-autopilot queue (delay 500ms)
  → AiAgentWorker.process(job):
      a. Debounce check (Redis)
      b. Re-check isAiPaused
      c. AiContextBuilder: load 20 messages + contact + policy → build system prompt + CoreMessage[]
      d. AiAgentService.processConversation():
         → generateText({ model, system, messages, tools, maxSteps: 10 })
         → Agent loop (Vercel AI SDK auto-handles):
            LLM → functionCall? → execute tool → feed result → repeat
            LLM → text response? → done
      e. Save AI response → MessagesService.create({ senderType: 'SYSTEM' })
      f. OutboundMessageListener auto-sends to customer channel
```

### 3.3. System Prompt Architecture

```
[Persona]
Bạn là nhân viên bán hàng AI của shop "{shopName}".
Giọng điệu: {personaTone}.

[Quy tắc bắt buộc]
1. KHÔNG BAO GIỜ bịa thông tin sản phẩm. Luôn gọi tool searchProducts trước.
2. KHÔNG giảm giá vượt hạn mức: tối đa {maxDiscountPercent}% hoặc {maxDiscountVnd}đ.
3. Nếu không chắc chắn hoặc khách yêu cầu phức tạp → gọi tool escalateToHuman.
4. Trả lời ngắn gọn, thân thiện, dùng emoji phù hợp.

[Hướng dẫn riêng của shop]
{customInstructions}

[Thông tin khách hàng hiện tại]
Tên: {contactName}
SĐT: {contactPhone}
```

### 3.4. Cấu hình AI mới (`inbox.settings.aiCommercePolicy`)

```typescript
{
  enabled: boolean,                    // Bật/tắt AUTOPILOT
  maxDiscountPercent: number,          // % giảm giá tối đa
  maxDiscountVnd: number,              // Số tiền giảm tối đa (VNĐ)
  personaTone: string,                 // 'shop_ban' | 'em_anh_chi' | 'minh_ban' | 'chuyen_vien'
  customInstructions: string,          // Hướng dẫn bán hàng riêng (max 2000 ký tự)
  defaultWarehouseId: string,          // Kho mặc định
  defaultBankAccountId: string,        // TK ngân hàng cho VietQR
}
```

---

## 4. Tiêu Chí Nghiệm Thu

### Core Agent Loop
- [ ] Vercel AI SDK (`ai` + `@ai-sdk/google`) cài và hoạt động
- [ ] `AiAgentService.processConversation()` chạy được agent loop cơ bản (LLM trả text, chưa cần tools)
- [ ] Agent trả lời dựa trên system prompt + conversation history
- [ ] `maxSteps: 10` enforce — loop không chạy vô hạn

### Dispatcher
- [ ] Tin nhắn CONTACT → enqueue job `ai-autopilot` khi `aiPolicy.enabled === true`
- [ ] Tin nhắn không phải CONTACT → bỏ qua
- [ ] Conversation `isAiPaused === true` → bỏ qua
- [ ] Inbox không có `aiCommercePolicy` → bỏ qua

### Worker
- [ ] `AiAgentWorker` xử lý job từ BullMQ queue `ai-autopilot`
- [ ] Debounce hoạt động: gửi 3 tin liên tiếp → chỉ xử lý tin cuối
- [ ] Job retry: 2 lần, exponential backoff

### Human Takeover
- [ ] Nhân viên gửi tin → `isAiPaused = true` → AI dừng
- [ ] AI đang xử lý giữa chừng → `onStepFinish` detect takeover → abort
- [ ] Resolve conversation → `isAiPaused = false`
- [ ] Khách nhắn lại → AI hoạt động bình thường

### Message Attribution
- [ ] Tin AI có `senderType: 'SYSTEM'`, `metadata.isAiGenerated: true`
- [ ] `OutboundMessageListener` tự động gửi ra kênh
- [ ] WebSocket broadcast tin AI cho frontend

### Context Builder
- [ ] Load tối đa 20 tin nhắn gần nhất
- [ ] System prompt chứa persona + rules + customInstructions + contact info
- [ ] Map messages sang `CoreMessage[]` format của Vercel AI SDK

### Schema & Migration
- [ ] Prisma migration: `isAiPaused Boolean @default(false)` trên Conversation
- [ ] Zod schema `aiCommercePolicy` cập nhật: bỏ `mode`, thêm `enabled`, `customInstructions` (max 2000)
- [ ] Shared contracts: queue name `AI_AUTOPILOT_QUEUE`, job data interface
