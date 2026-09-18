# Epic 3.4 — AI Settings UI: Cấu Hình & Giám Sát AI Agent

> **Mục tiêu**: Xây dựng giao diện quản trị cho phép chủ shop bật/tắt AI Autopilot, cấu hình chính sách giảm giá, viết hướng dẫn bán hàng riêng, nâng cấp Comment Guard — và theo dõi hoạt động AI trên conversation.\
> **Tiên quyết**: Epic 3.1 (AI Agent Core) + Epic 3.2 (Commerce Tools)\
> **Ước lượng**: 1-2 tuần\
> **Tham chiếu**: [PRD §4](../product/prd-ai-agent-framework.md)\
> **Quyết định thiết kế**: [epic-3.4-design-decisions.md](../../.gemini/antigravity/brain/c8e940de-c251-405c-a668-34575f6b112f/epic-3.4-design-decisions.md)

---

## 1. Mô Tả Tổng Quan

Epic này xây dựng **toàn bộ frontend** cho AI Agent Framework. Gồm 3 nhóm UI chính:

1. **AI Settings per Inbox** — Tab mới trong Inbox Detail: bật/tắt Autopilot, cấu hình discount, persona, custom instructions.
2. **Nâng cấp Comment Guard UI** — Refactor UI Comment Guard hiện có trong `TabConfiguration`: thêm nút "Khôi phục mặc định", cải thiện layout.
3. **Conversation UI enhancements** — Badge AI subtle trên tin nhắn, nút Takeover (một chiều), trạng thái AI trên header.

> [!NOTE]
> UI cũ (`tab-ai-commerce-policy.tsx`, `AiAutofillBanner`, `composer-bridge.ts`) đã được dọn dẹp trong Epic 3.0. Chỉ còn sót key i18n `conversations.aiAutofill` cần xóa.

---

## 2. Giao Diện Chi Tiết

### 2.1. Tab AI Settings (trong Inbox Detail)

**Vị trí**: Inbox Detail → Tab mới "AI Agent" (tab thứ 5 trong `InboxDetailLayout`)

**Pattern lưu dữ liệu**: **Auto-save per field** (Notion-style)
- Switch/Select: fire `PATCH` ngay khi `onChange`
- Textarea/Number input: debounce ~500ms sau blur hoặc cuối keystroke
- Hiện toast "Đã lưu ✓" khi save thành công
- Không cần nút "Lưu thay đổi"

**Nội dung:**

| Field | Component | Mô tả |
|---|---|---|
| **AI Autopilot** | Switch toggle | Bật/tắt AI tự động trả lời cho Inbox này |
| **Persona Tone** | Select dropdown (có subtitle) | 4 options với label + mô tả phụ (xem bảng §2.1.1) |
| **Custom Instructions** | Textarea | Hướng dẫn bán hàng riêng, max 2000 ký tự. Placeholder: "VD: Luôn giới thiệu combo giảm giá khi khách mua từ 2 sản phẩm..." |
| **Giảm giá tối đa (%)** | Number input | `maxDiscountPercent`, min 0, max 100, default 0 |
| **Giảm giá tối đa (VNĐ)** | Number input | `maxDiscountVnd`, min 0, step 1000 |
| **Kho hàng** | Read-only info | Hiển thị "📦 Kho chính ✓" (hệ thống single-warehouse) |
| **Tài khoản VietQR** | Read-only info | Hiển thị thông tin từ `workspace.settings.paymentSettings` (VD: "🏦 MBBank - 098765xxxx ✓"). Nếu chưa cấu hình → link dẫn tới Workspace Settings |

#### 2.1.1. Persona Tone Options (Label + Subtitle)

| Value | Label | Subtitle |
|---|---|---|
| `shop_ban` | **Shop - Bạn** | Trung tính, phổ thông, phù hợp mọi ngành hàng |
| `em_anh_chi` | **Em - Anh/Chị** | Kính trọng, phổ biến nhất tại Việt Nam |
| `minh_ban` | **Mình - Bạn** | Thân thiện, gần gũi, phù hợp thời trang trẻ |
| `chuyen_vien` | **Chuyên viên** | Chuyên nghiệp, formal, phù hợp dịch vụ cao cấp |

**Trạng thái hiển thị**:
- Khi AI tắt: Các fields mờ (disabled), badge "AI đang tắt"
- Khi AI bật: Các fields active, badge "AI đang hoạt động 🟢"

**Validation (Block cứng khi bật toggle)**:
- `customInstructions` ≤ 2000 ký tự
- `maxDiscountPercent` 0-100
- `maxDiscountVnd` ≥ 0
- **Bật AI yêu cầu `workspace.settings.paymentSettings` đã được cấu hình**. Nếu chưa có → toggle không cho bật, hiện inline error: _"Vui lòng cấu hình Tài khoản VietQR trong Cài đặt Workspace trước khi bật AI"_

### 2.2. Nâng Cấp Comment Guard UI (trong Inbox Detail > Tab Configuration)

**Vị trí**: Giữ nguyên trong `TabConfiguration` của Inbox Detail (section Facebook Channel)

**Nâng cấp so với UI hiện có:**

| Cải tiến | Mô tả |
|---|---|
| Nút **"Khôi phục mặc định"** | Reset `privateReplyTemplate` và `publicReplyTemplate` về giá trị mặc định |
| Cải thiện layout | Responsive trên tablet, spacing/grouping rõ ràng hơn |
| Consistent auto-save | Áp dụng cùng pattern auto-save per field như tab AI Settings |

**Fields hiện có (giữ nguyên):**

