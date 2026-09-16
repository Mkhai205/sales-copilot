# Kiến Trúc Dữ Liệu & Tích Hợp Đa Kênh (Data & Integrations)

> **Tài liệu**: Đặc Tả Kiến Trúc Lưu Trữ Dữ Liệu & Tích Hợp Đối Tác (Data & Partner Integration Blueprint)  
> **Dự án**: Sales Copilot Platform  
> **Vị trí file**: `docs/architecture/02-data-and-integrations.md`  
> **Trạng thái**: Đã phê duyệt (Approved Baseline)  

---

## 1. Cơ Sở Dữ Liệu Quan Hệ (PostgreSQL 16 & Prisma ORM)

PostgreSQL là nguồn chân lý (Source of Truth) duy nhất cho toàn bộ dữ liệu giao dịch nghiệp vụ, đảm bảo tính toàn vẹn dữ liệu (ACID).

### 1.1. Chiến Lược Cách Ly Đa Người Thuê (Multi-Tenancy Isolation)
1. **Khóa Ngoại Bắt Buộc**: Mọi bảng dữ liệu vận hành thuộc doanh nghiệp bắt buộc phải có cột `workspaceId` tham chiếu đến `Workspace.id` với hành vi xóa nối tầng (`onDelete: Cascade`).
2. **Quy Tắc Truy Vấn An Toàn**:
   - ❌ **Tuyệt đối cấm**: `prisma.order.findUnique({ where: { id } })`
   - ✅ **Bắt buộc kẹp tenant**: `prisma.order.findFirst({ where: { id, workspaceId } })` hoặc `prisma.order.findUnique({ where: { workspaceId_id: { workspaceId, id } } })`
3. **Chỉ Mục Hợp Thành (Composite Unique & Indexes)**:
   Mọi ràng buộc duy nhất và chỉ mục tìm kiếm chính đều bắt đầu bằng `workspaceId`:
   - `Contact`: `@@unique([workspaceId, identifier])`
   - `Conversation`: `@@unique([workspaceId, displayId])`
   - `Product`: `@@unique([workspaceId, sku])`, `@@unique([workspaceId, slug])`
   - `ProductVariant`: `@@unique([workspaceId, sku])`, `@@index([workspaceId, productId])`
   - `Order`: `@@unique([workspaceId, orderNumber])`, `@@index([workspaceId, status])`, `@@index([workspaceId, paymentStatus])`
   - `ChannelIdentity`: `@@unique([channelId, externalContactId])`
   - `ChannelEvent`: `@@unique([channelId, externalEventId])` (chống ghi nhận trùng sự kiện webhook)

---

## 2. Bộ Nhớ Đệm & Đồng Bộ Phân Tán (Redis 7)

Redis được sử dụng chuyên trách cho 4 mục đích hiệu năng cao:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       KHÔNG GIAN KHÓA REDIS (NAMESPACES)                    │
├──────────────────────────────────────┬──────────────────────────────────────┤
│ 1. Distributed Locks (Khóa Phân Tán) │ 2. Presence & Online State           │
│    • lock:order:{wsId}:{convId}      │    • presence:workspace_{wsId}       │
│      (TTL = 30s, chống va chạm Commerce)  │      (Set các Agent đang online)     │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ 3. 2-Tier Cache (Bộ Đệm Cấu Hình)    │ 4. Message Queues (Hàng Đợi BullMQ)  │
│    • system:settings:{key}           │    • bull:ai-autopilot:*             │
│    • system:settings:all (Hash Map)  │    • bull:webhook-delivery:*         │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

- **WebSocket Multi-Node Pub/Sub**: Socket.io Redis Adapter giúp đồng bộ tức thì các sự kiện tin nhắn mới, badge `order.paid` giữa các instance server mà không bị nghẽn.
- **Khóa Trượt Chống Va Chạm (Sliding Lock)**: Thiết lập TTL = 30s khi nhân viên mở khung lên đơn; heartbeat gửi từ client mỗi 15s để gia hạn khóa; tự động giải phóng khi đóng cửa sổ.

---

## 3. Lưu Trữ Tệp Đa Phương Tiện (MinIO S3)

Toàn bộ hình ảnh sản phẩm, ảnh chụp thẻ VietQR, tệp đính kèm tin nhắn (video, voice note, tài liệu) được lưu trữ tập trung tại MinIO S3 Object Storage:

- **Bucket**: `sales-copilot-attachments`
- **Cấu trúc Thư mục**:
  ```text
  /{workspaceId}/
  ├── products/{productId}/{variantId}_{filename}.webp
  ├── orders/{orderId}/vietqr_card.png
  └── messages/{conversationId}/{year}/{month}/{fileUuid}_{filename}
  ```
- **Bảo mật**: Các tệp tin nhạy cảm trong tin nhắn riêng tư chỉ được truy cập thông qua **Pre-signed URL** có thời hạn (15 phút).

---

## 4. Chuẩn Adapter Tích Hợp Đa Kênh (Channel Adapters)

Mọi nền tảng nhắn tin bên ngoài (Facebook Messenger, Zalo OA, Webchat, Telegram) đều được đóng gói chuẩn hóa qua interface `ChannelAdapter`:

```typescript
export interface ChannelAdapter {
  readonly channelType: ChannelType;

  // Xác thực chữ ký webhook từ Meta / Zalo / Telegram
  verifyWebhookSignature(headers: Record<string, string>, rawBody: Buffer, channel: Channel): boolean;

  // Chuẩn hóa payload ngoại vi thành cấu trúc tin nhắn nội bộ chung
  normalizeInboundEvent(payload: Record<string, unknown>, channel: Channel): IngestedMessagePayload[];

  // Gửi tin nhắn ra kênh ngoài
  sendOutboundMessage(channel: Channel, payload: SendMessagePayload): Promise<{ externalMessageId: string }>;

  // Đồng bộ hồ sơ khách hàng (Avatar, Tên)
  fetchContactProfile(channel: Channel, externalContactId: string): Promise<{ name?: string; avatarUrl?: string }>;
}
```

### Chính Sách Bảo Mật Khóa Kênh (Credential Encryption):
- Toàn bộ bí mật xác thực lưu trong `Channel.credentials` (Page Access Token, App Secret, Refresh Token) **BẮT BUỘC phải mã hóa AES-256-GCM** trước khi lưu vào CSDL.
- Khóa mã hóa chủ (`ENCRYPTION_MASTER_KEY`) lưu trong biến môi trường bảo mật, tuyệt đối không commit lên Git repository.
- Dữ liệu credentials khi trả về API cho client bắt buộc phải bị che (`***`).

---

## 5. Động Cơ Bắn Webhook Ra Ngoài (Outbound Webhooks)

Cho phép doanh nghiệp đồng bộ dữ liệu đơn hàng và khách hàng sang các hệ thống nội bộ của shop theo thời gian thực:

- **Sự kiện hỗ trợ**: `order.created`, `order.paid`, `order.cancelled`, `conversation.created`, `contact.created`.
- **Mã hóa Xác thực Chữ ký**: Mỗi request gửi đi kẹp header `X-SalesCopilot-Signature` tạo từ thuật toán **HMAC-SHA256** với `WebhookSubscription.secretKey`.
- **Chiến Lược Thử Lại Lũy Thừa (Exponential Backoff via BullMQ)**:
  - Lần 1: Ngay lập tức
  - Lần 2: +1 phút
  - Lần 3: +5 phút
  - Lần 4: +30 phút
  - Lần 5: +2 giờ ➔ Nếu vẫn thất bại, chuyển trạng thái `EXHAUSTED` và thông báo quản trị viên.
