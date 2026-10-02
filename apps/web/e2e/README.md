# Playwright UI e2e (apps/web)

Chạy UI e2e **local** với dev stack đang đứng:

```bash
pnpm serve:server   # API  → http://localhost:8000 (dev DB đã seed: pnpm db:seed)
pnpm serve:web      # Web  → http://localhost:3000
pnpm test:ui        # Playwright (chromium) — login bằng tài khoản admin demo qua API
```

- `global-setup` login 1 lần qua `POST /auth/login` và lưu cookie httpOnly vào `e2e/.auth/admin.json` (gitignored) — mọi spec đều đã đăng nhập.
- Dữ liệu assertion dựa trên seed demo (`default-workspace`): đơn `ORD-20260901-0001`, sản phẩm "Tai nghe Bluetooth Sony…", biến thể "Màu Đen (Black)".
- Spec tạo dữ liệu mới dùng tiền tố `PW-E2E-`/`PWE2E-` để tránh đụng dữ liệu thật.
- `playwright.config.ts` đặt `reuseExistingServer` mặc định — suite KHÔNG tự khởi động server.
