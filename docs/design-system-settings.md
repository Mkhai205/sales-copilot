# BỘ QUY TẮC THIẾT KẾ COMPONENT UI CHO PHÂN HỆ CÀI ĐẶT (SETTINGS)
**Hệ thống Sales Copilot** — *Phiên bản 1.0 (Tailwind CSS v4 & Shadcn Mira Style)*

---

## 1. TỔNG QUAN & PHÂN ĐỊNH RANH GIỚI HỆ THỐNG

### 1.1. Mục đích của Phân hệ Cài đặt (Settings)
Phân hệ **Cài đặt (Settings)** là trung tâm quản trị và cấu hình không gian làm việc của doanh nghiệp (Thông tin chung, Ngân hàng thanh toán VietQR, Phân quyền nhân sự, Đội nhóm, Kênh liên lạc, Nhãn phân loại, Tin nhắn mẫu, và Tri thức AI). 

### 1.2. Phân định rõ ràng: Settings Layout vs Commerce (Bán hàng) Layout
| Tiêu chí | Phân hệ Cài đặt (Settings) | Phân hệ Bán hàng (Commerce - Sẽ làm sau) |
| :--- | :--- | :--- |
| **Mục đích sử dụng** | Quản trị, cấu hình tích hợp, phân quyền, thiết lập chính sách. | Vận hành bán hàng, xử lý đơn real-time, kiểm kho, đối soát doanh thu. |
| **Tần suất thao tác** | Thấp đến trung bình (chủ yếu khi onboard hoặc điều chỉnh định kỳ). | Liên tục, cường độ cao suốt ngày làm việc của thu ngân và tư vấn viên. |
| **Độ rộng khung chứa** | **Tập trung (Focused `max-w-5xl` ~1024px)**, căn giữa màn hình để người dùng tập trung đọc và điền biểu mẫu, không mỏi mắt. | **Tràn viền (Fluid Edge-to-edge / 100% viewport)** để hiển thị bảng dữ liệu nhiều cột (mã đơn, COD, đối soát, tồn kho,...). |
| **Nhịp điệu trực quan** | Chia Card phân nhóm tính năng, nhãn & mô tả hướng dẫn chi tiết. | Mật độ thông tin dày đặc (dense), bảng số liệu lớn, bộ lọc đa tầng, split-pane POS. |
| **Cơ chế lưu dữ liệu** | **Dirty-State Form Tracking**: Nổi thanh `SettingsActionBar` khi có thay đổi chưa lưu, cho phép Hoàn tác hoặc Lưu có xác thực. | Lưu tức thì (Optimistic updates), phím tắt nhanh (hotkeys), in phiếu tự động. |

---

## 2. BỘ 10 NGUYÊN TẮC VÀNG THIẾT KẾ UI CHO SETTINGS

### NGUYÊN TẮC 1: Khung Chứa Thống Nhất (Uniform Centered Container)
- **Quy chuẩn**: Mọi trang trong phân hệ Settings **BẮT BUỘC** sử dụng component layout chung:
  ```tsx
  <SettingsPageLayout
    title="..."
    description="..."
    icon={...}
    isLoading={isLoading}
    skeletonVariant="form" | "table" | "cards" | "detail"
  >
    {/* Nội dung trang */}
  </SettingsPageLayout>
  ```
- **Kích thước chuẩn**: Inner container luôn là `max-w-5xl mx-auto w-full` (1024px).
- **Tuyệt đối cấm**: Không tự ý dùng `w-full` không giới hạn khiến các input dãn dài bất thường trên màn hình 1080p, 2K, 4K hoặc Ultrawide.

---

### NGUYÊN TẮC 2: Cấu Trúc Khối Card Phân Nhóm (Sectional Card Hierarchy)
- Mỗi cụm tính năng logic phải được gói trong một `<Card className="border-border bg-card/50">`.
- Cấu trúc Card chuẩn gồm 2 phần:
  1. `<CardHeader className="pb-4 border-b border-border/40">`:
     - Chứa icon nhận diện (`size-4 text-primary`)
     - `<CardTitle className="text-sm font-semibold">`
     - `<CardDescription className="text-xs mt-0.5">` giải thích ngắn gọn mục đích cấu hình.
  2. `<CardContent className="pt-6">`:
     - Chứa nội dung nhập liệu hoặc preview.

---

