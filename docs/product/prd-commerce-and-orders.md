# PRD: Phân Hệ Thương Mại D2C, Quản Lý Kho & Đơn Hàng (Milestone 2A)

> **Tài liệu**: Đặc tả Yêu cầu Sản phẩm & Thiết kế Trải nghiệm (PRD & UX Specs)  
> **Phân hệ**: Thương Mại D2C, Quản Lý Kho & Khung Lên Đơn Nhanh (D2C Commerce, Inventory & Quick Order)  
> **Dự án**: Sales Copilot Platform  
> **Vị trí file**: `docs/product/prd-commerce-and-orders.md`  
> **Trạng thái**: Đã phê duyệt (Approved Baseline)  
> **Tài liệu kỹ thuật đối ứng**: [`docs/architecture/rfc-commerce-and-orders.md`](../architecture/rfc-commerce-and-orders.md)  

---

## 1. Bối Cảnh & Mục Tiêu Nghiệp Vụ

### 1.1. Bối cảnh Bán lẻ Hội thoại tại Việt Nam

Trong mô hình bán lẻ D2C qua mạng xã hội (Facebook Messenger, Zalo OA, Instagram, TikTok Shop), hội thoại chat chính là điểm chuyển đổi doanh thu (**The Chat IS the Point of Conversion**).

Dựa trên khảo sát thực tế tại các shop thời trang, mỹ phẩm và đồ gia dụng:

- **Tốn thời gian**: Nhân viên bán hàng mất **1.5 đến 3 phút** cho mỗi đơn hàng nếu phải copy-paste thông tin sang phần mềm quản lý bên ngoài (Excel, phần mềm rời rạc).
- **Rủi ro đứt gãy thông tin kho**: Nhân viên chat không biết chính xác trong kho còn biến thể (size/màu) cụ thể hay không, dẫn đến tình trạng chốt đơn nhưng kho đã hết hàng.
- **Rủi ro bom hàng & fake bill**: Nhập sai địa chỉ hành chính khiến tỷ lệ hoàn hàng lên tới **15% - 25%**; chuyển khoản thủ công không đối soát tự động tạo kẽ hở cho hóa đơn giả mạo.
- **Rủi ro va chạm**: Nhiều nhân viên cùng trực chung một trang dẫn đến tư vấn trùng, tranh khách và tạo trùng đơn hàng.

### 1.2. Mục tiêu Phân hệ Thương Mại D2C (Commerce Subsystem)

Tích hợp một hệ sinh thái thương mại khép kín phục vụ bán lẻ D2C ngay trên cùng một nền tảng:

1. **Khung Lên Đơn Nhanh Trong Chat (In-Chat Quick Order)**: Cho phép nhân viên bán hàng hoặc AI Auto-pilot tra cứu tồn kho khả dụng (&lt;50ms), chọn biến thể SKU, lên đơn 1-click và gửi thẻ Dynamic VietQR trực tiếp vào hội thoại chat.
2. **Quản Lý Danh Mục & Kho Hàng Tinh Gọn (Mini Inventory & Catalog)**: Quản lý sản phẩm, biến thể (Size, Màu, SKU, Giá bán, Giá vốn), theo dõi tồn kho 3 trạng thái (Vật lý, Tạm giữ, Khả dụng), nghiệp vụ nhập kho (`Stock In`) và kiểm kê cân bằng kho (`Stock Adjustment`).
3. **Quản Trị Bán Hàng & Vòng Đời Đơn Hàng (Order Management - OMS)**: Màn hình quản lý tập trung toàn bộ đơn hàng phát sinh từ chat (`/orders`), lọc đa chiều theo trạng thái thanh toán (`PAID`, `UNPAID`), xử lý giao vận, và tự động hoàn trả tồn kho khi hủy đơn.
4. **Thanh toán Dynamic VietQR (NAPAS 247) & Đối Soát Webhook (&lt; 1s)**: Tự sinh mã QR chuẩn NAPAS 247 kèm số tiền và mã đơn `DH{code}`; webhook ngân hàng (SePay/Casso) tự động gạch nợ sang `PAID` và cập nhật thời gian thực.
5. **Khóa chống va chạm đa nhân viên (Redis Collision Lock)**: Khóa trượt 30 giây khi có nhân viên mở đơn hàng của hội thoại.

