# Company Jobs Search

A comprehensive job extraction system that pulls job listings exclusively from company websites (their Careers/Jobs pages) with advanced filtering, Safe Mode protections, and Liquid Glass design integration.

## 🚀 Features

### **Frontend (React/Vite)**
- **Collapsible Interface**: Integrated into Professional Email Checker page
- **Advanced Configuration**:
  - Country selection (default: Saudi Arabia)
  - Cities filter (comma-separated list)
  - Domains input (one per line)
  - Optional keyword filtering
  - Max per domain (10-200, default: 50)
- **Action Buttons**:
  - 🚀 **Run Extract**: Full extraction from all domains
  - 🧪 **Dry Run**: Test extraction on first domain only (max 10 results)
  - 🗑️ **Clear Results**: Reset all data
  - 📁 **Import Domains**: Load domains from .txt file
  - 💾 **Export Config**: Save configuration as JSON
- **Progress Tracking**: Real-time progress with domain status
- **Results Display**:
  - Summary chips (total jobs, country matches, city matches, unique domains)
  - Search filter for title/location
  - Responsive table with detailed job information
  - Row actions (Open ↗, Copy URL)
  - Export actions (Copy URLs, Export CSV, Export JSON)
- **Safe Mode Integration**: Shows banner and disables extraction when Safe Mode is enabled

### **Backend (Node/Express)**
- **Smart Career Page Discovery**:
  - Tries common career page paths (`/careers`, `/jobs`, `/join-us`, etc.)
  - Falls back to homepage anchor scanning for career links
  - Uses sitemap.xml as last resort
- **Platform-Specific Parsers**:
  - **Generic Parser**: Works with any website
  - **Workday Parser**: Optimized for Workday-powered sites
  - **SuccessFactors Parser**: Optimized for SuccessFactors-powered sites
- **Advanced Filtering**:
  - Country matching with synonyms (Saudi Arabia, KSA, السعودية)
  - City filtering with English/Arabic support
  - Keyword matching in titles and locations
  - Job board detection and exclusion
- **Protection Mechanisms**:
  - Rate limiting and request delays
  - Domain backoff for 429/403 responses
  - Caching with 30-minute TTL
  - Robots.txt respect
  - Concurrency controls

## 🛡️ Safe Mode & Protections

### **Safe Mode**
- Controlled by `SAFE_MODE` environment variable
- When enabled, all extraction endpoints return `SAFE_MODE_ENABLED` error (503)
- Frontend shows warning banner and disables buttons

### **Rate Limiting & Caching**
- **Global Concurrency**: 3 simultaneous requests
- **Per-Domain Concurrency**: 1 request per domain
- **Request Delay**: 6 seconds between domain batches
- **Timeout**: 10 seconds per request
- **Backoff**: 2 hours for rate-limited domains
- **Cache TTL**: 30 minutes for domain results
- **Memory-based**: In-memory cache with automatic cleanup

### **Legal Compliance**
- **Robots.txt Respect**: Automatically checks and respects robots.txt
- **Polite Scraping**: Low concurrency, delays, timeouts
- **Job Board Exclusion**: Automatically skips LinkedIn, Bayt, GulfTalent, etc.
- **No Eval**: Never evaluates HTML; sanitizes all outputs
- **Safe Links**: All links open with `target="_blank" rel="noopener noreferrer"`

## 📊 API Endpoints

### **POST /api/company-jobs/run**
Extract jobs from company domains.

**Request:**
```json
{
  "country": "Saudi Arabia",
  "cities": ["Riyadh", "Jeddah", "Dammam"],
  "domains": ["stc.com", "sabic.com", "aramco.com", "almarai.com"],
  "keyword": "engineer",
  "maxPerDomain": 50
}
```

**Query Parameters:**
- `dry=1` - Dry run mode (first domain only, max 10 results)

**Response:**
```json
{
  "ok": true,
  "count": 12,
  "items": [
    {
      "title": "Software Engineer",
      "url": "https://careers.stc.com/job/123",
      "source": "stc.com",
      "location": "Riyadh, Saudi Arabia",
      "countryMatch": true,
      "cityMatch": "Riyadh",
      "fetchedAt": "2025-09-29T13:00:00Z"
    }
  ],
  "logs": {
    "stc.com": "✓ careers page found, 5 jobs extracted",
    "sabic.com": "❌ no careers page found"
  },
  "processingTime": 15420,
  "dryRun": false
}
```

