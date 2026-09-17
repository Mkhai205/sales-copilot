# Epic 3.2 — Commerce Tool Registry: 9 Tools Cho AI Agent

> **Mục tiêu**: Xây dựng bộ 9 Tools cho phép AI Agent tra cứu sản phẩm, bóc tách địa chỉ, đánh giá giảm giá, tạo đơn hàng, sinh VietQR, và escalate cho nhân viên — tất cả thông qua Vercel AI SDK tool calling.\
> **Tiên quyết**: Epic 3.1 (AI Agent Core)\
> **Ước lượng**: 2-3 tuần\
> **Tham chiếu**: [RFC Architecture §3.5 Tool Registry](../architecture/rfc-ai-agent-framework.md)

---

## 1. Mô Tả Tổng Quan

Epic 3.1 xây xong bộ khung Agent (loop + dispatch + worker). Epic này **gắn vũ khí** cho Agent — 9 tools tương tác với hệ thống Commerce, biến AI từ "chỉ biết nói" thành "biết làm": tra kho, tạo đơn, thu tiền.

**Kết quả mong đợi**: AI Agent có thể chạy user journey hoàn chỉnh — khách hỏi sản phẩm → AI tra kho → tư vấn → khách gửi địa chỉ → AI tạo đơn → sinh QR thanh toán → gửi cho khách. Tất cả tự động.

---

## 2. Danh Sách 9 Tools

### T1. `searchProducts` — Tìm kiếm sản phẩm

| Thuộc tính | Giá trị |
|---|---|
| **Mô tả cho LLM** | Tìm sản phẩm trong catalog cửa hàng theo tên hoặc từ khóa. Trả về danh sách tên, giá, tồn kho |
| **Input** | `{ query: string }` |
| **Output** | `Array<{ productId, name, basePrice, variants: [{ variantId, name, price, availableStock }] }>` |
| **Service gọi** | `ProductsService.search()` hoặc `ProductsService.findMany()` |
| **Read/Write** | Read |
| **Quy tắc** | - Tìm theo keyword trong tên sản phẩm + tên variant + SKU<br/>- Chỉ trả products `isActive: true`<br/>- Giới hạn 10 results<br/>- **BẮT BUỘC** có `workspaceId` trong where clause |

### T2. `getProductDetails` — Chi tiết sản phẩm

| Thuộc tính | Giá trị |
|---|---|
| **Mô tả cho LLM** | Lấy thông tin chi tiết của 1 sản phẩm: mô tả, tất cả biến thể (size, màu), giá từng biến thể, tồn kho, ảnh |
| **Input** | `{ productId: string }` |
| **Output** | `{ name, description, basePrice, images[], variants: [{ variantId, name, sku, price, availableStock }] }` |
| **Service gọi** | `ProductsService.findOne()` |
| **Read/Write** | Read |
| **Quy tắc** | - Trả đầy đủ variant + stock<br/>- Include ảnh sản phẩm (URL)<br/>- Return null nếu không tìm thấy |

### T3. `checkInventory` — Kiểm tra tồn kho

| Thuộc tính | Giá trị |
|---|---|
| **Mô tả cho LLM** | Kiểm tra số lượng tồn kho khả dụng cho 1 biến thể sản phẩm cụ thể |
| **Input** | `{ variantId: string }` |
| **Output** | `{ variantId, name, sku, availableStock: number, isInStock: boolean }` |
| **Service gọi** | `ProductsService.getVariant()` hoặc `InventoryLedgerService` |
| **Read/Write** | Read |
| **Quy tắc** | - `availableStock` = physical stock - reserved<br/>- `isInStock` = availableStock > 0 |

### T4. `extractShippingInfo` — Bóc tách thông tin giao hàng

| Thuộc tính | Giá trị |
|---|---|
| **Mô tả cho LLM** | Bóc tách tên người nhận, số điện thoại, và địa chỉ giao hàng (tỉnh/huyện/xã/đường) từ đoạn text tự do của khách |
| **Input** | `{ text: string }` |
| **Output** | `{ recipientName?, phoneNumber?, province?, district?, ward?, streetAddress?, confidence: number }` |
| **Logic bên trong** | **Hybrid 2-tier**:<br/>- **Tier 1 (fast path < 5ms)**: `address-parser.util.ts` — Regex SĐT Việt Nam + GSO 3 cấp (`vietnam-divisions-js`)<br/>- **Tier 2 (fallback)**: Nếu confidence < 70% → dùng Vercel AI SDK `generateObject()` với structured output để LLM extract |
| **Read/Write** | Read |
| **Quy tắc** | - Phone regex: `03x/05x/07x/08x/09x` + `+84`<br/>- Chuẩn hóa SĐT về 10 số<br/>- Address parse: Province → District → Ward → Street<br/>- Trả confidence score 0-100 |

