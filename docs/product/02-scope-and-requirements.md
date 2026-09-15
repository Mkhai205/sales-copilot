# Phạm Vi Hệ Thống & Ma Trận Yêu Cầu (Scope & Requirements Matrix)

> **Tài liệu**: Đặc tả Phạm vi & Ma trận Yêu cầu Sản phẩm (Single Source of Truth)\
> \*\***Dự án**: Sales Copilot Platform\
> \*\***Vị trí file**: `docs/product/02-scope-and-requirements.md`\
> \*\***Thay thế cho**: `scope.md` và `requirements.md`\
> \*\***Trạng thái**: Đã phê duyệt (Approved Baseline)

---

## 1. Lộ Trình Phân Kỳ Hệ Thống (Scope Phasing)

### 1.1. Phase 1: Omnichannel Conversation Platform Core (COMPLETED BASELINE)

- **Trạng thái**: **100% Hoàn thành & Đã nghiệm thu** ([Biên bản nghiệm thu](../audit/phase-1-completion-signoff.md) với 1.277 tests pass, 0 lỗi TypeScript).
- **Phạm vi**:
  - Đa người thuê (Multi-Tenancy) với mã định danh bắt buộc `workspaceId`.
  - Tiếp nhận đa kênh (Web Chat, Facebook Messenger, Zalo OA, Telegram).
  - Khử trùng lặp và phân giải danh tính khách hàng 3NF (`Contacts`, `ChannelIdentities`).
  - Vòng đời hội thoại (`OPEN`, `PENDING`, `RESOLVED`, `SNOOZED`), tin nhắn văn bản, đa phương tiện và ghi chú nội bộ (`isPrivate`).
  - Phân công tự động Round-Robin, Tin nhắn mẫu (`Canned Responses`), Động cơ tự động hóa (`Automation Rules`), Webhook bắn ra ngoài và Socket.io Realtime.
- ⛔ **QUY TẮC BẤT BIẾN**: Phase 1 APIs, schemas và contracts là nền tảng đóng băng, **tuyệt đối không refactor hoặc thay đổi làm phá vỡ baseline**.

### 1.2. Phase 2: D2C Conversational Commerce & AI Auto-pilot POS (CURRENT ACTIVE SCOPE)

- **Trạng thái**: **Đang triển khai tích cực** ([Master Backlog](../backlog/README.md)).
- **Phân rã thực thi**:
  - **Milestone 2A (Commerce Core - Ưu tiên số 1)**:
    - Ngăn kéo bán hàng In-Chat POS & Quản lý tồn kho biến thể SKU (&lt;50ms).
    - Quản lý Danh mục & Kho hàng: Biến thể SKU, Nhập hàng (`Stock In`), Kiểm kê cân bằng kho và Sổ cái biến động kho.
    - Quản trị Bán hàng & Đơn hàng: Danh sách đơn toàn workspace, lọc trạng thái, xử lý giao vận và tự động hoàn tồn khi hủy đơn.
    - Khóa tạm tồn kho nguyên tử (`Atomic Stock Reservation`) chống bán vượt (Anti-Overselling).
    - Tạo mã Dynamic VietQR (NAPAS 247) tự động và Đối soát Webhook ngân hàng tức thì (&lt; 1s qua SePay/Casso).
    - Khóa chống va chạm đa nhân viên (Redis 30s Sliding Lock).
  - **Milestone 2B (AI Automation - Ưu tiên số 2)**:
    - 24/7 AI Auto-pilot & Guarded Discount Policy Engine (Cung cấp cơ chế thiết lập linh hoạt: 24/7 toàn thời gian, Ngoài giờ làm việc, hoặc Cứu cánh khi quá tải; tự động tư vấn size, kiểm tra tồn kho, đàm phán giảm giá an toàn, tích hợp AI NER bóc tách địa chỉ 3 cấp và tự chốt đơn).
    - Ẩn bình luận chứa SĐT theo thời gian thực (&lt; 1s) chống đối thủ cướp khách và tự động kéo khách vào Inbox.

---

## 2. Ma Trận Yêu Cầu Chức Năng (Functional Requirements - FR)

### 2.1. Phân hệ 1: Multi-Tenancy & Phân Quyền (Phase 1 Baseline)

