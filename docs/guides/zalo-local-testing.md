# Guide — Test kênh Zalo OA cục bộ (không cần OA thật / app chưa duyệt)

> Khi Zalo App chưa được xét duyệt quyền API (`-14029`) hoặc chưa có OA thật, có thể test **toàn bộ pipeline Zalo** (lifecycle, inbound webhook ký MAC, Contact sync, trả lời agent/AI Copilot) bằng một mock server chạy cục bộ. Chỉ riêng **popup OAuth connect qua UI** là không mô phỏng được (xảy ra trên trang oauth.zaloapp.com của Zalo) — thay vào đó ta tạo inbox qua API.

## 1. Khởi động mock server

```bash
node apps/server/scripts/zalo-mock-server.mjs
# → [zalo-mock] Mock Zalo server listening on http://localhost:8321
```

Cổng đổi được qua `ZALO_MOCK_PORT`.

## 2. Trỏ backend vào mock

Thêm vào `apps/server/.env`:

```env
ZALO_OPEN_API_BASE=http://localhost:8321/v3.0
```

Khởi động lại server (`pnpm serve:server`).

## 3. Tạo inbox Zalo qua API (thay popup OAuth)

Đăng nhập lấy token (đổi email/password theo tài khoản admin của bạn):

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"Password123!"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).tokens.accessToken))")
```

Tạo inbox (đổi `WORKSPACE_ID` lấy từ URL app, ví dụ `.../settings/inboxes` thuộc workspace đang dùng):

```bash
curl -s -X POST http://localhost:8000/api/v1/inboxes \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Workspace-Id: WORKSPACE_ID" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Zalo Mock OA",
    "channelType": "ZALO",
    "channelCredentials": {
      "appId": "mock_app",
      "accessToken": "mock_access_token",
      "refreshToken": "mock_refresh_token",
      "accessTokenExpiresAt": "2030-01-01T00:00:00.000Z",
      "oaSecretKey": "local-mock-oa-secret"
    }
  }' | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const r=JSON.parse(d);console.log('inboxId:',r.data.id,'channelId:',r.data.channel.id,'isConnected:',r.data.channel.isConnected)})"
```

Lifecycle sẽ gọi `GET /v3.0/oa` trên mock → `isConnected: true`, OA name "Mock Zalo OA" hiển thị ở màn cấu hình inbox kèm Webhook URL.

## 4. Giả lập khách nhắn tin (webhook ký MAC)

Đổi `CHANNEL_ID` bằng channelId ở bước 3, chạy:

```bash
node -e "
const crypto=require('crypto');
const appId='mock_app', secret='local-mock-oa-secret';
const ts=String(Date.now());
const body=JSON.stringify({event_name:'user_send_text',app_id:appId,timestamp:ts,data:JSON.stringify({sender:{id:'mock_user_1'},recipient:{id:'mock_oa_123'},message:{msg_id:'in_'+ts,text:'Xin chào, cho mình hỏi giá?'}})});
const mac=crypto.createHash('sha256').update(appId+body+ts+secret).digest('hex');
fetch('http://localhost:8000/api/v1/channels/CHANNEL_ID/webhook',{method:'POST',headers:{'Content-Type':'application/json','x-zevent-signature':mac},body}).then(r=>r.text()).then(console.log);
"
```

Kỳ vọng: tin nhắn xuất hiện trong Inbox UI (conversation mới với Contact "Mock User (_1)"), mock server log request.

Sửa `text`/`msg_id` để gửi thêm tin; đổi `event_name` thành `user_send_image` + `attachments:[{type:'image',payload:{url:'https://...'}}]` để test ảnh.

## 5. Trả lời & AI Copilot

- Trả lời thủ công trong Inbox UI → outbound listener gọi mock `POST /v3.0/oa/message/cs` → mock log `→ delivering to user ...` → Message chuyển `SENT` với `externalId = mock_msg_N`.
- Bật AI autopilot cho inbox → tin inbound sẽ được AI trả lời qua cùng đường ống.

## 6. Test handshake + chữ ký sai

```bash
# Callback verify (không cần chữ ký) — kỳ vọng echo: {"code":0,"data":{"verify_token":"vt_x"}}
curl -s -X POST http://localhost:8000/api/v1/channels/CHANNEL_ID/webhook \
  -H 'Content-Type: application/json' \
  -d '{"event_name":"oa_callback_verify","data":"{\"verify_token\":\"vt_x\"}"}'

# MAC sai — kỳ vọng 401 INVALID_WEBHOOK_SIGNATURE
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:8000/api/v1/channels/CHANNEL_ID/webhook \
  -H 'Content-Type: application/json' -H 'x-zevent-signature: deadbeef' \
  -d '{"event_name":"user_send_text","data":"{}"}'
```

## Lưu ý

- ⚠️ **Đừng nhầm hai URL**: OAuth Redirect URI (`/api/v1/integrations/zalo/callback` — đăng ký trên developers.zalo.me cho luồng ủy quyền, đối chiếu ở **Official Account → Thiết lập chung**) khác với **Webhook URL** (`/api/v1/channels/{channelId}/webhook` — dán vào OA Console để nhận sự kiện). Dán Redirect URI vào ô Webhook sẽ nhận 404 vì route đó chỉ nhận GET.
- Mock chỉ thay **OpenAPI** (`openapi.zalo.me`); các endpoint OAuth (`oauth.zaloapp.com`) không qua mock vì popup chạy trên trang Zalo thật.
- Khi có app được duyệt + OA thật: bỏ `ZALO_OPEN_API_BASE` khỏi `.env`, restart, và connect bằng UI như thường.
- Đây chỉ dùng cho dev/staging — không bật `ZALO_OPEN_API_BASE` trên production.
- Bản đồ mã lỗi connect (-14029/-14003/-14068): xem `docs/backlog/phase-3c-zalo-oa-implementation-plan.md` §5b.
