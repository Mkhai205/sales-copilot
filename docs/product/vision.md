# Sales Copilot Platform — Product Vision

## 1. Vision & Strategy

Sales Copilot Platform là nền tảng hội thoại khách hàng đa kênh (Omnichannel Conversation Platform) và hỗ trợ bán hàng thông minh (Sales Copilot) được thiết kế theo tư duy **Conversation-First**.

### Chiến lược phân kỳ 3 giai đoạn:
1. **Phase 1 (COMPLETED & FROZEN BASELINE)**: Xây dựng nền tảng hội thoại đa kênh cốt lõi (Omnichannel Conversation Platform Core) lấy cảm hứng từ Chatwoot, tối ưu bằng NestJS, Next.js, PostgreSQL (Prisma), Redis, MinIO và WebSockets. *(Đã nghiệm thu 100% với 1.277 tests).*
2. **Phase 2 (CURRENT ACTIVE SCOPE)**: Lớp thông minh bán hàng (Sales Intelligence & AI Copilot): Vòng đời Lead/Opportunity, tính điểm AI Lead Scoring có độ suy giảm theo thời gian (time-decay), trích xuất tín hiệu mua hàng & bằng chứng bán hàng (BANT), và Copilot Assistant Drawer.
3. **Phase 3 (FUTURE EXTENSIONS)**: Tác nhân bán hàng tự trị (Autonomous Sales Agents), tích hợp Voice/SIP qua WebRTC, và đồng bộ CRM ngoài (HubSpot, Salesforce).

---

## 2. Product Principles

- **Conversation-first, không CRM-first**: Mọi tương tác, cơ hội và giá trị khách hàng đều bắt nguồn từ luồng giao tiếp trực tiếp trong hội thoại.
- **Kế thừa có chọn lọc từ Chatwoot**: Tham khảo sâu về nghiệp vụ hội thoại, gán việc, và quản lý kênh của Chatwoot nhưng triển khai theo kiến trúc Pragmatic Modular Monolith hiện đại trong NestJS & TypeScript mà không vướng nợ kỹ thuật của Rails.
- **Bảo mật Multi-Tenant chuẩn mực**: Phân tách dữ liệu triệt để theo từng `Workspace`.
- **Ranh giới Domain rõ ràng**: Giữ các module độc lập, giao tiếp qua exported services, EventEmitter2 và BullMQ.
- **Phân tách giai đoạn nghiêm ngặt**: Không triển khai trước các entity/service của Phase 3 khi đang làm Phase 2.

---

## 3. Product Flow (End-to-End)

```text
Customer
   │ (Nhắn tin qua Web Chat, Messenger, Zalo, Telegram)
   ▼
Channel Ingestion Pipeline (Xác thực HMAC, chống trùng lặp ChannelEvent)
   │
   ▼
Inbox (Hộp thư tiếp nhận 1:1 với Channel)
   │
   ▼
Contact & ChannelIdentity Resolution (Khách hàng 3NF)
   │
   ▼
Conversation & Message Threading (OPEN, PENDING, RESOLVED, SNOOZED)
   │
   ├──► Team / Agent Auto-Assignment (Round-Robin online presence)
   │
   ├──► Operations (Labels, Canned Responses, Automation Rules, Outbound Webhooks)
   │
   ├──► Realtime WebSocket Broadcasts to Next.js Agent Dashboard
   │
   └──► (Phase 2 Active) Async Sales Intelligence (BullMQ):
         ├── BANT Evidence Extraction & Buying Signals
         ├── Dynamic Lead Scoring with 48h Time-Decay
         └── Next Best Action (NBA) Suggestions in Copilot Drawer
```
