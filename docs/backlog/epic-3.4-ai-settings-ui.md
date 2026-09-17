# Epic 3.4 — AI Settings UI: Cấu Hình & Giám Sát AI Agent

> **Mục tiêu**: Xây dựng giao diện quản trị cho phép chủ shop bật/tắt AI Autopilot, cấu hình chính sách giảm giá, viết hướng dẫn bán hàng riêng, cấu hình Comment Guard — và theo dõi hoạt động AI trên conversation.\
> **Tiên quyết**: Epic 3.1 (AI Agent Core) + Epic 3.2 (Commerce Tools)\
> **Ước lượng**: 1-2 tuần\
> **Tham chiếu**: [PRD §4](../product/prd-ai-agent-framework.md)

---

## 1. Mô Tả Tổng Quan

Epic này xây dựng **toàn bộ frontend** cho AI Agent Framework — thay thế hoàn toàn UI cũ (`tab-ai-commerce-policy.tsx`, `AiAutofillBanner`, `composer-bridge.ts`). Gồm 3 nhóm UI chính:

1. **AI Settings per Inbox** — Bật/tắt AUTOPILOT, cấu hình discount, persona, custom instructions.
2. **Comment Guard Settings per Channel** — Bật/tắt, cấu hình private reply template.
3. **Conversation UI enhancements** — Badge AI trên tin nhắn, nút Takeover, trạng thái AI.

---

## 2. Giao Diện Chi Tiết

### 2.1. Tab AI Settings (trong Inbox Detail)

**Vị trí**: Inbox Detail → Tab mới "AI Agent"

**Nội dung:**

| Field | Component | Mô tả |
|---|---|---|
| **AI Autopilot** | Switch toggle | Bật/tắt AI tự động trả lời cho Inbox này |
| **Persona Tone** | Select dropdown | 4 options: `shop_ban`, `em_anh_chi`, `minh_ban`, `chuyen_vien` |
| **Custom Instructions** | Textarea | Hướng dẫn bán hàng riêng, max 2000 ký tự. Placeholder: "VD: Luôn giới thiệu combo giảm giá khi khách mua từ 2 sản phẩm..." |
| **Giảm giá tối đa (%)** | Number input | `maxDiscountPercent`, min 0, max 100, default 0 |
| **Giảm giá tối đa (VNĐ)** | Number input | `maxDiscountVnd`, min 0, step 1000 |
| **Kho mặc định** | Select dropdown | Chọn warehouse cho AI tạo đơn |
| **Tài khoản VietQR** | Select dropdown | Chọn bank account cho AI sinh QR |

**Trạng thái hiển thị**:
- Khi AI tắt: Các fields mờ (disabled), badge "AI đang tắt"
- Khi AI bật: Các fields active, badge "AI đang hoạt động 🟢"

**Validation**:
- `customInstructions` ≤ 2000 ký tự
- `maxDiscountPercent` 0-100
- `maxDiscountVnd` ≥ 0
- Bật AI yêu cầu chọn ít nhất 1 warehouse và 1 bank account

### 2.2. Comment Guard Settings (trong Channel Detail)

**Vị trí**: Channel (Facebook Page) Detail → Section "Comment Guard"

| Field | Component | Mô tả |
|---|---|---|
| **Comment Guard** | Switch toggle | Bật/tắt ẩn comment chứa SĐT |
| **Private Reply Template** | Textarea | Template tin nhắn riêng gửi cho commenter. Có nút "Khôi phục mặc định" |

### 2.3. Conversation UI — Trạng Thái AI

**Trong Conversation Header:**
- Khi AI đang xử lý: Badge `🤖 AI Autopilot` màu xanh
- Khi nhân viên đã Takeover: Badge `👤 Nhân viên` màu cam
- Nút **"Tiếp quản từ AI"**: Hiện khi AI đang bật. Click → set `isAiPaused = true`

**Trong Message Thread:**
- Tin nhắn AI: Avatar bot đặc biệt + badge "AI" nhỏ trên góc
- `senderType === 'SYSTEM'` + `metadata.isAiGenerated === true` → render avatar bot

**Trong Conversation Sidebar:**
- Info card: "AI xử lý: X tin nhắn" + "Takeover: Y lần"

### 2.4. Platform Admin

- Feature flag `feature.ai_autopilot_enabled` — giữ nguyên
- System setting `llm.default_model` — cập nhật nếu cần

---

## 3. Quy Tắc Nghiệp Vụ UI

### 3.1. State Management

- Sử dụng **TanStack Query** (React Query) cho toàn bộ fetching/mutation.
- Mutations: `useMutation` → gọi PATCH `/api/v1/inboxes/:id` để update `settings.aiCommercePolicy`.
- Cache invalidation: invalidate inbox query khi save settings thành công.

### 3.2. Tái sử dụng Shadcn UI

- Switch: `@/components/ui/switch`
- Select: `@/components/ui/select`
- Textarea: `@/components/ui/textarea`
- NumberInput: `@/components/ui/input` type="number"
- Badge: `@/components/ui/badge`
- Button: `@/components/ui/button`
- Card: `@/components/ui/card`
- Kiểm tra `src/components/ui/` trước khi tạo component mới.

### 3.3. Responsive & A11y

- Settings UI responsive trên tablet + desktop
- Labels associate đúng với inputs (`htmlFor`)
- Toast notifications khi save thành công/lỗi

### 3.4. Realtime Updates

- Khi nhân viên bấm Takeover → WebSocket broadcast trạng thái conversation
- Tin nhắn AI xuất hiện real-time qua WebSocket (existing flow)
- Badge AI/Human cập nhật real-time khi trạng thái thay đổi

---

## 4. API Endpoints

### Endpoints hiện có (chỉ cần sửa body schema)

| Method | Endpoint | Body thay đổi |
|---|---|---|
| `PATCH` | `/api/v1/inboxes/:id` | `settings.aiCommercePolicy` → schema mới (bỏ `mode`, thêm `enabled`, `customInstructions`) |

### Endpoints mới

| Method | Endpoint | Mô tả |
|---|---|---|
| `PATCH` | `/api/v1/channels/:id/settings` | Update `commentGuard` settings |
| `POST` | `/api/v1/conversations/:id/takeover` | Set `isAiPaused = true`, emit event |

---

## 5. Tiêu Chí Nghiệm Thu

### AI Settings UI
- [ ] Toggle Autopilot bật/tắt → persist vào DB → AI hoạt động/dừng tương ứng
- [ ] Persona tone select → 4 options → persist
- [ ] Custom Instructions textarea → max 2000 ký tự → validation client-side
- [ ] Discount fields → validate range → persist
- [ ] Warehouse + Bank account selects → populate từ API → persist

### Comment Guard Settings
- [ ] Toggle Comment Guard per Channel → persist
- [ ] Private Reply template edit → persist + nút reset mặc định

### Conversation UI
- [ ] Tin nhắn AI hiển thị avatar bot + badge "AI"
- [ ] Nút "Tiếp quản từ AI" hoạt động → set `isAiPaused` → badge đổi sang "Nhân viên"
- [ ] Real-time: tin nhắn AI xuất hiện không cần refresh

### Codebase Quality
- [ ] Không còn reference đến `AiAutofillBanner`, `composer-bridge.ts`, `tab-ai-commerce-policy.tsx` cũ
- [ ] Tất cả components dùng Shadcn UI primitives
- [ ] TanStack Query cho mọi API calls (không `useEffect` fetch thủ công)
- [ ] Design tokens: `bg-background`, `text-foreground`, `text-primary`
