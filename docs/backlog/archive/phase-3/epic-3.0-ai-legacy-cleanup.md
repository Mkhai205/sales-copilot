# Epic 3.0 — AI Legacy Cleanup & Foundation

> **Mục tiêu**: Dọn dẹp toàn bộ code AI/chatbot cũ (chưa rõ kiến trúc, không theo hướng Tool-Use Agent), thiết lập nền tảng sạch cho AI Agent Framework mới dựa trên Vercel AI SDK.\
> **Tiên quyết**: Không\
> **Ước lượng**: 2-3 ngày

---

## Bối Cảnh

Codebase hiện tại chứa nhiều module AI/chatbot được viết trước khi xác định rõ kiến trúc AI Agent:

- `intelligence/llm-gateway/` — LLM Gateway tự viết dùng `@google/genai` trực tiếp (GeminiAdapter, OpenAIAdapter, CircuitBreaker, RateLimiter, StructuredOutput). Sẽ được thay thế hoàn toàn bởi Vercel AI SDK.
- `commerce/automation/` — OrderExtractorService, processor, listener chạy trên BullMQ queue riêng. Cần xóa processor/listener (logic dispatch sẽ do AI Dispatcher mới đảm nhiệm). Giữ lại `address-parser.util.ts` làm fast-path cho tool.
- `packages/shared-contracts/src/intelligence/` — LLM enums, schemas, prompt templates không còn phù hợp.
- Frontend: `AiAutofillBanner`, `composer-bridge.ts`, `tab-ai-commerce-policy.tsx` — viết lại hoàn toàn.

**Quyết định**: Xóa sạch, bắt đầu lại đúng kiến trúc. Code cũ không đi theo hướng Tool-Use Agent + Vercel AI SDK.

---

## Phạm Vi Cleanup

### Backend — Xóa hoàn toàn

| Module | Files | Lý do xóa |
|---|---|---|
| `intelligence/llm-gateway/` | `gemini.adapter.ts`, `openai.adapter.ts`, `llm-gateway.service.ts`, `circuit-breaker.service.ts`, `rate-limiter.service.ts`, `structured-output.service.ts`, interfaces, module, tests | Thay thế bằng Vercel AI SDK. Không cần adapter pattern hay circuit breaker tự viết |
| `intelligence/intelligence.module.ts` | Module wrapper | Viết lại cho AI Agent |
| `commerce/automation/` | `commerce-order-automation.listener.ts`, `commerce-order-automation.processor.ts`, `commerce-automation.module.ts` | Dispatch + Worker cũ → thay bằng AI Dispatcher + AI Agent Worker |
| `commerce/automation/` | `order-extractor.service.ts` | Logic extraction sẽ viết lại thành Tool trong AI Agent. Giữ `address-parser.util.ts` |
| `shared-contracts/intelligence/` | `llm/llm.enums.ts`, `llm/llm.schemas.ts`, `prompts/prompt-template.schemas.ts` | Viết lại contracts phù hợp Vercel AI SDK |

### Backend — Giữ lại

| File | Lý do giữ |
|---|---|
| `commerce/automation/address-parser.util.ts` | Logic GSO 3 cấp + `vietnam-divisions-js` hoạt động tốt, < 5ms, dùng làm fast-path trong tool `extractShippingInfo` |

### Frontend — Xóa hoàn toàn

| Component | Lý do xóa |
|---|---|
| `tab-ai-commerce-policy.tsx` | Viết lại đơn giản hơn (chỉ toggle on/off + params) |
| `AiAutofillBanner` + related imports | Dùng cho mode COPILOT (Phase sau) |
| `composer-bridge.ts` | Dùng cho mode COPILOT (Phase sau) |

### Dependencies — Gỡ & Cài

| Hành động | Package | Lý do |
|---|---|---|
| **Gỡ** | `@google/genai` | Không dùng trực tiếp nữa, Vercel AI SDK wrap |
| **Gỡ** | `openai` | Fallback provider — Vercel AI SDK xử lý |
| **Cài** | `ai` | Vercel AI SDK Core |
| **Cài** | `@ai-sdk/google` | Gemini provider cho Vercel AI SDK |

---

## Quy Tắc Cleanup

1. **Xóa dứt điểm**: Không comment out, không `@deprecated`. Xóa file, xóa import, xóa test.
2. **Giữ address-parser.util.ts**: Di chuyển vào thư mục phù hợp (có thể `intelligence/ai-agent/utils/`).
3. **Giữ nguyên `inbox.settings.aiCommercePolicy`** trong database (dữ liệu), chỉ sửa Zod schema.
4. **Feature flag `feature.ai_autopilot_enabled`**: Giữ lại trong SystemSettings.
5. **DomainEvent `POS_DRAFT_SUGGESTED`**: Xóa — không còn dùng.
6. **Queue `COMMERCE_ORDER_AUTOMATION_QUEUE`**: Xóa — thay bằng `AI_AUTOPILOT_QUEUE`.

---

## Tiêu Chí Nghiệm Thu (Acceptance Criteria)

- [x] Build thành công (`pnpm build`) sau khi xóa tất cả code cũ
- [x] Typecheck pass (`pnpm typecheck`) — không còn import broken
- [x] Không còn reference đến `LlmGatewayService`, `GeminiAdapter`, `OrderExtractorService` trong codebase (trừ docs)
- [x] Dependencies `@google/genai` và `openai` đã gỡ khỏi `package.json`
- [x] Dependencies `ai` và `@ai-sdk/google` đã cài
- [x] `address-parser.util.ts` vẫn hoạt động, test pass
- [x] Các module Commerce (Orders, Products, Inventory, VietQR) vẫn hoạt động bình thường — không bị ảnh hưởng bởi cleanup
- [x] Frontend build thành công, không còn reference đến components AI cũ
