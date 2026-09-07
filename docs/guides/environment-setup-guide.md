# Hướng Dẫn Cấu Hình Môi Trường & Triển Khai (Environment & Deployment Guide)

Tài liệu này hướng dẫn chi tiết cách thiết lập biến môi trường (`.env`), cấu hình hạ tầng mạng và vận hành hệ thống **Sales Copilot Platform** theo 3 kịch bản:
1. **Kịch bản 1: Local Development** (Phát triển thông thường, chạy lệnh native, infra Docker)
2. **Kịch bản 2: Local Development + Cloudflare Tunnel** (Phát triển local có webhook Facebook / share link demo)
3. **Kịch bản 3: Production trên VPS** (Đóng gói 100% Docker, Nginx Reverse Proxy & Cloudflare Tunnel)

---

## 1. Tổng Quan Kiến Trúc Mạng & Cổng Giao Tiếp (Network Architecture)

Hệ thống hoạt động trên kiến trúc **Single Domain + Nginx Reverse Proxy**:

```
                                    ┌────────────────────────┐
                                    │  Trình duyệt / Webhook │
                                    └───────────┬────────────┘
                                                │
                 https://sales-copilot.kakadev.xyz (hoặc domain VPS)
                                                ▼
┌── Docker Network: sales_copilot_net ────────────────────────────────────────────────────────┐
│                                                                                            │
│   ┌── NGINX (:80) ──────────────────────────────────────────────────────────────────────┐  │
│   │  • /api/*          ──► Backend NestJS (:8000)                                       │  │
│   │  • /widget/*       ──► Backend NestJS (:8000) - Phục vụ file nhúng /widget/sdk.js   │  │
│   │  • /docs           ──► Backend NestJS (:8000) - Swagger API Documentation           │  │
│   │  • /socket.io/*    ──► Backend NestJS (:8000) - Realtime WebSocket                  │  │
│   │  • /* (catch-all)  ──► Frontend Next.js (:3000)                                     │  │
│   └─────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                            │
│   ┌───────────────────────┐   [Mạng nội bộ Docker]    ┌─────────────────────────────────┐  │
│   │   web (Next.js)       │ ────────────────────────► │   server (NestJS)               │  │
│   │   SSR / ServerActions │   INTERNAL_API_URL        │   Port 8000                     │  │
│   └───────────────────────┘   http://server:8000/api  └───────┬─────────────┬───────────┘  │
│                                                               │             │              │
│                 ┌─────────────────────────────────────────────┘             │              │
│                 ▼                                                           ▼              │
│   ┌──────────────────────────┐                                ┌─────────────────────────┐  │
│   │  postgres:5432 / redis   │                                │  minio:9000 (S3 API)    │  │
│   └──────────────────────────┘                                └─────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Hai luồng giao tiếp cốt lõi:
1. **Client-side (Trình duyệt):** Gọi URL tương đối `/api/v1` và WebSocket `window.location.origin` $\rightarrow$ Nginx nhận request và điều hướng chuẩn xác.
2. **Server-side (Next.js SSR / Server Actions / Middleware):** Gọi trực tiếp Backend qua mạng nội bộ Docker (`INTERNAL_API_URL=http://server:8000/api/v1`) $\rightarrow$ **Độ trễ < 1ms, không qua Internet, không tốn băng thông**.

---

## 2. Kịch Bản 1: Local Development (Native Code, Docker Infra)

Dùng khi lập trình tính năng mới hàng ngày. Tốc độ hot-reload nhanh nhất.

### Bảng biến môi trường cần thiết

