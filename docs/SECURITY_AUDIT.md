# Security Audit

**Scope:** Defensive review of `d:\emails` source and docs. **No files modified.**  
**Secrets:** Not quoted. If credentials appear in `README.md` or local `.env`, rotate and remove from version control.

---

## 1. Summary matrix

| Severity | Count (representative) | Theme |
|----------|------------------------|--------|
| Critical | 2 | Unauthenticated outbound abuse (crawl/SMTP/SERP) |
| High | 4 | JWT fallback, SSRF, split Safe Mode, credential hygiene |
| Medium | 5 | CORS dev mode, rate limit stubs, hard-coded URLs, file upload when mounted |
| Low | 3 | CSRF surface, verbose client logging, missing utility scripts |

---

## 2. Authentication and authorization

| Finding | Severity | Evidence | Remediation (recommendation only) |
|---------|----------|----------|-----------------------------------|
| Discovery APIs public | **Critical** | Most mounted routes have no `authenticateToken` | Require API key or JWT for all POST that trigger outbound network |
| JWT secret fallback | **High** | `middleware/auth.js` uses `process.env.JWT_SECRET` with string fallback if unset | Fail startup if `JWT_SECRET` missing in production |
| Admin routes not mounted | **Medium** | `routes/config.js` has `requireAdmin` but not in `server.js` | Mount config API behind auth when enabling admin UI |
| `ADMIN_BYPASS` dev override | **Medium** | `requireAdmin` allows bypass when env set | Disallow in production builds |
| No user lifecycle | **Low** | No User model | Design RBAC before multi-tenant |

---

## 3. Session management

- **None** for browser users (no cookie sessions).
- JWT is stateless design only — **unused** on hot paths.

---

## 4. API security

| Control | Status |
|---------|--------|
| Helmet | Enabled `server.js` |
| CORS | Production allowlist; **development uses `origin: true`** |
| Body size limit | 10mb JSON |
| Rate limiting | `express-rate-limit` on some routers; global token bucket with fixed RPS=10 in `rateLimit.js` (config service bypass) |
| Input validation | Per-route manual checks; no central schema (Zod/Joi) |

---

## 5. Secrets management

| Issue | Severity |
|-------|----------|
| README may document example DB URI and JWT env | **High** (if committed) |
| OpenAI/Stripe in Mongo `Configuration` | **Medium** when DB enabled — ensure encryption at rest |
| WhatsApp keys via env (`WHATSAPP_VERIFY_*`) | **Low** if kept out of repo |

**Recommendation:** Use OS secret store / `.env` only on host; never commit; scan git history.

---

## 6. Injection and client-side risks

| Class | Risk | Notes |
|-------|------|-------|
| SQL injection | N/A | MongoDB ODM |
| NoSQL injection | Low | Typical Mongoose usage |
| XSS | Low–Medium | React default escaping; audit any raw HTML (none found in sampled pages) |
| CSRF | Low | JSON APIs, no cookie auth; relevant if cookies added later |

---

## 7. SSRF

| Finding | Severity | Evidence |
|---------|----------|----------|
| User-supplied domains fetched server-side | **High** | `domainEmails/crawler.js` `fetchPage(url)`, `prefixEmails/siteExplorer.js`, `companyJobsService.js` |
| No private IP / metadata URL blocklist | **High** | No dedicated SSRF guard found (only domain blocklists for disposable email) |

**Remediation (conceptual):** Resolve DNS, reject RFC1918, link-local, metadata IPs; allow only http(s); max redirects; per-tenant allowlist for intelligence mode.

---

## 8. File upload security

`file.routes.js` (unmounted):

- **Multer** disk storage under `backend/uploads`
- **Filter:** `.txt` only
- **Size:** `MAX_FILE_SIZE` default 10MB
- **Risk when enabled:** **Medium** — path traversal mitigated by generated filenames; still needs virus scan policy for untrusted uploads

---

## 9. Browser isolation / Docker

- **No** Docker or sandboxed browser in repo.
- Crawling uses **server-side fetch** from Windows host IP — **reputation and legal exposure**.

**Recommendation for intelligence work:** WSL2/Docker egress policy; optional Playwright in isolated container for untrusted pages.

---

## 10. Network and database permissions

- **Not verified:** MongoDB user least privilege in deployment.
- SMTP and DNS outbound from same process as HTTP API — single blast radius.

---

## 11. Audit logging

| What | Where |
|------|-------|
| HTTP access | Winston `logger.info` per request in `server.js` |
| Errors | `errorHandler.js` with UUID `traceId` |
| Security events | Ad hoc warnings in auth middleware |
| Tamper-evident audit trail | **Missing** |

---

## 12. Backup security

No encrypted backup implementation in code. Ops responsibility per `DEPLOYMENT.md`.

---

## 13. Safe Mode and outbound guard

| Component | Intended role | Actual |
|-----------|---------------|--------|
| `middleware/safeMode.js` | Block non-GET when Safe Mode on | `safeModeEnabled = false` hardcoded |
| `outboundGuard.js` | Check `configService.getSafeModeStatus()` | Works only if DB + config wired |
| Route-level `SAFE_MODE` env | 503 on some POST routes | Partial |

**Severity:** **High** for operational safety — protections do not align.

---

## 14. Windows 11 host risks

| Risk | Why |
|------|-----|
| IP blocklisting | SMTP probes and aggressive crawling from residential/office IP |
| Legal | SERP scraping may violate provider ToS |
| Lateral movement | SSRF could reach LAN services from Node process |
| Malware | Audit rule avoided executing untrusted binaries |

**Recommendation:** Run API in VM/WSL2 with firewall egress rules; separate “verification” VLAN if possible.

---

## 15. Ranked remediation roadmap (no code changes in audit)

1. **P0:** Auth on outbound endpoints; SSRF guard; remove JWT default secret; enforce `JWT_SECRET` at boot.
2. **P1:** Wire Safe Mode to configuration + env consistently; disable synthetic intelligence data paths in production policy.
3. **P2:** Central request validation; structured audit collection.
4. **P3:** Container isolation for crawlers; secrets scanning in CI.

---

**End of security audit.**