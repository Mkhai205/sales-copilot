# Sales Copilot Platform

> **Omnichannel Conversational Commerce & AI Sales Platform** for D2C & Retail — built with NestJS 11, Next.js 16, PostgreSQL (Prisma 7), Redis, MinIO, and WebSockets.

[![Nx Monorepo](https://img.shields.io/badge/Monorepo-Nx%2023-blue.svg)](https://nx.dev)
[![NestJS](https://img.shields.io/badge/Backend-NestJS%2011-ea2849.svg)](https://nestjs.com)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2016-black.svg)](https://nextjs.org)
[![Prisma](https://img.shields.io/badge/ORM-Prisma%207-2d3748.svg)](https://prisma.io)
[![CI](https://github.com/Mkhai205/sales-copilot/actions/workflows/ci.yml/badge.svg)](https://github.com/Mkhai205/sales-copilot/actions/workflows/ci.yml)

## 🎯 Overview

Sales Copilot is a **Conversation-First** platform for D2C & retail sellers, built on the premise that **the chat conversation IS the point of sale**. It unifies every messaging channel into one realtime agent dashboard, puts inventory, orders, and VietQR payment collection directly inside the chat, and lets a configurable AI Auto-pilot consult, negotiate, and close orders 24/7 — no tab-switching to external sales tools, no fake-bill risk, no agent collisions.

## ✨ Features

- **📥 Omnichannel Inbox** — Unify Web Chat, Facebook Messenger, Zalo OA, and Telegram into one realtime dashboard (< 200ms WebSocket). 3NF contact identity resolution & merge, conversation lifecycle (`OPEN / PENDING / RESOLVED / SNOOZED`), internal private notes, media attachments, Round-Robin auto-assignment, `/` slash canned responses, and automation rules.
- **🛒 Conversational Commerce** — An in-chat POS right beside the conversation: SKU variant catalog & inventory (stock-in, adjustments, ledger), atomic stock reservation against overselling, Redis 30s collision lock with Takeover, full OMS (filters, tracking codes, auto-restock on cancel), and Dynamic VietQR (NAPAS 247) with instant bank-webhook reconciliation (< 1s via SePay/Casso).
- **🤖 AI Auto-pilot** — Four configurable modes (24/7, off-hours, overflow, manual). LLM agent with tool-use on the real catalog & orders, guarded discount negotiation (`DiscountPolicyEngine`), AI address NER with 3-tier normalization, automatic draft orders + QR payment card — including midnight checkout while the team sleeps. An independent Comment Guard hides phone-number comments in < 1s and pulls the customer into the inbox.
- **⚙️ Platform** — Strict multi-tenancy (`workspaceId` isolation on every query & socket room), 2-tier RBAC (Platform + Workspace roles), Super Admin Portal (workspaces, quotas, feature flags, metadata-only audit), AES-256-GCM channel credential encryption, and idempotent BullMQ pipelines.

## 🧰 Tech Stack

| Layer    | Technologies                                                                       |
| :------- | :--------------------------------------------------------------------------------- |
| Monorepo | Nx 23 · pnpm 10                                                                    |
| Backend  | NestJS 11 · Prisma 7 · BullMQ · Socket.io                                          |
| Frontend | Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · shadcn/ui · TanStack Query 5 |
| Data     | PostgreSQL 16 · Redis 7 · MinIO S3                                                 |
| AI       | Vercel AI SDK (`@ai-sdk/google`) · Gemini                                          |

## 📁 Structure

```text
apps/server                 # NestJS 11 Modular Monolith (REST API, WebSocket, BullMQ)
apps/web                    # Next.js 16 App Router (React 19, Shadcn UI, TanStack Query)
packages/shared-contracts   # Zod DTO schemas & isomorphic types
docs/                       # Documentation hub (architecture, PRDs, guides, audits)
```

## 🚀 Quickstart

Prerequisites: **Node.js 22+**, **pnpm 10+**, **Docker**.

```bash
pnpm install                                              # Install dependencies
docker compose -f docker-compose.dev.yml up -d            # Infra: PostgreSQL, Redis, MinIO
pnpm db:generate && pnpm db:migrate:dev && pnpm db:seed   # Schema + baseline seed data
pnpm serve:server                                         # API  → http://localhost:8000 (Swagger: /docs)
pnpm serve:web                                            # Web  → http://localhost:3000
```

**Public URL** (webhooks / sharing): `docker compose -f docker-compose.dev.yml --profile tunnel up -d` → `https://sales-copilot.kakadev.xyz` (first-time tunnel setup: `scripts/setup-tunnel.ps1` / `.sh`). How traffic flows: [Network Traffic Flow](./docs/guides/network-traffic-flow.md).

**Production** (VPS or local prod): `docker compose -f docker-compose.prod.yml up -d` (add `--profile tunnel` for HTTPS domain) — Nginx routes `/api/*` to NestJS and `/` to Next.js.

## 🧪 Testing

```bash
pnpm test        # Server unit tests
pnpm test:all    # Unit + integration + e2e
pnpm typecheck && pnpm lint
```

## 📚 Documentation

- 🗺️ **[Documentation Hub](./docs/README.md)** — sitemap, conventions & everything else
- 📐 **[System Architecture](./docs/architecture/01-system-architecture.md)** — bounded contexts, pipelines, REST/WS standards, conversation lifecycle
- 🎯 **[Product Vision](./docs/product/01-vision.md)** — value proposition & product principles
- 🤖 **[AGENTS.md](./AGENTS.md)** — non-negotiable engineering rules (multi-tenancy, YAGNI, data integrity)
