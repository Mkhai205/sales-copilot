# Sales Copilot Platform — System Documentation Hub

Chào mừng bạn đến với trung tâm tài liệu kỹ thuật, kiến trúc và thiết kế hệ thống của **Sales Copilot Platform**.

---

## 📌 1. Lộ trình phân kỳ & Phạm vi (Project Phasing & Scope Guardrail)

### 🟢 Phase 1: Omnichannel Conversation Platform Core (COMPLETED BASELINE)
- **Trạng thái**: **100% Hoàn thành & Nghiệm thu** ([Biên bản nghiệm thu](./audit/phase-1-completion-signoff.md) — 1.277 automated tests passing).
- **Phạm vi**: Multi-tenancy, Omnichannel Ingestion, 3NF Contact & Channel Identity resolution, Vòng đời Conversation & Message đa hình, Auto-assignment Round-Robin, Canned Responses, Automation Rules, Outbound Webhooks, Realtime WebSocket (Socket.io + Redis Pub/Sub), và Next.js Dashboard.
- ⛔ **QUY TẮC BẤT BIẾN**: Phase 1 APIs, schemas và contracts đã ổn định, **tuyệt đối không refactor làm vỡ Phase 1 baseline**.

### 🟡 Phase 2: D2C Conversational Commerce & AI Auto-pilot POS (CURRENT ACTIVE SCOPE)
- **Trạng thái**: **Đang triển khai tích cực** ([Master Backlog Hub](./backlog/README.md)).
- **Phạm vi**:
  - **Milestone 2A (Commerce Core)**: Epic 2.1 (Built-in Inventory & Catalog), Epic 2.2 (In-Chat POS & Orders OMS), Epic 2.3 (Dynamic VietQR & Instant Bank Reconciliation).
  - **Milestone 2B (Super Admin Portal)**: Epic 2.4 (Super Admin Portal, Quota & Dynamic Settings).
  - **Milestone 2C (AI Automation)**: Epic 2.5 (AI NER 3-Tier Address Extraction), Epic 2.6 (24/7 AI Auto-pilot & Discount Engine), Epic 2.7 (Anti-theft Comment Auto-masking).
- ⛔ **QUY TẮC BẢO VỆ**: Tuyệt đối không tạo models cho B2B CRM hoặc Phase 3 khi đang làm Phase 2. Toàn bộ trọng tâm dành riêng cho Bán lẻ & D2C Conversational Commerce.

---

## 🗺️ 2. Danh mục tài liệu kỹ thuật (Documentation Sitemap)

### 📐 Kiến trúc hệ thống (`architecture/`)
| Tài liệu | Mô tả chi tiết |
| :--- | :--- |
| **[System Architecture](./architecture/01-system-architecture.md)** | Bản đặc tả tổng quan kiến trúc Modular Monolith, Technology Stack, 7 Bounded Contexts, Ingestion Pipeline (<100ms), 4 chế độ AI Automation, RBAC 2 tầng, Chuẩn REST Envelope/Swagger, Realtime WebSocket và Quy tắc Vòng đời Hội thoại/Round-Robin. |
| **[Data & Integrations](./architecture/02-data-and-integrations.md)** | Kiến trúc lưu trữ CSDL PostgreSQL 16 (Multi-tenancy isolation & indexes), Redis 7 (locks, pub/sub), MinIO S3, Channel Adapters đa kênh và Outbound Webhooks. |
| **[Commerce & Orders RFC](./architecture/rfc-commerce-and-orders.md)** | Đặc tả kỹ thuật lõi Thương Mại D2C: Models, Thuật toán khóa kho nguyên tử 2 tầng ($transaction), chuẩn Dynamic VietQR NAPAS 247 và Đối soát ngân hàng tự động. |
| **[Super Admin RFC](./architecture/rfc-super-admin.md)** | Đặc tả kỹ thuật Cổng Super Admin Portal: Models SystemSetting, PlatformAuditLog, Redis 2-tier Caching, PlatformRolesGuard và Layout /admin. |

> 💡 **Tài liệu API tương tác (Swagger UI)**: Toàn bộ REST Endpoints được tự động sinh tại `http://localhost:8000/docs`. Chuẩn Envelope và Realtime WebSocket được quy định trong [`01-system-architecture.md`](./architecture/01-system-architecture.md).

---

### 📦 Product & Yêu cầu sản phẩm (`product/`)
| Tài liệu | Mô tả chi tiết |
| :--- | :--- |
| **[Product Vision](./product/01-vision.md)** | Tầm nhìn "The Chat IS the Point of Sale", triết lý thiết kế D2C, so sánh Pancake.vn và sơ đồ luồng tổng thể. |
| **[Scope & Requirements Matrix](./product/02-scope-and-requirements.md)** | Nguồn chân lý duy nhất về phân kỳ 3 Phase, hàng rào cấm B2B CRM, ma trận FR (chức năng) và NFR (phi chức năng). |
| **[Commerce & Orders PRD](./product/prd-commerce-and-orders.md)** | Bản đặc tả sản phẩm Thương Mại D2C (Milestone 2A): Khung lên đơn nhanh trong Chat, Quản lý Kho (SKU, Stock In, Adjustment), Quản trị Đơn hàng (OMS), Dynamic VietQR và đối soát Webhook. |
| **[Super Admin PRD](./product/prd-super-admin.md)** | Đặc tả yêu cầu sản phẩm Super Admin Portal & Cấu hình Động: Quản lý Workspaces, Hạn mức Quota, Feature Flags và Platform Audit Logs. |