| File | Mục đích | Các biến quan trọng |
| :--- | :--- | :--- |
| `.env` (thư mục gốc) | Docker Compose Dev | `POSTGRES_USER=postgres`, `POSTGRES_PASSWORD=password`, `MINIO_ROOT_USER=minioadmin`, `MINIO_ROOT_PASSWORD=miniopassword123` |
| `apps/server/.env` | Backend NestJS | `PORT=8000`, `DATABASE_URL=postgresql://postgres:password@localhost:5432/sales_copilot_dev?schema=public`, `REDIS_URL=redis://localhost:6379`, `STORAGE_ENDPOINT=http://localhost:9000`, `JWT_ACCESS_TOKEN_SECRET=...`, `CHANNEL_ENCRYPTION_KEY=...` |
| `apps/web/.env.local` | Frontend Next.js | `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1`, `NEXT_PUBLIC_WS_URL=http://localhost:8000` |

### Các bước khởi động

```bash
# 1. Khởi tạo file env từ template
cp .env.example .env
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env.local

# 2. Khởi động hạ tầng Docker (PostgreSQL, Redis, MinIO)
docker compose -f docker-compose.dev.yml up -d

# 3. Chạy migration và seed dữ liệu ban đầu
pnpm db:generate
pnpm db:migrate:dev
pnpm db:seed

# 4. Chạy Backend (Terminal 1)
pnpm serve:server
# -> Chạy tại: http://localhost:8000 (Swagger: http://localhost:8000/docs)

# 5. Chạy Frontend (Terminal 2)
pnpm serve:web
# -> Chạy tại: http://localhost:3000
```

---

## 3. Kịch Bản 2: Local Development + Cloudflare Tunnel (Test Webhook / Public URL)

Dùng khi cần nhận Webhook từ bên ngoài (Facebook Messenger, Zalo OA) hoặc gửi link demo cho đồng nghiệp xem trực tiếp từ máy của bạn.

### Yêu cầu bổ sung
- Cài đặt `cloudflared CLI` trên máy:
  - Windows: `winget install Cloudflare.cloudflared` hoặc tải installer.
  - macOS: `brew install cloudflared`
  - Linux: tải package từ Cloudflare.

### Bước 1: Khởi tạo Tunnel (Chỉ làm lần đầu)

Chạy script cấu hình tự động:
```powershell
# Trên Windows PowerShell:
.\scripts\setup-tunnel.ps1

# Trên Linux / macOS / Git Bash:
chmod +x ./scripts/setup-tunnel.sh
./scripts/setup-tunnel.sh
```

Script sẽ:
1. Đăng nhập Cloudflare (`cloudflared tunnel login`).
2. Tạo tunnel tên `sales-copilot`.
3. Định tuyến DNS 2 domain:
   - `sales-copilot.kakadev.xyz` $\rightarrow$ Web App & API
   - `storage-sales-copilot.kakadev.xyz` $\rightarrow$ MinIO File Storage
4. Copy file credentials JSON vào `config/cloudflared/credentials.json` và điền Tunnel ID vào `config/cloudflared/config.yml`.

### Bước 2: Cập nhật biến môi trường cho Tunnel

Trong `apps/server/.env`, cập nhật hoặc bỏ comment các dòng:
```bash
# Public webhook base URL (Meta gửi webhook về đây)
WEBHOOK_BASE_URL=https://sales-copilot.kakadev.xyz

# URL lưu trữ ảnh/file gửi ra ngoài
STORAGE_PUBLIC_ENDPOINT=https://storage-sales-copilot.kakadev.xyz

# Cho phép Nginx tunnel gọi API
CORS_ORIGIN='https://sales-copilot.kakadev.xyz,http://localhost:3000'

# Meta App Credentials (lấy từ https://developers.facebook.com)
FB_APP_ID=your_meta_app_id
FB_APP_SECRET=your_meta_app_secret
FB_VERIFY_TOKEN=your_custom_verify_token
```

### Bước 3: Khởi động hệ thống với profile `tunnel`

```bash
# Bật hạ tầng + Nginx + Cloudflared Tunnel trong Docker:
docker compose -f docker-compose.dev.yml --profile tunnel up -d

# Chạy Backend & Frontend native trên máy host như bình thường:
pnpm serve:server
pnpm serve:web
```

