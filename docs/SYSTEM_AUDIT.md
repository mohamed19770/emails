# System Audit — Complete Investigation

**Scope:** `d:\emails` (audit-only). Secrets are not reproduced.

---

## 1. Programming languages and runtimes

| Component | Language | Module system |
|-----------|----------|----------------|
| Root monorepo | JavaScript | `"type": "module"` in `package.json` |
| Backend | JavaScript | ESM (`backend/package.json`) |
| Frontend | JSX / JavaScript | ESM via Vite |
| `liquid-glass-system/` | JSX + CSS | Standalone Vite package (not wired into main `App.jsx`) |

**Node:** `>=18.0.0` (root and backend `engines`).

---

## 2. Frameworks and major dependencies

### Backend (`backend/package.json`)

- **express**, **helmet**, **cors**, **express-rate-limit**
- **mongoose** (MongoDB ODM)
- **axios**, **cheerio**, **node-fetch**
- **winston**, **dotenv**, **jsonwebtoken**, **multer**, **uuid**
- **bullmq**, **ioredis** — **declared only; no usage verified in `backend/src`**
- **disposable-email-domains**, **lru-cache**, **punycode**

### Frontend (`frontend/package.json`)

- **react**, **react-dom**, **react-router-dom**
- **vite**, **@vitejs/plugin-react**
- **axios**, **xlsx**
- **vitest**, **@testing-library/react** (dev)

### Root (`package.json`)

- **concurrently** (dev orchestration)
- Scripts: `dev`, `install:all`, `build`, `start` (backend only)

---

## 3. Directory structure map

```
d:\emails\
├── package.json                 # Monorepo scripts
├── package-lock.json
├── README.md                    # Feature list, setup (may contain env examples — treat as sensitive)
├── DEPLOYMENT.md                # Windows / PM2 / MongoDB deployment
├── COMPANY_JOBS_SEARCH.md       # Company jobs feature spec
├── .gitignore
│
├── docs/                        # This audit documentation (created audit-only)
│
├── backend/
│   ├── package.json
│   ├── jest.config.cjs
│   ├── .babelrc
│   ├── test-server.js           # Minimal test app
│   ├── debug-email.js
│   ├── scripts/                 # seedConfig, engine test scripts (.mjs)
│   ├── tests/                   # Integration/unit tests
│   ├── __mocks__/
│   └── src/
│       ├── server.js            # *** HTTP entry point ***
│       ├── config/
│       │   ├── db.js            # Mongo connect helper (not called from server.js today)
│       │   └── logger.js
│       ├── middleware/
│       │   ├── auth.js          # JWT helpers
│       │   ├── safeMode.js      # Safe mode gate (stubbed off)
│       │   ├── rateLimit.js     # Token bucket per IP
│       │   └── errorHandler.js
│       ├── models/              # EmailCheck, Job, File, Configuration
│       ├── routes/              # 20 route modules (subset mounted)
│       ├── services/            # Validation, search, phones, crawlers
│       └── utils/
│           └── checkFrontend.js
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js           # Port 5173, /api proxy → :5003
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx              # Minimal route table
│       ├── api.js
│       ├── config.js
│       ├── pages/               # Several pages not in App.jsx
│       ├── components/          # Discovery / OSINT UI
│       ├── services/configClient.js
│       └── styles/
│
└── liquid-glass-system/         # Separate design system (React/Vite/Tailwind)
    ├── package.json
    ├── vite.config.js
    ├── README.md
    └── src/ ...
```

**Missing referenced artifacts (verified):** `scripts/clean-cache.mjs`, `scripts/verify-env.mjs` referenced from root `package.json` but absent from tree.

---

## 4. Backend architecture

### Entry and lifecycle

`backend/src/server.js`:

1. Loads `dotenv`.
2. Creates Express app with helmet, CORS, JSON body parsers (10mb).
3. Applies `safeModeMiddleware`, `rateLimitMiddleware`.
4. Registers **subset** of routes (see `docs/ARCHITECTURE.md`).
5. `startServer()`: creates `logs/` and `uploads/`; **skips** `Database.connect()`; starts HTTP listener.
6. Registers `SIGTERM`/`SIGINT` handlers calling `gracefulShutdown()` (attempts `mongoose.disconnect()`).
7. Schedules `runCleanupTasks()` only if `mongoose.connection.readyState === 1` (currently never on cold start).

### Service domains (`backend/src/services/`)

| Area | Key paths | Responsibility |
|------|-----------|----------------|
| Email check (legacy) | `emailCheck.js`, `emailValidator.js` | Single/batch checks via models |
| Advanced batch checker | `advancedEmailValidation.js` | DNS/MX/SMTP with concurrency (`p-limit` import — verify lockfile for dependency) |
| Email verification API | `emailVerification/*` | Safe verification, DNS cache, safety controls, confidence |
| Email checker modular | `emailChecker/*` | Format, DNS, SMTP, score, factory |
| Prefix / company email search | `prefixEmails/*` | SERP + `SiteExplorer` crawl |
| Domain emails | `domainEmails/crawler.js` | Same-site BFS email harvest |
| Enhanced search | `enhancedSearch/*` | Multi-country SERP orchestration |
| Industry domains | `industryDomains/*` | Industry keyword → domain discovery |
| Company jobs | `companyJobsService.js` | Career page extraction (CommonJS `require` in ESM project) |
| Recruitment phones | `recruitment/*`, `phones/*` | SERP + page fetch + normalization |
| WhatsApp verify | `phones/whatsappVerify.js` | Optional 2chat/wawp/custom HTTP APIs |
| Config | `configService.js` | Cached Configuration document |
| Safety | `safeMode.js`, `outboundGuard.js` | Intended outbound blocking when Safe Mode on |

