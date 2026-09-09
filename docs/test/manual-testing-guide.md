# Tài Liệu Tổng Hợp Tính Năng, Use Cases & Kịch Bản Manual Test Chi Tiết (Sales Copilot Platform)

> **Dành cho**: QA / Tester / Product Owner & Kỹ sư phát triển  
> **Phiên bản hệ thống**: Phase 1 Baseline (Omnichannel Core) & Phase 2 (Sales Intelligence, POS & In-Chat Commerce)  
> **Ngày cập nhật**: 09/09/2026  
> **Vị trí file**: [`docs/test/manual-testing-guide.md`](../../docs/test/manual-testing-guide.md)

---

## 📌 MỤC LỤC
1. [Môi trường & Dữ liệu mẫu chuẩn bị sẵn (Prerequisites)](#1-môi-trường--dữ-liệu-mẫu-chuẩn-bị-sẵn-prerequisites)
2. [Tổng hợp Phân hệ Tính năng & Danh mục Use Cases](#2-tổng-hợp-phân-hệ-tính-năng--danh-mục-use-cases)
   - [Phân hệ 1: Quản trị Workspace & Phân quyền RBAC](#21-phân-hệ-1-quản-trị-workspace--phân-quyền-rbac)
   - [Phân hệ 2: Live Chat Đa kênh & Trực quan hóa Hội thoại](#22-phân-hệ-2-live-chat-đa-kênh--trực-quan-hóa-hội-thoại)
   - [Phân hệ 3: Khung Soạn thảo Kép & Tin nhắn mẫu Canned Responses](#23-phân-hệ-3-khung-soạn-thảo-kép--tin-nhắn-mẫu-canned-responses)
   - [Phân hệ 4: Trợ lý AI Copilot (Dock, Drawer & Streaming)](#24-phân-hệ-4-trợ-lý-ai-copilot-dock-drawer--streaming)
   - [Phân hệ 5: Bán hàng Trực tiếp trong Chat POS (In-Chat Commerce)](#25-phân-hệ-5-bán-hàng-trực-tiếp-trong-chat-pos-in-chat-commerce)
   - [Phân hệ 6: Thanh toán VietQR & Đối soát Ngân hàng Webhook](#26-phân-hệ-6-thanh-toán-vietqr--đối-soát-ngân-hàng-webhook)
   - [Phân hệ 7: Sổ cái Bằng chứng BANT & Điểm Lead Score](#27-phân-hệ-7-sổ-cái-bằng-chứng-bant--điểm-lead-score)
3. [Bộ Kịch Bản Manual Test Chi Tiết Theo Luồng Thực Tế](#3-bộ-kịch-bản-manual-test-chi-tiết-theo-luồng-thực-tế)
   - [Kịch bản 1: Đăng nhập 1-Click, Phiên HttpOnly & RBAC Protection](#kịch-bản-1-đăng-nhập-1-click-phiên-httponly--rbac-protection)
   - [Kịch bản 2: Live Chat Realtime, Typing Indicator & Tải ảnh Lightbox](#kịch-bản-2-live-chat-realtime-typing-indicator--tải-ảnh-lightbox)
   - [Kịch bản 3: Khung soạn thảo kép, Ghi chú nội bộ bí mật & Phím tắt `/`](#kịch-bản-3-khung-soạn-thảo-kép-ghi-chú-nội-bộ-bí-mật--phím-tắt-)
   - [Kịch bản 4: Trợ lý Copilot Dock, Drawer, Battlecards & AI Streaming](#kịch-bản-4-trợ-lý-copilot-dock-drawer-battlecards--ai-streaming)
   - [Kịch bản 5: Bán hàng POS (`F4`), AI Autofill & Khóa va chạm (Collision Lock)](#kịch-bản-5-bán-hàng-pos-f4-ai-autofill--khóa-va-chạm-collision-lock)
   - [Kịch bản 6: Quản lý Tồn kho & Chống bán vượt (Anti-Overselling Model A)](#kịch-bản-6-quản-lý-tồn-kho--chống-bán-vượt-anti-overselling-model-a)
   - [Kịch bản 7: Thanh toán VietQR & Đối soát Webhook Ngân hàng](#kịch-bản-7-thanh-toán-vietqr--đối-soát-webhook-ngân-hàng)
   - [Kịch bản 8: Quản lý Bằng chứng BANT & Điểm Lead Score trên Tab Bán hàng](#kịch-bản-8-quản-lý-bằng-chứng-bant--điểm-lead-score-trên-tab-bán-hàng)
4. [Radar Săn Bug & Các Tình Huống Thử Thách Biên (Bug-Hunting Radar)](#4-radar-săn-bug--các-tình-huống-thử-thách-biên-bug-hunting-radar)
5. [Biểu Mẫu Chuẩn Ghi Nhận Bug Dành Cho AI Coding Agent](#5-biểu-mẫu-chuẩn-ghi-nhận-bug-dành-cho-ai-coding-agent)

---

## 1. Môi Trường & Dữ Liệu Mẫu Chuẩn Bị Sẵn (Prerequisites)

Dự án đã được tích hợp sẵn toàn bộ dữ liệu mẫu trong file seed [`apps/server/prisma/seed.ts`](../../apps/server/prisma/seed.ts). Trước khi tiến hành kiểm thử, bạn chỉ cần thực hiện 2 bước sau:

### Bước 1: Khởi động dịch vụ nền tảng & Seed dữ liệu
```powershell
# 1. Khởi động Docker containers (PostgreSQL, Redis, MinIO)
docker compose -f docker-compose.dev.yml up -d

# 2. Nạp dữ liệu mẫu hoàn chỉnh (Users, Workspace, Products, Inventory, Bank, Leads, BANT)
pnpm db:seed

# 3. Khởi động ứng dụng
pnpm dev
```

### Bước 2: Bảng tra cứu dữ liệu mẫu đã seed sẵn
| Loại dữ liệu | Giá trị kiểm thử sẵn có | Ghi chú |
| :--- | :--- | :--- |
| **Workspace** | Tên: `Sales Copilot Default Workspace`<br>Slug: `default-workspace` | Slug định tuyến mặc định trên URL |
| **Tài khoản Agent** | `agent@salescopilot.io` / `SalesCopilot@2026!` | Nút bấm 1-Click trên trang `/login` |
| **Tài khoản Admin** | `admin@salescopilot.io` / `SalesCopilot@2026!` | Dùng để test phân quyền RBAC |
| **Tài khoản Owner** | `superadmin@salescopilot.io` / `SalesCopilot@2026!` | Quyền lực cao nhất trong workspace |
| **Sản phẩm 1 (POS)** | `PROD-AO-THUN-BASIC`: Áo thun Polo Basic Cotton (Giá: 250k) | 2 Biến thể (Size M, L / Trắng, Đen) - Tồn 100 |
| **Sản phẩm 2 (POS)** | `PROD-QUAN-JEAN-SLIM`: Quần Jean Nam Slimfit (Giá: 450k) | 2 Biến thể (Size 30, 32 / Indigo) - Tồn 50 |
| **Sản phẩm 3 (POS)** | `PROD-AO-SO-MI-OXFORD`: Áo Sơ mi Oxford Dài tay (Giá: 380k) | 2 Biến thể (Size M, L / Xanh Pastel) - Tồn 40 |
| **Cấu hình Ngân hàng** | Ngân hàng: **MBBank** (`bankBin: 970422`, `bankCode: MB`)<br>STK: `0988123456`<br>Tên TK: `CONG TY SALES COPILOT` | Đã cấu hình sẵn trong `workspace.settings` |
| **Webhook Secret** | `sepay_test_secret_key_2026` | Dùng trong header `secure-token` khi giả lập Webhook SePay |
| **Lead & BANT có sẵn** | Khách hàng `Nguyễn Văn A` liên kết sẵn Lead `#6a8e6889`, 4 bằng chứng BANT, Điểm: **85 (HOT)** | Hiển thị sẵn trên tab Bán hàng & BANT |

---

## 2. Tổng Hợp Phân Hệ Tính Năng & Danh Mục Use Cases

### 2.1. Phân hệ 1: Quản trị Workspace & Phân quyền RBAC
- **Tính năng**:
  - Đăng nhập 1-Click tiện lợi qua thanh chọn tài khoản mẫu, lưu trữ phiên qua cặp Cookie `HttpOnly` an toàn (`access_token`, `refresh_token`).
  - Đảm bảo tính cô lập dữ liệu đa người thuê (Multi-Tenancy Scoping): Mọi truy vấn Prisma bắt buộc kẹp `workspaceId`.
  - Phân quyền RBAC 4 cấp độ: `OWNER`, `ADMIN`, `AGENT`, `VIEWER`.
  - Quản trị thành viên Workspace ([`settings/members`](../../apps/web/src/app/(dashboard)/[workspaceSlug]/settings/members/page.tsx)) và đội nhóm trực tuyến ([`settings/teams`](../../apps/web/src/app/(dashboard)/[workspaceSlug]/settings/teams/page.tsx)).
- **Danh mục Use Cases**:
  - `UC-AUTH-01`: Đăng nhập nhanh bằng tài khoản thử nghiệm có sẵn với vai trò Agent.
  - `UC-RBAC-02`: Agent bị chặn bởi `SettingsGuard` khi cố tình truy cập trang Cài đặt quản trị.
  - `UC-RBAC-03`: Quản trị viên (Admin) mời thành viên mới qua email và gán vào Đội nhóm.

### 2.2. Phân hệ 2: Live Chat Đa kênh & Trực quan hóa Hội thoại
- **Tính năng**:
  - Bố cục làm việc 3 cột chuyên nghiệp: Danh mục Hội thoại | Khung Tin nhắn Trung tâm | Chi tiết Khách hàng & POS ([`conversation-layout.tsx`](../../apps/web/src/features/conversations/conversation-layout.tsx)).
  - Kết nối thời gian thực qua WebSocket (`Socket.io`), đồng bộ trạng thái `PENDING` ➔ `SENT` ➔ `DELIVERED` ➔ `READ`.
  - Xem file đính kèm, Rich Link Preview và xem ảnh phóng to bằng Lightbox Carousel ([`image-lightbox-dialog.tsx`](../../apps/web/src/features/conversations/image-lightbox-dialog.tsx)).
  - Thanh phím tắt gắn nhãn nhanh ([`QuickTagActionBar`](../../apps/web/src/features/conversations/quick-tag-action-bar.tsx)): Chuyển Priority, Status, gán tag `VIP`, `BOM_HANG` ngay trên composer.
- **Danh mục Use Cases**:
  - `UC-CHAT-01`: Khách gửi tin nhắn từ Web Widget/API, Agent nhận tức thì không cần tải lại trang.
  - `UC-CHAT-02`: Agent trả lời tin nhắn, theo dõi trạng thái gửi đi và hiển thị typing indicator.
  - `UC-CHAT-03`: Kéo thả ảnh trực tiếp vào khung chat, mở xem phóng to bằng Carousel.

### 2.3. Phân hệ 3: Khung Soạn thảo Kép & Tin nhắn mẫu Canned Responses
- **Tính năng**:
  - Khung soạn thảo kép (Dual-Mode Composer - [`chat-composer.tsx`](../../apps/web/src/features/composer/chat-composer.tsx)):
    - **Chế độ Phản hồi (Reply)**: Gửi tin nhắn ra ngoài cho khách hàng.
    - **Chế độ Ghi chú nội bộ (Private Note)**: Khung viền vàng nổi bật, icon ổ khóa; Outbound listener ([`outbound-message.listener.ts:96`](../../apps/server/src/integrations/outbound-message.listener.ts#L96)) chặn tuyệt đối không phát tán ra kênh bên ngoài.
  - Phím tắt Slash Picker (`/`): Gõ `/` tìm kiếm tin nhắn mẫu ([`canned-response-picker.tsx`](../../apps/web/src/features/composer/canned-response-picker.tsx)), hỗ trợ thế biến động `{{contact.name}}`.
- **Danh mục Use Cases**:
  - `UC-COMP-01`: Agent gõ `/chao` chèn lời chào chuẩn hóa có tự động điền tên khách.
  - `UC-COMP-02`: Agent chuyển sang chế độ Note để ghi chú riêng cho ca trực sau mà khách không hề biết.

### 2.4. Phân hệ 4: Trợ lý AI Copilot (Dock, Drawer & Streaming)
- **Tính năng**:
  - **Copilot Dock** ([`copilot-dock.tsx`](../../apps/web/src/features/copilot/components/copilot-dock.tsx)): Thanh đề xuất nổi trên Composer, hiển thị % match và nút chèn nhanh vào chat.
  - **Copilot Drawer** ([`copilot-drawer.tsx`](../../apps/web/src/features/copilot/components/copilot-drawer.tsx)):
    - Bản thảo câu trả lời thông minh (`ReplyDraftCard`).
    - Hành động tiếp theo (`ActionCard`): Chứa nút mở dialog [`ConvertOpportunityDialog`](../../apps/web/src/features/copilot/components/convert-opportunity-dialog.tsx).
    - Cẩm nang đối ứng (`BattlecardCard`): Lập luận xử lý từ chối giá và so sánh đối thủ.
    - AI Custom Streaming ([`use-copilot-stream.ts`](../../apps/web/src/features/copilot/hooks/use-copilot-stream.ts)): Gõ prompt tùy ý, nhận văn bản stream thời gian thực qua WebSocket.
- **Danh mục Use Cases**:
  - `UC-AI-01`: Áp dụng câu trả lời thông minh từ Copilot Dock chỉ với 1 click.
  - `UC-AI-02`: Mở Drawer, nhập yêu cầu tùy biến và xem văn bản dạng gõ chữ trực tiếp.
  - `UC-AI-03`: Chuyển đổi Lead sang Cơ hội bán hàng (Opportunity) từ Action Card.

### 2.5. Phân hệ 5: Bán hàng Trực tiếp trong Chat POS (In-Chat Commerce)
- **Tính năng**:
  - Khởi tạo đơn hàng tức thì bằng phím tắt **`F4`** ([`pos-drawer.tsx`](../../apps/web/src/features/pos/components/pos-drawer.tsx)).
  - **AI Autofill Banner** ([`ai-autofill-banner.tsx`](../../apps/web/src/features/pos/components/ai-autofill-banner.tsx)): Bóc tách SĐT, nhận diện nhà mạng, phân giải địa chỉ 3 cấp (Tỉnh/Huyện/Xã) và sản phẩm từ câu chat của khách (confidence >= 80%).
  - **Khóa chống va chạm (Redis Collision Lock)** ([`use-pos-collision.ts`](../../apps/web/src/features/pos/hooks/use-pos-collision.ts)): Khóa trượt 30 giây khi có nhân viên mở POS; hiển thị cảnh báo đỏ và cung cấp nút **Cướp quyền (Takeover)** nếu có người khác đang mở.
  - **Quản lý Tồn kho nguyên tử (Anti-Overselling Model A)**: Giữ kho khi xác nhận đơn (`reservedQuantity`), trừ kho khi thanh toán, hoàn kho khi đơn bị hủy.
  - **In Hóa Đơn Nhiệt Chuẩn Hóa** ([`thermal-print-dialog.tsx`](../../apps/web/src/features/pos/components/thermal-print-dialog.tsx)): Hóa đơn bán lẻ **K58 (58mm)** và Phiếu vận đơn **K80 (80mm)** có mã vạch Code128 SVG.
- **Danh mục Use Cases**:
  - `UC-POS-01`: Bấm Áp dụng từ AI Autofill Banner để tự điền form tạo đơn hàng.
  - `UC-POS-02`: Khóa chống va chạm kích hoạt khi 2 nhân viên cùng mở POS trong 1 cuộc trò chuyện.
  - `UC-POS-03`: Xác nhận đơn hàng, kiểm tra giữ kho và in bill nhiệt K58/K80.

### 2.6. Phân hệ 6: Thanh toán VietQR & Đối soát Ngân hàng Webhook
- **Tính năng**:
  - Sinh mã VietQR động chuẩn EMVCo NAPAS 24/7 ([`vietqr.service.ts`](../../apps/server/src/modules/pos/payments/vietqr.service.ts)) kẹp sẵn cú pháp memo `ORD <displayId>`.
  - Thẻ thanh toán tương tác trong Chat ([`vietqr-chat-card.tsx`](../../apps/web/src/features/pos/components/vietqr-chat-card.tsx)): Bắn thẻ QR vào hội thoại cho khách hàng.
  - Webhook đối soát tự động (SePay, Casso) qua BullMQ ([`pos-reconciliation.processor.ts`](../../apps/server/src/modules/pos/reconciliation/pos-reconciliation.processor.ts)): Fast-ACK `< 50ms`, kiểm tra Idempotency chống trừ kho 2 lần, tự động gạch nợ đơn sang `PAID` và cập nhật tồn kho.
- **Danh mục Use Cases**:
  - `UC-PAY-01`: Agent bấm gửi thẻ VietQR vào cuộc trò chuyện cho khách hàng.
  - `UC-PAY-02`: Ngân hàng bắn Webhook giao dịch, hệ thống tự động gạch nợ đơn đã thanh toán.

### 2.7. Phân hệ 7: Sổ cái Bằng chứng BANT & Điểm Lead Score
- **Tính năng**:
  - Tab chuyên biệt "Bán hàng & BANT" (`SalesEvidenceTab`) trên panel bên phải của màn hình hội thoại ([`detail-panel.tsx`](../../apps/web/src/features/conversations/detail-panel.tsx)).
  - **Thẻ Điểm số Lead Score**: Điểm số lớn, xếp loại huy hiệu (`HOT >= 70`, `WARM >= 40`, `COLD < 40`), giai đoạn Lead (`LeadStage`) và thanh đo trực quan kèm nút **Tính lại điểm (Recalculate)**.
  - **Ma trận BANT (BANT Matrix)**: Hiển thị trạng thái xác thực 4 tiêu chuẩn (Ngân sách - Thẩm quyền - Nhu cầu - Thời gian) với icon xanh lá khi đã có bằng chứng xác nhận.
  - **Danh sách Bằng chứng BANT**: Lọc theo `Tất cả` / `Chỉ BANT` / `Rủi ro`, hiển thị trích dẫn nguyên văn câu chat (`verbatim quote`) và độ tin cậy. Mỗi bằng chứng có nút **Hủy bỏ (Invalidate)** cho phép Agent tự tay loại trừ nếu AI phân tích nhầm.
- **Danh mục Use Cases**:
  - `UC-SALES-01`: Xem trạng thái xác thực BANT của khách hàng ngay trong lúc chat.
  - `UC-SALES-02`: Bấm nút Hủy bỏ (Invalidate) một bằng chứng AI phát hiện sai.
  - `UC-SALES-03`: Bấm nút Tính lại điểm Lead Score để cập nhật điểm mới nhất.

---

## 3. Bộ Kịch Bản Manual Test Chi Tiết Theo Luồng Thực Tế

### 🔹 Kịch bản 1: Đăng nhập 1-Click, Phiên HttpOnly & RBAC Protection
- **Mục tiêu**: Kiểm tra đăng nhập nhanh, cơ chế cookie bảo mật và bảo vệ phân quyền RBAC.
- **Các bước thực hiện**:
  1. Truy cập `http://localhost:3000/login`.
  2. Tại hàng nút *Tài khoản thử nghiệm nhanh (1-Click Fill)*, bấm chọn **Agent (Sarah Agent)**. Form tự điền `agent@salescopilot.io` / `SalesCopilot@2026!`.
  3. Bấm **Đăng nhập**. Trình duyệt chuyển hướng vào `/[workspaceSlug]/conversations`.
  4. Mở DevTools (`F12`) ➔ **Application** ➔ **Cookies**: Xác nhận có cookie `access_token` mang cờ `HttpOnly`.
  5. Thử gõ trực tiếp URL cài đặt: `http://localhost:3000/default-workspace/settings/general` hoặc `settings/members`.
     - *Kết quả mong đợi*: Bị `SettingsGuard` chặn lại với thông báo "Bạn không có quyền truy cập khu vực này".
  6. Đăng xuất, chọn đăng nhập bằng tài khoản **Admin (`admin@salescopilot.io`)**.
  7. Vào lại `settings/members`: Xác nhận danh sách thành viên hiển thị đầy đủ và nút **Mời thành viên mới** hoạt động bình thường.
  8. Mở tab ẩn danh (Incognito), gọi API không token: `curl http://localhost:8000/api/v1/conversations`.
     - *Kết quả mong đợi*: Nhận mã lỗi `401 Unauthorized`.

---

### 🔹 Kịch bản 2: Live Chat Realtime, Typing Indicator & Tải ảnh Lightbox
- **Mục tiêu**: Kiểm tra truyền nhận tin nhắn thời gian thực qua WebSocket, sự kiện đang gõ và hiển thị carousel ảnh.
- **Các bước thực hiện**:
  1. Mở 2 cửa sổ cạnh nhau:
     - **Cửa sổ A (Agent)**: Mở cuộc hội thoại của khách "Nguyễn Văn A".
     - **Cửa sổ B (Terminal giả lập khách chat)**:
       ```bash
       curl -X POST http://localhost:8000/api/v1/conversations/<CONVERSATION_ID>/messages \
         -H "Content-Type: application/json" \
         -H "Authorization: Bearer <AGENT_TOKEN>" \
         -d '{
           "content": "Shop tư vấn giúp mình mẫu áo polo nam size L nhé!",
           "senderType": "CONTACT",
           "messageType": "INCOMING"
         }'
       ```
  2. Quan sát cửa sổ A:
     - *Kết quả mong đợi*: Tin nhắn xuất hiện tức thì trong luồng chat **không cần reload trang**; cuộc hội thoại bên cột trái tự động nhảy lên đầu với nhãn thời gian "Vừa xong".
  3. Agent gõ nội dung vào ô chat:
     - Quan sát xem sự kiện báo đang soạn tin (`typing indicator`) có phản hồi không.
  4. Agent gửi tin nhắn trả lời:
     - Quan sát icon trạng thái cập nhật từ `PENDING` ➔ `SENT` ➔ `DELIVERED`.
  5. Kéo thả 1 ảnh vào khung chat và bấm gửi:
     - Ảnh hiển thị trong khung chat, bấm vào ảnh để kiểm tra **Lightbox Carousel** phóng to hình ảnh.

---

### 🔹 Kịch bản 3: Khung soạn thảo kép, Ghi chú nội bộ bí mật & Phím tắt `/`
- **Mục tiêu**: Đảm bảo Ghi chú nội bộ (Private Note) tuyệt đối không bị gửi ra ngoài và phím tắt `/` hoạt động chuẩn xác.
- **Các bước thực hiện**:
  1. Tại khung soạn thảo, chuyển sang chế độ **Ghi chú (Note)**:
     - Khung viền đổi sang màu vàng, xuất hiện icon ổ khóa và nhãn "Ghi chú nội bộ".
  2. Nhập nội dung: `"Khách tiềm năng, đang phân vân size L và XL"` và bấm Gửi.
     - *Kết quả mong đợi*: Tin nhắn hiển thị nền vàng có icon khóa trong luồng chat. Tại terminal backend kiểm tra log xác nhận tin nhắn bị chặn không gửi ra ngoài (`skip outbound message`).
  3. Chuyển lại sang chế độ **Phản hồi (Reply)**.
  4. Gõ ký tự `/` vào ô nhập tin nhắn:
     - Danh sách Canned Responses bật lên. Gõ `/chao` và nhấn `Enter`.
     - *Kết quả mong đợi*: Mẫu câu chào hiển thị và biến `{{contact.name}}` được thay thế chính xác bằng tên "Nguyễn Văn A".

---

### 🔹 Kịch bản 4: Trợ lý Copilot Dock, Drawer, Battlecards & AI Streaming
- **Mục tiêu**: Kiểm tra gợi ý trả lời thông minh của Copilot, cẩm nang đối ứng và luồng stream câu trả lời theo yêu cầu.
- **Yêu cầu môi trường**: Server có cấu hình `GEMINI_API_KEY` trong `.env`.
- **Các bước thực hiện**:
  1. Giả lập tin nhắn khách hỏi: `"Chính sách bảo hành và đổi trả của bên mình thế nào?"`.
  2. Quan sát thanh **Copilot Dock** nổi trên composer:
     - Hiển thị câu trả lời đề xuất cùng % tin cậy. Bấm nút **Chèn nhanh** để điền câu trả lời vào composer.
  3. Mở **Copilot Drawer** (bằng cách click vào dock hoặc icon Sparkles trên header):
     - Chuyển sang tab **Cẩm nang (Battlecards)**: Kiểm tra các thẻ gợi ý đối ứng xử lý từ chối.
     - Tại ô nhập lệnh tùy chỉnh (**Custom Instruction**), gõ: `"Tóm tắt chính sách đổi hàng trong 1 câu ngắn gọn 15 từ"` và bấm Gửi.
     - *Kết quả mong đợi*: Văn bản hiển thị dạng gõ chữ trực tiếp (Streaming qua WebSocket). Bấm **Chèn vào chat** để đưa nội dung vào khung nhập.

---

### 🔹 Kịch bản 5: Bán hàng POS (`F4`), AI Autofill & Khóa va chạm (Collision Lock)
- **Mục tiêu**: Kiểm tra bóc tách thông tin đơn hàng tự động, cơ chế khóa va chạm giữa các nhân viên và in bill nhiệt K58/K80.
- **Các bước thực hiện**:
  1. Giả lập tin nhắn khách hàng chốt đơn:
     `"Gửi cho anh 2 cái Áo thun Polo Basic Cotton về địa chỉ 88 Cầu Giấy, Phường Quan Hoa, Quận Cầu Giấy, Hà Nội. Người nhận Nguyễn Văn A, SĐT 0988123456"`
  2. Quan sát đầu luồng chat:
     - Banner **AI Autofill** xuất hiện với độ tin cậy `>= 80%`, hiển thị chuẩn xác Tên, SĐT (Viettel), Địa chỉ 3 cấp và Sản phẩm gợi ý.
  3. Bấm **Áp dụng vào POS (F4)**:
     - Ngăn kéo POS Drawer trượt ra từ bên phải với toàn bộ thông tin được tự động điền sẵn.
  4. Thử nghiệm **Khóa va chạm (Collision Lock)**:
     - Mở 1 trình duyệt khác đăng nhập bằng tài khoản khác (`superadmin@salescopilot.io`), truy cập cùng cuộc hội thoại đó và bấm `F4`.
     - *Kết quả mong đợi*: Tab thứ 2 hiển thị banner cảnh báo màu đỏ: "Đơn hàng đang được thao tác bởi Sarah Agent" và nút lưu bị vô hiệu hóa.
     - Tại tab thứ 2, bấm **Cướp quyền thao tác (Takeover)**: Quyền thao tác chuyển sang tab thứ 2; tab 1 nhận thông báo đã bị mất quyền.
  5. Nhập giảm giá 20.000đ, phí ship 30.000đ. Kiểm tra tổng tiền tính đúng: `(250.000 * 2) - 20.000 + 30.000 = 510.000đ`.
  6. Bấm **Tạo đơn hàng** (hoặc nhấn `Ctrl + Enter`):
     - Drawer tự động đóng lại, thông báo tạo đơn thành công hiển thị.
  7. Tại panel bên phải, chuyển sang **Tab Đơn POS (`PosDetailTab`)**:
     - Thấy đơn hàng `#ORD-...` vừa tạo hiển thị ở trạng thái `DRAFT`.
     - Bấm nút **Xác nhận đơn**: Trạng thái chuyển sang `CONFIRMED`, tồn kho chuyển vào trạng thái giữ hàng (`reservedQuantity`).
     - Bấm nút **In phiếu (Print)**: Hộp thoại `ThermalPrintDialog` hiện lên. Kiểm tra mẫu in **K58 (Hóa đơn)** và **K80 (Vận đơn)** có mã vạch Code128 SVG sắc nét.

---

### 🔹 Kịch bản 6: Quản lý Tồn kho & Chống bán vượt (Anti-Overselling Model A)
- **Mục tiêu**: Đảm bảo hệ thống không cho phép bán âm kho và tự động hoàn trả tồn giữ hàng khi hủy đơn.
- **Các bước thực hiện**:
  1. Kiểm tra sản phẩm có tồn khả dụng là 2 sản phẩm (`stockQuantity = 2`, `reservedQuantity = 0`).
  2. Tạo Đơn hàng 1 với số lượng = 2 ➔ Bấm **Xác nhận đơn (Confirm)**:
     - Tồn kho: `stockQuantity = 2`, `reservedQuantity = 2` (Tồn khả dụng = 0).
  3. Tạo tiếp Đơn hàng 2 với số lượng = 1 cho cùng sản phẩm đó ➔ Bấm **Xác nhận đơn**:
     - *Kết quả mong đợi*: Hệ thống trả về lỗi `409 Conflict` - `INSUFFICIENT_STOCK: Không đủ tồn kho khả dụng để xác nhận đơn`. Đơn giữ nguyên trạng thái `DRAFT`.
  4. Quay lại Đơn hàng 1, bấm **Hủy đơn hàng (Cancel Order)**, nhập lý do "Khách đổi ý":
     - Đơn 1 chuyển sang `CANCELLED`.
     - Tồn kho giữ hàng được hoàn lại: `reservedQuantity = 0` (Tồn khả dụng hồi phục = 2).
  5. Quay lại Đơn hàng 2 bấm Xác nhận đơn: Lần này xác nhận thành công.

---

### 🔹 Kịch bản 7: Thanh toán VietQR & Đối soát Webhook Ngân hàng
- **Mục tiêu**: Kiểm tra sinh mã VietQR động, gửi thẻ vào chat và gạch nợ tự động qua Webhook ngân hàng.
- **Các bước thực hiện**:
  1. Tại Tab Đơn POS của đơn hàng đã Confirm, bấm nút **Gửi VietQR**:
     - *Kết quả mong đợi*: Thẻ **VietQrChatCard** xuất hiện ngay trong luồng chat giữa Agent và khách hàng. Thẻ hiển thị mã QR, ngân hàng MBBank, số tài khoản `0988123456`, số tiền và nội dung chuyển khoản `ORD <displayId>`.
  2. Giả lập ngân hàng (SePay) bắn Webhook giao dịch thành công bằng cURL:
     ```bash
     curl -X POST http://localhost:8000/api/v1/workspaces/default-workspace/webhooks/payments/sepay \
       -H "Content-Type: application/json" \
       -H "secure-token: sepay_test_secret_key_2026" \
       -d '{
         "id": "trans_test_9999",
         "gateway": "MBBank",
         "transferAmount": 510000,
         "transferType": "in",
         "content": "ORD <DISPLAY_ID> Nguyen Van A thanh toan",
         "accountNumber": "0988123456"
       }'
     ```
  3. Quan sát kết quả:
     - API Webhook trả về `{ "success": true, "queued": true }`.
     - Worker `PosReconciliationProcessor` đối soát thành công: Đơn hàng chuyển sang `PAID`, `paymentStatus = PAID`.
     - Kho hàng tự động trừ kho thực tế (`stockQuantity` giảm, `reservedQuantity` giải phóng).
     - Trong luồng chat xuất hiện tin nhắn hệ thống xác nhận đã thanh toán thành công.
  4. Bắn lại đúng lệnh cURL trên một lần nữa (Kiểm tra Idempotency):
     - Hệ thống ghi nhận `DUPLICATE` và bỏ qua, không trừ kho lần hai.

---

### 🔹 Kịch bản 8: Quản lý Bằng chứng BANT & Điểm Lead Score trên Tab Bán hàng
- **Mục tiêu**: Kiểm tra hiển thị Ma trận BANT, thẻ Lead Score và thao tác Hủy bỏ (Invalidate) bằng chứng.
- **Các bước thực hiện**:
  1. Tại cột bên phải của màn hình hội thoại, chuyển sang **Tab thứ 3: Bán hàng & BANT (`SalesEvidenceTab`)**:
     - *Kết quả mong đợi*: 
       - Thẻ **LeadScoreCard** hiển thị điểm số (ví dụ: `85 HOT`), giai đoạn `DISCOVERY` và thanh tiến trình màu cam/đỏ.
       - Ma trận **BantMatrix** hiển thị 4 tiêu chuẩn với icon tích xanh xác nhận: Ngân sách (Budget), Thẩm quyền (Authority), Nhu cầu (Need), Thời gian (Timeline).
       - Danh sách **Bằng chứng bán hàng**: Hiển thị 4 bằng chứng BANT kèm trích dẫn nguyên văn câu chat (`verbatim quote`) và độ tin cậy (`confidence`).
  2. Bấm vào bộ lọc: Chọn **Chỉ BANT** hoặc **Rủi ro**:
     - Danh sách bằng chứng được lọc theo đúng danh mục đã chọn.
  3. Tại một bằng chứng (ví dụ `BUDGET_CONFIRMED`), bấm nút **Hủy bỏ (Invalidate)**:
     - Hệ thống gọi API hủy bằng chứng. Thẻ bằng chứng hiển thị trạng thái đã bị gạch bỏ/vô hiệu hóa.
     - Ma trận BANT tự động cập nhật tiêu chí Ngân sách thành chưa xác thực.
  4. Bấm nút **Tính lại điểm (Recalculate)** trên thẻ Lead Score:
     - Hệ thống gửi yêu cầu tính lại điểm số, điểm mới được cập nhật sau khi đã loại trừ bằng chứng bị hủy.

---

## 4. Radar Săn Bug & Các Tình Huống Thử Thách Biên (Bug-Hunting Radar)

Khi thực hiện kiểm thử thủ công, hãy tập trung thử thách hệ thống bằng các tình huống biên sau:

1. **Bấm chuột liên tiếp (Rapid Double-click)**:
   - Thử bấm nhanh 3 lần liên tiếp vào nút "Tạo đơn hàng" hoặc nút "Xác nhận đơn" để xem hệ thống có cơ chế debounce/disable nút bấm hay bị tạo trùng 2 đơn / trừ kho 2 lần.
2. **Ký tự lạ & Tên Tỉnh/Thành viết tắt**:
   - Thử gửi tin nhắn địa chỉ với các cách viết dị biệt: "Sài Gòn", "TP.HCM", "HN", "Tỉnh BR-VT", "P. An Phú Q.2". Xem bộ parser `parseAddressHierarchy` có nhận diện đúng tỉnh/thành hay không.
3. **Mất kết nối mạng đột ngột**:
   - Mở màn hình chat, ngắt kết nối mạng 10 giây trong khi một tab khác gửi tin nhắn. Kết nối lại mạng và kiểm tra xem danh sách tin nhắn có tự động lấy lại các tin bị nhỡ hay không.
4. **Chuyển khoản thiếu tiền (Partially Paid)**:
   - Giả lập Webhook chuyển khoản số tiền nhỏ hơn tổng đơn (ví dụ đơn 500k nhưng khách chỉ chuyển 200k). Kiểm tra xem đơn có chuyển sang trạng thái `PARTIALLY_PAID` hay không và số tiền còn thiếu hiển thị như thế nào.
5. **Cướp quyền thao tác đồng thời (Concurrent Takeover)**:
   - Cho 2 tài khoản cùng mở 1 cuộc trò chuyện và cùng lúc bấm nút tạo đơn hoặc nút cướp quyền xem cơ chế Redis lock có xử lý phân giải xung đột mượt mà không.

---

## 5. Biểu Mẫu Chuẩn Ghi Nhận Bug Dành Cho AI Coding Agent

Khi bạn phát hiện lỗi trong quá trình kiểm thử, hãy copy mẫu dưới đây, điền thông tin và gửi lại cho AI Coding Agent để được định vị và sửa lỗi triệt để:

```markdown
### 🐞 BÁO CÁO LỖI / YÊU CẦU ĐIỀU CHỈNH

- **Kịch bản số**: (Ví dụ: Kịch bản 5 - Bán hàng POS / Kịch bản 7 - VietQR)
- **Mức độ nghiêm trọng**: [Critical - Chặn luồng] / [High - Lỗi chức năng] / [Medium - Sai lệch hiển thị] / [Low - Góp ý UI]
- **URL màn hình**: (Ví dụ: http://localhost:3000/default-workspace/conversations/conv-123)
- **Tài khoản test**: (Ví dụ: agent@salescopilot.io)

#### 1. Mô tả tóm tắt lỗi:
[Mô tả ngắn gọn hiện tượng xảy ra]

#### 2. Các bước tái hiện (Steps to Reproduce):
1. Bước 1: ...
2. Bước 2: ...
3. Bước 3: ...

#### 3. Kết quả thực tế (Actual Result):
[Điều gì xảy ra? Bị đơ, hiện thông báo lỗi gì, hoặc mã lỗi trong tab Network F12]

#### 4. Kết quả mong đợi (Expected Result):
[Hệ thống đáng lẽ phải hoạt động như thế nào]

#### 5. Logs hoặc Dữ liệu đính kèm (nếu có):
- Console Error / Network tab payload: ...
- File mã nguồn nghi ngờ (nếu biết): ...
```