| Mã FR | Tên yêu cầu | Chi tiết kỹ thuật & Tiêu chí chấp nhận |
| --- | --- | --- |
| **FR-1.1** | Phân quyền 2 tầng | Tầng 1: `PlatformRole` (`SUPER_ADMIN`, `USER`). Tầng 2: `WorkspaceRole` (`OWNER`, `ADMIN`, `AGENT`, `VIEWER`). |
| **FR-1.2** | Cô lập Workspace | Mỗi user có thể thuộc nhiều Workspace với vai trò khác nhau. Mọi query nghiệp vụ bắt buộc có `where: { workspaceId }`. |
| **FR-1.3** | Đội nhóm (Teams) | Cho phép tạo Team trong Workspace và gán thành viên `TeamMember` phục vụ định tuyến phân công. |

### 2.2. Phân hệ 2: Ingestion Đa Kênh (Phase 1 Baseline)

| Mã FR | Tên yêu cầu | Chi tiết kỹ thuật & Tiêu chí chấp nhận |
| --- | --- | --- |
| **FR-2.1** | Gắn kết Kênh 1:1 | Mỗi `Channel` (Web Chat, Facebook, Zalo, Telegram) gắn kết 1:1 với một `Inbox`. |
| **FR-2.2** | Xác thực & Chống lặp | Xác thực chữ ký HMAC-SHA256 của Webhook bên ngoài; loại bỏ sự kiện trùng lặp qua bảng `ChannelEvent`. |
| **FR-2.3** | Mã hóa Credentials | Thông tin bí mật kết nối trong `Channel.credentials` phải được mã hóa AES-256-GCM khi lưu tại database. |

### 2.3. Phân hệ 3: Định Danh Khách Hàng (Phase 1 Baseline)

| Mã FR | Tên yêu cầu | Chi tiết kỹ thuật & Tiêu chí chấp nhận |
| --- | --- | --- |
| **FR-3.1** | Danh tính kênh (3NF) | Tự động tạo/tìm `ChannelIdentity` theo cặp `(channelId, externalContactId)`. |
| **FR-3.2** | Hợp nhất Contact | Một `Contact` có thể liên kết nhiều `ChannelIdentity` trên các mạng xã hội khác nhau. Hỗ trợ gộp khách hàng (Merge Contacts). |

### 2.4. Phân hệ 4: Hội Thoại & Nhắn Tin (Phase 1 Baseline)

| Mã FR | Tên yêu cầu | Chi tiết kỹ thuật & Tiêu chí chấp nhận |
| --- | --- | --- |
| **FR-4.1** | Vòng đời Hội thoại | Quản lý trạng thái: `OPEN` (đang xử lý), `PENDING` (chờ khách), `RESOLVED` (đã xong), `SNOOZED` (tạm hoãn). Tự động mở lại (`OPEN`) khi khách nhắn tin mới. |
| **FR-4.2** | Khung soạn thảo kép | Hỗ trợ 2 chế độ: Tin nhắn gửi khách (`isPrivate: false`) và Ghi chú nội bộ bí mật (`isPrivate: true` - viền vàng, chặn phát tán ra kênh ngoài). |
| **FR-4.3** | Đa phương tiện | Tải lên và lưu trữ hình ảnh, video, audio, file tài liệu qua MinIO S3 đính kèm tin nhắn. |
| **FR-4.4** | Trạng thái chuyển phát | Đồng bộ trạng thái tin nhắn thời gian thực: `PENDING` ➔ `SENT` ➔ `DELIVERED` ➔ `READ` ➔ `FAILED`. |

### 2.5. Phân hệ 5: Vận Hành & Tự Động Hóa (Phase 1 Baseline)

| Mã FR | Tên yêu cầu | Chi tiết kỹ thuật & Tiêu chí chấp nhận |
| --- | --- | --- |
| **FR-5.1** | Phân công Round-Robin | Tự động phân chia hội thoại đều cho các Agent đang Online trong Inbox theo vòng tròn luân phiên. |
| **FR-5.2** | Tin nhắn mẫu Slash (`/`) | Gõ phím `/` mở picker tìm nhanh câu trả lời mẫu theo mã shortcode, tự động điền biến động `{{contact.name}}`. |
| **FR-5.3** | Automation Rules | Động cơ đánh giá quy tắc khi có sự kiện hội thoại/tin nhắn để tự gán tag, đổi priority hoặc gán nhân viên. (xem xét loại bỏ) |
| **FR-5.4** | Outbound Webhooks | Phát tán sự kiện hệ thống ra ngoài (CRM/ERP riêng của shop) kèm cơ chế thử lại BullMQ Exponential Backoff. (xem xét loại bỏ) |

### 2.6. Phân hệ 6: Thương Mại Hội Thoại D2C, Quản Lý Kho & Đơn Hàng (Phase 2 Active)

