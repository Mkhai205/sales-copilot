# PRD: AI Agent Framework — AI Sales Copilot Tự Động Vận Hành

> **Tài liệu**: Đặc Tả Yêu Cầu Sản Phẩm (Product Requirements Document)\
> **Dự án**: Sales Copilot Platform — AI Agent Framework\
> **Vị trí file**: `docs/product/prd-ai-agent-framework.md`\
> **Trạng thái**: ✅ Confirmed\
> **Tham chiếu**: [`01-vision.md`](../product/01-vision.md) · Epics: [`3.0`](../backlog/epic-3.0-ai-legacy-cleanup.md) · [`3.1`](../backlog/epic-3.1-ai-agent-core.md) · [`3.2`](../backlog/epic-3.2-commerce-tool-registry.md) · [`3.3`](../backlog/epic-3.3-comment-guard.md) · [`3.4`](../backlog/epic-3.4-ai-settings-ui.md)

---

## 1. Bối Cảnh & Vấn Đề Kinh Doanh

### 1.1. Vấn đề hiện tại

Sales Copilot Platform đã xây dựng xong nền tảng **Commerce + Omnichannel** hoàn chỉnh: hộp thư hợp nhất đa kênh, khung lên đơn trong chat, khóa tồn kho nguyên tử, VietQR động và đối soát thanh toán tự động. Tuy nhiên, **toàn bộ quy trình tư vấn và chốt đơn vẫn 100% phụ thuộc vào nhân viên con người**.

Điều này tạo ra 3 nút thắt cổ chai:

1. **Dead Zone ngoài giờ**: 23:00 – 07:00 không có nhân viên trực → mất 30-40% tin nhắn khách hàng tiềm năng (theo dữ liệu ngành Social Commerce VN).
2. **Nghẽn cổ chai cao điểm**: Livestream / Flash Sale sinh 200-500 tin nhắn/phút → nhân viên không kịp phản hồi → khách rời sang đối thủ.
3. **Vận hành tốn kém**: Shop nhỏ (1-2 người) không đủ nhân lực trực chat 24/7, phải thuê thêm nhân viên hoặc bỏ lỡ doanh số.

### 1.2. Giá trị kinh doanh của AI Agent

| Metric | Hiện tại (Manual) | Mục tiêu (AI Agent) |
|---|---|---|
| Thời gian phản hồi trung bình | 5-15 phút (giờ cao điểm) | < 10 giây (24/7) |
| Tỷ lệ chốt đơn ngoài giờ | 0% (không ai trực) | 40-60% (AI tự chốt) |
| Khả năng phục vụ đồng thời | 3-5 khách/nhân viên | Không giới hạn |
| Chi phí vận hành/đơn hàng | ~15.000đ (lương nhân viên) | ~500-1.000đ (token LLM) |

---

## 2. Tầm Nhìn Sản Phẩm

> *"Biến mỗi Inbox thành một nhân viên bán hàng AI không bao giờ ngủ — tư vấn đúng sản phẩm, đàm phán giá trong hạn mức, chốt đơn và thu tiền tự động — trong khi chủ shop ngủ yên."*

### 2.1. Nguyên tắc thiết kế AI Agent

1. **🛡️ Guarded Autonomy (Tự chủ có kiểm soát)**: AI được trao quyền hành động nhưng LUÔN tuân thủ rào chắn an toàn do chủ shop thiết lập. Không bao giờ bán vượt kho, không giảm giá quá trần.

2. **🧰 Tool-Use Architecture (Kiến trúc gọi công cụ)**: AI KHÔNG tự bịa thông tin — nó gọi các Tool (tra kho, tạo đơn, sinh QR) để thao tác với hệ thống thật. Mọi hành động đều có audit trail.

3. **🔄 Human-in-the-Loop (Con người luôn có quyền can thiệp)**: Nhân viên có thể tiếp quản (Takeover) bất kỳ lúc nào. AI dừng ngay lập tức, không tranh chấp.

4. **📦 Don't Reinvent the Wheel**: Sử dụng framework AI Agent có sẵn, đã được cộng đồng kiểm chứng, thay vì tự xây dựng agent loop từ đầu.

---

## 3. Phân Tích Giải Pháp: Build vs Buy (Don't Reinvent the Wheel)

### 3.1. Bối cảnh kỹ thuật hiện có

