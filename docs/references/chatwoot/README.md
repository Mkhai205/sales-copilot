# Chatwoot Reference Guide & Source Mapping

## 1. Mục đích & Vai trò của Chatwoot Reference

[Chatwoot](https://github.com/chatwoot/chatwoot) là nguồn tham chiếu chuẩn về **Quy tắc nghiệp vụ (Business Logic)** và **Hành vi sản phẩm (Product Behavior)** cho nền tảng hội thoại đa kênh của Sales Copilot Platform (Phase 1 Baseline).

Toàn bộ mã nguồn Chatwoot được tham khảo trực tuyến tại:
🔗 **[Chatwoot Official Repository (GitHub)](https://github.com/chatwoot/chatwoot/tree/develop)**

---

## 2. Bản đồ đối chiếu mã nguồn Chatwoot ──► Sales Copilot (Phase 1)

Khi cần đối soát hoặc tham khảo nghiệp vụ, bạn có thể tra cứu các file tương ứng trên repository của Chatwoot:

| Nghiệp vụ | Chatwoot Reference Path (GitHub) | Trọng tâm cần tham khảo |
| :--- | :--- | :--- |
| **Contact Identity & Merge** | [`app/actions/contact_identify_action.rb`](https://github.com/chatwoot/chatwoot/blob/develop/app/actions/contact_identify_action.rb)<br>[`app/actions/contact_merge_action.rb`](https://github.com/chatwoot/chatwoot/blob/develop/app/actions/contact_merge_action.rb) | Thuật toán đối soát Contact theo thứ tự `identifier > email > phone_number` và quy trình gộp Contact trong database transaction. |
| **Conversation State Machine** | [`app/models/conversation.rb`](https://github.com/chatwoot/chatwoot/blob/develop/app/models/conversation.rb) | Các trạng thái `OPEN`, `RESOLVED`, `PENDING`, `SNOOZED`, sự kiện tự động reopen khi khách hàng nhắn tin lại. |
| **Round-Robin Auto-Assignment** | [`app/services/auto_assignment/`](https://github.com/chatwoot/chatwoot/tree/develop/app/services/auto_assignment) | Thuật toán luân phiên gán hội thoại cho các Agent đang online trong Inbox. |
| **Inboxes & Channel Bindings** | [`app/models/inbox.rb`](https://github.com/chatwoot/chatwoot/blob/develop/app/models/inbox.rb)<br>[`app/models/channel/`](https://github.com/chatwoot/chatwoot/tree/develop/app/models/channel) | Cách tổ chức 1:1 giữa Inbox và Channel, tách biệt logic của từng kênh (Facebook, Web Widget, Email). |
| **Webhook Ingestion** | [`app/controllers/webhooks/`](https://github.com/chatwoot/chatwoot/tree/develop/app/controllers/webhooks) | Cách xác thực chữ ký webhook, chuẩn hóa payload tin nhắn và xử lý bất đồng bộ. |
| **Outbound Webhooks** | [`app/models/webhook.rb`](https://github.com/chatwoot/chatwoot/blob/develop/app/models/webhook.rb)<br>[`app/listeners/webhook_listener.rb`](https://github.com/chatwoot/chatwoot/blob/develop/app/listeners/webhook_listener.rb) | Cơ chế dispatch webhook sự kiện cho bên thứ 3 và retry khi thất bại. |
| **Canned Responses & Labels** | [`app/models/canned_response.rb`](https://github.com/chatwoot/chatwoot/blob/develop/app/models/canned_response.rb)<br>[`app/models/label.rb`](https://github.com/chatwoot/chatwoot/blob/develop/app/models/label.rb) | Quản lý câu trả lời mẫu theo shortcode và nhãn hội thoại. |

---

## 3. Nguyên tắc "Học nghiệp vụ — Không copy code"

1. **Hiểu nghiệp vụ (Business Behavior)**: Tìm hiểu cách Chatwoot giải quyết vấn đề thực tế (ví dụ: gán việc, chống trùng tin nhắn, xử lý webhook).
2. **Không sao chép máy móc**:
   - KHÔNG chuyển đổi trực tiếp Ruby ActiveRecord callbacks/concerns sang NestJS.
   - KHÔNG đưa các dependency của Ruby/Rails vào TypeScript.
3. **Hiện thực theo chuẩn Sales Copilot**:
   - Sử dụng Pragmatic Modular Monolith (Services + Prisma Client).
   - Sử dụng PostgreSQL 16 + Redis 7 + MinIO S3.
   - Tuân thủ nghiêm ngặt các quy tắc trong `AGENTS.md`.

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
