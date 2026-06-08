# Email Checker

A production-ready monorepo for email validation and file sharing, built with Node.js/Express backend and React frontend.

## Features

### Email Validation
- **Format Validation**: RFC-compliant email format checking
- **Domain Resolution**: MX record validation and domain existence
- **SMTP Probing**: Server connectivity testing without sending emails
- **Batch Processing**: Validate up to 1000 emails at once
- **Real-time Progress**: Live updates for batch operations
- **CSV Export**: Download validation results

### File Sharing
- **Secure Upload**: .txt files only, up to 10MB
- **Public Links**: Share files via unique URLs
- **Auto-Expiry**: Files expire after 7 days
- **Download Tracking**: Monitor access patterns
- **No Authentication**: Public access for simplicity

### Configuration Management
- **Runtime Settings**: Change timeouts, concurrency, and rate limits
- **Safe Mode**: Global IP protection with daily/hourly limits
- **Domain Blocking**: Block suspicious temporary email domains
- **Web UI**: Easy configuration through the web interface
- **Version History**: Track configuration changes over time

## Tech Stack

### Backend
- **Node.js 18+** with ESM modules
- **Express 4** web framework
- **Mongoose 8** MongoDB ODM
- **Winston** structured logging
- **Helmet** security headers
- **Express Rate Limit** API protection
- **Multer** file upload handling
- **BullMQ + Redis** (optional queue system)

### Frontend
- **React 18** with hooks
- **Vite** build tool and dev server
- **React Router** navigation
- **Axios** HTTP client
- **Vanilla CSS** (no frameworks)

### Infrastructure
- **PM2** process management
- **MongoDB** data storage
- **Redis** (optional) for queues
- **Windows Server** optimized

## Quick Start

### Prerequisites
- Node.js 18 or higher
- MongoDB 4.4 or higher
- Redis (optional, for queue features)

### Installation

1. **Clone and install dependencies:**
```bash
git clone <repository-url>
cd email-checker
npm run install:all
```

2. **Set up environment variables:**
```bash
# Backend environment file (backend/.env) is already created with:
PORT=5000
CLIENT_ORIGIN=http://localhost:5173
MONGODB_URI=mongodb+srv://mmegahed:123@crm.ndldkx7.mongodb.net/email_checker?retryWrites=true&w=majority&appName=crmApp
UPLOAD_DIR=uploads
SMTP_PROBE_TIMEOUT_MS=8000
JWT_SECRET=SuperSecretMegaKey123

# Frontend environment file (frontend/.env) is already created with:
VITE_API_URL=http://localhost:5000
VITE_APP_TITLE=Email Checker
VITE_APP_DESCRIPTION=Professional email validation and file sharing service

# If you need to modify these settings, edit the .env files and restart both servers
```

3. **Start development servers:**
```bash
# Start both frontend and backend
npm run dev

# Or start individually
npm run dev:backend  # Backend on :5000
npm run dev:frontend # Frontend on :5173 (Vite will auto-select available port)
```

**Important:** After modifying `.env` files, you must restart both frontend and backend servers for changes to take effect.

4. **Access the application:**
- Frontend: http://localhost:5173 (or the port shown in terminal)
- Backend API: http://localhost:5000
- Health Check: http://localhost:5000/health

## Production Deployment

### Using PM2 (Recommended)

1. **Build the frontend:**
```bash
npm run build
```

2. **Start with PM2:**
```bash
cd backend
pm2 start ecosystem.config.cjs --env production
```

3. **Monitor the application:**
```bash
pm2 status
pm2 logs email-checker-backend
pm2 monit
```

### Environment Configuration

Create `backend/.env` with production settings:

```env
# Server
NODE_ENV=production
PORT=3001

# Database
MONGODB_URI=mongodb://your-mongodb-host:27017/email-checker

# Redis (optional)
REDIS_URL=redis://your-redis-host:6379

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=uploads

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
EMAIL_CHECK_RATE_LIMIT_WINDOW_MS=60000
EMAIL_CHECK_RATE_LIMIT_MAX_REQUESTS=10

# Logging
LOG_LEVEL=info
LOG_FILE=logs/app.log
```

