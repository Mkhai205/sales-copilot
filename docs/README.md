# Sales Copilot — Documentation Hub

Tài liệu kỹ thuật & sản phẩm của **Sales Copilot** (Omnichannel Conversational Commerce). Dự án ở giai đoạn **Pre-production** — kiến trúc có thể thay đổi thường xuyên, quy ước tài liệu nằm ở cuối trang này.

---

## Trạng thái dự án (cập nhật 2026-10-03)

| Phase | Phạm vi | Trạng thái |
|:---|:---|:---:|
| Phase 1 | Omnichannel Conversation Platform Core | ✅ Done — [Biên bản nghiệm thu](./audit/phase-1-completion-signoff.md) |
| Phase 2 | D2C Commerce & Orders (Kho, OMS, VietQR, Super Admin) | ✅ Done |
| Phase 3 | AI Agent Framework & Cleanup | ✅ Done |
| Phase 4 | Comprehensive Codebase Audit + Remediation | ✅ Done (2026-09-28) |
| **Phase 3C** | **Expansion: Shipping v2 (GHN/GHTK/ViettelPost), Zalo** | 🔄 Zalo OA + Zalo Personal ✅ đã deploy — còn Shipping v2 |

⛔ **QUY TẮC BẤT BIẾN**: Phase 1 APIs, schemas và contracts đã ổn định — tuyệt đối không refactor làm vỡ baseline. Toàn bộ trọng tâm hiện tại dành cho Phase 3C.

---

## Sitemap

### 🧭 System Handbook (`system/`) — kiến trúc as-built, derive trực tiếp từ code
| Tài liệu | Nội dung |
| :--- | :--- |
| **[00 — Tổng quan hệ thống](./system/00-overview.md)** | Sơ đồ topology, monorepo, hạ tầng, role, chỉ mục bộ tài liệu. |
| **[01 — Kiến trúc Backend](./system/01-backend.md)** | NestJS modular monolith: 8 module groups, request pipeline, bản đồ API surface, BullMQ, EventEmitter2, WebSocket, auth. |
| **[02 — Luồng dữ liệu](./system/02-data-flows.md)** | Sequence diagram: tin nhắn vào/ra, AI autopilot, bán hàng + VietQR, auto-assignment, fan-out realtime. |
| **[03 — Mô hình dữ liệu](./system/03-data-model.md)** | ERD 27 models, multi-tenancy, state machines, 20 enums, ràng buộc unique. |
| **[04 — Kiến trúc Frontend](./system/04-frontend.md)** | Cấu trúc feature-sliced, fetch wrapper, auth cookie + proxy.ts, TanStack Query, realtime sync, widget SDK. |
| **[05 — Danh mục trang](./system/05-frontend-pages.md)** | Toàn bộ route của apps/web + ai truy cập + cơ chế guard route. |
| **[06 — Tích hợp hệ thống ngoài](./system/06-integrations.md)** | ChannelAdapter 5 kênh, webhook security, idempotency, AI tools, VietQR/đối soát, hạ tầng. |

### 📐 Kiến trúc (`architecture/`)
| Tài liệu | Nội dung |
| :--- | :--- |
| **[System Architecture](./architecture/01-system-architecture.md)** | Modular Monolith, Ingestion Pipeline, RBAC 2 tầng, chuẩn REST/WebSocket. ⚠️ Baseline cũ (7 contexts) — đã được thay bởi [System Handbook 01](./system/01-backend.md). |
| **[Data & Integrations](./architecture/02-data-and-integrations.md)** | PostgreSQL, Redis, MinIO, Channel Adapters, Webhooks. ⚠️ Baseline cũ — đã được thay bởi [System Handbook 03/06](./system/03-data-model.md). |
| **[Commerce & Orders RFC](./architecture/rfc-commerce-and-orders.md)** | Đặc tả kỹ thuật Commerce: models, khóa kho nguyên tử `$transaction`, Dynamic VietQR NAPAS 247, đối soát ngân hàng. |
| **[Super Admin RFC](./architecture/rfc-super-admin.md)** | Đặc tả kỹ thuật Super Admin Portal: SystemSetting, Quota, Feature Flags, PlatformRolesGuard. |
| **[AI Agent Framework RFC](./architecture/rfc-ai-agent-framework.md)** | Đặc tả kỹ thuật AI Sales Agent: Vercel AI SDK, Commerce Tools, Comment Guard, Human Takeover. |