Hệ thống đã có `LlmGatewayService` tự viết với `GeminiAdapter` (`@google/genai` v2.21.0), hỗ trợ text generation, streaming, structured output, circuit breaker, rate limiter, BYOK multi-tenant credentials. **Chưa có**: function calling, agent loop, tool orchestration.

### 3.2. Các framework AI Agent đã nghiên cứu

| Framework | NPM Package | Downloads/week | Stars | Agent Loop | Zod Tools | NestJS Fit | KISS Rating |
|---|---|---|---|---|---|---|---|
| **Vercel AI SDK** | `ai` + `@ai-sdk/google` | **18.3M** | **26.7k** | ✅ `maxSteps` built-in | ✅ Native | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Google Genkit | `genkit` + `@genkit-ai/google-genai` | 208k | 1.3k | ✅ Agents API | ✅ `defineSchema` | ⭐⭐⭐ | ⭐⭐⭐ |
| LangChain.js | `@langchain/langgraph` + `@langchain/google` | 4.85M | 18.1k | ✅ LangGraph | ⚠️ Custom | ⭐ | ⭐ |
| `@google/genai` thuần | `@google/genai` | 18M | 1.6k | ⚠️ CallableTool (AFC) | ❌ JSON Schema only | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Mastra AI | `@mastra/core` | 1.1M | 19.8k | ✅ Agent class | ✅ `createTool` | ⭐⭐⭐ | ⭐⭐⭐ |

### 3.3. Quyết định: Vercel AI SDK (`ai` + `@ai-sdk/google`)

**Lý do chọn:**

1. **Agent loop built-in**: `generateText({ tools, maxSteps: 10 })` tự động loop: gọi LLM → nhận function call → execute tool → feed result back → lặp lại → cho đến khi LLM trả text response. **Không cần tự viết ReAct loop.**

2. **Zod-native tools**: Tool define schema bằng `z.object({...})` — khớp hoàn hảo với codebase đang dùng Zod everywhere (pipes, shared-contracts, DTOs).

3. **Model-agnostic**: `@ai-sdk/google` cho Gemini, nhưng swap sang `@ai-sdk/openai` hay `@ai-sdk/anthropic` chỉ đổi 1 dòng import. Future-proof cho multi-provider fallback.

4. **Nhẹ, pragmatic**: Zero framework overhead — chỉ là một thư viện hàm thuần (`generateText`, `streamText`, `tool`). Không conflict với NestJS DI, không tạo layer thừa. Phù hợp triết lý **Anti-Over-Engineering**.

5. **BullMQ-friendly**: `generateText()` (non-streaming) chạy hoàn hảo trong BullMQ Worker — trả về `Promise<result>`, không cần HTTP response stream.

6. **Lifecycle hooks**: `onStepFinish` cho phép audit trail mỗi bước (tool nào được gọi, kết quả gì), `onFinish` để persist conversation vào Prisma.

7. **Industry standard**: 18.3M downloads/week, 26.7k stars — lớn nhất hệ sinh thái TypeScript AI.

**Tác động tối thiểu đến codebase hiện có:**

| Component hiện tại | Tác động |
|---|---|
| `GeminiAdapter` + `LlmGatewayService` | **Giữ nguyên** cho Structured Output, text gen, streaming hiện tại |
| `CircuitBreakerService` | **Tái sử dụng** — wrap quanh AI SDK provider |
| `RateLimiterService` | **Tái sử dụng** — pre-check quota trước agent loop |
| `OrderExtractorService` | **Tái sử dụng** — expose thành Tool `extractShippingInfo` |
| `inbox.settings.aiCommercePolicy` | **Tái sử dụng nguyên vẹn** — mode + discount config + UI đã có |
| `OutboundMessageListener` | **Tái sử dụng** — tạo Message `senderType: SYSTEM` → auto-send |

**Các framework bị loại:**

- **LangChain/LangGraph**: Over-abstraction nghiêm trọng (`Runnable`, `Command`, `StateGraph`), dependency tree nặng, vi phạm KISS & YAGNI.
- **GenKit**: Coupled với Firebase/GCP patterns (Firestore session stores), conflict với NestJS DI conventions, API đang thay đổi nhanh.
- **Mastra**: Framework-within-framework conflict, supply-chain vulnerability incident (06/2026).
- **`@google/genai` thuần**: Đã có sẵn trong project nhưng cần tự viết agent loop thủ công (~200-300 LOC). Viable nhưng Vercel AI SDK cung cấp sẵn với chất lượng production-tested.