Ứng dụng của bạn sẽ được truy cập toàn cầu tại:
- **Dashboard & API**: `https://sales-copilot.kakadev.xyz`
- **Facebook Webhook URL**: `https://sales-copilot.kakadev.xyz/api/v1/integrations/facebook/webhook`
- **Storage Attachment**: `https://storage-sales-copilot.kakadev.xyz`

---

## 4. Kịch Bản 3: Production trên VPS (Đóng Gói 100% Docker)

Dùng khi triển khai lên máy chủ thật (VPS Ubuntu/Debian) hoặc test đóng gói hoàn chỉnh ở local. Không cần cài Node.js hay pnpm trên host.

### Bước 1: Chuẩn bị máy chủ VPS

Cài đặt Docker Engine & Docker Compose v2 trên VPS:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
```

Clone mã nguồn về VPS:
```bash
git clone https://github.com/Mkhai205/sales-copilot.git /opt/sales-copilot
cd /opt/sales-copilot
```

### Bước 2: Thiết lập file môi trường `.env` duy nhất ở thư mục gốc

Tạo file `.env` từ `.env.example`:
```bash
cp .env.example .env
```

Chỉnh sửa `.env` với các thông số production thực tế:
```bash
# --- Cơ sở dữ liệu PostgreSQL ---
POSTGRES_USER=prod_copilot_user
POSTGRES_PASSWORD=MatKhauThatManhChoPostgres_2026!
POSTGRES_DB=sales_copilot_prod

# --- MinIO Storage ---
MINIO_ROOT_USER=minioprodadmin
MINIO_ROOT_PASSWORD=MatKhauThatManhChoMinio_2026!
MINIO_CONSOLE_PORT=9001

# --- Bảo mật & Khóa bí mật (BẮT BUỘC ĐỔI) ---
# Chuỗi ngẫu nhiên tối thiểu 32 ký tự:
JWT_ACCESS_TOKEN_SECRET=k9F!xZ8$qW2#mP5@vL7*yR1^tB4&eC6(aU3)
# Chuỗi hex 64 ký tự (32 byte) cho mã hóa AES-256-GCM credentials:
CHANNEL_ENCRYPTION_KEY=e4d3c2b1a09876543210fedcba9876543210fedcba9876543210fedcba987654

# --- Tên miền & Mạng ---
HTTP_PORT=80
CORS_ORIGIN=https://sales-copilot.kakadev.xyz
WEBHOOK_BASE_URL=https://sales-copilot.kakadev.xyz
STORAGE_PUBLIC_ENDPOINT=https://storage-sales-copilot.kakadev.xyz

# Mạng nội bộ Docker (Next.js server-side gọi thẳng Backend không qua Internet)
INTERNAL_API_URL=http://server:8000/api/v1

# --- Meta / Facebook (Nếu có) ---
FB_APP_ID=123456789012345
FB_APP_SECRET=abcdef0123456789abcdef0123456789
FB_VERIFY_TOKEN=sales_copilot_fb_verify_token_prod
```

### Bước 3: Đặt file xác thực Cloudflare Tunnel (Nếu dùng Tunnel)

Nếu bạn định tuyến qua Cloudflare Tunnel:
1. Đặt file credential vào `config/cloudflared/credentials.json`.
2. Điền Tunnel UUID vào `config/cloudflared/config.yml`.

### Bước 4: Khởi chạy Production Containers

```bash
# Chạy toàn bộ hệ thống (Postgres, Redis, MinIO, db-migrate, Server, Web, Nginx):
docker compose -f docker-compose.prod.yml up -d --build