---

## 2. Các Nhóm Người Dùng (Personas & JTBD)

```mermaid
graph TD
    subgraph 4 Personas Cốt Lõi Phân Hệ Thương Mại
        P1[Tư Vấn Viên / Sales Agent]
        P2[Thủ Kho / Quản Lý Kho]
        P3[Quản Lý Kinh Doanh / Chủ Shop]
        P4[Khách Hàng Mua Sắm]
    end

    P1 -->|Cần tốc độ, tra size, lên đơn 1-click| F1[Khung Lên Đơn Quick Order]
    P1 -->|Cần cảnh báo va chạm, chống trùng đơn| F2[Khóa va chạm Redis 30s]
    P2 -->|Cần nhập hàng, kiểm kê, xem sổ biến động| F3[Quản lý Kho & Nhập Hàng /products]
    P3 -->|Cần kiểm soát đơn hàng, doanh thu, hủy hoàn tồn| [Quản lý Đơn Hàng /orders]
    P4 -->|Cần quét QR 1 chạm, nhận xác nhận tức thì| F5[Thẻ VietQR Tự Gạch Nợ]
```

### 2.1. Tư Vấn Viên (Chat Sales Agent)

- **Hồ sơ**: Trực 15 - 30 hội thoại cùng lúc trong giờ cao điểm. Đánh giá qua Doanh số (GMV), Tỷ lệ chốt đơn và Tốc độ phản hồi (&lt; 30s).
- **JTBD**: *"Khi khách đồng ý mua trong chat, tôi muốn tra cứu tồn kho size/màu trong 1 giây, chọn nhanh địa chỉ 3 cấp và gửi mã Dynamic VietQR để chốt xong đơn trong 15 giây mà không cần rời khỏi màn hình chat."*

### 2.2. Thủ Kho / Quản Lý Kho (Warehouse Specialist)

- **Hồ sơ**: Chịu trách nhiệm nhập hàng mới về, kiểm kê định kỳ và đóng gói đơn hàng.
- **JTBD**: *"Khi có lô hàng mới về, tôi muốn nhập kho nhanh theo biến thể SKU. Khi kiểm kê phát hiện hàng lỗi/hỏng, tôi muốn cân bằng tồn kho và xem được toàn bộ sổ cái biến động kho để đối soát minh bạch."*

### 2.3. Quản Lý Kinh Doanh / Chủ Shop (Sales Manager / Shop Owner)

- **Hồ sơ**: Điều hành doanh số, quản lý đội ngũ bán hàng và luồng tiền về tài khoản.
- **JTBD**: *"Tôi muốn có một màn hình quản lý đơn hàng tập trung để theo dõi đơn nào đã thanh toán qua VietQR, đơn nào chờ giao, doanh thu theo ngày và đảm bảo khi nhân viên hủy đơn thì hàng được tự động hoàn lại vào kho."*

### 2.4. Khách Hàng Mua Sắm (Social Buyer)

- **Hồ sơ**: Mua hàng qua Messenger/Zalo, có app Mobile Banking trên điện thoại.
- **JTBD**: *"Khi mua hàng, tôi muốn nhận được ảnh mã VietQR có sẵn số tiền và nội dung để quét chuyển khoản trong 3 giây và nhận được tin nhắn xác nhận tiền đã về ngay lập tức."*

---

## 3. Bản Đồ Hành Trình Nghiệp Vụ Khép Kín (End-to-End Lifecycle)

