### 1. Kịch Bản 1: Dev Local (Infra Docker + Code chạy Native trên máy)

> **Mục đích:** Lập trình tính năng hàng ngày, tốc độ hot-reload nhanh nhất, không nhận webhook thật từ bên ngoài.
> **Lệnh chạy:**
> - Infra: `docker compose -f docker-compose.dev.yml up -d` (chỉ bật Postgres, Redis, MinIO)
> - App: `pnpm serve:server` (terminal 1) và `pnpm serve:web` (terminal 2)

```
[ Trình duyệt của bạn ]
   │
   ├──► http://localhost:3000  ───────────► [ Next.js Web Dev Server (Host:3000) ]
   │                                              │ (SSR / Client calls)
   ├──► http://localhost:8000/api ────────► [ NestJS API Server (Host:8000) ]
   │                                              │
   └──► ws://localhost:8000/socket.io ────┤      │ Kết nối qua Port Mapping
                                                  ▼
                         ┌── Docker Network (docker-compose.dev.yml) ─────────┐
                         │  • localhost:5432  ──► postgres:5432 (pgvector)    │
                         │  • localhost:6379  ──► redis:6379                  │
                         │  • localhost:9000  ──► minio:9000 (S3 API)         │
                         └────────────────────────────────────────────────────┘
```

* **Luồng mạng:**
  - **Trình duyệt $\rightarrow$ Ứng dụng:** Trình duyệt gọi trực tiếp vào các cổng `3000` (Web UI) và `8000` (API/WebSocket) mở ngay trên máy host.
  - **Ứng dụng $\rightarrow$ Database/Redis/MinIO:** NestJS và Next.js chạy trực tiếp trên máy bạn (host), kết nối tới các dịch vụ Docker qua cổng localhost được map ra ngoài: `localhost:5432`, `localhost:6379`, `localhost:9000`.
  - **Webhook ngoài:** Không thể gửi vào máy bạn (UI trang Cài đặt Ngân hàng sẽ hiện cảnh báo vàng nhắc bạn dùng tunnel).

---

### 2. Kịch Bản 2: Dev Test Local với Cloudflare Tunnel (Code chạy Native + Docker Tunnel)

> **Mục đích:** Vừa giữ được **Hot-Reload tức thì** trên máy khi sửa code, vừa mở được **domain HTTPS công khai** (`sales-copilot.kakadev.xyz`) để nhận Webhook thật từ Facebook Messenger, Telegram, SePay hoặc gửi link cho người khác xem thử.
> **Lệnh chạy:**
> - Infra + Tunnel: `docker compose -f docker-compose.dev.yml --profile tunnel up -d`
> - App: `pnpm serve:server` (terminal 1) và `pnpm serve:web` (terminal 2)

```
[ Khách hàng / Meta Webhook / SePay ]
              │ (HTTPS)
              ▼
   [ Cloudflare Edge Server ]
              │ (Outbound Encrypted Tunnel)
              ▼
   ┌── Docker: sales_copilot_net ────────────────────────────────────────────────────────┐
   │                                                                                     │
   │  [ container: cloudflared ]                                                         │
   │        │                                                                            │
   │        ├── (domain: sales-copilot.kakadev.xyz) ──────────┐                          │
   │        └── (domain: storage-sales-copilot.kakadev.xyz) ──┼──────────┐               │
   │                                                          │          │               │
   │  [ container: nginx (:80) ] ◄────────────────────────────┘          ▼               │
   │        │                                            [ container: minio (:9000) ]    │
   │        │  (Định tuyến ngược ra máy HOST)                                            │
   │        ├── /api/*, /widget/*, /socket.io/* ──► http://host.docker.internal:8000     │
   │        └── /* (tất cả trang giao diện)     ──► http://host.docker.internal:3000     │
   └────────┼───────────────────────────────────────────────────┼────────────────────────┘
            │                                                   │
            ▼                                                   ▼
   [ NestJS Server trên HOST:8000 ]                    [ Next.js Server trên HOST:3000 ]
```

* **Luồng mạng:**
  1. `cloudflared` chạy trong Docker tạo đường hầm bảo mật ra Cloudflare.
  2. Khi Meta hoặc SePay gửi webhook tới `https://sales-copilot.kakadev.xyz/api/...`:
     - Cloudflare đẩy qua tunnel vào container `cloudflared`.
     - `cloudflared` gửi sang container `nginx`.
     - Nhờ cấu hình [`config/nginx/dev.conf`](../../config/nginx/dev.conf), Nginx sử dụng gateway đặc biệt **`host.docker.internal`** để chuyển tiếp traffic ngược trở lại ứng dụng đang chạy ở máy thật của bạn (`:8000` cho API, `:3000` cho Web).
  3. Khi trình duyệt gọi link ảnh `https://storage-sales-copilot.kakadev.xyz/...`:
     - `cloudflared` chuyển tiếp thẳng vào container `minio:9000`.

---

### 3. Kịch Bản 3: Test Local Full Service với Docker (Mô phỏng 100% Production)

> **Mục đích:** Kiểm tra xem Dockerfile build có lỗi không, toàn bộ app đóng gói 100% thành container chạy nội bộ với nhau có hoạt động ổn định trước khi deploy lên VPS thật hay không.
> **Lệnh chạy:**
> `docker compose -f docker-compose.prod.yml --profile tunnel up --build -d`