| Field | Component | Mô tả |
|---|---|---|
| **Comment Guard** | Switch toggle | Bật/tắt ẩn comment chứa SĐT |
| **Public Reply** | Switch toggle | Bật/tắt trả lời công khai dưới comment |
| **Private Reply Template** | Textarea | Template tin nhắn riêng gửi cho commenter qua Messenger |
| **Public Reply Template** | Textarea | Template bình luận công khai trả lời |

### 2.3. Conversation UI — Trạng Thái AI

**Trong Conversation Header:**
- Khi AI đang xử lý (inbox AI enabled + `isAiPaused === false`): Badge `🤖 AI Autopilot` màu xanh
- Khi nhân viên đã Takeover (`isAiPaused === true`): Badge `👤 Nhân viên` màu cam
- Nút **"Tiếp quản từ AI"**: Hiện khi AI đang bật. Click → `POST /conversations/:id/takeover` → set `isAiPaused = true`

> [!IMPORTANT]
> **Takeover là một chiều**: Một khi nhân viên tiếp quản, AI không bao giờ tự bật lại cho conversation đó. Không có nút "Resume AI" / "Trả lại cho AI".

**Trong Message Thread:**
- Tin nhắn AI: Giữ nguyên avatar Inbox + **badge "🤖 AI" nhỏ** góc dưới-phải avatar
- Điều kiện render badge: `senderType === 'SYSTEM'` + `metadata.isAiGenerated === true`
- Badge chỉ hiển thị cho **nhân viên nội bộ** (khách trên Messenger/Zalo không thấy)

**Trong Conversation Sidebar (Detail Panel):**
- Info card: "AI xử lý: X tin nhắn" + "Takeover: Y lần"

### 2.4. Platform Admin

- Feature flag `feature.ai_autopilot_enabled` — giữ nguyên
- System setting `llm.default_model` — cập nhật nếu cần

---

## 3. Quy Tắc Nghiệp Vụ UI

### 3.1. State Management

- Sử dụng **TanStack Query** (React Query) cho toàn bộ fetching/mutation.
- Mutations: `useMutation` → gọi PATCH `/api/v1/inboxes/:id` để update `settings.aiCommercePolicy`.
- **Auto-save pattern**: Mỗi field thay đổi → gọi mutation riêng → toast thành công/lỗi.
- Cache invalidation: invalidate inbox query khi save thành công.

### 3.2. Tái sử dụng Shadcn UI

- Switch: `@/components/ui/switch`
- Select: `@/components/ui/select`
- Textarea: `@/components/ui/textarea`
- NumberInput: `@/components/ui/input` type="number"
- Badge: `@/components/ui/badge`
- Button: `@/components/ui/button`
- Card: `@/components/ui/card`
- Field: `@/components/ui/field`
- Kiểm tra `src/components/ui/` trước khi tạo component mới.

### 3.3. Responsive & A11y

- Settings UI responsive trên tablet + desktop
- Labels associate đúng với inputs (`htmlFor`)
- Toast notifications (Sonner) khi auto-save thành công/lỗi

### 3.4. Realtime Updates

- Khi nhân viên bấm Takeover → WebSocket broadcast `conversation.updated`
- Tin nhắn AI xuất hiện real-time qua WebSocket (existing flow)
- Badge AI/Human cập nhật real-time khi trạng thái thay đổi

---

## 4. API Endpoints

### Endpoints hiện có (đã sẵn sàng)

| Method | Endpoint | Ghi chú |
|---|---|---|
| `PATCH` | `/api/v1/inboxes/:id` | Update `settings.aiCommercePolicy` — schema đã có `enabled`, `customInstructions`, `personaTone`, `maxDiscountPercent`, `maxDiscountVnd` |
| `POST` | `/api/v1/conversations/:id/takeover` | Set `isAiPaused = true`, emit `conversation.updated` — **đã implement sẵn trên backend** |

### Endpoints mới

_Không cần endpoint mới._ Comment Guard update đã đi qua `PATCH /api/v1/inboxes/:id` với payload `channelSettings.commentGuard`.

---

## 5. Tiêu Chí Nghiệm Thu

### AI Settings UI
- [ ] Tab "AI Agent" xuất hiện trong Inbox Detail
- [ ] Toggle Autopilot bật/tắt → auto-save → AI hoạt động/dừng tương ứng
- [ ] Toggle bị block khi `workspace.settings.paymentSettings` chưa cấu hình → hiện inline error
- [ ] Persona tone select → 4 options với label + subtitle → auto-save
- [ ] Custom Instructions textarea → max 2000 ký tự → debounce auto-save
- [ ] Discount fields → validate range → auto-save
- [ ] Kho + TK ngân hàng hiển thị read-only từ workspace settings

### Comment Guard UI
- [ ] Nút "Khôi phục mặc định" hoạt động cho cả private + public reply template
- [ ] Layout responsive, consistent với các tab khác

### Conversation UI
- [ ] Badge "🤖 AI" nhỏ trên avatar tin nhắn AI (chỉ internal view)
- [ ] Nút "Tiếp quản từ AI" hoạt động → `isAiPaused = true` → badge đổi sang "👤 Nhân viên"
- [ ] Không có nút "Resume AI" (takeover một chiều)
- [ ] Real-time: tin nhắn AI xuất hiện + badge cập nhật không cần refresh
- [ ] Info card AI stats trong Detail Panel sidebar

### Codebase Quality
- [ ] Xóa key i18n sót `conversations.aiAutofill`
- [ ] Tất cả components dùng Shadcn UI primitives
- [ ] TanStack Query cho mọi API calls (không `useEffect` fetch thủ công)
- [ ] Design tokens: `bg-background`, `text-foreground`, `text-primary`
