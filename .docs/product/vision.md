# Sales Copilot Platform — Product Vision

## 1. Vision & Strategy

Sales Copilot Platform là nền tảng hội thoại đa kênh (Omnichannel Conversation Platform) và hỗ trợ bán hàng thông minh (Sales Copilot) được thiết kế theo tư duy **Conversation-First**.

### Chiến lược 2 giai đoạn:
1. **Phase 1 (Active)**: Xây dựng nền tảng hội thoại đa kênh cốt lõi (Omnichannel Conversation Platform Core) lấy cảm hứng từ Chatwoot, tối ưu bằng NestJS và Next.js.
2. **Phase 2 (Future)**: Xây dựng lớp thông minh bán hàng (Sales Intelligence & AI Copilot) đặt trên nền tảng hội thoại đã hoàn thiện.

---

## 2. Product Principles

- **Conversation-first, không CRM-first**: Mọi tương tác, cơ hội và giá trị khách hàng đều bắt nguồn từ luồng giao tiếp trực tiếp.
- **Kế thừa có chọn lọc từ Chatwoot**: Tham khảo sâu về nghiệp vụ hội thoại, gán việc, và quản lý kênh của Chatwoot nhưng triển khai theo kiến trúc Clean / Modular Monolith hiện đại trong NestJS & TypeScript.
- **Bảo mật Multi-Tenant chuẩn mực**: Phân tách dữ liệu triệt để theo từng `Workspace`.
- **Ranh giới Domain rõ ràng**: Giữ các module độc lập, sẵn sàng mở rộng mà không tạo ra god-modules.
- **Phân tách giai đoạn nghiêm ngặt**: Không triển khai trước các entity/service của Phase 2 khi Phase 1 chưa hoàn thiện.

---

## 3. Product Flow (Phase 1)

```text
Customer
   │ (Nhắn tin qua Web Chat, Messenger, Zalo, Telegram)
   ▼
Channel Ingestion Pipeline
   │
   ▼
Inbox (Hộp thư tiếp nhận 1:1 với Channel)
   │
   ▼
Contact & ChannelIdentity Resolution
   │
   ▼
Conversation & Message Threading
   │
   ▼
Team / Agent Assignment (Round-Robin & Manual)
   │
   ▼
Operations (Labels, Canned Responses, Automation Rules, Outbound Webhooks)
   │
   ▼
Realtime WebSocket Broadcasts to Next.js Agent Dashboard
```
