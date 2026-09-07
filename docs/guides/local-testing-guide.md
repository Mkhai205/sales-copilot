# Local Testing Guide: Web Chat & Facebook Messenger with Cloudflare Tunnel

Hướng dẫn toàn diện để thiết lập môi trường test local cho Sales Copilot Platform, kết nối Cloudflare Tunnel với domain public (`kakadev.xyz`), và kiểm thử 2 kênh giao tiếp: **Web Chat Widget** và **Facebook Messenger**.

---

## 1. Yêu cầu tiên quyết (Prerequisites)

Trước khi bắt đầu, đảm bảo máy của bạn đã cài đặt:
- **Docker Desktop** (hoặc Docker Engine + Docker Compose v2)
- **Node.js 22 LTS**
- **pnpm** (`corepack enable pnpm`)
- **cloudflared CLI** (Cloudflare Tunnel client):
  - Windows: `winget install Cloudflare.cloudflared` hoặc `choco install cloudflared`
  - macOS: `brew install cloudflared`
  - Linux: tải package từ [Cloudflare Downloads](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
- Tài khoản **Cloudflare** quản lý domain `kakadev.xyz`
- Tài khoản **Meta for Developers** với App, Test Page, và Test User

---

## 2. Các Chế Độ Vận Hành (Operating Modes)

| Chế độ | Khi nào sử dụng | Đặc điểm |
| :--- | :--- | :--- |
| **Mode 1: Localhost Only** | Lập trình hàng ngày, test Web Chat Widget, phát triển UI | Tốc độ nhanh nhất, Hot reload cả Backend lẫn Frontend |
| **Mode 2: Tunnel Dev (Khuyên dùng)** | Test Facebook Webhook, demo khách hàng qua internet | Backend/Frontend chạy native (hot reload), Tunnel expose qua Docker |
| **Mode 3: Full Containerized** | Test mô phỏng production qua cloudflared tunnel local trước khi release | Toàn bộ hệ thống chạy trong Docker qua `docker-compose.prod.yml` |

---

## 3. Mode 1: Quick Start (Localhost Only)

Dùng để phát triển thông thường và kiểm thử Web Chat Widget ngay trên máy local.

### Bước 1: Khởi động Infrastructure (Postgres, Redis, MinIO)

```bash
# Khởi động databases và storage
docker compose -f docker-compose.dev.yml up -d

# Kiểm tra trạng thái containers (phải healthy)
docker compose -f docker-compose.dev.yml ps
```

### Bước 2: Setup Database & Seed dữ liệu mẫu

```bash
# Cài đặt dependencies
pnpm install

# Chạy migration database
pnpm db:migrate:dev

# Seed dữ liệu mặc định (Admin, Workspace mặc định)
pnpm db:seed
```

### Bước 3: Khởi động Ứng Dụng (Native Dev)

Mở 2 terminal riêng biệt:

```bash
# Terminal 1: NestJS API Server (Port 8000)
pnpm nx serve server

# Terminal 2: Next.js Web Dashboard (Port 3000)
pnpm nx serve web
```

- **Dashboard UI**: [http://localhost:3000](http://localhost:3000)
- **API Healthcheck**: [http://localhost:8000/health](http://localhost:8000/health)
- **MinIO Console**: [http://localhost:9001](http://localhost:9001) (User: `minioadmin` / Pass: `miniopassword123`)

---

## 4. Kiểm Thử Web Chat Widget (Localhost)

Web Chat Widget có thể được kiểm thử hoàn chỉnh mà không cần Cloudflare Tunnel.

### Luồng kiểm thử 2 trình duyệt (Two-Browser Pattern):

1. **Browser A (Agent Dashboard)**:
   - Truy cập `http://localhost:3000/login`
   - Đăng nhập bằng tài khoản Admin đã seed:
     - Email: `admin@salescopilot.vn` (hoặc email trong seed)
     - Password: `Password123!`
   - Vào mục **Settings > Inboxes > Add Inbox**:
     - Chọn channel **Web Chat**
     - Đặt tên Inbox (ví dụ: "Website Support")
     - Nhận **Channel ID** và **SDK Script snippet**
   - Chuyển sang màn hình **Conversations** để chờ tin nhắn.

2. **Browser B (Ẩn danh / Incognito - Visitor)**:
   - Mở file test demo widget hoặc nhúng widget script vào một trang HTML tĩnh:
     ```html
     <!-- test-widget.html -->
     <!DOCTYPE html>
     <html>
     <head><title>Test Widget</title></head>
     <body>
       <h1>Khách hàng ghé thăm Website</h1>
       <script>
         (function(d,t) {
           var BASE_URL="http://localhost:8000";
           var g=d.createElement(t),s=d.getElementsByTagName(t)[0];
           g.src=BASE_URL+"/widget/sdk.js";
           g.defer = true;
           g.async = true;
           s.parentNode.insertBefore(g,s);
           g.onload=function(){
             window.SalesCopilotWidget.init({
               baseUrl: BASE_URL,
               channelId: "<CHANNEL_ID_VỪA_TẠO>"
             });
           };
         })(document,"script");
       </script>
     </body>
     </html>
     ```
   - Nhập Form thông tin (Pre-chat form): Tên, Email hoặc Số điện thoại.
   - Gửi một tin nhắn: *"Chào shop, tôi cần tư vấn giá sản phẩm"*.

3. **Xác nhận kết quả**:
   - Tại **Browser A (Agent)**: Tin nhắn mới xuất hiện tức thì qua WebSocket kèm âm thanh chime thông báo.
   - Agent gõ phản hồi: *"Dạ chào bạn, bạn quan tâm gói nào ạ?"*
   - Tại **Browser B (Visitor)**: Nhận tin nhắn phản hồi của Agent theo thời gian thực (Realtime).

---

## 5. Thiết Lập Cloudflare Tunnel (Cho Facebook Messenger)

Để Meta (Facebook) có thể gửi Webhook về máy local của bạn, cần một HTTPS URL công khai.

### Bước 1: Chạy Script Thiết Lập Tunnel Tự Động

**Trên Windows (PowerShell)**:
```powershell
### Bước 1: Khởi Tạo & Đăng Nhập Tunnel

**Trên Windows (PowerShell)**:
```powershell
.\scripts\setup-tunnel.ps1
```

**Trên Linux / macOS (Bash)**:
```bash
chmod +x ./scripts/setup-tunnel.sh
./scripts/setup-tunnel.sh
```

Script sẽ thực hiện:
1. `cloudflared tunnel login`: Mở trình duyệt để bạn ủy quyền domain `kakadev.xyz`.
2. `cloudflared tunnel create sales-copilot`: Tạo Named Tunnel cố định.
3. Tự động trỏ DNS CNAME:
   - `sales-copilot.kakadev.xyz` $\rightarrow$ Nginx (phục vụ cả Web App Dashboard, Backend API, WebSocket, và Widget SDK)
   - `storage-sales-copilot.kakadev.xyz` $\rightarrow$ MinIO Storage
4. Cập nhật Tunnel ID vào `config/cloudflared/config.yml` và lưu credentials vào `config/cloudflared/credentials.json`.

### Bước 2: Cập Nhật Biến Môi Trường (Tunnel Mode)

Cập nhật cấu hình trong `apps/server/.env`:

```bash
# Thêm domain tunnel vào danh sách CORS origins cho phép
CORS_ORIGIN='https://sales-copilot.kakadev.xyz,http://localhost:3000'

# Public Base URL cho Webhooks và OAuth
WEBHOOK_BASE_URL=https://sales-copilot.kakadev.xyz

# Public URL cho MinIO Storage (phục vụ ảnh/file đính kèm)
STORAGE_PUBLIC_ENDPOINT=https://storage-sales-copilot.kakadev.xyz

# Facebook Meta App Credentials (lấy từ Meta Developer Console)
FB_APP_ID=your_facebook_app_id
FB_APP_SECRET=your_facebook_app_secret
FB_VERIFY_TOKEN=sales_copilot_meta_verify_token_secure123
```

*(Lưu ý: Trong `apps/web/.env`, trình duyệt tự động dùng relative URL `/api/v1` và same-origin WebSocket khi truy cập qua `sales-copilot.kakadev.xyz`, nên không cần chỉnh sửa)*.

### Bước 3: Khởi Động Hạ Tầng & Tunnel Container

```bash
# Khởi động infra + nginx + cloudflared tunnel
docker compose -f docker-compose.dev.yml --profile tunnel up -d
```

Kiểm tra kết nối:
```bash
curl https://sales-copilot.kakadev.xyz/api/v1/health
# Kết quả mong đợi: {"status":"ok", ...}
```

---

## 6. Kiểm Thử Facebook Messenger Integration

### Bước 1: Cấu Hình Meta App Webhook

1. Truy cập [Meta for Developers](https://developers.facebook.com/) $\rightarrow$ Chọn App của bạn.
2. Vào mục **Messenger > Settings > Webhooks**:
   - **Callback URL**: `https://sales-copilot.kakadev.xyz/api/v1/integrations/facebook/webhook`
   - **Verify Token**: Giá trị trùng với `FB_VERIFY_TOKEN` bạn đặt trong `.env` (ví dụ: `sales_copilot_meta_verify_token_secure123`).
   - Nhấn **Verify and Save**. NestJS server sẽ nhận request `hub.challenge` và phản hồi HTTP 200 thành công.
3. Trong danh sách **Subscription Fields**, tích chọn:
   - `messages`
   - `messaging_postbacks`

### Bước 2: Kết Nối Facebook Test Page Vào Sales Copilot

1. Đăng nhập Dashboard tại [https://sales-copilot.kakadev.xyz](https://sales-copilot.kakadev.xyz).
2. Vào **Settings > Inboxes > Add Inbox** $\rightarrow$ Chọn **Facebook Messenger**.
3. Điền thông tin Page:
   - **Page ID**: ID của Facebook Test Page.
   - **Page Access Token**: Token sinh từ Meta Developer Console (có quyền `pages_messaging`, `pages_manage_metadata`).
4. Lưu cấu hình. Kênh Facebook hiện đã sẵn sàng.

### Bước 3: Thực Hiện Kiểm Thử End-to-End

1. Dùng **Facebook Test User** (hoặc tài khoản cá nhân có quyền Admin/Tester trên App).
2. Mở Facebook Messenger, truy cập Test Page và gửi tin nhắn:
   *"Xin chào Sales Copilot, đây là tin nhắn test từ Facebook Messenger!"*
3. **Quan sát luồng xử lý**:
   - Meta gửi Webhook POST tới `https://sales-copilot.kakadev.xyz/api/v1/integrations/facebook/webhook`.
   - NestJS xác thực chữ ký HMAC-SHA256 (`x-hub-signature-256`).
   - Đưa event vào BullMQ queue `channel-ingestion`.
   - Contact và ChannelIdentity của Facebook Sender được tự động tạo/khớp (deduplication).
   - Hội thoại (Conversation) mới được tạo với trạng thái `OPEN`.
   - Broadcast sự kiện WebSocket `message.created` tới Dashboard.
4. **Tại Agent Dashboard**:
   - Hội thoại mới xuất hiện ngay trên danh sách.
   - Agent bấm vào và gõ trả lời: *"Chào bạn! Chúng tôi đã nhận được tin nhắn qua Facebook"*.
   - Phản hồi được chuyển tiếp qua Meta Graph API v22.0 về Messenger của Test User.

---

## 7. Mode 3: Kiểm Thử Full Containerized Stack (Production Test)

Khi bạn muốn kiểm tra toàn bộ ứng dụng chạy hoàn toàn bên trong Docker (giống môi trường Production staging):

```bash
# Build và khởi chạy toàn bộ containers:
# postgres, redis, minio, db-migrate, server, web, nginx
docker compose -f docker-compose.prod.yml up --build -d

# Nếu muốn kèm Cloudflare Tunnel:
docker compose -f docker-compose.prod.yml --profile tunnel up --build -d

# Xem logs của toàn bộ stack
docker compose -f docker-compose.prod.yml logs -f server

# Tắt và dọn dẹp môi trường test
docker compose -f docker-compose.prod.yml down -v
```

---

## 8. Xử Lý Sự Cố Thường Gặp (Troubleshooting)

### 1. Facebook Webhook Verification Thất Bại (`hub.challenge`)
- **Nguyên nhân**: Token không khớp hoặc URL không phản hồi HTTP 200 dạng raw text.
- **Khắc phục**:
  - Kiểm tra biến `FB_VERIFY_TOKEN` trong `apps/server/.env` có khớp từng ký tự với ô Verify Token trên Meta Console.
  - Kiểm tra log tunnel: `docker compose logs cloudflared`.

### 2. File Đính Kèm Không Hiển Thị Được Từ Internet
- **Triệu chứng**: Trình duyệt báo lỗi khi load ảnh/tệp đính kèm từ MinIO.
- **Khắc phục**:
  - Kiểm tra `STORAGE_PUBLIC_ENDPOINT` đã đặt thành `https://storage-sales-copilot.kakadev.xyz`.
  - Đảm bảo DNS CNAME cho `storage-sales-copilot.kakadev.xyz` đã được Cloudflare Tunnel định tuyến tới service `http://minio:9000`.

### 3. Live Chat Widget SDK Báo Lỗi 404
- **Triệu chứng**: Trang web ngoài nhúng `<script src="https://sales-copilot.kakadev.xyz/widget/sdk.js"></script>` báo 404.
- **Khắc phục**:
  - Đảm bảo Nginx đã có `location /widget/` chuyển tiếp vào backend server (đã được cấu hình trong `config/nginx/dev.conf` và `config/nginx/prod.conf`).

