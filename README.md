# IT OpsDesk MVP (Multi-tenant SaaS)

IT OpsDesk is a local MVP of an enterprise-style IT operations/service desk platform built with Next.js App Router, TypeScript, Prisma/Postgres, NextAuth, RBAC, audit logging, and tenant isolation.

Runs locally at [http://localhost:3000](http://localhost:3000).

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn-style UI components
- Prisma + PostgreSQL
- NextAuth (credentials)
- Zod validation (shared schemas)
- React Hook Form
- Docker Compose (Postgres + Redis)
- BullMQ + Redis workers
- Vitest (unit tests)

## Core capabilities

- Multi-tenant isolation with `orgId` scope across org-owned models
- RBAC roles per organization: `OrgAdmin`, `Agent`, `Requester`, `ReadOnly`
- `requireRole` / `requirePermission` guards for pages and server actions
- Auth flow with org lookup/selection and auto-org when a user has one membership
- Invite-by-token flow (Admin invites Agent/Requester/ReadOnly)
- Ticketing with CRUD, filters, comments, timeline, watchers, attachment metadata, bulk actions, SLA tracking
- Dashboard KPIs/charts: open/unassigned/at-risk/breached, trends, workload, aging
- Users/Teams with role changes, capacity, team membership
- Knowledge Base (Markdown CRUD, full-text-ish search fallback, feedback)
- Settings for org profile/branding, SLA rules, categories/tags, notification prefs, canned responses
- Access Requests module with approval statuses and evidence metadata
- Stripe billing (test mode) with plan gating: Free, Pro, Enterprise
- Microsoft Entra ID integration mock (org-scoped config, execute access requests, integration action logs)
- Asset management and ticket linkage
- Workflow automation rules + manual job endpoint (`POST /api/workflows/run`)
- In-app notifications + email queue stubs
- Background jobs for SLA scans, workflow automation, and notification delivery
- Observability pages: health/system status, metrics, audit log viewer
- Structured logging + centralized server action error handling + App Router error boundaries
- Auth endpoint rate limiting (in-memory)

## Multi-tenant + RBAC design

- All org-owned records include `orgId` and are queried with tenant constraints.
- Auth session stores `orgId`, `orgSlug`, `orgName`, `role`, `membershipId`.
- Access control entry points:
  - `src/lib/auth/context.ts`
  - `requireRole([...])`
  - `requirePermission("...")`
- Permission matrix is defined in:
  - `src/lib/auth/permissions.ts`

## ERD-style model overview

- `Organization` is the tenant root.
- `User` is global identity; `OrganizationMember` is per-org membership + role + capacity.
- `Team` + `TeamMember` model team assignment.
- `Ticket` belongs to org; relates to requester/assignee/team/category/tags/watchers/comments/attachments/asset.
- `SlaRule` defines response/resolution targets by priority per org.
- `AuditLog` captures create/update/delete/status/assignment/role/login and other security events.
- `Notification` + `NotificationPreference` handle in-app preferences and delivery intent.
- `EmailQueue` stores email stubs.
- `KnowledgeArticle` + `KnowledgeFeedback` support KB and helpfulness scoring.
- `AccessRequest` + `AccessRequestAttachment` support IAM workflows/evidence.
- `EntraIntegration` stores per-org Entra connection config (mock for MVP).
- `IntegrationActionLog` stores provider action execution outcomes and links to access requests.
- `Asset` tracks IT inventory and can link to tickets.
- `AutoAssignRule` + `WorkflowRun` support automation and job run history.
- `JobRun` captures BullMQ worker execution status, timing, and output summary.
- `Organization.plan` + `Organization.planStatus` power entitlements across modules.
- NextAuth tables: `Account`, `Session`, `VerificationToken`.

## Project structure

```text
src/
  app/
    (public)/login, invite, reset-password
    (protected)/dashboard, tickets, users, teams, knowledge, settings,
                settings/billing, settings/integrations/entra, access-requests, assets, workflows,
                notifications, admin/status, admin/metrics, admin/audit,
                admin/integrations/logs, admin/jobs, profile
    pricing
    api/auth/[...nextauth], api/health, api/workflows/run,
    api/admin/run-jobs, api/admin/seed-demo, api/admin/rbac-export,
    api/stripe/webhook
  components/
    app/*
    ui/*
  lib/
    auth/*, validation/*, prisma.ts, logger.ts, errors.ts, rate-limit.ts
  server/
    actions/*
    services/*
prisma/
  schema.prisma
  seed.ts
```

## Environment variables

Local development uses `.env.example` (`.env`) and production uses `.env.production.example`:

```env
DATABASE_URL="postgresql://itopsdesk:itopsdesk@localhost:5432/itopsdesk?schema=public"
NEXTAUTH_SECRET="local-dev-super-secret-itopsdesk-2026"
AUTH_SECRET="local-dev-super-secret-itopsdesk-2026"
NEXTAUTH_URL="http://localhost:3000"
REDIS_URL="redis://localhost:6379"
ADMIN_SECRET="local-admin-secret"
STRIPE_SECRET_KEY="sk_test_replace_me"
STRIPE_WEBHOOK_SECRET="whsec_replace_me"
STRIPE_PRICE_PRO_MONTHLY="price_replace_pro"
STRIPE_PRICE_ENTERPRISE_MONTHLY="price_replace_enterprise"
APP_ENV="local"
DEMO_MODE="false"
```

## Local setup and run

Run these exact commands in order:

1. `npm install`
2. `docker compose up -d`
3. `npx prisma migrate dev`
4. `npx prisma db seed`
5. `npm run dev`
6. `npm run dev:workers`

Then open [http://localhost:3000](http://localhost:3000).

## Production deployment (Vercel + Neon)

### Required environment variables (Vercel)

- `DATABASE_URL` (Neon Postgres connection string, SSL enabled)
- `NEXTAUTH_SECRET` (or set both `NEXTAUTH_SECRET` and `AUTH_SECRET`)
- `AUTH_SECRET` (optional alias for Auth.js compatibility)
- `NEXTAUTH_URL` (your deployed app URL, e.g. `https://your-app.vercel.app`)
- `ADMIN_SECRET` (used by `/api/admin/*` protected endpoints)
- `REDIS_URL` (recommended for BullMQ queues in production, e.g. Upstash Redis)
- `STRIPE_SECRET_KEY` (Stripe test secret key)
- `STRIPE_WEBHOOK_SECRET` (from Stripe webhook endpoint)
- `STRIPE_PRICE_PRO_MONTHLY` (Stripe price ID for Pro)
- `STRIPE_PRICE_ENTERPRISE_MONTHLY` (Stripe price ID for Enterprise)

### Optional environment variables

- `APP_ENV=production`
- `DEMO_MODE=true` (enables demo banner)

### Deployment checklist

1. Create a Neon Postgres database and copy its `DATABASE_URL`.
2. In Vercel project settings, configure all required environment variables above.
3. Ensure build command uses `npm run vercel-build`.
4. Deploy from GitHub on Vercel.
5. After first deploy, run one-time demo seeding:
   - `POST /api/admin/seed-demo` with `x-admin-secret`.
6. Configure Stripe webhook endpoint in Stripe Dashboard:
   - `https://your-app.vercel.app/api/stripe/webhook`
   - events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
7. Verify health endpoint:
   - `GET /api/health` should return `db: "up"`.
8. Login with demo accounts listed below.

### Prisma in production

- Production build/migration flow:
  - `npm run vercel-build`
  - runs `prisma migrate deploy && next build`
- `postinstall` runs `prisma generate` automatically.

### Seed demo data after deploy

Use this one-time (idempotent) command:

```bash
curl -X POST "https://your-app.vercel.app/api/admin/seed-demo" \
  -H "x-admin-secret: YOUR_ADMIN_SECRET"
```

- Safe to run multiple times.
- Existing demo org/users are not duplicated.
- Response includes counts created.

### Stripe billing setup and webhook testing

1. In Stripe test mode, create 2 recurring prices:
   - Pro monthly
   - Enterprise monthly
2. Put their IDs in:
   - `STRIPE_PRICE_PRO_MONTHLY`
   - `STRIPE_PRICE_ENTERPRISE_MONTHLY`
3. Local webhook testing (Stripe CLI):
   - `stripe listen --forward-to localhost:3000/api/stripe/webhook`
   - copy webhook secret to `STRIPE_WEBHOOK_SECRET`
4. Start checkout from:
   - `/settings/billing`
5. After successful checkout, webhook updates:
   - `Organization.plan`
   - `Organization.planStatus`
   - Stripe customer/subscription IDs

Plan entitlements:
- Free: tickets/users/knowledge base
- Pro: Free + background jobs + Entra integration
- Enterprise: Pro + audit retention control + RBAC export (`/api/admin/rbac-export`)

## Demo accounts

Password for all demo users: `DemoPass123!`

### Acme org (`orgSlug: acme`)

- `acme.admin@demo.local` (`OrgAdmin`)
- `acme.agent@demo.local` (`Agent`)
- `acme.requester@demo.local` (`Requester`)
- `acme.readonly@demo.local` (`ReadOnly`)

### Globex org (`orgSlug: globex`)

- `globex.admin@demo.local` (`OrgAdmin`)
- `globex.agent@demo.local` (`Agent`)
- `globex.requester@demo.local` (`Requester`)

### Multi-org login test

- `shared.agent@demo.local` belongs to both `acme` and `globex` (tests org selection).

## Seeded invite links

- `http://localhost:3000/invite/seed-invite-acme-requester`
- `http://localhost:3000/invite/seed-invite-globex-agent`

## Workflow endpoint (manual scheduler simulation)

- `POST /api/workflows/run`
- Requires authenticated user with `settings.manage` permission.
- Performs:
  - auto-assignment attempts for unassigned active tickets
  - SLA at-risk / breached refresh
  - watcher/requester/assignee notifications for SLA alerts
  - workflow run record updates

## Admin endpoints

- `POST /api/admin/run-jobs` (requires `x-admin-secret`)
- `POST /api/admin/seed-demo` (requires `x-admin-secret`, idempotent demo provisioning)
- `GET /api/admin/rbac-export` (Enterprise plan + `users.manage`)
- `POST /api/stripe/webhook` (Stripe signed webhook endpoint)

## Background jobs

- Admin UI page: `/admin/jobs` (requires `settings.manage`)
- Queues:
  - SLA scans
  - Workflow runs
  - Notifications dispatch/flush
- Workers:
  - `npm run worker:sla`
  - `npm run worker:workflows`
  - `npm run worker:notifications`
  - `npm run dev:workers` (all workers concurrently)
- Fallback production-style endpoint:
  - `POST /api/admin/run-jobs`
  - Header: `x-admin-secret: <ADMIN_SECRET>` (or `Authorization: Bearer <ADMIN_SECRET>`)
  - JSON body:
    - `{"jobType":"sla.scan","orgId":"<orgId>"}`
    - `{"jobType":"workflows.run","orgId":"<orgId>"}`
    - `{"jobType":"notifications.flush","orgId":"<orgId>"}`

## CI

GitHub Actions workflow: `.github/workflows/ci.yml`

Checks:

- lint
- typecheck
- unit tests
- Prisma migrate deploy
- Prisma migrate check (`npm run prisma:migrate:check`)

## Scripts

- `npm run dev`
- `npm run build`
- `npm run vercel-build`
- `npm run start`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run prisma:migrate:check`
- `npm run dev:workers`

## Screenshots

Add project screenshots here:

- `docs/screenshots/login.png`
- `docs/screenshots/dashboard.png`
- `docs/screenshots/tickets.png`
- `docs/screenshots/access-requests.png`

## Manual test: Entra integration mock

Use these quick steps after seeding:

1. Login as `acme.admin@demo.local` with org `acme`.
2. Open `/settings/integrations/entra`.
3. Verify default seeded config shows connected and enabled.
4. Click `Test connection` and confirm success message.
5. Open `/admin/integrations/logs` and confirm `testConnection` SUCCESS log appears.
6. Open `/access-requests` and execute one request with `Execute in Entra`.
7. Confirm request status updates to `COMPLETED` (or `FAILED` for unsupported/failing mock input).
8. Confirm logs exist in `/admin/integrations/logs` and audit entries in `/admin/audit`.
9. Login as `acme.agent@demo.local` and verify `/settings` redirects/forbids (no `settings.manage`).

## Manual test: BullMQ jobs

1. Start dependencies: `docker compose up -d`.
2. Start app: `npm run dev`.
3. Start workers in another terminal: `npm run dev:workers`.
4. Login as `acme.admin@demo.local`.
5. Open `/admin/jobs`.
6. Click each enqueue button.
7. Verify `JobRun` rows appear with status and duration.
8. Verify SLA scan updates `Ticket.atRisk` / `Ticket.breachedAt` and writes breach audit entries.
9. Verify workflow run auto-assigns unassigned tickets and creates escalation notifications.
10. Verify notification flush marks `EmailQueue` pending items as sent.