### API route modules (`backend/src/routes/`)

All files present; **mounting** is only in `server.js`:

| File | Intended prefix | Mounted in `server.js` |
|------|-----------------|------------------------|
| `check.routes.js` | `/api/checks` | Yes |
| `emailChecker.routes.js` | `/api/email-checker` | Yes |
| `emailVerification.routes.js` | `/api/email-verification` | Yes |
| `prefixEmails.js` | `/api/prefix-emails` | Yes |
| `phonesExtract.js` | `/api/phones-extract` | Yes |
| `recruitmentPhones.js` | `/api/recruitment-phones` | Yes |
| `domainEmails.js` | `/api/domain-emails` | Yes |
| `whatsappVerify.js` | `/api/whatsapp-verify` | Yes |
| `testRoute.js` | `/api/test` | Yes |
| `enhancedSearch.js` | `/api/enhanced-search` | **No** |
| `companyJobs.routes.js` | `/api/company-jobs` | **No** |
| `industryDomains.js` | `/api/industry-domains` | **No** |
| `file.routes.js` | `/api/files` | **No** |
| `config.routes.js`, `config.js` | `/api/config` | **No** |
| `jobs.routes.js`, `job.routes.js` | `/api/jobs`, `/api/job` | **No** |
| `emailChecker.js`, `emailCheckerFinal.js`, `emailCheckerConservative.js` | Alternate implementations | **No** (superseded variants) |

**Frontend orphan:** `DomainSearch.jsx` calls `/api/domain-search/*` — **no matching backend route** (verified by ripgrep).

---

## 5. Frontend architecture

- **Router:** `react-router-dom` in `main.jsx` → `App.jsx`.
- **Active routes** (`App.jsx`): `/`, `/email-checker`, `/pro-checker`, `/whatsapp`, `/recruitment-whatsapp`.
- **HTTP:** `frontend/src/api.js` uses `window.location.origin` (Vite proxy for `/api`).
- **Inconsistent hard-coded URLs:** Several components use `http://localhost:5003` directly (`CompanyJobsExtractor.jsx`, `EnhancedSearchEngine.jsx`, `DomainSearch.jsx`, `DomainEmailsFinder.jsx`).

### Pages (`frontend/src/pages/`)

| File | Routed | Notes |
|------|--------|-------|
| `EmailSearchPage.jsx` | Yes | Bulk validation UI |
| `ProfessionalEmailChecker.jsx` | Yes | Embeds discovery tools |
| `QuickCheck.jsx` | No | |
| `BatchCheck.jsx` | No | |
| `FileShare.jsx` | No | Needs `/api/files` |
| `Configuration.jsx`, `ConfigurationPage.jsx` | No | Needs `/api/config` + DB |
| `EmailSearchPageEnhanced.jsx` | No | |

### Major components (`frontend/src/components/`)

| Component | API dependency | Status |
|-----------|----------------|--------|
| `LiveCompanyEmailsFinder.jsx` | `/api/prefix-emails` | Works if backend mounted |
| `DomainEmailsFinder.jsx` | `/api/domain-emails` | Works; hard-coded base URL |
| `IndustryDomainFinder.jsx` | `/api/industry-domains` | **Broken** (route not mounted) |
| `EnhancedSearchEngine.jsx` | `/api/enhanced-search` | **Broken** |
| `CompanyJobsSearch.jsx`, `CompanyJobsExtractor.jsx` | `/api/company-jobs` | **Broken** |
| `DomainSearch.jsx` | `/api/domain-search` | **Broken** (API missing) |
| `WhatsAppFinder.jsx`, `RecruitmentWhatsAppFinder.jsx` | prefix / recruitment APIs | Partial (WhatsApp verify needs env) |

---

## 6. Authentication system

- **JWT middleware:** `backend/src/middleware/auth.js` — `authenticateToken`, `requireAdmin`, `optionalAuth`, `generateToken`.
- **Usage:** `backend/src/routes/config.js` protects admin config routes — **router not mounted**.
- **No** User model, login/register endpoints, or session store.
- **Frontend:** No auth flows in routed pages.
- **Configuration schema** includes `enableRegistration` (`Configuration.js`) — placeholder only.

---

## 7. Background workers and queues

- Long jobs: in-memory `Map` in `prefixEmails.js`, `domainEmails.js`, `recruitmentPhones.js` with **Server-Sent Events** streams.
- **BullMQ / Redis:** Not implemented despite dependencies.
- Cleanup cron: hourly email/job/file cleanup in `server.js` — gated on DB connection.

