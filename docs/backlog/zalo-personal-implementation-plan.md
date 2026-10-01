# Implementation Plan — Zalo Cá nhân (ZALO_PERSONAL, kênh song song)

> **Trạng thái:** Đã chốt với user qua phỏng vấn (2026-10-02) — implement ngay sau plan này.
> **Vị trí:** Kênh **song song** với `ZALO` (OA) — không thay thế. OA vẫn là kênh chính thức cho production.
> **Nền tảng:** [zca-js](https://github.com/RFS-ADRENO/zca-js) (unofficial, MIT) + báo cáo khảo sát `docs/backlog/zalo-personal-research.md`.
> **Out of scope (cấm):** Zalo Mini App, ZNS, tin nhóm (phase sau).

## 1. Các quyết định đã chốt (phỏng vấn 2 vòng, 2026-10-02)

| # | Quyết định | Chốt |
|---|---|---|
| 1 | Loại tin MVP | **Nhận đủ** (text/ảnh/sticker/file/link), **gửi text** (gửi media để phase sau) |
| 2 | Tin nhóm (ThreadType.Group) | **Không** — chỉ 1-1; event nhóm bị bỏ qua |
| 3 | Tin chủ tài khoản gửi từ điện thoại | **Ghi vào inbox** như Message OUTGOING (`selfListen: true`) + chống loop bằng msgId (mục 4.4) |
| 4 | Số tài khoản/workspace | **Nhiều** — mỗi tài khoản = 1 inbox; 1 tài khoản chỉ kết nối **1 channel trong toàn hệ thống** (check `ownUserId` cross-tenant như OA) |
| 5 | Rủi ro ToS/ban | **Chấp nhận** + cảnh báo rõ trong UI (bước connect + config) + khuyến nghị tài khoản phụ |
| 6 | AI Copilot | **Mặc định TẮT** cho inbox ZALO_PERSONAL (override default của workspace), owner tự bật |
| 7 | Rate limiter | **Có**: serialize gửi per-channel, tối thiểu ~1.5s giữa 2 tin + cap tin/ngày (hằng số, exceeded → Message FAILED `ZALO_PERSONAL_RATE_LIMITED`) |
| 8 | Thời điểm | Implement ngay sau plan |

## 2. Kiến trúc

### 2.1. Server — `apps/server/src/modules/omnichannel/integrations/zalo-personal/`
| File | Vai trò |
|---|---|
| `zalo-personal.constants.ts` | Rate limit (min interval 1500ms, daily cap), connect session TTL (10'), reconnect backoff (5s→15s→45s→2m→cap 5m), option `checkUpdate:false, logging:false` |
| `zalo.types.ts` | Kiểu tối thiểu cho message/credentials của zca-js (import type từ lib nếu export; tự khai phần thiếu) |
| `zalo-personal-client.provider.ts` | Provider bọc class `Zalo` của zca-js (DI seam cho unit test mock) |
| `zalo-personal-connection.service.ts` | **Hạt nhân**: map `channelId → {zalo, api}`; `OnApplicationBootstrap` re-login từ credentials mã hóa cho mọi channel connected; supervisor bắt `disconnected` → backoff re-login; login(cred) thất bại chắc chắn (hết phiên) → `isConnected:false` + `reauthorizationRequired:true`; connect-session in-memory (QR flow); ingest entry: self-message & message → envelope → `WebhooksService.handleInboundWebhook(channelId, envelope, headers, query, {skipSignatureVerification: true})` (tái dùng dedupe/queue/AI Copilot) |
| `zalo-personal-rate-limiter.service.ts` | Serialize + spacing gửi per-channel; đếm tin/ngày (reset theo ngày, in-memory đủ vì 1 listener/instance) |
| `zalo-personal.adapter.ts` | `ChannelAdapter` (`channelType = ZALO_PERSONAL`): `parseInboundPayload` (map message zca-js → InboundMessagePayload; `externalMessageId = data.msgId`; 1-1 only — event Group bị bỏ), `sendMessage` (text qua rate limiter; media → throw `ZALO_PERSONAL_OUTBOUND_MEDIA_UNSUPPORTED` rõ ràng), `fetchSenderInfo` → `getUserInfo` (name/avatar), `getChannelInfo` → profile own account; `verifyWebhook` **luôn false** (HTTP route phải fail-closed — inbound chỉ đến từ listener nội bộ) |
| `zalo-personal.controller.ts` | OAuth-không: `POST connect-session` (bắt loginQR, trả `sessionId`), `GET connect-session/:id/status` (poll: `pending/qr_ready/connected/failed/expired` + `qrImage` base64 + profile name/ownId khi xong), `POST connect` (từ draft: tạo Inbox+Channel 1 tx, persist credentials mã hóa, đăng ký listener), `POST reauthorize/:channelId` (quét QR mới cho channel session chết) — guard OWNER/ADMIN + WorkspaceGuard |
| `zalo-personal.module.ts` | Register adapter + connection service; import vào `integrations.module.ts` |

### 2.2. DB & contracts
- Prisma enum `ChannelType` += `ZALO_PERSONAL` (migration) + `packages/shared-contracts` enums.
- Credentials (mã hóa): `{imei, cookie, userAgent, ownUserId}`; `providerAccountId = ownUserId` (unique cross-tenant); `settings`: `{zaloName, avatar, lastConnectedAt}`.
- Inbox AI policy: khi tạo inbox ZALO_PERSONAL, set `aiCommercePolicy.enabled = false` mặc định (ghi đè default workspace) — owner bật lại trên UI.

### 2.3. Hợp đồng tin nhắn
- **Inbound**: `message.isSelf === false` → Contact/Conversation/Message INCOMING như thường (attachments theo `message.data.content` object; URL http(s) → StorageService tải như pipeline hiện có, lỗi tải → giữ external URL).
- **Self (điện thoại chủ)**: `message.isSelf === true`:
  - `data.msgId` **đã có** trong `Message.externalId` (server vừa gửi) → **bỏ qua** (chống loop).
  - Chưa có → tìm conversation qua `ChannelIdentity(channelId, threadId)` → tạo Message **OUTGOING**, `senderType = AGENT` (senderId null, `metadata.selfMessage = true`), không dispatch outbound lại (không gửi ngược ra Zalo — flag trong payload/`metadata` để `OutboundMessageListener` skip, ví dụ `metadata.suppressOutbound = true`).
- **Outbound**: agent/AI trả lời → `sendMessage` qua rate limiter → `Message.externalId = msgId trả về`.

### 2.4. Web — `apps/web/src/features/settings/inboxes/`
- `new/channels/zalo-personal/`: flow = cảnh báo ToS (bắt đầu) → nút tạo phiên → **poll status hiển thị QR** → quét → hiện tên tài khoản → submit draft → collaborators → connect. Schema Zod không cần secret (khác OA).
- `detail/channels/zalo-personal/zalo-personal-config.tsx`: trạng thái + tên tài khoản, cảnh báo "đừng mở Zalo Web cùng tài khoản", nút **Kết nối lại (quét QR)** khi `reauthorizationRequired`, toggle AI (đã có sẵn theo inbox), ngắt kết nối.
- `channel-registry` + renderer + placeholder dọn ZALO_PERSONAL; icon dùng lại `/channels/zalo.png` (hoặc icon riêng nếu có).

### 2.5. Ràng buộc vận hành (ghi vào config UI + docs)
- 1 web listener/tài khoản: **không mở chat.zalo.me cùng tài khoản** trong lúc bot chạy.
- 1 instance server/tài khoản (đa replica = future work: leader election).
- `checkUpdate: false` trên prod.

## 3. Tests
- **Unit** (mock `Zalo` qua provider): adapter parse (text/ảnh/sticker/file, group bị bỏ, isSelf), sendMessage + rate limiter (spacing, daily cap → FAILED), connection service (re-login bootstrap, disconnected → backoff, session chết → reauthRequired, self-dedupe loop), controller (connect-session lifecycle, cross-tenant ownUserId check).
- **e2e**: seed `ZALO_PERSONAL` (thêm vào `seed.ts`) + fixture inbound envelope qua `handleInboundWebhook` in-process (skipSignature) → Contact/Conversation/Message/WS; outbound qua `message.created` → mocked api.
- **Verification**: lint / typecheck / unit / web test / e2e — zero regression.

## 4. Rủi ro chấp nhận (đã có user consent)
- ToS Zalo: tài khoản có thể bị khóa/banned → cảnh báo UI bắt buộc + khuyến nghị tài khoản phụ.
- API nội bộ có thể đổi → pin exact version `zca-js` trong package.json.
- 1 web session/tài khoản → hướng dẫn vận hành.
