# Development Roadmap

**Prerequisite:** Explicit approval after audit. **No application code modified** unless approved.

**Storage override (2026-11-22):** See [STORAGE_AND_DATABASE_DECISION.md](./STORAGE_AND_DATABASE_DECISION.md).  
**Target root:** `D:\MEGA_INTELLIGENCE` · **Database:** PostgreSQL only · **Queues:** Redis + BullMQ · **No MongoDB.**

Complexity: **S** / **M** / **L** / **XL**

---

## Phase 0 — D: layout, PostgreSQL, Redis (foundation)

### Objectives

- Create `D:\MEGA_INTELLIGENCE` tree without overwriting existing data
- PostgreSQL with `PGDATA` = `D:\MEGA_INTELLIGENCE\database\postgresql`
- Redis persistence on `D:\MEGA_INTELLIGENCE\redis`
- Backup directory `D:\MEGA_INTELLIGENCE\backups\postgresql`
- Document Windows permissions and post-reboot persistence checks
- **Do not** install MongoDB

### Reuse

- Audit mappings in `docs/STORAGE_AND_DATABASE_DECISION.md`
- Existing Mongoose models as **spec** for SQL migrations

### Files / modules (new — after approval)

- `D:\MEGA_INTELLIGENCE\config\.env.example` (paths only, no secrets)
- `D:\MEGA_INTELLIGENCE\docker\compose.yml` (optional) — volume binds to D:
- `app/backend/db/migrations/*` — SQL for parity tables
- `app/backend/repositories/*` — PG data access

### Database changes

- Create database `mega_intelligence`
- Tables: `batch_jobs`, `email_checks`, `shared_files`, `app_settings`, `app_secrets`, `config_audit_log`
- Extensions: `pgcrypto`, `citext` (optional)

### Dependencies

- PostgreSQL 16+ (local)
- Redis 7+
- `pg` or Drizzle/Prisma (choice at implementation approval)
- Existing `bullmq`, `ioredis` in package.json

### Risks

- Docker Desktop default volumes on C: — must override to D:
- Service account lacking write access to D:

### Complexity

**M**

### Acceptance criteria

- PG and Redis survive Windows restart
- `pg_dump` written to `backups\postgresql`
- Free space remain > 50 GB (currently ~434 GiB free on D: — verified planning snapshot)
- No MongoDB service or data directory created

### Testing

- Connect test from Node using `DATABASE_URL`
- Redis PING from worker process

---

## Phase 1 — Foundation and stabilization (on D:)

### Objectives

- Relocate/copy `d:\emails` → `D:\MEGA_INTELLIGENCE\app`
- **Repository layer** replaces direct Mongoose calls (Mongoose **not deleted** yet)
- Mount orphan routes after persistence works
- Single API base URL in frontend
- Gate synthetic SERP data off in production profile
- Logs → `D:\MEGA_INTELLIGENCE\logs`; uploads → app storage on D:

### Reuse

- `backend/src/server.js`, routes, services (logic unchanged initially)
- `configService.js` behavior → backed by `app_settings`

### Files likely to modify (after approval)

| File | Change |
|------|--------|
| `server.js` | PG pool init; remove Mongo connect goal; hourly cleanup → SQL |
| `config/db.js` | Replace with `config/postgres.js` or supersede (keep old file until cutover) |
| `configService.js` | Use `AppSettingsRepository` |
| `emailCheck.js` | `EmailCheckRepository` |
| `routes/check.routes.js`, `job.routes.js`, `file.routes.js`, `config.routes.js` | Repositories; fix missing `getHistory` |
| `middleware/safeMode.js`, `services/safeMode.js` | Read runtime from PG |
| `App.jsx` | Full route table |

### New modules

- `repositories/batchJobs.js`, `emailChecks.js`, `sharedFiles.js`, `appSettings.js`
- `workers/cleanup.js` — retention (30d checks, 7d jobs, file expiry)

### Database changes

- Seed `app_settings` row `global` via migration or seed script (PG version of `seedConfig.js`)

### Dependencies

- Phase 0 complete

### Risks

- Long-cutover if both Mongoose and PG accidentally wired — **forbidden by policy**; use feature flag single write target

### Complexity

**L**

### Acceptance criteria

- Parity with Mongoose behaviors in decision doc checklist
- No `mongoose.connect` in production path
- All UI-critical APIs return non-404 from new root

### Testing

- Port `backend/tests` from Mongo to PG test DB on D:
- Smoke: file upload metadata in PG + bytes on D:

---

## Phase 2 — Search and discovery

### Objectives

- Persist `search_runs`, `search_results` in PostgreSQL
- Move in-memory `activeRuns` to **Redis + BullMQ**
- Mount `enhancedSearch`, `industryDomains`; remove synthetic `generateComprehensiveResults` in prod

### Reuse

- `prefixEmails/runSearch.js`, `enhancedSearch/runSearch.js`, `industryDomains/runSearch.js`

### New modules

- `models` → SQL tables `search_runs`, `search_results`
- `workers/searchWorker.js`

### Cache

- Hot: Redis; cold file cache: `D:\MEGA_INTELLIGENCE\search_cache`

### Complexity

**L**

### Acceptance criteria

- Resume search after API restart (job id in PG)
- Results export to `D:\MEGA_INTELLIGENCE\exports`

---

## Phase 3 — Company intelligence

### Objectives

- Mount `companyJobs.routes.js`; ESM-fix `companyJobsService.js`
- Table `companies`, link to `search_results`

### Reuse

- `companyJobsService.js`, company UI components

### Complexity

**L**

---

## Phase 4 — Professional people intelligence

### Objectives

- Tables `contacts`, `people_roles` (HR Director, Recruitment Manager taxonomy)
- GCC country fields; source attribution columns

### Complexity

**XL** (with compliance review)

---

## Phase 5 — Authorized Deep Web research

### Objectives

- Connector vault in `app_secrets`; audit log per call
- No auth bypass

### Complexity

**XL** (business gated)

---

## Phase 6 — Dark Web defensive threat intelligence

### Objectives

- Isolated Docker worker on D: volumes; TI feeds allowlist only
- Evidence → `D:\MEGA_INTELLIGENCE\evidence`

### Complexity

**L–XL**

---

## Phase 7 — AI intelligence and entity resolution

### Objectives

- Ollama under `local_ai`; classification workers
- Entity resolution tables in PostgreSQL

### Complexity

**L**

---

## Phase 8 — Analytics and reporting

### Objectives

- SQL aggregations / materialized views
- Scheduled exports to `exports/`

### Complexity

**M–L**

---

## Phase 9 — Security hardening and performance

### Objectives

- Auth on outbound routes; SSRF guard
- BullMQ concurrency tuning
- Backup restore drill from `backups/postgresql`

### Reuse

- `safetyControls.js`, `auth.js`

### Complexity

**L**

---

## Mongoose retirement (final sub-phase — separate approval)

| Step | Action |
|------|--------|
| R1 | Confirm zero runtime `import` from `models/*` |
| R2 | Remove `mongoose` from `package.json` |
| R3 | Archive `backend/src/models/_legacy_mongoose/` in git history only — do not delete until R1 green |

**Optional:** If legacy MongoDB has data, one-time ETL (approval **M8** in storage doc) — otherwise skip.

---

## Prioritized order

1. **Phase 0** — D: + PostgreSQL + Redis  
2. **Phase 1** — Relocation + repository parity  
3. **Phase 9 subset** — auth + SSRF (parallel security track)  
4. **Phase 2–3** — Search + company intel  
5. Phases 4–8 per business priority  
6. **Mongoose retirement**

---

## Technology choices (justified)

| Tech | Role | Why |
|------|------|-----|
| **PostgreSQL** | Sole system of record | Required by decision; investigations need relational integrity |
| **Redis** | Queue + cache | Already in dependencies; fits BullMQ on Windows |
| **Express (keep)** | API | Existing investment; wrap with repositories |
| **React/Vite (keep)** | UI | Working UI; relocate to D: |
| **Next.js** | Defer | No SSR need yet for local intel tool |
| **FastAPI** | Optional sidecar | Only if Python scrapers dominate |
| **Playwright** | Phase 2+ | JS-heavy career sites |
| **Docker Desktop** | Isolation | Crawlers/Tor worker; volumes on D: |
| **WSL2** | Optional | Linux-oriented tooling without C: data |

---

## Phase 0 progress log

| Date | Item |
|------|------|
| 2026-11-22 | `D:\MEGA_INTELLIGENCE` tree created; Docker compose, SQL `001_initial_schema.sql`, `config/.env.example` — see `D:\MEGA_INTELLIGENCE\docs\PHASE0_STATUS.md` |
| — | App sync `d:\emails` → `app/` and `docker compose up` — **operator steps** |

**Next gate:** Phase 1 (PostgreSQL repositories + relocate dev workflow) after Phase 0 infra is running.