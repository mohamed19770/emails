# Company Jobs Extractor

A powerful web scraping tool integrated into the Professional Email Checker application that extracts job listings from company websites with advanced filtering, Safe Mode protections, and Liquid Glass design.

## 🚀 Features

### **Frontend (React/Vite)**
- **Collapsible Interface**: Clean, expandable section in the Professional Email Checker page
- **Advanced Configuration**:
  - Country selection (default: Saudi Arabia)
  - Cities filter (comma-separated list)
  - Domains input (one per line)
  - Optional keyword filtering
- **Action Buttons**:
  - 🚀 **Run Extract**: Full extraction from all domains
  - 🧪 **Dry Run**: Test extraction on first domain only
  - 🗑️ **Clear Results**: Reset all data
- **Results Display**:
  - Summary chips (total jobs, country matches, city matches, unique domains)
  - Search filter for title/location
  - Responsive table with detailed job information
  - Export actions (Copy URLs, Export CSV, Export JSON)
- **Safe Mode Integration**: Shows banner and disables extraction when Safe Mode is enabled

### **Backend (Node/Express)**
- **Smart Extraction Logic**:
  - Tries common career page paths (`/careers`, `/jobs`, `/join-us`, etc.)
  - Falls back to homepage anchor scanning for career links
  - Uses sitemap.xml as last resort
- **Advanced Filtering**:
  - Country matching with synonyms (Saudi Arabia, KSA, السعودية)
  - City filtering with English/Arabic support
  - Keyword matching in titles and locations
- **Protection Mechanisms**:
  - Rate limiting and request delays
  - Domain backoff for 429/403 responses
  - Caching with 30-minute TTL
  - Robots.txt respect
  - Concurrency controls

## 🛡️ Safe Mode & Protections

### **Safe Mode**
- Controlled by `SAFE_MODE` environment variable
- When enabled, all extraction endpoints return `SAFE_MODE_ENABLED` error
- Frontend shows warning banner and disables buttons

### **Rate Limiting**
- **Global Concurrency**: 3 simultaneous requests
- **Per-Domain Concurrency**: 1 request per domain
- **Request Delay**: 6 seconds between domain batches
- **Timeout**: 10 seconds per request
- **Backoff**: 2 hours for rate-limited domains

### **Caching**
- **TTL**: 30 minutes for domain results
- **Memory-based**: In-memory cache with automatic cleanup
- **Cache Control**: Manual cache clearing via API

## 📊 API Endpoints

### **POST /api/company-jobs/run**
Extract jobs from multiple domains.

**Request:**
```json
{
  "country": "Saudi Arabia",
  "cities": ["Riyadh", "Jeddah"],
  "domains": ["stc.com", "sabic.com"],
  "keyword": "engineer"
}
```

**Response:**
```json
{
  "ok": true,
  "count": 12,
  "items": [
    {
      "title": "Planning Engineer",
      "url": "https://careers.stc.com/job/123",
      "source": "stc.com",
      "location": "Riyadh, Saudi Arabia",
      "countryMatch": true,
      "cityMatch": "Riyadh",
      "fetchedAt": "2025-09-29T13:00:00Z"
    }
  ],
  "logs": {
    "stc.com": "✓ careers page found, 5 jobs extracted"
  },
  "processingTime": 15420
}
```

### **POST /api/company-jobs/dry-run**
Test extraction on first domain only.

### **GET /api/company-jobs/status**
Get service status and configuration.

### **POST /api/company-jobs/clear-cache**
Clear service cache and backoff domains.

## 🎨 Liquid Glass Design

The component uses the existing Liquid Glass design system:

- **Glass Containers**: `.glass` class for frosted glass effect
- **Glass Buttons**: `.btn-glass` for consistent button styling
- **Chips**: Color-coded status indicators
- **Responsive Grid**: Mobile-friendly layout
- **Smooth Animations**: Hover effects and transitions

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
npm test -- companyJobsService.test.js
```

### **Frontend Tests**
```bash
cd frontend
npm test -- CompanyJobsExtractor.test.jsx
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
   - Scroll down to "Company Jobs Extractor" section
   - Configure extraction parameters
   - Click "Run Extract" or "Dry Run"

## 📈 Performance

- **Concurrent Processing**: Up to 3 domains simultaneously
- **Smart Caching**: Avoids re-fetching same domains within 30 minutes
- **Rate Limiting**: Respects website limits and prevents bans
- **Memory Efficient**: Automatic cache cleanup and garbage collection

## 🔒 Security

- **User Agent Rotation**: Realistic browser headers
- **Request Delays**: Prevents overwhelming target servers
- **Error Handling**: Graceful degradation on failures
- **Safe Mode**: Complete extraction disable when needed

## 🌍 International Support

- **Country Synonyms**: Supports multiple language variations
- **City Matching**: English and Arabic city names
- **Unicode Support**: Full UTF-8 character handling
- **Localized Results**: Region-specific job filtering

---

**Built with ❤️ using Liquid Glass Design System**