```
[ Internet / Khách hàng ] ──► [ Cloudflare Tunnel: sales-copilot.kakadev.xyz ]
                                              │
┌── Toàn bộ chạy trong Docker Network (sales_copilot_net) ───────────────────────────────┐
│                                             ▼                                          │
│                                  [ container: nginx (:80) ]                            │
│                                        │            │                                  │
│                ┌───────────────────────┘            └─────────────────────────┐        │
│                ▼                                                              ▼        │
│    [ container: web (Next.js :3000) ]                        [ container: server (:8000) ]
│      • Chạy bản standalone build                               • Chạy NestJS production
│      • SSR gọi API qua mạng nội bộ:                            • Tự kết nối nội bộ:    │
│        INTERNAL_API_URL=http://server:8000/api                   postgres:5432         │
│                                                                  redis:6379            │
│                                                                  minio:9000            │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

* **Luồng mạng:**
  - Không còn `host.docker.internal` nữa. Tất cả các container (`server`, `web`, `nginx`, `postgres`, `redis`, `minio`) nói chuyện với nhau trực tiếp bằng **Service Name** qua Docker DNS nội bộ.
  - **SSR Siêu Tốc (<1ms):** Khi người dùng tải trang, Next.js server-side gọi Backend thông qua `INTERNAL_API_URL=http://server:8000/api/v1` ngay trong RAM của Docker bridge network, hoàn toàn không tốn băng thông Internet.

---

### 4. Kịch Bản 4: VPS Production Docker (Triển khai chính thức)

> **Mục đích:** Ứng dụng chạy trên VPS production với domain chính thức (ví dụ: `https://app.yourdomain.com` hoặc dùng Cloudflare Tunnel).
> **Lệnh chạy:**
> `docker compose -f docker-compose.prod.yml up -d`

```
[ Người dùng truy cập ] & [ Webhooks (Meta, Telegram, SePay) ]
                          │
                          ▼ (HTTPS: Cổng 443 / 80)
┌── VPS Host ────────────────────────────────────────────────────────────────────────────┐
│                                                                                        │
│   ┌── [ Nginx Reverse Proxy Container ] ────────────────────────────────────────────┐  │
│   │   • SSL Termination (Let's Encrypt hoặc Cloudflare Origin CA)                  │  │
│   │   • Điều phối traffic theo URL Path:                                           │  │
│   │       ├── /api/*, /widget/*, /docs, /socket.io/*  ──► server:8000 (NestJS)     │  │
│   │       └── /* (Giao diện web)                      ──► web:3000 (Next.js)       │  │
│   └────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                        │
│   ┌── Mạng Nội Bộ Docker: sales_copilot_net (Cô lập hoàn toàn với bên ngoài) ──────┐  │
│   │                                                                                │  │
│   │   [ web:3000 ] ──(SSR: http://server:8000/api)──► [ server:8000 ]              │  │
│   │                                                         │                      │  │
│   │                  ┌──────────────────────────────────────┼───────────────┐      │  │
│   │                  ▼                                      ▼               ▼      │  │
│   │          [ postgres:5432 ]                       [ redis:6379 ]   [ minio:9000 ]
│   │          (Dữ liệu lưu volume)                    (Queue/State)    (Storage File)│
│   └────────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

* **Luồng mạng:**
  1. **Bảo mật tuyệt đối:** Cổng Database (`5432`), Redis (`6379`) và MinIO internal (`9000`) **không expose ra ngoài Internet**. Chỉ có container `nginx` mở cổng `80` (và `443`) để đón khách.
  2. **Single Domain thống nhất:** Khách hàng, nhân viên và các dịch vụ thứ ba (Meta, SePay) chỉ nhìn thấy 1 domain duy nhất (ví dụ `https://app.yourdomain.com`). Nginx sẽ tự phân luồng `/api/` vào backend và phần còn lại vào frontend.
  3. **Độc lập URL:** Nếu sau này bạn chuyển MinIO sang AWS S3 hoặc Cloudflare R2, bạn chỉ cần sửa biến `STORAGE_PUBLIC_ENDPOINT` trong file `.env` trên VPS mà không cần thay đổi bất kỳ dòng code hay cấu hình mạng nào.

---

### Bảng So Sánh Tóm Tắt 4 Kịch Bản

| Tiêu chí | 1. Dev Local | 2. Dev Test + Tunnel | 3. Test Full Docker | 4. VPS Production |
| :--- | :--- | :--- | :--- | :--- |
| **Backend & Web chạy ở đâu?** | Native trên máy host | Native trên máy host | Container Docker local | Container Docker trên VPS |
| **Hot Reload khi sửa code?** | Có (rất nhanh) | Có (rất nhanh) | Không (phải rebuild) | Không |
| **Nhận được Webhook ngoài?** | ❌ Không | ✅ Có (qua Tunnel) | ✅ Có (qua Tunnel) | ✅ Có (qua Domain/Tunnel) |
| **Nginx trỏ tới đâu?** | Không dùng Nginx | `host.docker.internal` | `server:8000`, `web:3000` | `server:8000`, `web:3000` |
| **Next.js SSR gọi API qua:** | `localhost:8000` | `localhost:8000` | `http://server:8000/api` | `http://server:8000/api` |