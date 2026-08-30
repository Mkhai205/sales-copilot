# Chatwoot Reference Guide & Source Mapping

## 1. Mục đích & Vai trò của Chatwoot Reference

[Chatwoot](https://github.com/chatwoot/chatwoot) là nguồn tham chiếu chuẩn về **Quy tắc nghiệp vụ (Business Logic)** và **Hành vi sản phẩm (Product Behavior)** cho nền tảng hội thoại đa kênh của Sales Copilot Platform.

Mã nguồn Chatwoot đầy đủ đã được lưu trữ cục bộ tại:
📂 [`docs/references/chatwoot/source/`](./source/)

---

## 2. Bản đồ đối chiếu mã nguồn Chatwoot ──► Sales Copilot (Phase 1)

Khi triển khai các use case cho Phase 1, bạn có thể tra cứu mã nguồn Chatwoot tương ứng tại các đường dẫn sau:

| Nghiệp vụ Phase 1 | Chatwoot Reference Path | Trọng tâm cần tham khảo |
| :--- | :--- | :--- |
| **Contact Identity & Merge** | `docs/references/chatwoot/source/app/actions/contact_identify_action.rb`<br>`docs/references/chatwoot/source/app/actions/contact_merge_action.rb` | Thuật toán đối soát Contact theo thứ tự `identifier > email > phone_number` và quy trình gộp Contact trong transaction. |
| **Conversation State Machine** | `docs/references/chatwoot/source/app/models/conversation.rb` | Các trạng thái `OPEN`, `RESOLVED`, `PENDING`, `SNOOZED`, sự kiện tự động reopen khi khách hàng nhắn tin lại. |
| **Round-Robin Auto-Assignment** | `docs/references/chatwoot/source/app/services/auto_assignment/` | Thuật toán luân phiên gán hội thoại cho các Agent đang online trong Inbox. |
| **Inboxes & Channel Bindings** | `docs/references/chatwoot/source/app/models/inbox.rb`<br>`docs/references/chatwoot/source/app/models/channel/` | Cách tổ chức 1:1 giữa Inbox và Channel, tách biệt logic của từng kênh (Facebook, Web Widget, Email). |
| **Webhook Ingestion** | `docs/references/chatwoot/source/app/controllers/webhooks/` | Cách xác thực chữ ký webhook, chuẩn hóa payload tin nhắn và xử lý bất đồng bộ. |
| **Outbound Webhooks** | `docs/references/chatwoot/source/app/models/webhook.rb`<br>`docs/references/chatwoot/source/app/listeners/webhook_listener.rb` | Cơ chế dispatch webhook sự kiện cho bên thứ 3 và retry khi thất bại. |
| **Canned Responses & Labels** | `docs/references/chatwoot/source/app/models/canned_response.rb`<br>`docs/references/chatwoot/source/app/models/label.rb` | Quản lý câu trả lời mẫu theo shortcode và nhãn hội thoại. |

---

## 3. Nguyên tắc "Học nghiệp vụ — Không copy code"

1. **Hiểu nghiệp vụ (Business Behavior)**: Tìm hiểu cách Chatwoot giải quyết vấn đề thực tế (ví dụ: gán việc, chống trùng tin nhắn, xử lý webhook).
2. **Không sao chép máy móc**:
   - KHÔNG chuyển đổi trực tiếp Ruby ActiveRecord callbacks/concerns sang NestJS.
   - KHÔNG đưa các dependency của Ruby/Rails vào TypeScript.
3. **Hiện thực theo chuẩn Sales Copilot**:
   - Sử dụng Clean Architecture (Presentation ──► Application ──► Domain ◄── Infrastructure).
   - Sử dụng Prisma ORM + PostgreSQL 16 + TypeScript types chặt chẽ.
   - Sử dụng Redis 7 (Pub/Sub + BullMQ) cho Realtime & Background Queues.

---

## 4. Xử lý xung đột (Conflict Resolution)

Thứ tự ưu tiên khi có sự khác biệt:
```text
1. Yêu cầu sản phẩm hiện tại của Sales Copilot
   >
2. Kiến trúc & Quy chuẩn mã nguồn (AGENTS.md)
   >
3. Quyết định kiến trúc đã phê duyệt (ADR)
   >
4. Cách Chatwoot hiện thực trong mã nguồn Rails
```