```mermaid
journey
    title Vòng Đời Khép Kín Từ Nhập Kho Đến Hoàn Tất Đơn Hàng
    section 1. Quản lý Kho
      Tạo sản phẩm & Biến thể (Size, Màu, SKU): 5: Quản lý Kho
      Nhập kho lô hàng mới (Stock In): 5: Quản lý Kho
      Hệ thống ghi nhận Tồn kho vật lý: 5: Hệ thống
    section 2. Tư vấn & Check kho
      Khách hỏi sản phẩm trong chat: 5: Khách hàng
      Nhân viên mở Khung Lên Đơn: 5: Nhân viên
      Hệ thống hiển thị Tồn kho khả dụng < 50ms: 5: Hệ thống
    section 3. Nhập liệu thông tin
      Khách gửi SĐT & địa chỉ: 5: Khách hàng
      Hệ thống nhận diện SĐT Regex < 5ms: 5: Hệ thống
      Chọn nhanh địa chỉ 3 cấp GSO (hoặc AI NER khi bật Auto-pilot): 5: Nhân viên, Hệ thống
    section 4. Tạo đơn & Khóa kho
      Nhân viên áp chiết khấu, bấm Tạo đơn: 5: Nhân viên
      Hệ thống khóa tồn kho nguyên tử trong DB Tx (reservedQuantity += Q): 5: Hệ thống
      Đơn hàng sinh mã #DH1042: 5: Hệ thống
    section 5. Sinh mã Dynamic VietQR
      Hệ thống sinh mã VietQR chuẩn NAPAS 247: 5: Hệ thống
      Gửi thẻ QR tương tác vào khung chat: 5: Nhân viên, Hệ thống
    section 6. Đối soát ngân hàng
      Khách quét QR trên app ngân hàng chuyển tiền: 5: Khách hàng
      Webhook SePay/Casso bắn về trong < 1s: 5: Hệ thống
      Đơn chuyển sang PAID & thông báo Realtime: 5: Hệ thống, Nhân viên
    section 7. Quản lý Đơn hàng & Vận chuyển
      Đơn hiển thị tại Danh sách Đơn hàng /orders: 5: Quản lý
      Gán mã vận đơn ĐVVC & chuyển sang SHIPPING: 5: Quản lý Kho
      Giao hàng hoàn tất COMPLETED (hoặc Hủy hoàn tồn): 5: Hệ thống
```

---

## 4. Đặc Tả Chi Tiết 8 Use Cases Cốt Lõi