---

### 📋 Backlog & Kế hoạch thực thi (`backlog/`)
| Tài liệu | Mô tả chi tiết |
| :--- | :--- |
| **[Backlog Master Hub & AI Playbook](./backlog/README.md)** | Trung tâm quản lý lộ trình Phase 2, Ma trận tiến độ 7 Epics và Cẩm nang quy trình điều phối AI Coding Agent. |
| **[Epic 2.1: Kho & SKU Biến Thể](./backlog/epic-2.1-inventory-and-catalog.md)** | Quản lý sản phẩm, biến thể SKU, tồn kho 3 trạng thái, điều chỉnh kho và sổ cái `InventoryTransaction`. |
| **[Epic 2.2: Lên Đơn & OMS](./backlog/epic-2.2-in-chat-pos-and-orders.md)** | Khung lên đơn nhanh trong Chat, Order State Machine, khóa kho 2 tầng và Redis 30s lock. |
| **[Epic 2.3: Dynamic VietQR & Gạch Nợ](./backlog/epic-2.3-vietqr-and-reconciliation.md)** | Dynamic VietQR NAPAS 247, Webhook SePay/Casso gạch nợ tự động < 1s và bắn realtime `order.paid`. |
| **[Epic 2.4: Super Admin Portal](./backlog/epic-2.4-super-admin-portal.md)** | Cổng quản trị nền tảng `/admin`, Quản lý Workspaces, Hạn mức Quota, Feature Flags và Platform Audit. |
| **[Epic 2.5: AI Bóc Tách Địa Chỉ](./backlog/epic-2.5-ai-address-ner.md)** | Regex bóc tách SĐT 10 số và chuẩn hóa địa chỉ 3 cấp Tỉnh - Huyện - Xã 1-click. |
| **[Epic 2.6: AI Auto-pilot & Giảm Giá](./backlog/epic-2.6-ai-autopilot-discount.md)** | 4 chế độ AI Automation, Đàm phán giảm giá có kiểm soát và Chốt đơn nửa đêm (Midnight Checkout). |
| **[Epic 2.7: Ẩn Bình Luận Chống Cướp](./backlog/epic-2.7-comment-guard.md)** | Quét SĐT bình luận < 1s, tự động ẩn bài viết công khai và gửi Private Message kéo khách vào inbox. |
| **[Archive Phase 1](./backlog/archive/phase-1/backlog.md)** | Lưu trữ lịch sử 12 Epics Phase 1 đã hoàn thành 100%. |

---

### 🛠️ Kỹ thuật & Kiểm thử (`guides/` & `test/`)
| Tài liệu | Mô tả chi tiết |
| :--- | :--- |
| **[AGENTS.md](../AGENTS.md)** | Nguồn chân lý duy nhất (Single Source of Truth) về tiêu chuẩn viết code Pragmatic Modular Monolith, YAGNI, KISS, quy tắc co-location, Zod pipes, Shadcn UI và Testing CLI Runbook. |
| **[Local Testing Guide](./guides/local-testing-guide.md)** | Hướng dẫn chạy môi trường dev và kiểm thử cục bộ với Docker Compose. |
| **[Environment Setup Guide](./guides/environment-setup-guide.md)** | Hướng dẫn thiết lập biến môi trường, cơ sở dữ liệu và các dịch vụ phụ trợ. |
| **[Manual Testing & Features Guide](./test/manual-testing-guide.md)** | Hướng dẫn manual test chi tiết 8 kịch bản thực tế, tổng hợp tính năng, use cases và bug radar. |

---

### 🔍 Nghiệm thu & Tham khảo (`audit/` & `references/`)
| Tài liệu | Mô tả chi tiết |
| :--- | :--- |
| **[Phase 1 Sign-Off Report](./audit/phase-1-completion-signoff.md)** | Báo cáo chứng nhận nghiệm thu chính thức Phase 1 (1.277 tests pass, 0 lỗi TypeScript/Lint). |
| **[Master Remediation Plan](./audit/10-master-remediation-plan.md)** | Danh mục 33 hạng mục cải tiến và hardening đã thực hiện cho Phase 1. |
| **[Chatwoot Reference Guide](./references/chatwoot/README.md)** | Bản đồ đối soát nghiệp vụ hội thoại với mã nguồn Chatwoot chính thức trên GitHub. |
