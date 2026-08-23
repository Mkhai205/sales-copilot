# Technology Stack (Phase 1)

## 1. Stack Components

| Layer | Công nghệ | Phiên bản | Vai trò & Mục đích |
| :--- | :--- | :--- | :--- |
| **Backend Framework** | NestJS | 11.2+ | Modular Monolith REST API & WebSocket Engine |
| **Language** | TypeScript | 5.8+ | Kiểu dữ liệu chặt chẽ trên toàn bộ kiến trúc |
| **ORM / Data Access** | Prisma ORM | 6.4+ | Type-safe Database client & Schema Migrations |
| **Relational Database**| PostgreSQL | 16+ | CSDL quan hệ lưu trữ dữ liệu nghiệp vụ chính |
| **In-Memory & Cache** | Redis | 7.2+ | Pub/Sub, Presence tracking, Distributed locks |
| **Background Queues** | BullMQ | Latest | Hàng đợi xử lý Ingestion & Webhook retry |
| **Object Storage** | MinIO S3 | Latest | Lưu trữ tệp đính kèm, hình ảnh, voice notes |
| **Frontend Framework**| Next.js (App Router) | 16.3+ | Giao diện Agent Dashboard & Admin Console |
| **UI Library** | React & Tailwind CSS | React 19, Tailwind v4 | Thiết kế giao diện hiệu năng cao |
| **Monorepo Tooling** | Nx | 23.1+ | Quản trị dự án Monorepo đa package |