### NGUYÊN TẮC 3: Chuẩn Hóa Form Controls (Shadcn Mira Field Primitives)
- **CẤM TUYỆT ĐỐI**:
  - ❌ Không dùng thẻ `<label>` trần kết hợp `<div className="space-y-1.5">`.
  - ❌ Không dùng class `space-y-*` hoặc `space-x-*` (lỗi anti-pattern của Tailwind v4).
- **BẮT BUỘC DÙNG**:
  ```tsx
  <FieldGroup className="flex flex-col gap-4">
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor="field-id">
        Tên trường thông tin <span className="text-destructive">*</span>
      </FieldLabel>
      <Input
        id="field-id"
        aria-invalid={!!error}
        className="text-xs h-10"
      />
      <FieldDescription>
        Văn bản giải thích hướng dẫn cho người dùng cuối.
      </FieldDescription>
      {error && <FieldError errors={[{ message: error }]} />}
    </Field>
  </FieldGroup>
  ```
- **Khoảng cách**: Giữa các field trong cùng một card dùng `gap-4` hoặc `gap-6` (với grid 2 cột).

---

### NGUYÊN TẮC 4: Theo Dõi Dirty State & Thanh Lưu Nổi (Contextual Save Bar / Shopify Style)
- **Quy chuẩn**: Mọi trang biểu mẫu cấu hình (General, Bank, AI Config) áp dụng chuẩn **Thanh Lưu Ngữ Cảnh Nổi (Contextual Save Bar)**:
  - **Loại bỏ hoàn toàn cụm nút tĩnh ở chân form**: Không để nút Lưu hay Hủy ở cuối trang sau đường kẻ separator. Tránh tuyệt đối lỗi trùng lặp thị giác (Button Stacking - xuất hiện 2 nút Lưu trên màn hình khi cuộn xuống đáy).
  - Khi form nguyên bản (`isDirty = false`): Màn hình hoàn toàn sạch sẽ, thoáng đãng, không có nút `disabled` vô nghĩa chiếm diện tích.
  - Ngay khi người dùng sửa đổi bất kỳ trường nào (`isDirty = true`): Tự động xuất hiện thanh **`SettingsActionBar`** trượt lên ở đáy viewport (`slide-in-from-bottom-3`).
- **Nội dung `SettingsActionBar`**:
  - Dải thông báo: Chấm vàng nhấp nháy + icon cảnh báo + *"Bạn có thay đổi chưa lưu trên trang này"*.
  - Nút **"Hủy"**: Hoàn tác dữ liệu form về `initialData`.
  - Nút **"Lưu thay đổi"**: Kích hoạt mutate API; khi lưu hiển thị `<Spinner className="size-3.5" data-icon="inline-start" /> Đang lưu...`.
- Người dùng khi cuộn một form dài (như trang Bank có VietQR và Stepper 3 bước) có thể lưu hoặc hủy tức thì ở bất kỳ vị trí cuộn nào mà không cần cuộn chuột xuống đáy form.

---

### NGUYÊN TẮC 5: Triệt Tiêu Layout Shift (Zero-CLS Skeleton Transition)
- **CẤM**: Không hiển thị spinner đơn độc xoay tròn giữa màn hình trắng khi tải trang cài đặt.
- **BẮT BUỘC**: `SettingsPageLayout` tự động quản lý khung tải trang qua prop `isLoading={isLoading}` và `skeletonVariant`:
  1. `skeletonVariant="form"`: Cho General, Bank & Payment. (Mô phỏng 2 Card biểu mẫu, grid inputs, stepper).
  2. `skeletonVariant="table"`: Cho Members, Labels, Canned Responses, Knowledge. (Mô phỏng toolbar + 5 hàng dữ liệu bảng).
  3. `skeletonVariant="cards"`: Cho Teams, Inboxes. (Mô phỏng lưới 3 cột cards).
  4. `skeletonVariant="detail"`: Cho Inbox Detail. (Mô phỏng Avatar + Tabs list + Card nội dung).

---

### NGUYÊN TẮC 6: Sử Dụng Màu Ngữ Nghĩa & Hỗ Trợ Dark Mode Tự Động
- Tuân thủ kiến trúc Tailwind CSS v4 của dự án:
  - Nền trang: `bg-background`
  - Thẻ card: `bg-card/50` hoặc `bg-card`
  - Viền: `border-border` hoặc `border-border/40`
  - Chữ chính: `text-foreground`
  - Chữ phụ/chú thích: `text-muted-foreground`
  - Điểm nhấn/Primary: `text-primary`, `bg-primary`, `text-primary-foreground`
  - Báo lỗi: `text-destructive`, `border-destructive`
  - Trạng thái thành công: `text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20`