## API Documentation

### Email Validation

#### Single Email Check
```http
POST /api/check/single
Content-Type: application/json

{
  "email": "test@example.com"
}
```

#### Batch Email Check
```http
POST /api/check/batch
Content-Type: application/json

{
  "emails": ["test1@example.com", "test2@example.com"]
}
```

#### Email History
```http
GET /api/check/history/test@example.com?page=1&limit=10
```

### File Sharing

#### Upload File
```http
POST /api/files/upload
Content-Type: multipart/form-data

file: [.txt file]
```

#### Download File
```http
GET /api/files/download/{fileId}
```

#### File Information
```http
GET /api/files/info/{fileId}
```

### Job Management

#### Create Batch Job
```http
POST /api/jobs/batch-check
Content-Type: application/json

{
  "emails": ["email1@example.com", "email2@example.com"]
}
```

#### Get Job Status
```http
GET /api/jobs/{jobId}
```

### Configuration Management

#### Get Current Configuration
```http
GET /api/config
```

#### Update Configuration
```http
PUT /api/config
Content-Type: application/json

{
  "emailValidation": {
    "smtpTimeout": 8000,
    "maxConcurrentChecks": 5,
    "batchSize": 5,
    "enableRcptCheck": false,
    "retryAttempts": 2
  },
  "rateLimiting": {
    "generalWindowMs": 900000,
    "generalMaxRequests": 1000,
    "emailCheckWindowMs": 60000,
    "emailCheckMaxRequests": 10
  },
  "fileSharing": {
    "maxFileSize": 10485760,
    "allowedFileTypes": ["txt"],
    "fileExpiryDays": 7,
    "maxFilesPerHour": 10
  },
  "safeMode": {
    "enabled": false,
    "maxChecksPerDay": 100,
    "maxChecksPerHour": 20,
    "blockSuspiciousDomains": true,
    "suspiciousDomains": ["tempmail.org", "10minutemail.com"]
  },
  "system": {
    "logLevel": "info",
    "enableMetrics": true,
    "cleanupIntervalHours": 24
  }
}
```

#### Get Configuration History
```http
GET /api/config/history?limit=10
```

#### Reset Configuration to Defaults
```http
POST /api/config/reset
```

#### Get Safe Mode Statistics
```http
GET /api/config/safe-mode/stats
```

#### Get IP Information
```http
GET /api/config/safe-mode/ip/{ip}
```

#### Reset Safe Mode Counters
```http
POST /api/config/safe-mode/reset
```

## Project Structure

```
email-checker/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js          # Database connection
│   │   │   └── logger.js      # Winston logging setup
│   │   ├── models/
│   │   │   ├── EmailCheck.js  # Email validation results
│   │   │   ├── Job.js         # Batch job tracking
│   │   │   ├── File.js        # File sharing records
│   │   │   └── Configuration.js # Runtime settings storage
│   │   ├── services/
│   │   │   ├── emailCheck.js  # Email validation logic
│   │   │   └── safeMode.js    # Safe Mode IP protection
│   │   ├── middleware/
│   │   │   └── safeMode.js    # Safe Mode middleware
│   │   ├── routes/
│   │   │   ├── check.routes.js    # Email validation endpoints
│   │   │   ├── job.routes.js      # Job management endpoints
│   │   │   ├── file.routes.js     # File sharing endpoints
│   │   │   └── config.routes.js   # Configuration endpoints
│   │   └── server.js          # Express server setup
│   ├── ecosystem.config.cjs   # PM2 configuration
│   ├── package.json
│   └── env.example
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── QuickCheck.jsx     # Single email validation
│   │   │   ├── BatchCheck.jsx     # Batch email processing
│   │   │   ├── FileShare.jsx      # File upload/download
│   │   │   └── Configuration.jsx  # Configuration management
│   │   ├── App.jsx            # Main app component
│   │   ├── api.js             # API client
│   │   ├── main.jsx           # React entry point
│   │   └── styles.css         # Global styles
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── package.json               # Root package.json
├── .prettierrc               # Code formatting
└── README.md
```

