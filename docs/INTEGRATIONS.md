# Integrations and Data Sources

Classifications: **A** Surface Web, **B** Deep Web (authorized), **C** Dark Web (defensive only).  
No credentials are documented here.

---

## 1. Integration inventory

| Integration | Type | Class | Used by | Auth | Mounted API |
|-------------|------|-------|---------|------|-------------|
| DuckDuckGo HTML (`duckduckgo.com/html/`) | HTTP scrape | A | `enhancedSearch/engines/ddg.js`, `prefixEmails/engines/ddg.js`, `recruitment/engines/ddg.js`, `industryDomains/engines/ddg.js` | None | Partial |
| Bing HTML search | HTTP scrape | A | `recruitment/engines/bing.js` | None | Via recruitment |
| Arbitrary company HTTPS sites | Crawl | A | `domainEmails/crawler.js`, `siteExplorer.js`, `companyJobsService.js` | None | Partial |
| Public DNS | DNS | A | `emailChecker/dns.js`, `advancedEmailValidation.js`, `dnsIntelligence.js` | None | Yes |
| Remote SMTP (MX) | TCP/TLS | A | `advancedEmailValidation.js`, `smtpHandshake.js`, `ndsmtp.js` | None | Yes |
| WhatsApp verify — 2chat | REST API | B | `phones/whatsappVerify.js` → `verifyVia2Chat` | API key header | Optional |
| WhatsApp verify — WAWP | REST API | B | `verifyViaWawp` | API key | Optional |
| WhatsApp verify — custom URL | REST | B | Env `WHATSAPP_VERIFY_URL` | Configurable | Optional |
| MongoDB Atlas / local | Database | B | `config/db.js` | URI | **Disconnected** in server |
| Redis | Cache/queue | B | Dependency only | URI | **Not implemented** |
| OpenAI | Cloud AI | B | Config schema only | API key field | **Not implemented** |
| Stripe | Payments | B | Config schema only | API key field | **Not implemented** |
| `disposable-email-domains` | NPM dataset | A | package dependency | N/A | Indirect |

**Dark web (C):** **None.**

---

## 2. Data collection mechanisms (detailed)

### 2.1 Prefix email / phone search

| Attribute | Detail |
|-----------|--------|
| **Source type** | A — Surface |
| **Entry** | `POST /api/prefix-emails/run` → `runPrefixSearch()` |
| **Method** | Build queries (`queryBuilder.js`) → DDG/mock engines → optional `SiteExplorer` |
| **Pagination** | `maxPages` per query |
| **Rate limits** | `SERP_DELAY_MS`, `VISIT_DELAY_MS`, `BACKOFF_429_403_MS` in `runSearch.js` |
| **Retry** | Domain backoff maps |
| **Normalization** | `filters.js`, `extractFromHtml.js` |
| **Validation** | Role/disposable filters, `maxEmailsPerDomain` |
| **Deduplication** | In-memory Sets |
| **Storage** | SSE to client; **no DB** |
| **Attribution** | `engine`, URL, timestamps in trace |

### 2.2 Domain email crawler

| Attribute | Detail |
|-----------|--------|
| **Source** | A — user-supplied domain |
| **Entry** | `POST /api/domain-emails/run` → `crawlDomainForEmails()` |
| **Method** | BFS same-site links, cheerio |
| **Limits** | `depthLimit`, `maxPagesPerDomain`, `TIMEOUT_MS` |
| **Exclusions** | Login/cart/utm patterns in `DEFAULT_EXCLUDE_PATTERNS` |
| **Storage** | In-memory run state + client |

### 2.3 Recruitment phone search

| Attribute | Detail |
|-----------|--------|
| **Source** | A — DDG/Bing + career paths |
| **Entry** | `POST /api/recruitment-phones/run` → `runRecruitmentPhoneSearch()` |
| **Templates** | `RECRUITMENT_QUERY_TEMPLATE`, `CAREER_PATHS`, `COUNTRY_HINTS` (GCC + Egypt) |
| **Concurrency** | `GLOBAL_CONCURRENCY = 3`, semaphore |
| **Phone validation** | `isLikelyFakePhone`, carrier helpers |

### 2.4 Enhanced search