- **CẤM**: Không hardcode mã hex `#ffffff`, `#000000` hay các class màu thô như `bg-blue-600`, `text-gray-500`.

---

### NGUYÊN TẮC 7: Bố Cục Hai Cột Chức Năng (Form + Real-Time Preview)
- Khi một trang cấu hình có yếu tố trực quan (như sinh mã VietQR, mô phỏng tin nhắn mẫu, hoặc xem trước widget WebChat):
  - Áp dụng bố cục 12 cột: **Cột trái nhập liệu (7 cột) + Cột phải Live Preview (5 cột)**.
  - Trên mobile/tablet (`< lg`): Tự động xếp chồng thành 1 cột dọc (Form ở trên, Preview ở dưới).
  - Thẻ Preview phải căn giữa (`self-center` hoặc `sticky top-6`) để luôn nằm trong tầm nhìn khi người dùng nhập thông tin.

---

### NGUYÊN TẮC 8: Quy Trình Nhiều Bước (Linear Stepper Pattern)
- Với các tác vụ tích hợp phức tạp (như Webhook SePay, kết nối Fanpage Facebook, cấu hình Telegram Bot):
  - Sử dụng **Linear Stepper dọc** rõ ràng (Bước 1 -> Bước 2 -> Bước 3).
  - Mỗi bước có số thứ tự dạng badge tròn (`size-7 rounded-full bg-primary/10 text-primary font-bold text-xs`).
  - Phân tách giữa các bước bằng `<Separator className="bg-border/40" />`.
  - Có các nút thao tác nhanh: Nút mở tài liệu ngoài (`asChild` Link kèm icon `ExternalLink`), ô sao chép webhook URL (`select-all font-mono` kèm nút `Copy`).

---

### NGUYÊN TẮC 9: Giọng Văn Giao Diện (UX Writing & Microcopy)
- Viết từ góc độ người dùng, không dùng thuật ngữ backend nội bộ:
  - ✅ *"Ngân hàng thụ hưởng"* — ❌ *"bankBin & bankCode"*
  - ✅ *"Tên hiển thị của không gian làm việc"* — ❌ *"workspace.name entity"*
  - ✅ *"Lưu thay đổi"* — ❌ *"Submit"*
- Hộp lưu ý / Cảnh báo quan trọng: Sử dụng Callout Box có màu ngữ nghĩa nhẹ hoặc icon `Sparkles` / `Info` / `AlertCircle`.

---

### NGUYÊN TẮC 10: Đồng Bộ Điều Hướng Sidebar & RBAC Guard
- Mọi trang cài đặt phải được bảo vệ bởi `<SettingsGuard workspaceSlug={workspaceSlug} segment="...">`.
- Khi người dùng không đủ quyền (Role không nằm trong `allowedRoles`), hiển thị trang Empty State thông báo phân quyền rõ ràng, không để trang bị crash hoặc hiển thị màn hình trắng.
- Tiêu đề trên Header, tên mục trên `SettingsSidebar`, và tiêu đề Breadcrumb phải đồng nhất 100% về mặt từ ngữ.

---

## 3. CHECKLIST KIỂM DUYỆT COMPONENT CÀI ĐẶT TRƯỚC KHI MERGE CODE

Trước khi tạo pull request hoặc bàn giao một màn hình Cài đặt mới, hãy tự kiểm tra:
- [ ] Trang đã được bọc trong `<SettingsPageLayout>` chưa?
- [ ] Đã chỉ định đúng `skeletonVariant` (`form` / `table` / `cards` / `detail`) chưa?
- [ ] Khung trang có bị bè ngang quá 1024px trên màn hình lớn không? (Phải đảm bảo `max-w-5xl`).
- [ ] Tất cả các input form đã dùng `FieldGroup`, `Field`, `FieldLabel`, `FieldDescription` chưa?
- [ ] Có còn class `space-y-*` hay `space-x-*` nào không? (Thay bằng `flex flex-col gap-*`).
- [ ] Đã gắn `SettingsActionBar` với `isDirty` để người dùng lưu nổi khi cuộn trang chưa?
- [ ] Khi chuyển trang, giao diện có bị giật (CLS) không?
- [ ] Đã kiểm tra hiển thị trên Dark Mode và Light Mode chưa?
