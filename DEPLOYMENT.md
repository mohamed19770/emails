# Deployment Guide

This guide covers deploying the Email Checker application to production environments, with a focus on Windows Server deployment.

## Prerequisites

### System Requirements
- **Windows Server 2016+** or **Windows 10/11**
- **Node.js 18+** (LTS recommended)
- **MongoDB 4.4+** (local or cloud)
- **Redis** (optional, for queue features)
- **PM2** for process management
- **IIS** or **Nginx** for reverse proxy (optional)

### Software Installation

1. **Install Node.js:**
   - Download from [nodejs.org](https://nodejs.org/)
   - Choose LTS version (18.x or higher)
   - Verify installation: `node --version`

2. **Install MongoDB:**
   - Download from [mongodb.com](https://www.mongodb.com/try/download/community)
   - Or use MongoDB Atlas (cloud)
   - Start MongoDB service: `net start MongoDB`

3. **Install PM2:**
   ```bash
   npm install -g pm2
   npm install -g pm2-windows-startup
   ```

4. **Install Redis (Optional):**
   - Download from [redis.io](https://redis.io/download)
   - Or use Redis Cloud
   - Start Redis service

## Deployment Steps

### 1. Prepare the Application

```bash
# Clone the repository
git clone <your-repo-url>
cd email-checker

# Install all dependencies
npm run install:all

# Build the frontend
npm run build
```

### 2. Environment Configuration

Create `backend/.env` with production settings:

```env
# Server Configuration
NODE_ENV=production
PORT=3001

# Database
MONGODB_URI=mongodb://localhost:27017/email-checker
# For MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/email-checker

# Redis (Optional)
REDIS_URL=redis://localhost:6379

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

### 3. Create Required Directories

```bash
# Create logs and uploads directories
mkdir backend\logs
mkdir backend\uploads

# Set permissions (if needed)
icacls backend\logs /grant Everyone:F
icacls backend\uploads /grant Everyone:F
```

### 4. Start with PM2

```bash
cd backend
pm2 start ecosystem.config.cjs --env production
```

### 5. Configure PM2 Startup

```bash
# Save PM2 configuration
pm2 save

# Configure startup script
pm2 startup

# Follow the instructions provided by PM2
```

### 6. Verify Deployment

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs email-checker-backend

# Test health endpoint
curl http://localhost:3001/health
```

## Reverse Proxy Setup

### Option 1: IIS with URL Rewrite

1. **Install IIS URL Rewrite Module**
2. **Create web.config in backend folder:**

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="Backend API" stopProcessing="true">
          <match url="^api/(.*)" />
          <action type="Rewrite" url="http://localhost:3001/api/{R:1}" />
        </rule>
        <rule name="Frontend" stopProcessing="true">
          <match url=".*" />
          <action type="Rewrite" url="http://localhost:3000/{R:0}" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

### Option 2: Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## SSL/HTTPS Setup

### Using Let's Encrypt with Certbot

1. **Install Certbot:**
   ```bash
   # Download and install certbot
   # Follow instructions at https://certbot.eff.org/
   ```

2. **Obtain SSL Certificate:**
   ```bash
   certbot certonly --webroot -w C:\inetpub\wwwroot -d your-domain.com
   ```

3. **Configure IIS/nginx for HTTPS**

## Monitoring & Maintenance

### PM2 Commands

```bash
# View application status
pm2 status

# View logs
pm2 logs email-checker-backend
pm2 logs email-checker-backend --lines 100

# Restart application
pm2 restart email-checker-backend

# Stop application
pm2 stop email-checker-backend

# Delete application
pm2 delete email-checker-backend

# Monitor resources
pm2 monit
```

### Log Management

```bash
# View application logs
type backend\logs\combined.log
type backend\logs\error.log

# Monitor logs in real-time
Get-Content backend\logs\combined.log -Wait -Tail 10
```

### Database Maintenance

```bash
# Connect to MongoDB
mongo mongodb://localhost:27017/email-checker

# Clean up old data (run periodically)
# The application automatically cleans up old records
```

## Performance Optimization

### PM2 Configuration

Edit `backend/ecosystem.config.cjs`:

```javascript
module.exports = {
  apps: [{
    name: 'email-checker-backend',
    script: 'src/server.js',
    instances: 'max', // Use all CPU cores
    exec_mode: 'cluster',
    max_memory_restart: '1G',
    // ... other settings
  }]
};
```

### MongoDB Optimization

```javascript
// Create indexes for better performance
db.emailchecks.createIndex({ "email": 1, "checkedAt": -1 })
db.jobs.createIndex({ "status": 1, "createdAt": -1 })
db.files.createIndex({ "publicId": 1, "isActive": 1 })
```

### Redis Configuration (Optional)

```bash
# Redis configuration for better performance
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

## Backup Strategy

### Database Backup

```bash
# MongoDB backup
mongodump --db email-checker --out C:\backups\mongodb\%date%

# Restore from backup
mongorestore --db email-checker C:\backups\mongodb\backup-folder
```

### File Backup

```bash
# Backup uploads directory
robocopy backend\uploads C:\backups\uploads\%date% /E

# Backup logs
robocopy backend\logs C:\backups\logs\%date% /E
```

## Security Considerations

### Firewall Configuration

```bash
# Allow HTTP/HTTPS traffic
netsh advfirewall firewall add rule name="HTTP" dir=in action=allow protocol=TCP localport=80
netsh advfirewall firewall add rule name="HTTPS" dir=in action=allow protocol=TCP localport=443

# Allow MongoDB (if external access needed)
netsh advfirewall firewall add rule name="MongoDB" dir=in action=allow protocol=TCP localport=27017
```

### Environment Security

- Use strong MongoDB passwords
- Enable MongoDB authentication
- Use environment variables for secrets
- Regular security updates
- Monitor access logs

## Troubleshooting

### Common Issues

1. **PM2 won't start:**
   ```bash
   pm2 kill
   pm2 start ecosystem.config.cjs
   ```

2. **Port conflicts:**
   ```bash
   netstat -ano | findstr :3001
   taskkill /PID <PID> /F
   ```

3. **MongoDB connection issues:**
   ```bash
   # Check MongoDB service
   net start MongoDB
   
   # Check connection
   mongo mongodb://localhost:27017/email-checker
   ```

4. **File upload issues:**
   ```bash
   # Check directory permissions
   icacls backend\uploads
   
   # Check disk space
   dir backend\uploads
   ```

### Log Analysis

```bash
# Search for errors
findstr /i "error" backend\logs\combined.log

# Monitor real-time logs
Get-Content backend\logs\combined.log -Wait -Tail 50
```

## Scaling Considerations

### Horizontal Scaling

- Use load balancer (nginx, HAProxy)
- Multiple PM2 instances
- MongoDB replica sets
- Redis clustering

### Vertical Scaling

- Increase server resources
- Optimize PM2 cluster settings
- Database query optimization
- Caching strategies

## Update Procedure

```bash
# 1. Stop application
pm2 stop email-checker-backend

# 2. Backup current version
robocopy . C:\backups\email-checker-%date% /E

# 3. Pull latest changes
git pull origin main

# 4. Install dependencies
npm run install:all

# 5. Build frontend
npm run build

# 6. Start application
pm2 start ecosystem.config.cjs --env production

# 7. Verify deployment
pm2 status
curl http://localhost:3001/health
```

This deployment guide provides a comprehensive approach to deploying the Email Checker application on Windows Server with PM2 process management.


