| Attribute | Detail |
|-----------|--------|
| **Source** | A (intended) |
| **Entry** | `enhancedSearch.js` — **not mounted** |
| **Orchestrator** | `enhancedSearch/runSearch.js` |
| **Anomaly** | `ddg.js` `generateComprehensiveResults()` — **synthetic URLs** for some queries (not live SERP) |
| **Cache** | 30-minute in-memory |

### 2.5 Industry domains

| Attribute | Detail |
|-----------|--------|
| **Entry** | `industryDomains.js` — **not mounted** |
| **Flow** | SERP → `verifyDomains()` → mock row detection |
| **Files** | `industryDomains/runSearch.js`, `domainAnalyzer.js` |

### 2.6 Company jobs extractor

| Attribute | Detail |
|-----------|--------|
| **Entry** | `companyJobs.routes.js` — **not mounted** |
| **Service** | `companyJobsService.js` (CommonJS requires in ESM backend) |
| **Method** | Career URL probing, Workday/SuccessFactors parsers (per COMPANY_JOBS_SEARCH.md) |
| **Deduplication** | `deduplicateJobs` by URL |
| **Safe Mode** | Env check in route |

### 2.7 Phones extract route

| Attribute | Detail |
|-----------|--------|
| **Entry** | `phonesExtract.js` — mounted |
| **Method** | Fetch user URLs, extract phones from HTML (see route file) |

### 2.8 Email verification / SMTP

| Attribute | Detail |
|-----------|--------|
| **Entry** | `/api/email-verification/*`, `/api/email-checker/run` |
| **Safety** | `safetyControls.js` rate limits, sensitive provider lists |
| **Confidence** | `confidenceScoring.js` |
| **Legal note** | SMTP probing can harm sender reputation — Safe Mode intended to limit |

### 2.9 Mock engines

| Engine | Location | Purpose |
|--------|----------|---------|
| `mock` | `prefixEmails/engines/mock.js`, `enhancedSearch/engines/mock.js`, `industryDomains/engines/mock.js` | Tests / dry runs |

### 2.10 Jobs search mock API

| Entry | `jobs.routes.js` — **not mounted** |
| Data | Hard-coded `mockJobs` array in route handler |

---

## 3. Search provider classification (Section 6)

| Mechanism | Used? |
|-----------|-------|
| Real search APIs (Google CSE, Bing API) | **No** |
| Web crawling | **Yes** |
| Static / synthetic datasets | **Yes** (enhanced DDG shortcut, jobs.routes mock) |
| External intelligence DBs | **No** |
| AI-based search | **No** |
| Combination | **Yes** — scrape + crawl + mock |

---

## 4. GCC / Anoud-relevant query data

Verified in code:

- Country lists in `EnhancedSearchEngine.jsx`, `IndustryDomainFinder.jsx`, `RecruitmentWhatsAppFinder.jsx`
- `COUNTRY_HINTS` in `recruitment/runSearch.js` for GCC states
- Default country **Saudi Arabia** in multiple components
- Arabic location strings in `DomainSearch.jsx` placeholders (component itself broken API-wise)

**Not verified:** Live accuracy of results for HR Director / HR Manager targeting (no role entity extraction).

---

## 5. Deep web module (existing)

**None.** No subscription connectors, authenticated portals, or licensed data APIs beyond optional WhatsApp verification vendors.

---

## 6. Defensive dark web (future — not in repo)

Recommended allowlist-only design documented in SYSTEM_AUDIT / ROADMAP — no implementation.

---

## 7. External dependency risks

| Risk | Detail |
|------|--------|
| SERP HTML layout changes | Breaks cheerio selectors |
| IP blocking | DDG/Bing may throttle datacenter/residential IPs |
| WhatsApp API cost | Per-number verify on 2chat/wawp |
| SMTP blocking | Recipient MX may tarpit or block probe source IP |

---

## 8. Compliance and authorized use (Anoud)

Operational policy should define:

- Allowed source types (company sites, public directories with permission)
- Prohibited sources (breach dumps, credential markets)
- Retention and purpose limitation for contact data
- GCC privacy regimes (PDPL UAE, etc.) — **legal review required**, not covered in code

---

**End of integrations document.**