### T5. `evaluateDiscount` — Đánh giá yêu cầu giảm giá

| Thuộc tính | Giá trị |
|---|---|
| **Mô tả cho LLM** | Kiểm tra xem một mức giảm giá có nằm trong hạn mức cho phép của shop hay không |
| **Input** | `{ orderTotal: number, requestedDiscount: number }` |
| **Output** | `{ approved: boolean, allowedDiscount: number, reason?: string }` |
| **Read/Write** | Read |
| **Quy tắc nghiệp vụ** | - `maxAllowed = min(orderTotal × maxDiscountPercent / 100, maxDiscountVnd)`<br/>- Nếu `requestedDiscount ≤ maxAllowed` → `approved: true`<br/>- Nếu vượt → `approved: false`, trả `allowedDiscount` (số tiền tối đa có thể giảm)<br/>- AI KHÔNG ĐƯỢC bypass — logic enforce ở tầng service, không tin LLM<br/>- Nếu shop không cấu hình discount → `maxAllowed = 0` (không giảm) |

### T6. `createDraftOrder` — Tạo đơn hàng nháp

| Thuộc tính | Giá trị |
|---|---|
| **Mô tả cho LLM** | Tạo đơn hàng DRAFT cho khách với các sản phẩm đã chọn. Tự động khóa tồn kho tạm thời |
| **Input** | `{ items: [{ variantId: string, quantity: number }], shippingAddress?: { ... }, contactPhone?: string, discountAmount?: number }` |
| **Output** | `{ orderId, orderNumber, totalAmount, status: 'DRAFT', items: [...] }` |
| **Service gọi** | `OrdersService.createOrder()` |
| **Read/Write** | **Write** |
| **Quy tắc** | - Gọi `InventoryLedgerService.reserveStock()` — atomic transaction<br/>- Nếu thiếu hàng → trả lỗi `{ error: 'INSUFFICIENT_STOCK', variantId, available }` (AI sẽ thông báo khách)<br/>- `discountAmount` phải ≤ `maxAllowed` (double-check lại, không tin tool trước đó)<br/>- Tạo/update Contact nếu có `contactPhone`<br/>- Link order → conversation (lưu `conversationId` vào order metadata) |

### T7. `confirmAndGenerateQR` — Xác nhận đơn + Sinh QR

| Thuộc tính | Giá trị |
|---|---|
| **Mô tả cho LLM** | Xác nhận đơn hàng và sinh mã QR thanh toán VietQR (NAPAS 247) để gửi cho khách |
| **Input** | `{ orderId: string }` |
| **Output** | `{ orderId, orderNumber, totalAmount, qrImageUrl: string, bankName, accountNumber }` |
| **Service gọi** | `OrdersService.confirmOrder()` + `VietQrService.generateQR()` |
| **Read/Write** | **Write** |
| **Quy tắc** | - Order phải ở trạng thái DRAFT → chuyển sang CONFIRMED<br/>- Dùng `defaultBankAccountId` từ aiCommercePolicy<br/>- QR theo chuẩn EMVCo VietQR, nội dung: `DH{orderNumber}`<br/>- Trả URL ảnh QR (MinIO/S3) để AI gửi kèm tin nhắn |

### T8. `updateContactInfo` — Cập nhật thông tin khách

| Thuộc tính | Giá trị |
|---|---|
| **Mô tả cho LLM** | Cập nhật thông tin khách hàng (tên, số điện thoại, địa chỉ) khi khách cung cấp trong chat |
| **Input** | `{ name?: string, phoneNumber?: string, address?: string }` |
| **Output** | `{ contactId, name, phoneNumber, address, updated: true }` |
| **Service gọi** | `ContactsService.update()` |
| **Read/Write** | **Write** |
| **Quy tắc** | - Chỉ cập nhật fields được cung cấp (partial update)<br/>- Chuẩn hóa SĐT trước khi lưu<br/>- Lookup contact từ conversation → `conversation.contactId` |

### T9. `escalateToHuman` — Chuyển cho nhân viên

| Thuộc tính | Giá trị |
|---|---|
| **Mô tả cho LLM** | Khi không thể xử lý yêu cầu của khách (quá phức tạp, khiếu nại, đổi trả, vấn đề kỹ thuật), chuyển conversation cho nhân viên con người |
| **Input** | `{ reason: string }` |
| **Output** | `{ escalated: true, message: "Đã chuyển cho nhân viên hỗ trợ" }` |
| **Read/Write** | **Write** |
| **Quy tắc** | - Set `conversation.isAiPaused = true`<br/>- Gửi notification cho workspace agents (WebSocket)<br/>- AI trả lời khách: "Em chuyển cho nhân viên hỗ trợ bạn nhé ạ 🙏"<br/>- Trigger Round-Robin assignment (nếu có agent online) |

