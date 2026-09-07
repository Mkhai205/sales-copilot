# Sales Copilot Platform

> **Omnichannel Customer Conversation & AI Sales Engagement Platform** built with NestJS, Next.js, PostgreSQL (Prisma 7), Redis, MinIO, and WebSockets.

[![Nx Monorepo](https://img.shields.io/badge/Monorepo-Nx%2023-blue.svg)](https://nx.dev)
[![NestJS](https://img.shields.io/badge/Backend-NestJS%2011-ea2849.svg)](https://nestjs.com)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2016-black.svg)](https://nextjs.org)
[![Prisma](https://img.shields.io/badge/ORM-Prisma%207-2d3748.svg)](https://prisma.io)
[![Tests Passing](https://img.shields.io/badge/Tests-1%2C277%20passing-brightgreen.svg)](./docs/audit/phase-1-completion-signoff.md)

---

## 📖 Overview

**Sales Copilot** is a high-performance customer engagement platform inspired by Chatwoot, designed with a **Conversation-First** philosophy. It unites multiple messaging channels (Live Web Chat, Facebook Messenger, Zalo OA, Telegram, Email) into a centralized, real-time agent dashboard, enhanced by an asynchronous **AI Sales Intelligence** engine that extracts buying signals, scores leads with time-decay, and suggests next best actions.

### Project Roadmap & Phasing:

- 🟢 **Phase 1 (COMPLETED BASELINE)**: Omnichannel conversation core, contact identity deduplication, round-robin auto-assignment, automation rules, canned responses, outbound webhooks, and realtime WebSocket streaming. _(Signed off with 1,277 automated tests passing)._
- 🟡 **Phase 2 (CURRENT ACTIVE SCOPE)**: Sales Intelligence & AI Copilot — Lead/Opportunity lifecycle, BANT evidence ledger, AI lead scoring with 48h time-decay, BullMQ conversation intelligence, and Copilot Assistant Drawer.
- ❄️ **Phase 3 (FUTURE EXTENSIONS)**: Autonomous Sales Agents, Voice/SIP (WebRTC), and bidirectional external CRM sync (HubSpot, Salesforce).

---

## 🏛️ Monorepo Structure

```text
sales-copilot/
├── apps/
│   ├── server/               # NestJS 11 Modular Monolith (REST API, WebSocket, BullMQ)
│   └── web/                  # Next.js 16 App Router (Turbopack, React 19, Shadcn UI)
│
├── packages/
│   └── shared-contracts/     # Isomorphic TypeScript types, Zod DTO schemas & events
│
├── docs/                     # Comprehensive System Documentation Hub
│   ├── architecture/         # System, module, and data architecture specifications
│   ├── domain/               # Domain models, business rules, and state machines
│   ├── api/                  # REST API and WebSocket realtime contracts
│   ├── backlog/              # Master backlog and active Phase 2 epics
│   ├── engineering/          # Coding guidelines and testing strategy
│   └── audit/                # Phase 1 completion sign-off and remediation plan
│
├── AGENTS.md                 # AI Agent operational directives & anti-overengineering rules
└── README.md                 # Repository entrypoint (this file)
```

---

## ⚡ Quickstart & Local Development

### Prerequisites

- **Node.js**: `v22+`
- **pnpm**: `v10+`
- **Docker & Docker Compose**: For local PostgreSQL, Redis, and MinIO services

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/Mkhai205/sales-copilot.git
cd sales-copilot
pnpm install
```

### 2. Start Infrastructure Services

```bash
docker compose -f docker-compose.dev.yml up -d
```

_Services started:_

- **PostgreSQL**: `localhost:5432` (Database: `sales_copilot_dev`)
- **Redis**: `localhost:6379`
- **MinIO**: `localhost:9000` (Console: `localhost:9001`)

### 3. Setup Database Schema & Seed Data

```bash
# Generate Prisma Client
pnpm db:generate

# Run database migrations
pnpm db:migrate:dev

# Seed initial baseline data (Admin user, default Workspace, Team, Inbox, Canned responses)
pnpm db:seed
```

### 4. Start Development Servers

```bash
# Start Backend (NestJS server on http://localhost:8000, Swagger at /docs)
pnpm serve:server

# Start Frontend (Next.js web app on http://localhost:3000)
pnpm serve:web
```

---

## 🔗 Tunnel Mode (Facebook Webhooks / Share URL)

When you need a public URL for testing Facebook webhooks or sharing with others:

```bash
# Start infra + nginx + cloudflared tunnel
docker compose -f docker-compose.dev.yml --profile tunnel up -d

# Start backend & frontend on host as usual
pnpm serve:server
pnpm serve:web
```

Your app is now accessible at `https://sales-copilot.kakadev.xyz` via Cloudflare Tunnel.

> **First-time setup**: Run `.\scripts\setup-tunnel.ps1` (Windows) or `./scripts/setup-tunnel.sh` (Linux/Mac) to create the tunnel and configure DNS.

---

## 🐳 Production Docker

Run the entire stack in Docker (for VPS deployment or local production testing):

```bash
# Start all services (access via http://localhost)
docker compose -f docker-compose.prod.yml up -d

# With Cloudflare Tunnel (access via https://sales-copilot.kakadev.xyz)
docker compose -f docker-compose.prod.yml --profile tunnel up -d
```

_Architecture: Nginx (port 80) → routes `/api/*` to NestJS, `/` to Next.js_

---

## 🧪 Testing & Code Quality

```bash
# Run tests across all projects
pnpm nx run-many -t test

# Run tests for backend only
pnpm nx test server

# Run tests for frontend only
pnpm nx test web

# Typecheck all packages
pnpm typecheck

# Lint codebase
pnpm lint
```

---

## 📚 Key Documentation Links

- 🗺️ **[System Documentation Hub](./docs/README.md)** — Central documentation index
- 📐 **[System Architecture](./docs/architecture/system-architecture.md)** — Architectural overview and pipeline
- 🏛️ **[Domain Model & Rules](./docs/domain/business-rules.md)** — Business logic, state machines, and invariants
- 🔌 **[API Contracts](./docs/api/api-contract.md)** | **[WebSocket Contracts](./docs/api/websocket-contract.md)**
- 📋 **[Phase 2 Backlog](./docs/backlog/phase-2-backlog.md)** — Active development epics
- 🤖 **[AGENTS.md](./AGENTS.md)** — Non-negotiable architectural rules, multi-tenancy invariants, and anti-overengineering principles