| Mã FR | Tên yêu cầu | Chi tiết kỹ thuật & Tiêu chí chấp nhận |
| --- | --- | --- |
| **FR-6.1** | In-Chat POS | POS bên phải trong. Tìm kiếm sản phẩm theo SKU/tên trong. Quản lý biến thể (Size, Màu). |
| **FR-6.2** | Khóa Tồn kho Nguyên tử | Công thức: $\\text{Khả dụng} = \\text{Tồn kho vật lý} - \\text{Tồn kho tạm giữ}$. Khi tạo đơn hàng nháp, hệ thống lập tức khóa số lượng tương ứng trong DB Transaction chống bán vượt. |
| **FR-6.3** | Quản lý Kho & Danh mục | CRUD Sản phẩm & Biến thể SKU. Nghiệp vụ Nhập hàng (`Stock In`), Kiểm kê cân bằng kho (`Stock Adjustment`), Sổ cái biến động kho (`InventoryTransaction`) và cảnh báo an toàn tồn kho. |
| **FR-6.4** | Quản trị Đơn hàng (OMS) | Màn hình quản lý danh sách đơn hàng toàn workspace, lọc theo trạng thái thanh toán và giao vận, cập nhật mã vận đơn, hủy đơn tự động hoàn kho và báo cáo doanh thu cơ bản. |
| **FR-6.5** | Chống va chạm nhân viên | Redis Sliding Lock 30 giây khi có nhân viên mở POS. Hiển thị cảnh báo đỏ và nút "Cướp quyền" (Takeover) cho các nhân viên khác. |
| **FR-6.6** | Dynamic VietQR & Gạch nợ | Tự sinh mã QR chuẩn NAPAS 247 có kèm số tiền và mã `DH{code}`. Webhook ngân hàng SePay/Casso tự động đối soát và chuyển đơn sang `PAID` trong `< 1s`. |
| **FR-6.7** | AI NER Địa chỉ 3 cấp | Tự động bóc tách SĐT và chuẩn hóa Tỉnh/Huyện/Xã từ tin nhắn chat, điền vào form đơn hàng với 1 click (`Tab`). |
| **FR-6.8** | Cấu hình AI Auto-pilot & Policy Engine | Cung cấp 4 chế độ vận hành linh hoạt (`ALWAYS_ON` 24/7, `OFF_HOURS` ngoài giờ, `OVERFLOW` cứu cánh quá tải, `MANUAL` thủ công); tự động tư vấn size, đàm phán giá trong giới hạn an toàn `DiscountPolicyEngine` và tự động chốt đơn. |
| **FR-6.9** | Ẩn Comment Thời gian thực | Quét và ẩn bình luận chứa số điện thoại trên Fanpage chống cướp khách và gửi tin nhắn riêng mời vào chat. |

---

## 3. Ma Trận Yêu Cầu Phi Chức Năng (Non-Functional Requirements - NFR)

| Mã NFR | Danh mục | Yêu cầu & Tiêu chuẩn kỹ thuật |
| --- | --- | --- |
| **NFR-1** | **Thời gian thực (Latency)** | Độ trễ phát tán tin nhắn và trạng thái qua WebSocket đến Dashboard dưới **200ms**. Tra cứu danh mục sản phẩm dưới **50ms**. |
| **NFR-2** | **Ingestion Non-blocking** | Tiếp nhận Webhook từ Facebook/Zalo phản hồi HTTP 200 trong `< 100ms`; toàn bộ tác vụ AI NER, bóc tách đơn hàng và gửi webhook ra ngoài chạy bất đồng bộ qua hàng đợi BullMQ. |
| **NFR-3** | **Cô lập Tenant Tuyệt đối** | 100% các câu truy vấn cơ sở dữ liệu (Prisma) và phòng WebSocket (Socket.io) bắt buộc kẹp điều kiện `workspaceId`. |
| **NFR-4** | **Tính Bất biến & Kháng lặp (Idempotency)** | Đảm bảo xử lý an toàn (chống ghi nhận trùng đơn, chống cộng tiền thừa) khi webhook ngân hàng hoặc webhook kênh bên ngoài bắn lại nhiều lần. |
| **NFR-5** | **Bảo mật & Mã hóa Dữ liệu** | Tuyệt đối không lưu plaintext token/credentials; toàn bộ khóa kênh lưu trữ được mã hóa AES-256-GCM. Session người dùng lưu trữ qua cặp cookie `HttpOnly` an toàn (cấm lưu token tại `localStorage`). |