---

## 3. Quy Tắc Chung Cho Toàn Bộ Tools

### 3.1. Multi-tenancy

- **`workspaceId` inject qua closure** — KHÔNG BAO GIỜ là tool parameter.
- LLM không biết `workspaceId` tồn tại → không thể cross-tenant.
- Mọi query Prisma trong tool PHẢI có `workspaceId` trong `where`.

### 3.2. Error Handling

- Tool KHÔNG throw exception → trả JSON error: `{ error: 'ERROR_CODE', message: 'Mô tả lỗi' }`.
- LLM nhận error context → tự xử lý (thông báo khách, thử lại, hoặc escalate).
- Ví dụ: `{ error: 'INSUFFICIENT_STOCK', message: 'Sản phẩm chỉ còn 2 cái, khách yêu cầu 5' }`.

### 3.3. Tool Description

- Mô tả phải cụ thể, không mơ hồ — Gemini dựa vào description để chọn tool.
- Mỗi parameter có `.describe()` giải thích ý nghĩa.
- Tổng 9 tools nằm trong giới hạn 10-20 tools khuyến nghị của Google.

### 3.4. Discount Double-Check

- Tool `evaluateDiscount` kiểm tra hạn mức → trả `allowedDiscount`.
- Tool `createDraftOrder` kiểm tra lại `discountAmount ≤ maxAllowed` → **double-check**, không tin kết quả LLM.
- Bất biến: `discountAmount ≤ min(orderTotal × maxPercent, maxVnd)` — enforce ở service layer.

---

## 4. User Journey Mẫu — Chốt Đơn Lúc 2h Sáng

```
Khách: "Áo polo trắng size L còn ko shop?"
  → AI gọi searchProducts("áo polo trắng size L")
  → Tìm thấy: Áo Polo Cotton, variant L Trắng, giá 150k, tồn 23

AI: "Dạ shop còn Áo Polo Cotton Trắng size L giá 150.000đ ạ 😊 Bạn cho shop địa chỉ nhận hàng nhé!"

Khách: "15 ngõ 45 Vọng, Đồng Tâm, HBT, HN. SĐT 0988123456"
  → AI gọi extractShippingInfo(text)
  → Tier 1: Phone 0988123456 ✓, Province: Hà Nội, District: Hai Bà Trưng, Ward: Đồng Tâm ✓
  → AI gọi updateContactInfo({ phone: "0988123456", name: ... })
  → AI gọi createDraftOrder({ items: [{ variantId, quantity: 1 }], shippingAddress: {...} })
  → Order #DH1042, tổng 180k (150k + 30k ship)
  → AI gọi confirmAndGenerateQR({ orderId })
  → QR image URL

AI: "Shop đã tạo đơn #DH1042 tổng 180.000đ (150k sản phẩm + 30k ship) 🎉
     Bạn quét mã QR bên dưới để thanh toán nhé! 🙏"
     [Ảnh QR VietQR]

(Bank webhook → auto reconcile → Order PAID → thông báo)
```

---

## 5. Tiêu Chí Nghiệm Thu

### Tools hoạt động đúng
- [ ] Mỗi tool có unit test cover happy path + error path
- [ ] `searchProducts` trả kết quả chính xác theo keyword, chỉ products `isActive`
- [ ] `extractShippingInfo` parse đúng SĐT + GSO 3 cấp (Tier 1), fallback LLM (Tier 2)
- [ ] `evaluateDiscount` enforce `min(total × %, maxVnd)` — không bao giờ approved vượt trần
- [ ] `createDraftOrder` atomic reserve stock — concurrent test không oversell
- [ ] `confirmAndGenerateQR` sinh QR đúng chuẩn EMVCo, có ảnh URL
- [ ] `escalateToHuman` set `isAiPaused = true` + notify agents

### Tool Registry tích hợp Agent
- [ ] 9 tools đăng ký vào `generateText({ tools: {...} })`
- [ ] Agent gọi đúng tool theo context (hỏi giá → searchProducts, gửi địa chỉ → extractShippingInfo)
- [ ] Agent loop hoàn thành user journey mẫu end-to-end

### Multi-tenancy
- [ ] Không tool nào có `workspaceId` trong parameter schema
- [ ] Mọi query bên trong tool đều có `workspaceId` trong `where`
- [ ] Test cross-tenant: Workspace A không truy cập được sản phẩm Workspace B

### Error Handling
- [ ] Stock hết → tool trả error → AI thông báo khách, suggest sản phẩm thay thế
- [ ] Discount vượt trần → tool trả `approved: false` → AI từ chối khéo
- [ ] Product không tồn tại → tool trả null → AI thông báo không tìm thấy