# Hoặc nếu chạy kèm Cloudflare Tunnel container:
docker compose -f docker-compose.prod.yml --profile tunnel up -d --build
```

### Quy trình tự động khi chạy Production Compose:
1. `postgres`, `redis`, `minio` khởi động và kiểm tra sức khỏe (`healthy`).
2. `db-migrate` tự động chạy `npx prisma migrate deploy` đồng bộ schema database.
3. `server` (NestJS) và `web` (Next.js) khởi động sau khi migration hoàn tất thành công.
4. `server` tự động kiểm tra và tạo bucket lưu trữ `sales-copilot` trong MinIO nếu chưa có.
5. `nginx` đón toàn bộ traffic ở cổng 80 và chuyển tiếp chính xác theo từng path.

### Kiểm tra & Quản lý

```bash
# Xem trạng thái các container
docker compose -f docker-compose.prod.yml ps

# Xem log thời gian thực
docker compose -f docker-compose.prod.yml logs -f server
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml logs -f nginx

# Dừng hệ thống
docker compose -f docker-compose.prod.yml down
```

---

## 5. Danh Mục Biến Môi Trường Chi Tiết (Environment Variables Reference)

### Nhóm 1: Cơ sở dữ liệu & Cache
| Tên biến | Mặc định | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `DATABASE_URL` | - | **Có** | Chuỗi kết nối PostgreSQL (Prisma format) |
| `DATABASE_POOL_MAX` | `10` | Không | Số lượng connection tối đa trong pool |
| `DATABASE_POOL_MIN` | `2` | Không | Số lượng connection tối thiểu duy trì |
| `REDIS_URL` | `redis://localhost:6379` | Không | URL kết nối Redis cho Queue và WebSocket Adapter |

### Nhóm 2: Xác thực & Bảo mật
| Tên biến | Mặc định | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `JWT_ACCESS_TOKEN_SECRET` | - | **Có** | Khóa ký JWT Access Token (tối thiểu 32 ký tự) |
| `JWT_ACCESS_TOKEN_EXPIRES_IN_SECONDS` | `900` (15m) | Không | Thời gian sống của Access Token |
| `REFRESH_TOKEN_EXPIRES_IN_SECONDS` | `604800` (7d) | Không | Thời gian sống của Refresh Token |
| `CHANNEL_ENCRYPTION_KEY` | - | **Có** | Khóa hex 64 ký tự mã hóa token các kênh tích hợp |
| `COOKIE_DOMAIN` | `undefined` | Không | Domain cookie (để trống để dùng Host-Only cookie an toàn) |

### Nhóm 3: Lưu trữ tệp tin (S3 / MinIO)
| Tên biến | Mặc định | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `STORAGE_ENDPOINT` | `http://localhost:9000` | Không | Endpoint nội bộ để Server tương tác với MinIO |
| `STORAGE_PUBLIC_ENDPOINT` | `http://localhost:9000` | Không | Endpoint public để ký Presigned URL cho client tải/xem ảnh |
| `STORAGE_ACCESS_KEY` | - | **Có** | Root User / Access Key của MinIO |
| `STORAGE_SECRET_KEY` | - | **Có** | Root Password / Secret Key của MinIO |
| `STORAGE_BUCKETS` | `sales-copilot` | Không | Tên bucket chính (tự động tạo nếu chưa có) |

### Nhóm 4: Điều hướng & Webhooks
| Tên biến | Mặc định | Bắt buộc | Mô tả |
| :--- | :--- | :---: | :--- |
| `CORS_ORIGIN` | `http://localhost:3000` | Không | Danh sách origin được phép gọi API (phân cách bằng dấu phẩy) |
| `WEBHOOK_BASE_URL` | `undefined` | Không | URL public của hệ thống phục vụ webhook callback & OAuth |
| `INTERNAL_API_URL` | `http://server:8000/api/v1`| Không | URL mạng nội bộ Docker để Next.js gọi NestJS trực tiếp |
| `FB_APP_ID` | `undefined` | Không | Meta App ID cho kênh Facebook Messenger |
| `FB_APP_SECRET` | `undefined` | Không | Meta App Secret để xác thực chữ ký Webhook HMAC-SHA256 |
| `FB_VERIFY_TOKEN` | `undefined` | Không | Token xác thực Webhook Meta handshake |