---

## 4. Các Chức Năng Chính (Feature Set)

### 4.1. AI Agent Core — Vòng Lặp Tư Vấn & Chốt Đơn Tự Động

**Mô tả**: AI Agent nhận tin nhắn khách hàng, tự động reasoning qua nhiều bước (multi-step), gọi các Tool để tra cứu sản phẩm, kiểm tra tồn kho, bóc tách địa chỉ, tạo đơn hàng, sinh VietQR — và gửi phản hồi cho khách.

**User Journey — Khách mua hàng lúc 2h sáng:**

| Bước | Khách hàng | AI Agent (nền) | Kết quả |
|---|---|---|---|
| 1 | *"Áo polo trắng size L còn ko shop?"* | Tool: `searchProducts("áo polo trắng L")` | Tìm thấy SKU, giá 150k, tồn 23 |
| 2 | | AI trả lời text | *"Dạ shop còn Áo Polo Trắng size L giá 150k ạ 😊"* |
| 3 | *"Ship về 15 ngõ 45 Vọng, HBT, HN. SĐT 0988123456"* | Tool: `extractShippingInfo(...)` | Hà Nội > Hai Bà Trưng > Đồng Tâm |
| 4 | | Tool: `createDraftOrder(...)` | Đơn #DH1042, tổng 180k |
| 5 | | Tool: `generateVietQR(...)` | Ảnh QR NAPAS 247 |
| 6 | | AI trả lời text + ảnh | *"Đơn #DH1042 tổng 180k, quét QR bên dưới nhé 🙏"* |
| 7 | Quét QR, chuyển khoản | Bank Webhook → auto reconcile | Đơn → PAID, thông báo nhân viên |

### 4.2. Chế Độ AI — AUTOPILOT (Bật/Tắt)

`inbox.settings.aiCommercePolicy.enabled`:

| Trạng thái | Hành vi |
|---|---|
| `enabled: true` | AI tự động xử lý 100% tin nhắn CONTACT 24/7. Nhân viên có thể Takeover bất kỳ lúc nào |
| `enabled: false` (hoặc không có config) | AI tắt hoàn toàn. Mọi tin nhắn đi vào flow nhân viên bình thường |

> Các chế độ nâng cao (COPILOT gợi ý cho nhân viên, HYBRID ngoài giờ, OVERFLOW chờ quá lâu) sẽ được bổ sung trong Phase sau khi AI Agent core đã ổn định.

### 4.3. Đàm Phán Giảm Giá Có Kiểm Soát (Guarded Discount)

- Chủ shop cấu hình: `maxDiscountPercent` (%), `maxDiscountVnd` (VNĐ)
- AI gọi Tool `evaluateDiscount` → kiểm tra: `discountAmount ≤ min(orderTotal × maxPercent, maxAmount)`
- Hợp lệ → áp dụng giảm giá, cập nhật đơn
- Vượt trần → từ chối khéo léo, giữ giá niêm yết

### 4.4. Vệ Sĩ Ẩn Bình Luận (Comment Guard) — Module Độc Lập

- **Không cần LLM** — chỉ Regex thuần, chi phí = 0 token, latency < 1s
- Quét SĐT trong comment bài viết/livestream → ẩn comment → gửi Private Reply kéo khách vào Inbox
- Chạy 24/7 độc lập, không phụ thuộc vào ca trực hay chế độ AI

### 4.5. Nhân Viên Tiếp Quản (Human Takeover)

- Nhân viên bấm nút **"Tiếp Quản Từ AI"** hoặc gửi bất kỳ tin nhắn nào trong conversation
- `conversation.isAiPaused = true` → AI Worker dừng ngay mọi xử lý
- AI không tự bật lại — chỉ được bật lại khi nhân viên chủ động resolve conversation

### 4.6. Marketing Outbound (Phase sau)

- Khách có SĐT/ý định mua nhưng chưa chốt đơn → nhắc nhở sau N giờ
- Tuân thủ Facebook 24h messaging window policy
- Scope: Để phase sau khi AI Agent core đã ổn định

---

## 5. Ràng Buộc An Toàn (Guardrails)

