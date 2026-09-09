# Sales Copilot Platform — Product Vision

## 1. Vision & Strategy

Sales Copilot Platform là nền tảng quản lý hội thoại đa kênh và bán hàng tự động thế hệ mới dành cho các thương hiệu **D2C & Bán Lẻ Mạng Xã Hội (Social Commerce)**, được xây dựng theo triết lý **"The Chat Conversation IS the Point of Sale" (Cuộc trò chuyện chính là Điểm bán hàng)**.

### Tuyên ngôn giá trị cốt lõi:
> Kế thừa toàn bộ công thái học chốt đơn siêu tốc của Pancake (hộp thư gộp đa kênh, phím tắt F4, chuẩn hóa địa chỉ 3 cấp, kết nối vận chuyển), nhưng tạo bước nhảy vọt với **Trí tuệ nhân tạo (AI-Native)**: Tự động tư vấn size, bóc tách địa chỉ 1-click, đàm phán giảm giá có kiểm soát và thu tiền tức thì qua **Dynamic VietQR** hoạt động 24/7 ngay cả khi nhân viên ngủ.

### Chiến lược phân kỳ hệ thống:
1. **Phase 1: Omnichannel Conversation Platform Core (COMPLETED BASELINE - 100%)**:
   - Hộp thư hội thoại đa kênh hợp nhất (Facebook Messenger, Instagram, Zalo OA, Telegram, Webchat).
   - Tiếp nhận webhook, mã hóa credentials AES-256-GCM, phân giải danh tính khách hàng 3NF.
   - Vòng đời hội thoại, tin nhắn realtime (Socket.io + Redis), phân công Round-Robin và tự động hóa.
   - ⛔ **QUY TẮC BẤT BIẾN**: Phase 1 APIs và contracts là nền móng vững chắc, tuyệt đối không refactor làm gãy baseline.
2. **Phase 2: Conversational Commerce & AI Auto-pilot POS (CURRENT ACTIVE SCOPE)**:
   - **Built-in In-Chat POS & Inventory**: Quản lý biến thể (Size/Màu), tồn kho khả dụng (<50ms), lên đơn trực tiếp trong khung chat với phím tắt F4.
   - **Dynamic VietQR & Instant Webhook Bank Reconciliation**: Render mã QR kèm số tiền và mã đơn, tự gạch nợ sang `PAID` trong <1s, xóa sổ vấn nạn hóa đơn chuyển khoản giả.
   - **AI NER 3-Tier Administrative Address Extraction**: Tự động bóc tách SĐT, Tên và chuẩn hóa Tỉnh - Huyện - Xã từ văn bản tự nhiên để điền đơn 1-click.
   - **24/7 Autonomous AI Auto-pilot & Discount Policy Engine**: Tự động tư vấn, chốt đơn nửa đêm (Midnight Checkout) và đàm phán mặc cả theo hạn mức chiết khấu an toàn của chủ shop.
   - **Anti-theft Comment Auto-masking**: Tự động ẩn bình luận chứa SĐT trong <1s chống cướp khách và gửi tin nhắn riêng (Private Message).
   - **Browser-based Thermal Printing**: In phiếu gửi nhiệt K80/K58 trực tiếp qua trình duyệt không độ trễ.
3. **Phase 3: Autonomous Scale & Advanced Operations (FUTURE ROADMAP - FROZEN)**:
   - Tác nhân bán hàng tự trị nâng cao, tích hợp Voice/SIP (WebRTC), và đồng bộ đa sàn TMĐT nâng cao (Shopee, TikTok Shop API 2 chiều).

---

## 2. Product Principles

1. **The Chat IS the Point of Sale**: Mọi thao tác kiểm tra tồn kho, tư vấn size, lấy địa chỉ, tạo đơn và thu tiền đều diễn ra ngay bên trong hội thoại mà không bao giờ phải chuyển tab sang ERP/POS ngoài.
2. **Ergonomic Speed & Zero-Context Switching**: Tốc độ là yếu tố sống còn của tỷ lệ chuyển đổi. Giao diện tối ưu hóa cho bàn phím (`F4`, phím tắt tag), tìm kiếm SKU dưới 50ms.
3. **AI-Native, Not Rigid Rule-Based**: Thay thế chatbot từ khóa cứng nhắc bằng mô hình ngôn ngữ lớn (LLM) hiểu ngữ cảnh tiếng Việt đời thường, teencode và tự động hóa chốt đơn 24/7.
4. **Guarded Autonomy (Tự động hóa có kiểm soát)**: AI Auto-pilot được cấp quyền đàm phán giảm giá/freeship nhưng luôn tuân thủ nghiêm ngặt hạn mức an toàn của `DiscountPolicyEngine`.
5. **Multi-Tenancy & Data Privacy**: Đảm bảo phân tách dữ liệu tuyệt đối theo từng `workspaceId`. Quyền riêng tư của shop và khách hàng được bảo vệ nghiêm ngặt.

---

## 3. Product Flow (End-to-End D2C Social Selling)

```text
Khách hàng
   │ (Bình luận hoặc Nhắn tin qua Facebook, Zalo, Instagram, TikTok Shop)
   ▼
Inbound Ingestion Pipeline
   ├──► Nếu là Bình luận chứa SĐT: Tự động ẩn bình luận trong < 1s (Chống cướp khách) + Gửi Private Reply
   └──► Nếu là Tin nhắn: Đưa vào Unified Inbox & Kiểm tra trùng lặp ChannelEvent
         │
         ▼
Contact & ChannelIdentity Resolution (3NF)
         │
         ▼
Conversation Lifecycle & Routing:
   ├──► Ban ngày (Có nhân viên): Phân công Round-Robin + Bật Copilot gợi ý câu trả lời & F4 In-Chat POS
   └──► Ban đêm / Vắng người: Kích hoạt AI Auto-pilot 24/7
         │
         ▼
AI Auto-pilot 24/7 & In-Chat POS Execution:
   ├── 1. Tra cứu bảng size & Tồn kho SKU tức thì (< 50ms)
   ├── 2. Tư vấn mẫu mã & Đàm phán giảm giá theo Discount Policy Engine
   ├── 3. Bóc tách địa chỉ 3 cấp (AI NER) & Tự động tạo Đơn hàng (Draft Order)
   ├── 4. Khóa tạm tồn kho (Atomic Stock Reservation)
   └── 5. Render Thẻ Dynamic VietQR (NAPAS 247) đúng số tiền & mã đơn vào khung chat
         │
         ▼
Thanh toán & Giao vận:
   ├── Khách quét QR ➔ Webhook ngân hàng bắn về trong < 1s ➔ Đơn tự động chuyển sang PAID
   └── 08:00 Sáng: Nhân viên kho mở danh sách đơn PAID ➔ In hàng loạt phiếu gửi K80 ➔ Bàn giao GHTK/GHN
```