---

## 8. AI models and providers

- **Schema/UI:** `Configuration.apiKeys.openai`, Configuration pages in frontend.
- **Runtime:** No OpenAI/Anthropic/Ollama client calls found in `backend/src/services`.
- **Conclusion:** AI is **configuration placeholder**, not an engine.

---

## 9. Deployment and environment

- **DEPLOYMENT.md:** Windows Server/10/11, Node 18+, MongoDB, optional Redis, PM2, reverse proxy.
- **No Dockerfile** in repository.
- **Dev:** `npm run dev` → concurrently backend nodemon + Vite.
- **Environment variables (non-exhaustive, names only):** `PORT`, `CLIENT_ORIGIN`, `MONGODB_URI` / `MONGO_URI`, `JWT_SECRET`, `SAFE_MODE`, `NODE_ENV`, rate limit vars, `WHATSAPP_VERIFY_*`, file upload `MAX_FILE_SIZE`, `UPLOAD_DIR`.
- **`.env` files:** Not committed (glob found none); README may document example values — **rotate any credentials that were ever committed to docs**.

---

## 10. Application flows (summary)

See [ARCHITECTURE.md](./ARCHITECTURE.md) for diagrams and function-level references.

| Step | Implementation |
|------|----------------|
| Startup | `startServer()` in `server.js` |
| Auth | Effectively none for discovery APIs |
| Dashboard | No; navbar only |
| Search lifecycle | POST `/run` → service orchestrator → SSE progress |
| Acquisition | HTTP fetch to SERP HTML and target sites |
| Processing | cheerio parse, regex filters, dedupe Sets |
| Validation | Email verification + disposable lists |
| Storage | Mongo models **if connected**; else ephemeral |
| AI | None |
| Presentation | React tables, filters, export helpers |
| Export | Client-side CSV/JSON patterns in components |

---

## 11. Data collection (pointer)

Full collector inventory: [INTEGRATIONS.md](./INTEGRATIONS.md).

---

## 12. People and company intelligence (Anoud / GCC)

| Capability | Evidence | Status |
|------------|----------|--------|
| GCC country selection | `EnhancedSearchEngine.jsx`, `COUNTRY_HINTS` in `recruitment/runSearch.js` | UI/query level |
| Company website discovery | Industry domains service, SERP | **API unmounted** |
| Public company emails | `prefixEmails`, `domainEmails` | **Partially working** |
| Phones / WhatsApp | `recruitmentPhones`, `phonesExtract` | **Partially working** |
| HR role targeting | Keyword templates only | No ontology |
| Job titles from live data | `companyJobsService` | **Unmounted**; enhanced search has **synthetic** rows |
| Email verification | `emailVerificationService`, `advancedEmailValidation` | **Working** |
| Confidence on OSINT leads | Limited | Verification-focused |
| Company matching / entity resolution | — | **Missing** |

---

## 13. Search engine audit (summary)

- **Input:** JSON POST bodies (keywords, countries, prefixes, engines, caps).
- **Providers:** DuckDuckGo HTML scrape, Bing HTML scrape, `mock` engines in several modules.
- **Not used:** Google/Bing official APIs, Elasticsearch, vector DB.
- **Caching:** In-process `Map`, TTL ~30 minutes in multiple services.
- **History:** Not persisted.
- **Synthetic data:** `enhancedSearch/engines/ddg.js` → `generateComprehensiveResults()` for certain queries.

Details: [ARCHITECTURE.md](./ARCHITECTURE.md) and [INTEGRATIONS.md](./INTEGRATIONS.md).

---

## 14. Deep web and dark web

**Verified:** No Tor, onion, breach feeds, or TI platforms in codebase.

---

## 15. Performance (no synthetic benchmarks)

**Measured during audit:** None (no load tests run per audit rules).

**Observed design characteristics likely to affect performance:**

| Factor | Source |
|--------|--------|
| SMTP/DNS concurrency caps | `advancedEmailValidation.js`, `safetyControls.js` |
| Crawl delays | `domainEmails/crawler.js`, `prefixEmails/runSearch.js` constants |
| Single Node process | No cluster mode in `server.js` |
| In-memory run maps | Risk of RAM growth on many concurrent SSE runs |
| SERP scraping latency | Network-bound; sequential page delays in DDG engine |

---

## 16. UI audit (summary)

Missing platform UI: dashboard, investigations, source management, analytics, company/person profile pages, security center.

Recommendation: Unified **Intelligence Console** shell with modules: Discover → Verify → Investigate → Report — reuse existing tool components behind consistent routing.

Detail in [GAP_ANALYSIS.md](./GAP_ANALYSIS.md).

---

## 17. Assumptions and unknowns

| Item | Status |
|------|--------|
| Production MongoDB schema contents | **Unknown** (DB not queried) |
| Live SERP success rate from Windows host | **Unknown** |
| Whether `p-limit` is direct or transitive dependency | Check `backend/package-lock.json` if packaging matters |
| PM2/ecosystem files in deployment | Not in repo root |

---

**End of system audit.** Application source unchanged.