| # | Ràng buộc | Cơ chế thực thi |
|---|---|---|
| G1 | Không bán vượt kho | Tool `createDraftOrder` → `InventoryLedgerService.reserveStock()` (atomic tx) |
| G2 | Không giảm giá vượt trần | Tool `evaluateDiscount` → hard-cap from `aiCommercePolicy` |
| G3 | Không bịa thông tin sản phẩm | System prompt: "BẮT BUỘC gọi searchProducts trước khi tư vấn" |
| G4 | Không vòng lặp vô hạn | `maxSteps: 10` trong Vercel AI SDK `generateText()` |
| G5 | Takeover tức thì | Check `isAiPaused` trước mỗi step trong `onStepFinish` |
| G6 | Rate limiting per tenant | `RateLimiterService` check quota RPM/TPM trước agent loop |
| G7 | Circuit breaker | `CircuitBreakerService` ngắt khi LLM provider lỗi liên tiếp |
| G8 | Multi-tenancy isolation | `workspaceId` inject từ authenticated context, KHÔNG phải tool argument |

---

## 6. Metrics Đo Lường Thành Công

| Metric | Mô tả | Mục tiêu Phase 1 |
|---|---|---|
| **AI First Response Latency** | Thời gian từ tin nhắn khách đến phản hồi AI đầu tiên | p95 < 8 giây |
| **AI Order Conversion Rate** | % conversation AI xử lý dẫn đến đơn hàng confirmed | > 15% |
| **AI Factual Accuracy** | % phản hồi chính xác (đúng giá, đúng tồn, đúng sản phẩm) | > 99% |
| **Human Takeover Rate** | % conversation cần nhân viên can thiệp | < 20% |
| **Token Cost per Order** | Chi phí token LLM trung bình cho 1 đơn hàng chốt thành công | < 1.000đ |
| **Comment Guard Latency** | Thời gian ẩn bình luận chứa SĐT | < 1 giây |
| **Discount Policy Compliance** | % đơn AI tạo tuân thủ hạn mức giảm giá | 100% |

---

## 7. Lộ Trình Triển Khai

| Epic | Nội dung | Thời gian | Tiên quyết |
|---|---|---|---|
| **[3.0](../backlog/epic-3.0-ai-legacy-cleanup.md)** | Xóa toàn bộ code AI cũ (`llm-gateway/`, `commerce/automation/`, shared contracts, frontend UI cũ). Cài `ai` + `@ai-sdk/google` | 2-3 ngày | — |
| **[3.1](../backlog/epic-3.1-ai-agent-core.md)** | AI Agent Core: Vercel AI SDK integration, BullMQ Worker, Dispatcher, Context Builder, Human Takeover, Prisma migration | 2-3 tuần | 3.0 |
| **[3.2](../backlog/epic-3.2-commerce-tool-registry.md)** | 9 Commerce Tools: searchProducts, extractShippingInfo, evaluateDiscount, createDraftOrder, confirmAndGenerateQR, escalateToHuman... | 2-3 tuần | 3.1 |
| **[3.3](../backlog/epic-3.3-comment-guard.md)** | Comment Guard: FB feed webhook, Regex quét SĐT, Graph API hide, Private Reply, lead conversion | 1-1.5 tuần | 3.1 |
| **[3.4](../backlog/epic-3.4-ai-settings-ui.md)** | AI Settings UI: Toggle AUTOPILOT, discount config, persona, custom instructions, Comment Guard settings, Conversation AI badge + Takeover button | 1-2 tuần | 3.1 + 3.2 |

---

## 8. Rủi Ro & Biện Pháp Giảm Thiểu

| Rủi ro | Mức độ | Biện pháp |
|---|---|---|
| AI hallucination (bịa sản phẩm/giá) | 🔴 Cao | Tool-use bắt buộc (G3) + temperature thấp (0.2) + system prompt cấm bịa |
| Chi phí token bùng nổ | 🟡 TB | Rate limiter per workspace tier + Gemini 2.5 Flash (rẻ nhất) + maxSteps cap |
| Facebook API rate limit | 🟡 TB | Queue-based processing + exponential backoff |
| Khách phản ứng tiêu cực với AI | 🟡 TB | Human Takeover + `personaTone` customization + từ chối khéo léo |
| Vercel AI SDK breaking changes | 🟢 Thấp | Pin version + abstraction layer mỏng (`AiAgentService`) |
| Deadlock tồn kho khi AI + nhân viên cùng chốt | 🟡 TB | Redis sliding lock đã có + sorted variant IDs trong atomic tx |