### 📦 Product (`product/`)
| Tài liệu | Nội dung |
| :--- | :--- |
| **[Vision](./product/01-vision.md)** | Tầm nhìn "The Chat IS the Point of Sale", so sánh Pancake.vn, luồng tổng thể. |
| **[Scope & Requirements](./product/02-scope-and-requirements.md)** | Nguồn chân lý về phân kỳ, hàng rào B2B CRM, ma trận FR/NFR. |
| **[Commerce & Orders PRD](./product/prd-commerce-and-orders.md)** | Đặc tả sản phẩm Commerce (Milestone 2A): lên đơn trong Chat, Kho/SKU, OMS, VietQR. |
| **[Super Admin PRD](./product/prd-super-admin.md)** | Đặc tả Super Admin Portal: Workspaces, Quota, Feature Flags, Platform Audit. |
| **[AI Agent Framework PRD](./product/prd-ai-agent-framework.md)** | Đặc tả sản phẩm AI Agent: 4 chế độ automation, commerce tools, Comment Guard, AI Settings UI. |

### 🛠️ Guides (`guides/`)
| Tài liệu | Nội dung |
| :--- | :--- |
| **[Environment Setup](./guides/environment-setup-guide.md)** | Thiết lập biến môi trường, CSDL và dịch vụ phụ trợ. |
| **[Local Testing](./guides/local-testing-guide.md)** | Chạy môi trường dev và kiểm thử cục bộ với Docker Compose. |
| **[Network Traffic Flow](./guides/network-traffic-flow.md)** | Luồng traffic: Cloudflare Tunnel → Nginx → API/Web/MinIO, webhook inbound. |

### 📋 Backlog (`backlog/`)
| Tài liệu | Nội dung |
| :--- | :--- |
| **[Backlog Hub & AI Orchestration Playbook](./backlog/README.md)** | Phân kỳ hiện tại + cẩm nang điều phối AI Coding Agent. |
| **[Phase 3C Expansion](./backlog/phase-3c-expansion.md)** | Backlog đang active: Shipping Module redesign (CarrierAdapter), kênh Zalo. |

### 🔍 Audit (`audit/`)
| Tài liệu | Nội dung |
| :--- | :--- |
| **[Phase 1 Sign-Off](./audit/phase-1-completion-signoff.md)** | Biên bản nghiệm thu chính thức Phase 1. |
| **Phase 4 Audit-of-Record (2026-09-28)** | 9 báo cáo: [baseline](./audit/phase-4-m4.0-baseline-report.md), [dead-code cleanup](./audit/phase-4-m4.1-dead-code-cleanup-report.md), [architecture consistency](./audit/phase-4-m4.2-architecture-consistency-report.md), [bug hunting](./audit/phase-4-m4.2-bug-hunting-report.md), [performance](./audit/phase-4-m4.3-performance-report.md), [schema](./audit/phase-4-m4.3-schema-report.md), [security](./audit/phase-4-m4.3-security-report.md), [remediation](./audit/phase-4-m4.4-remediation-report.md), [decisions](./audit/phase-4-decisions-2026-09-28.md). |

### 📝 Working notes (`test/`)
- **[log-bug.md](./test/log-bug.md)** — ghi chú công việc / checklist của chủ dự án.

---

## Quy ước tài liệu

1. **Audit**: chỉ giữ audit-of-record gần nhất trong repo; các đợt audit cũ nằm trong git history (`git log --oneline -- docs/audit`).
2. **Backlog**: epic/feature đã nghiệm thu bị xóa khỏi repo — git history là archive (`git log --oneline -- "docs/backlog/archive"`).
3. **Nguồn chân lý code**: xem [`AGENTS.md`](../AGENTS.md). API docs tự sinh tại Swagger: `http://localhost:8000/docs`.
