<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

# AGENTS.md

## 1. Project

Sales Copilot Platform is an omnichannel conversation and AI sales platform.

Primary product flow:

Customer
→ Channel
→ Conversation
→ Contact
→ Lead
→ AI Intelligence
→ Sales Copilot
→ Human or Autonomous Action

The product is conversation-first, not CRM-first.

Chatwoot is the primary business-logic reference for the conversation platform.

Do not copy Chatwoot's Ruby/Rails architecture directly.

## 2. Technology

Backend:

- NestJS
- TypeScript
- PostgreSQL
- Redis
- MinIO
- WebSocket
- Queue/Background Workers

Frontend:

- Next.js
- React
- TypeScript

Repository:

- Monorepo

Architecture:

- Modular monolith
- Event-driven internally
- Domain-oriented modules

Do not introduce microservices unless explicitly approved.

## 3. Architectural Principles

Prefer:

- Clear module boundaries
- Explicit dependencies
- Domain-driven design where useful
- Application use-cases
- Typed contracts
- Dependency inversion
- Small cohesive modules
- Asynchronous processing for expensive/background operations
- Explicit domain events
- Testable business logic

Avoid:

- Global service classes
- God modules
- Circular dependencies
- Direct database access from controllers
- Business logic inside controllers
- Business logic inside React components
- Provider-specific logic leaking into domain code
- Unnecessary abstractions
- Premature microservices

## 4. Module Boundaries

Core modules include:

- Identity
- Organization
- Workspace
- User
- Team
- Contact
- Lead
- Conversation
- Message
- Channel
- Inbox
- Automation
- AI
- Sales Copilot
- Notification
- Webhook
- Audit

A module owns its domain logic and data access.

Other modules must interact through:

- Public application services
- Commands/use-cases
- Queries
- Domain events
- Explicit contracts

Do not access another module's internal implementation.

## 5. Dependency Direction

Preferred direction:

Presentation
→ Application
→ Domain

Infrastructure implements interfaces required by application/domain.

Example:

Controller
→ Use Case
→ Domain

Repository implementation:

Domain/Application interface
← Infrastructure implementation

Do not:

Controller
→ Prisma/Database

Domain
→ NestJS framework infrastructure

Domain
→ OpenAI SDK

Domain
→ Facebook/Zalo/Telegram SDK

## 6. External Integrations

External providers must be isolated behind adapters.

Examples:

- OpenAI
- Gemini
- Facebook Messenger
- Zalo
- Telegram
- Email providers
- MinIO

Preferred:

Application
→ Provider Interface
→ Adapter
→ External SDK/API

Never expose provider SDK types throughout the domain.

## 7. AI Architecture

AI must be treated as an application capability, not embedded directly into business entities.

Use:

AI Application Service
→ LLM Gateway
→ Provider Adapter

Supported providers:

- OpenAI
- Google Gemini

AI agent actions must use tools.

AI Agent
→ Tool Registry
→ Policy/Guardrail
→ Action Executor
→ Application Use Case

Never allow the AI agent to directly modify the database.

## 8. Lead Rules

Lead is an independent entity.

Relationship:

Contact 1 → N Lead

Lead lifecycle:

NEW
→ ENGAGED
→ QUALIFIED
→ HOT
→ CONVERTED

Terminal states:

LOST
DISQUALIFIED

Lead Score is AI-controlled.

Sales must not directly modify the score.

Human feedback/evidence may be submitted and used by AI for subsequent evaluation.

Every important AI score update should preserve provenance/audit information.

## 9. Autonomous Agent

Supported autonomy levels:

OFF
ASSISTED
AUTONOMOUS

Autonomous actions may include:

- Send message
- Update lead
- Add tag
- Create note
- Trigger workflow
- Escalate to human

Every action requires:

- Tool definition
- Authorization
- Policy validation
- Input validation
- Execution
- Result
- Audit/event record

Default to safe behavior when policy or confidence requirements are not satisfied.

## 10. Event-Driven Architecture

Use domain/application events for asynchronous workflows.

Example:

MessageReceived
→ AIAnalysisRequested
→ AIAnalysisCompleted
→ LeadScoreUpdated
→ CopilotDecisionRequested
→ ActionExecuted

Events must be explicit, typed and versionable.

Do not introduce Kafka or other distributed infrastructure merely because the system is event-driven.

Redis/queue infrastructure is sufficient for the modular-monolith stage unless requirements demonstrate otherwise.

## 11. Database

PostgreSQL is the source of truth for transactional business data.

Rules:

- Use migrations.
- Never modify production schema manually.
- Add indexes intentionally.
- Preserve tenant/workspace isolation.
- Use transactions for consistency boundaries.
- Avoid N+1 queries.
- Do not expose ORM models directly as API contracts.

Database implementation must not leak into domain logic.

## 12. API

API contracts must be explicit and typed.

Requirements:

- Input validation
- Authentication
- Authorization
- Tenant isolation
- Workspace isolation
- Consistent errors
- Pagination
- Filtering
- Sorting
- Idempotency where required

Do not silently change existing API contracts.

Breaking changes require explicit decision/documentation.

## 13. Realtime

WebSocket is used for realtime application state.

Events must be:

- Typed
- Explicit
- Namespaced where appropriate
- Authorization-aware
- Tenant/workspace scoped

Realtime infrastructure must not bypass domain/application authorization.

## 14. Testing

Every new business capability must have appropriate tests.

Prefer:

- Unit tests for domain logic
- Application tests for use-cases
- Integration tests for database/infrastructure
- E2E tests for critical flows
- Contract tests for external integrations
- AI evaluation tests for AI behavior

Do not add code that cannot reasonably be tested.

Critical flow:

Message
→ Conversation
→ AI Analysis
→ Lead Intelligence
→ Copilot
→ Action

must be covered progressively by integration/E2E tests.

## 15. Coding Standards

Use TypeScript strictly.

Prefer explicit types at architectural boundaries.

Use consistent naming.

Names must describe domain concepts rather than implementation details.

Avoid abbreviations unless they are established domain terminology.

Keep functions and classes cohesive.

Do not create abstractions only to satisfy theoretical purity.

Do not duplicate business rules across controllers, services and frontend.

Business rules belong in the appropriate domain/application layer.

## 16. Frontend Rules

Next.js/React UI must not contain backend business rules.

Frontend responsibilities:

- Presentation
- User interaction
- Client state
- API interaction
- Realtime rendering

Backend remains the authority for:

- Authorization
- Lead lifecycle
- Lead scoring
- Business rules
- AI decisions
- Autonomous actions

## 17. Chatwoot Reference Rules

Chatwoot is the primary reference for conversation-platform behavior.

When implementing conversation-related functionality:

1. Inspect the relevant Chatwoot implementation.
2. Understand the business behavior.
3. Identify the domain rules.
4. Translate those rules into the current architecture.
5. Implement using NestJS/TypeScript conventions.

Do not blindly translate Ruby classes into TypeScript classes.

Do not copy Rails-specific abstractions.

Do not introduce Chatwoot features outside the current product scope.

When there is a conflict:

Current Sales Copilot requirements

>

Current architecture

>

Explicit ADR

>

Chatwoot implementation

## 18. Coding-Agent Workflow

For every task:

1. Read AGENTS.md.
2. Read relevant product documentation.
3. Inspect existing module boundaries.
4. Identify affected domain/application/infrastructure layers.
5. Inspect relevant Chatwoot behavior when applicable.
6. Implement the smallest coherent change.
7. Add/update tests.
8. Run validation.
9. Check architecture boundaries.
10. Update documentation when behavior or architecture changes.

Do not start coding before understanding the affected module.

## 19. Refactoring Permission

The agent MAY:

- Refactor code.
- Improve module boundaries.
- Extract duplicated logic.
- Improve performance.
- Improve testability.
- Replace poor local implementations.
- Suggest architectural improvements.

The agent MUST preserve documented architectural decisions.

The agent MUST NOT silently:

- Introduce microservices.
- Replace PostgreSQL.
- Replace Redis.
- Replace MinIO.
- Replace NestJS/Next.js.
- Change tenancy architecture.
- Change core domain semantics.
- Change major API contracts.
- Change AI autonomy policy.
- Change Lead lifecycle.
- Add major infrastructure dependencies.

## 20. Architectural Changes

Minor refactoring can be performed directly.

Significant architectural changes require an ADR or explicit approval.

Examples:

- New bounded context
- Major database strategy change
- New messaging infrastructure
- New distributed system component
- Microservice extraction
- Major authorization model change
- Major AI architecture change
- Breaking API change

The agent may propose these changes but must not silently implement them as if they were already approved.

## 21. Dependencies

Before adding a dependency:

- Verify that the existing stack cannot reasonably solve the problem.
- Prefer mature, focused dependencies.
- Avoid duplicate libraries.
- Consider bundle/runtime impact.
- Consider maintenance and security.
- Keep infrastructure dependencies minimal.

Do not add dependencies simply for convenience.

## 22. Security

Never:

- Commit secrets.
- Log credentials.
- Expose provider API keys.
- Trust client-side authorization.
- Bypass tenant isolation.
- Let AI directly execute arbitrary code or database queries.

All external webhooks must be validated according to provider requirements.

All autonomous AI actions must pass authorization and policy checks.

## 23. Definition of Done

A task is not complete when the code merely compiles.

Done means:

- Requirements implemented.
- Correct module boundary.
- Tests added/updated.
- API contracts updated if necessary.
- Database migration created if necessary.
- Error handling implemented.
- Authorization implemented.
- Observability considered.
- No architectural violation.
- Existing tests remain passing.
- Documentation updated when required.

## 24. Priority

When making implementation decisions, prioritize:

1. Correct business behavior.
2. Security and tenant isolation.
3. Architectural boundaries.
4. Data consistency.
5. Reliability.
6. Testability.
7. Performance.
8. Developer convenience.

Do not sacrifice domain correctness for implementation speed.

## 25. Source of Truth

Priority of information:

1. Explicit current project requirements.
2. AGENTS.md.
3. Product documentation.
4. Architecture decisions/ADRs.
5. Existing source code.
6. Chatwoot business behavior.
7. Agent assumptions.

If information is ambiguous and the decision affects architecture or business behavior, stop and ask rather than inventing a requirement.
