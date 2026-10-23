# Multi-tenancy rollout

Goal: one deployment serves many developers (companies). Each company sees only
its own projects, units, customers and money — even when a user guesses another
company's record ID.

Model: **shared database, shared tables, `companyId` on every tenant-owned row.**
`activeCompanyId` always comes from the server-verified session (JWT + an ACTIVE
`CompanyMembership`), never from a client-supplied body field or header.

## Status

| Step | State |
| --- | --- |
| Versioned Prisma migrations (`0_init` baseline) instead of `db push` | done |
| `Company` + `CompanyMembership` models; existing data backfilled into "Demo Company" | done |
| Table ownership map (this document) | done |
| `companyId` columns — nullable, backfilled, verified | todo |
| `companyId` NOT NULL + composite FKs/uniques | todo |
| Auth: `companyId` in JWT, membership check, company switch | todo |
| Route-by-route scoping of all ~160 endpoints | todo |
| Cross-tenant integration tests (Company A vs B) | todo |
| Optional PostgreSQL RLS as defence in depth | todo |

`Company.currency/locale/timezone` default to `UZS` / `uz` / `Asia/Tashkent` for
new companies. The demo company keeps `INR` / `en` / `Asia/Kolkata` because its
seeded prices are INR.

## Table ownership map

### A. Platform-level — no `companyId`

| Table | Notes |
| --- | --- |
| `Company`, `CompanyMembership` | Tenant registry. Membership carries the per-company role. |
| `User` | Global identity; email stays globally unique (one login, many companies). `roleId` and `partnerAccountId` are tenant-specific and move to `CompanyMembership`. `timezone` default `Asia/Kolkata` should become "inherit from company". |
| `RefreshToken` | User-scoped. Access tokens minted from it must re-check membership. |
| `Role`, `Permission`, `RolePermission` | Global catalogue for now. Per-company custom roles would add `companyId` later. |

### B. Tenant roots — direct `companyId` (NOT NULL)

`Project`, `Tower`, `InventoryUnit`, `PriceRevision`, `Campaign`, `Lead`,
`Account`, `Contact`, `Opportunity`, `SiteVisit`, `Quotation`, `Booking`,
`PaymentPlan`, `DemandSchedule`, `Receipt`, `Document`, `LeadRoutingRule`,
`CustomFieldDefinition`, `SavedReport`, `DashboardWidget`,
`NotificationTemplate`, `Notification`, `AuditLog`

### C. Child rows — inherit tenancy from the parent

Also get `companyId` (denormalised) so every query can filter on it directly and
composite FKs can enforce "same company as parent":

| Child | Parent |
| --- | --- |
| `CampaignSource`, `CampaignResponse` | `Campaign` |
| `LeadActivity` | `Lead` |
| `OpportunityActivity` | `Opportunity` |
| `VisitFeedback` | `SiteVisit` |
| `QuotationLineItem` | `Quotation` |
| `CoApplicant`, `BookingApproval` | `Booking` |
| `PaymentPlanMilestone` | `PaymentPlan` |
| `ReceiptAllocation` | `Receipt` + `DemandSchedule` (both must match) |
| `CustomFieldValue` | `CustomFieldDefinition` |

### D. Needs redesign, not just a column

| Item | Today | Change |
| --- | --- | --- |
| `SystemConfig` | PK `key`, one global row per setting | PK `(companyId, key)`; platform defaults separate |
| Document numbering (`lib/sequence.ts`) | One global counter per kind in `SystemConfig` (`seq:booking`, ...) | Counter per `(companyId, kind)` — each company gets its own sequential, gap-free numbers |
| `Quotation.quoteNumber`, `Booking.bookingNumber`, `DemandSchedule.demandNumber`, `Receipt.receiptNumber`, `Receipt.sequence` | Globally `@unique` | `@@unique([companyId, ...])` |
| `NotificationTemplate.key` | Globally `@unique` | `@@unique([companyId, key])` |
| `CustomFieldDefinition` | `@@unique([objectType, apiName])` | `@@unique([companyId, objectType, apiName])` |
| `Booking.unitId` | Globally `@unique` | Stays unique (unit IDs are already tenant-specific) but FK should be composite `(companyId, unitId)` |
| Partner intake API | One global `PARTNER_API_KEY` | Per-company keys (hashed) that resolve the company |
| `COMPANY_NAME` env / `branding` config | Single company name in PDFs | Read from `Company` / per-company config |
| `GST_RATE_UNDER_CONSTRUCTION`, `DEFAULT_HOLD_HOURS` env | Global | Per-company settings |

## Code hotspots to scope

- `middleware/auth.ts` / `lib/jwt.ts` — add `companyId` to the access token; verify an ACTIVE membership on each request; derive role from the membership, not `User.roleId`.
- `middleware/scope.ts` — `scopeFilter()` must always include `companyId`, including for global-view roles (today they get `{}`).
- `lib/sequence.ts` — the `bumpCounter` calls in bookings, finance (demand ×3, receipt) and quotations.
- `modules/search.routes.ts`, `modules/reports.routes.ts` (report builder + export), `modules/dashboard.routes.ts` — aggregate queries across many tables.
- `modules/notifications.routes.ts` — SSE stream must only push the active company's notifications.
- `lib/storage.ts` — prefix S3 keys with `companyId`; real signed URLs.
- `lib/leadRouting.ts` — least-loaded agent fallback must only consider the company's agents.
- Redis is not used by any module yet; when it is, every key must include `companyId`.

## Migration order (per step: backup, run on a copy first, tests green)

1. Add `companyId` nullable to B and C tables.
2. Backfill to the Demo Company (B directly, C from the parent).
3. Verify: no NULLs, no child whose `companyId` differs from its parent.
4. Make NOT NULL; add indexes, composite FKs and the per-company uniques in D.
5. Switch the code paths above, endpoint by endpoint, behind A-vs-B tests.