Phân hệ được chia thành 3 nhóm năng lực gắn kết chặt chẽ:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│               PHÂN HỆ THƯƠNG MẠI HỘI THOẠI D2C (MILESTONE 2A)               │
├───────────────────────────────┬───────────────────────────────┬─────────────┤
│ Nhóm I: Khung Lên Đơn Trong   │ Nhóm II: Quản Lý Kho Hàng     │ Nhóm III:   │
│ Chat (In-Chat Quick Order )   │ (Catalog & Mini Inventory)    │ Quản Lý Đơn │
├───────────────────────────────┼───────────────────────────────┼─────────────┤
│ • UC1: Tra cứu biến thể & kho │ • UC6: Quản lý SP & Biến thể  │ • UC8:      │
│ • UC2: Bắt SĐT & Địa chỉ 3 cấp│ • UC7: Nhập hàng, Kiểm kho    │   Danh sách │
│ • UC3: Lên đơn & Khóa tồn kho │        & Sổ cái biến động     │   & Vòng đời│
│ • UC4: Sinh Dynamic VietQR    │        (InventoryTransaction) │   Đơn hàng  │
│ • UC5: Đối soát Webhook < 1s  │                               │             │
└───────────────────────────────┴───────────────────────────────┴─────────────┘
```

---

### NHÓM I: KHUNG LÊN ĐƠN TRONG CHAT (IN-CHAT QUICK ORDER )

#### 4.1. Use Case 1 (UC1): Tra Cứu Biến Thể & Tồn Kho Khả Dụng Trong Chat

- **Tác nhân**: Tư vấn viên bán hàng.
- **Quy tắc tính toán tồn kho**: $$\\text{Tồn kho Khả dụng (Available)} = \\text{Tồn kho Vật lý (Physical)} - \\text{Tồn kho Tạm giữ (Reserved)}$$
  - *Tồn kho Vật lý (*`stockQuantity`*)*: Số lượng thực tế trong kho.
  - *Tồn kho Tạm giữ (*`reservedQuantity`*)*: Số lượng đang giữ cho các đơn `DRAFT`, `CONFIRMED`, `PAID` đang chờ xuất kho.
  - *Tồn kho Khả dụng*: Số lượng thực tế được phép bán, ngăn chặn triệt để tình trạng bán vượt kho (overselling).
- **Huy hiệu trạng thái trực quan**:
  - `Còn hàng` (Badge xanh lá): Khả dụng $\\ge 10$.
  - `Sắp hết` (Badge vàng cam): Khả dụng $1 \\dots 9$.
  - `Hết hàng` (Badge đỏ): Khả dụng $= 0$. Vô hiệu hóa thêm vào giỏ.
- **Hiệu năng**: Tìm kiếm client trên `cmdk` primitive với độ trễ `< 20ms`.

#### 4.2. Use Case 2 (UC2): Bóc Tách SĐT & Chuẩn Hóa Địa Chỉ Hành Chính 3 Cấp

- **Tác nhân**: Tư vấn viên (khi nhân viên trực tiếp xử lý) / AI Auto-pilot (khi ở chế độ 24/7, ngoài giờ làm việc hoặc khi quá tải).

- **Cơ chế xử lý phân luồng theo Chế độ Vận hành**:

  1. **Chế độ Nhân viên trực tiếp (100% Thao tác Bàn phím & Regex Siêu tốc)**:
     - **Số điện thoại**: Tự động nhận diện tức thì từ câu chat bằng Regex thuần túy (&lt; 5ms, 0 chi phí token).
     - **Địa chỉ 3 cấp (Tỉnh/Thành - Quận/Huyện - Phường/Xã)**: Nhân viên chọn siêu tốc qua combobox tìm kiếm tiền tố (Prefix Search &lt; 10ms trên cây hành chính GSO, hỗ trợ phím `Tab` / `Enter`). Hoàn toàn không gọi LLM để triệt tiêu độ trễ và tiết kiệm 100% token khi có nhân viên gõ máy.
  2. **Chế độ Tự động hóa (AI Auto-pilot - Milestone 2B)**:
     - Kích hoạt linh hoạt theo thiết lập của shop: Chạy 24/7 toàn thời gian (`ALWAYS_ON`), Ngoài giờ làm việc (`OFF_HOURS`), hoặc Cứu cánh khi quá tải tin nhắn (`OVERFLOW`).
     - AI Auto-pilot tự động kích hoạt mô hình Semantic NER (&lt; 1.2s) kết hợp Trie chuẩn hóa cây hành chính 3 cấp GSO (63 Tỉnh/TP, 705 Quận/Huyện, 10.600+ Phường/Xã).
     - Tự động điền đầy đủ Tên, SĐT, Địa chỉ chi tiết vào đơn hàng nháp mà không cần con người can thiệp.

- **Trải nghiệm UX (Autofill Banner)**: Khi tin nhắn của khách chứa thông tin liên lạc, trên đầu Khung Lên Đơn hiển thị Banner:

  > *"Phát hiện SĐT khách: 0987654321 \[Áp dụng - Phím Tab\]"* (khi nhân viên trực)\
  > hoặc tự động map 3 cấp vào đơn hàng (khi AI Auto-pilot tiếp quản).

#### 4.3. Use Case 3 (UC3): Lên Đơn Hàng Siêu Tốc 1-Click & Khóa Tồn Kho Nguyên Tử

- **Tác nhân**: Tư vấn viên.
- **Trải nghiệm giao diện**:
  - Giỏ hàng trực quan: Tăng/giảm số lượng, đổi size/màu biến thể.
  - Ô nhập chiết khấu linh hoạt: Theo phần trăm (%) hoặc số tiền cố định (VNĐ).
  - Tự động tính toán tổng tiền thanh toán: $$\\text{Tổng tiền} = \\text{Tiền hàng} - \\text{Giảm giá} + \\text{Phí vận chuyển}$$
- **Khóa tồn kho nguyên tử (Atomic Stock Reservation)**: Khi bấm "Tạo đơn hàng", backend mở một Database Transaction (`$transaction`):
  1. Sắp xếp các biến thể theo thứ tự `variantId` tăng dần (tránh deadlock `40P01`).
  2. Kiểm tra tồn kho khả dụng từng biến thể: $\\text{stockQuantity} - \\text{reservedQuantity} \\ge \\text{quantity}$.
  3. Nếu đủ hàng: Tăng `reservedQuantity` tương ứng và tạo đơn hàng ở trạng thái `DRAFT`.
  4. Nếu không đủ hàng: Rollback ngay lập tức và báo lỗi chính xác sản phẩm nào vừa hết hàng.

#### 4.4. Use Case 4 (UC4): Tạo Thẻ Dynamic VietQR (NAPAS 247)

- **Tác nhân**: Tư vấn viên & Hệ thống.
- **Quy cách mã QR**:
  - Chuẩn EMVCo / NAPAS 247 kết nối trực tiếp với tài khoản ngân hàng của shop đã cấu hình trong `workspace.settings`.
  - Mã QR động chứa chính xác:
    - Mã định danh ngân hàng (BIN) và Số tài khoản thụ hưởng.
    - Số tiền chính xác của đơn hàng (sau khi trừ chiết khấu).
    - Cú pháp nội dung chuyển khoản độc nhất: `DH{orderCode}` (Ví dụ: `DH1042`).
- **Thẻ tương tác trong Chat**:
  - Gửi thẳng thẻ hình ảnh QR chất lượng cao vào khung chat của khách.
  - Kèm nút bấm 1-chạm: "Sao chép STK", "Sao chép số tiền", "Sao chép nội dung".

#### 4.5. Use Case 5 (UC5): Đối Soát Webhook Ngân Hàng Tự Động (&lt; 1 Giây)

- **Tác nhân**: Webhook Ngân hàng (SePay / Casso) & Hệ thống.
- **Quy trình gạch nợ tự động**:
  1. Webhook ngân hàng gửi biến động số dư về endpoint `/api/v1/webhooks/bank`.
  2. Hệ thống xác thực bảo mật Token/HMAC.
  3. Bóc tách nội dung chuyển khoản tìm mã đơn dạng `DH\d+`.
  4. Khớp số tiền thực nhận (`amountIn`) với số tiền đơn hàng:
     - Nếu khớp $\\ge \\text{Tổng tiền}$: Cập nhật đơn sang `PAID`, ghi nhận bản ghi thanh toán `PaymentTransaction`.
     - Nếu nhỏ hơn: Chuyển sang `PARTIALLY_PAID` và cảnh báo nhân viên thu nốt phần thiếu.
  5. Phát tín hiệu WebSocket `order.paid` tới màn hình nhân viên:
     - Badge đơn hàng đổi sang màu xanh lá `ĐÃ THANH TOÁN`.
     - Thông báo toast Sonner chúc mừng.
     - Tự động gửi tin nhắn xác nhận đã nhận tiền vào khung chat cho khách hàng.

---

### NHÓM II: QUẢN LÝ KHO & DANH MỤC (CATALOG & MINI INVENTORY)

#### 4.6. Use Case 6 (UC6): Quản Lý Sản Phẩm & Biến Thể SKU

- **Tác nhân**: Quản lý kho, Chủ shop.
- **Giao diện**: Route quản lý sản phẩm (`/products`).
- **Năng lực quản lý**:
  - **Thông tin sản phẩm cha (**`Product`**)**: Tên sản phẩm, Danh mục (Category), Mô tả tóm tắt, Giá niêm yết cơ bản (`basePrice`), Giá vốn ước tính (`costPrice`), Bật/tắt theo dõi tồn kho (`trackInventory`).
  - **Quản lý biến thể (**`ProductVariant`**)**:
    - Thiết lập các thuộc tính biến thể: Kích thước (Size S, M, L, XL), Màu sắc (Đen, Trắng, Be, Xanh Navy).
    - Sinh mã SKU độc nhất tự động hoặc cho phép nhập tay (ví dụ: `POLO-DEN-L`).
    - Giá bán riêng biệt theo biến thể (nếu có chênh lệch giá giữa các size/màu).
    - Mã vạch Barcode phục vụ tìm kiếm nhanh.
  - **Bật/Tắt kinh doanh**: Cho phép ẩn biến thể hoặc tạm dừng kinh doanh sản phẩm mà không làm mất lịch sử đơn hàng cũ.

#### 4.7. Use Case 7 (UC7): Quản Trị Tồn Kho, Nhập Hàng & Sổ Cái Biến Động

- **Tác nhân**: Quản lý kho, Chủ shop.
- **Giao diện**: Tab Quản lý Kho (`/products/inventory`).
- **Cơ chế nghiệp vụ kho**:
  1. **Nhập kho nhanh (**`Quick Stock In`**)**:
     - Khi có kiện hàng mới về kho, thủ kho chọn biến thể SKU, nhập số lượng nhập và đơn giá vốn.
     - Hệ thống tăng `stockQuantity` tương ứng trong CSDL.
     - Tự động ghi lại bản ghi sổ cái `InventoryTransaction` với loại `PURCHASE_RECEIPT`, lưu rõ: số lượng thay đổi (+Q), tồn trước, tồn sau, nhân viên thực hiện.
  2. **Kiểm kê & Cân bằng kho (**`Stock Adjustment`**)**:
     - Khi kiểm kho định kỳ phát hiện lệch số lượng, hàng lỗi hoặc tặng mẫu: Thủ kho nhập số lượng tồn thực tế.
     - Bắt buộc chọn lý do: `DAMAGE` (Hỏng hóc), `LOSS` (Thất thoát), `SAMPLE` (Hàng tặng/mẫu), `INVENTORY_COUNT` (Lệch kiểm kê).
     - Hệ thống cập nhật `stockQuantity` và ghi sổ cái `InventoryTransaction` loại `STOCK_ADJUSTMENT`.
  3. **Cảnh báo an toàn tồn kho (Low Stock Warnings)**:
     - Badge cảnh báo màu vàng khi tồn kho khả dụng $\\le 5$.
     - Badge cảnh báo màu đỏ khi tồn kho khả dụng $= 0$.
     - Bộ lọc xem nhanh các mặt hàng đang "Sắp hết" hoặc "Cháy hàng" để thủ kho kịp thời lên kế hoạch nhập hàng.

---

### NHÓM III: QUẢN TRỊ BÁN HÀNG & ĐƠN HÀNG (SALES & ORDER MANAGEMENT - OMS)

#### 4.8. Use Case 8 (UC8): Danh Sách Đơn Hàng Toàn Diện & Xử Lý Vòng Đời

- **Tác nhân**: Chủ shop, Quản lý kinh doanh, Thủ kho.
- **Giao diện**: Route quản trị đơn hàng (`/orders`).
- **Năng lực quản lý**:
  1. **Bảng dữ liệu đơn hàng tập trung (Orders Data Table)**:
     - Hiển thị toàn bộ đơn hàng phát sinh từ Khung Lên Đơn Trong Chat và AI Auto-pilot trong Workspace.
     - Cột dữ liệu: Mã đơn (`orderNumber`), Khách hàng (Tên, SĐT), Giá trị đơn, Trạng thái thanh toán, Trạng thái đơn, Kênh bán / Hội thoại gốc, Nhân viên tạo đơn, Thời gian tạo.
  2. **Bộ lọc đa chiều phục vụ vận hành**:
     - Lọc theo Trạng thái thanh toán: `UNPAID` (Chưa thanh toán), `PARTIALLY_PAID` (Thiếu tiền), `PAID` (Đã thanh toán VietQR).
     - Lọc theo Vòng đời đơn: `DRAFT` ➔ `CONFIRMED` ➔ `PAID` ➔ `SHIPPING` ➔ `COMPLETED` ➔ `CANCELLED`.
     - Lọc theo khoảng thời gian (Hôm nay, 7 ngày qua, Tháng này).
  3. **Chi tiết đơn hàng & Lịch sử thanh toán**:
     - Xem danh sách chi tiết các mặt hàng trong đơn, số tiền chiết khấu, phí ship.
     - Lịch sử giao dịch ngân hàng (`PaymentTransaction`): Mã giao dịch, ngân hàng, số tiền thực nhận, thời điểm gạch nợ.
  4. **Xử lý Vận chuyển & Bàn giao ĐVVC**:
     - Nhập mã vận đơn (Tracking Code) khi giao cho ĐVVC (GHTK, GHN).
     - Chuyển trạng thái đơn sang `SHIPPING` và hoàn tất `COMPLETED` khi khách nhận hàng.
  5. **Hủy đơn & Tự động Hoàn Tồn Kho (Auto Stock Release)**:
     - Khi khách đổi ý hoặc không thanh toán: Nhân viên/Quản lý bấm "Hủy đơn" kèm lý do.
     - Hệ thống kích hoạt Database Transaction:
       - Đổi trạng thái đơn sang `CANCELLED`.
       - Giảm `reservedQuantity` của các biến thể tương ứng, hoàn trả lại số lượng khả dụng cho kho.
       - Ghi sổ cái `InventoryTransaction` loại `RESERVATION_RELEASE`.
  6. **Báo cáo Bán hàng Tinh gọn (Sales Snapshot)**:
     - Thống kê doanh thu theo ngày / tuần / tháng.
     - Tỷ lệ đơn đã thanh toán chuyển khoản VietQR vs Thu hộ COD.
     - Top sản phẩm / biến thể bán chạy nhất.

---

## 5. Cơ Chế Khóa Va Chạm Nhân Viên (Redis Sliding Lock)

Nhằm ngăn chặn rủi ro 2 nhân viên cùng mở khung lên đơn của một khách hàng:

```text
Nhân viên A mở Khung Lên Đơn trong Chat
  │
  ├──► Gửi Socket.io: order.editing_started
  │    Backend tạo Redis Key: lock:order:{workspaceId}:{conversationId} (TTL = 30s)
  │    Gửi tín hiệu tới tất cả nhân viên khác đang mở hội thoại này
  │
  └──► Nhân viên B mở cùng hội thoại:
       Thấy Banner đỏ cảnh báo: "Nhân viên A đang mở đơn hàng này"
       Hai lựa chọn:
         1. Xem ở chế độ Chỉ Đọc (Read-Only)
         2. Bấm nút "Cướp quyền (Takeover)" ➔ Chuyển quyền sửa sang Nhân viên B
```

- Trong suốt thời gian nhân viên A giữ Khung Lên Đơn, client gửi ping heartbeat mỗi 15 giây để duy trì khóa trượt.
- Khi nhân viên A đóng khung hoặc tắt trình duyệt, khóa tự động giải phóng trong 30 giây.