## Security Features

- **Helmet**: Security headers
- **Rate Limiting**: API protection with configurable limits
- **Input Validation**: Email format and file type checking
- **File Size Limits**: Configurable maximum upload size
- **CORS Configuration**: Cross-origin request handling
- **Error Handling**: Secure error responses
- **Safe Mode**: IP-based protection with daily/hourly limits
- **Domain Blocking**: Automatic blocking of suspicious email domains
- **Configuration Validation**: Input sanitization for all settings

## Monitoring & Logging

- **Winston**: Structured logging with file rotation
- **PM2**: Process monitoring and auto-restart
- **Health Checks**: `/health` endpoint for monitoring
- **Cleanup Tasks**: Automatic old data removal

## Development

### Code Style
- **Prettier**: 2 spaces, no tabs
- **ESLint**: Code quality checks
- **ESM Modules**: Modern JavaScript imports

### Scripts
```bash
# Development
npm run dev              # Start both frontend and backend
npm run dev:backend      # Backend only
npm run dev:frontend     # Frontend only

# Production
npm run build           # Build frontend
npm start              # Start backend

# PM2
pm2 start ecosystem.config.cjs
pm2 stop email-checker-backend
pm2 restart email-checker-backend
pm2 delete email-checker-backend
```

## Cache Management

### Quick Commands
```bash
# Clean caches and build outputs
npm run clean

# Deep clean (also removes lock files)
npm run clean:deep

# Show what would be deleted (dry run)
npm run clean:dry

# Deep clean + fresh install (root, frontend, backend)
npm run reinstall

# Verify environment files
npm run verify
```

### Cache Cleaning Details

The cache cleaner removes:
- **Node modules**: `node_modules/` directories
- **Build outputs**: `dist/`, `build/`, `out/`
- **Cache directories**: `.vite/`, `.parcel-cache/`, `.turbo/`, `.cache/`
- **Framework caches**: `.next/`, `.nuxt/`, `.svelte-kit/`
- **Test coverage**: `coverage/`
- **Lock files**: `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock` (with `--deep`)
- **Tool caches**: Jest, ESLint, Cypress, Playwright caches
- **npm cache**: Global npm cache (with `npm cache clean --force`)

### Safety Features
- **Preserves .env files**: Environment files are never deleted
- **Dry run mode**: Use `--dry-run` to preview what would be deleted
- **Verbose logging**: Use `--verbose` for detailed output
- **Cross-platform**: Works on Windows, macOS, and Linux
- **Idempotent**: Safe to run multiple times

### Individual Project Cleaning
```bash
# Clean frontend only
cd frontend && npm run clean

# Clean backend only  
cd backend && npm run clean

# Reinstall frontend only
cd frontend && npm run reinstall

# Reinstall backend only
cd backend && npm run reinstall
```

## Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   - Check MongoDB is running
   - Verify connection string in `.env`
   - Ensure network access

2. **Port Already in Use**
   - Change PORT in `.env`
   - Kill existing processes: `pm2 delete all`

3. **File Upload Fails**
   - Check file size (max 10MB)
   - Ensure file is .txt format
   - Verify uploads directory exists

4. **Rate Limit Exceeded**
   - Wait for rate limit window to reset
   - Adjust rate limits in `.env`
   - Use batch processing for large volumes

### Logs
```bash
# PM2 logs
pm2 logs email-checker-backend

# Application logs
tail -f backend/logs/combined.log
tail -f backend/logs/error.log
```

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions:
- Create an issue on GitHub
- Check the troubleshooting section
- Review the API documentation

#   e m a i l s  
 