### **GET /api/company-jobs/status**
Get service status and configuration.

**Response:**
```json
{
  "ok": true,
  "safeMode": false,
  "cacheSize": 5,
  "backoffDomains": 0,
  "config": {
    "GLOBAL_CONCURRENCY": 3,
    "PER_DOMAIN_CONCURRENCY": 1,
    "REQUEST_DELAY_PER_DOMAIN": 6000,
    "TIMEOUT": 10000,
    "CACHE_TTL": 1800000,
    "BACKOFF_DURATION": 7200000
  }
}
```

### **POST /api/company-jobs/clear-cache**
Clear service cache and backoff domains.

## 🎨 Liquid Glass Design

The component uses the existing Liquid Glass design system:

- **Glass Containers**: `.glass` class for frosted glass effect
- **Glass Buttons**: `.btn-glass` for consistent button styling
- **Chips**: Color-coded status indicators
- **Responsive Grid**: Mobile-friendly layout
- **Smooth Animations**: Hover effects and transitions
- **Deterministic Visuals**: No randomness in design
- **Accessible Focus**: Proper focus-visible styles

## 🔧 Configuration

### **Environment Variables**
```bash
# Safe Mode
SAFE_MODE=false

# Company Jobs Extraction
COMPANY_JOBS_GLOBAL_CONCURRENCY=3
COMPANY_JOBS_PER_DOMAIN_CONCURRENCY=1
COMPANY_JOBS_REQUEST_DELAY_PER_DOMAIN=6000
COMPANY_JOBS_TIMEOUT=10000
COMPANY_JOBS_CACHE_TTL=1800000
COMPANY_JOBS_BACKOFF_DURATION=7200000
```

### **Dependencies**
- **Backend**: `cheerio` for HTML parsing, `axios` for HTTP requests
- **Frontend**: React hooks for state management, CSS modules for styling

## 🧪 Testing

### **Backend Tests**
```bash
cd backend
npm test -- companyJobsSearch.test.js
```

### **Frontend Tests**
```bash
cd frontend
npm test -- CompanyJobsSearch.test.jsx
```

## 🚀 Usage

1. **Start Backend**:
   ```bash
   cd backend
   npm start
   ```

2. **Start Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```

3. **Access Application**:
   - Navigate to `http://localhost:5173/pro-checker`
   - Scroll down to "Company Jobs Search" section
   - Configure extraction parameters
   - Click "Run Extract" or "Dry Run"

## 📈 Performance

- **Concurrent Processing**: Up to 3 domains simultaneously
- **Smart Caching**: Avoids re-fetching same domains within 30 minutes
- **Rate Limiting**: Respects website limits and prevents bans
- **Memory Efficient**: Automatic cache cleanup and garbage collection
- **Progress Tracking**: Real-time feedback on extraction progress

## 🔒 Security & Legal

- **User Agent Rotation**: Realistic browser headers
- **Request Delays**: Prevents overwhelming target servers
- **Error Handling**: Graceful degradation on failures
- **Safe Mode**: Complete extraction disable when needed
- **Robots.txt Compliance**: Automatic respect for robots.txt
- **Job Board Exclusion**: No scraping of job boards

## 🌍 International Support

- **Country Synonyms**: Supports multiple language variations
- **City Matching**: English and Arabic city names
- **Unicode Support**: Full UTF-8 character handling
- **Localized Results**: Region-specific job filtering

## 📋 Supported Platforms

- **Generic Websites**: Any company career page
- **Workday**: Optimized parsing for Workday-powered sites
- **SuccessFactors**: Optimized parsing for SuccessFactors-powered sites
- **Future Platforms**: Extensible architecture for additional parsers

## 🚫 Excluded Platforms

- **Job Boards**: LinkedIn, Bayt, GulfTalent, Naukrigulf, MonsterGulf, Indeed, Glassdoor, etc.
- **Aggregators**: Any site that aggregates jobs from multiple companies
- **Social Networks**: Facebook, Twitter, etc. (unless they have dedicated career pages)

---

**Built with ❤️ using Liquid Glass Design System**
