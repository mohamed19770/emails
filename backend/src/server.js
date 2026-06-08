import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import mongoose from 'mongoose';

// Import configurations and services
import logger from './config/logger.js';
import configService from './services/configService.js';

// Import middleware
import safeModeMiddleware from './middleware/safeMode.js';
import rateLimitMiddleware from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// Import routes
import checkRoutes from './routes/check.routes.js';
import emailCheckerRoutes from './routes/emailChecker.routes.js';
import emailVerificationRoutes from './routes/emailVerification.routes.js';
import prefixEmailsRoutes from './routes/prefixEmails.js';
import phonesExtractRoutes from './routes/phonesExtract.js';
import recruitmentPhonesRoutes from './routes/recruitmentPhones.js';
import domainEmailsRoutes from './routes/domainEmails.js';
import whatsappVerifyRoutes from './routes/whatsappVerify.js';
import testRoute from './routes/testRoute.js';

// Import models for cleanup tasks
import EmailCheck from './models/EmailCheck.js';
import Job from './models/Job.js';
import File from './models/File.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Set default Safe Mode if not specified
if (!process.env.SAFE_MODE) {
  process.env.SAFE_MODE = 'false';
}

const app = express();
const PORT = process.env.PORT || 5003;

// Create necessary directories
async function createDirectories() {
  const dirs = ['logs', 'uploads'];
  for (const dir of dirs) {
    try {
      await fs.mkdir(path.join(__dirname, '..', dir), { recursive: true });
    } catch (error) {
      logger.warn(`Directory ${dir} may already exist:`, error.message);
    }
  }
}

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || (process.env.NODE_ENV === 'production' 
    ? ['http://localhost:3000', 'http://localhost:3003', 'http://localhost:5173'] 
    : true),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Apply Safe Mode middleware (before routes)
app.use(safeModeMiddleware);

// Apply rate limiting middleware
app.use(rateLimitMiddleware);

// Health check endpoint (before other routes)
app.get('/health', async (req, res) => {
  try {
    // Simplified health check for email checker only
    const healthData = {
      ok: true,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      service: 'Email Checker API',
      version: '1.0.0'
    };
    
    res.json(healthData);
  } catch (error) {
    logger.error('Error in health check:', error);
    res.status(500).json({
      ok: false,
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

// API routes
app.use('/api/checks', checkRoutes);
app.use('/api/email-checker', emailCheckerRoutes);
app.use('/api/email-verification', emailVerificationRoutes);
app.use('/api/prefix-emails', prefixEmailsRoutes);
app.use('/api/phones-extract', phonesExtractRoutes);
app.use('/api/recruitment-phones', recruitmentPhonesRoutes);
app.use('/api/domain-emails', domainEmailsRoutes);
app.use('/api/whatsapp-verify', whatsappVerifyRoutes);
app.use('/api/test', testRoute);

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    service: 'Email Checker API'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Email & WhatsApp Checker API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      emailCheck: '/api/checks',
      emailVerification: '/api/email-verification',
      emailChecker: '/api/email-checker',
      prefixEmails: '/api/prefix-emails',
      phonesExtract: '/api/phones-extract',
      recruitmentPhones: '/api/recruitment-phones',
      domainEmails: '/api/domain-emails'
    },
    description: 'Professional email validation and WhatsApp recruitment phone extraction service'
  });
});

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Cleanup tasks
async function runCleanupTasks() {
  try {
    logger.info('Running cleanup tasks...');
    
    // Clean up old email checks (older than 30 days)
    const emailCheckResult = await EmailCheck.cleanupOldRecords(30);
    logger.info(`Cleaned up ${emailCheckResult.deletedCount} old email check records`);
    
    // Clean up old jobs (older than 7 days)
    const jobResult = await Job.cleanupOldJobs(7);
    logger.info(`Cleaned up ${jobResult.deletedCount} old job records`);
    
    // Mark expired files as inactive
    const fileResult = await File.cleanupExpiredFiles();
    logger.info(`Marked ${fileResult.modifiedCount} expired files as inactive`);
    
  } catch (error) {
    logger.error('Cleanup tasks failed:', error);
  }
}

// Graceful shutdown
async function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Stop accepting new requests
    server.close(() => {
      logger.info('HTTP server closed');
    });
    
    // Close database connection
    await mongoose.disconnect();
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

// Start server
async function startServer() {
  try {
    // Create necessary directories
    await createDirectories();
    
    // Connect to MongoDB - DISABLED for now
    logger.info('✅ Running without database (MongoDB disabled)');
    logger.info('Company Jobs Search will work without database');
    
    // Initialize configuration - DISABLED for now
    logger.info('✅ Configuration service disabled (no database required)');
    
    // Run initial cleanup only if database is connected
    if (mongoose.connection.readyState === 1) {
      await runCleanupTasks();
    }
    
    // Get current Safe Mode status for logging - DISABLED for now
    const safeMode = false; // Default to false when no database
    
    // Start HTTP server
    const server = app.listen(PORT, async () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      logger.info(`🌐 API root: http://localhost:${PORT}/`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`Database: ${mongoose.connection.readyState === 1 ? 'connected' : 'not connected'}`);
      logger.info(`Safe Mode: ${safeMode ? 'ENABLED' : 'disabled'}`);
      
      // Check if frontend is running
      logger.info('🔍 Checking frontend status...');
      try {
        const { checkFrontend } = await import('./utils/checkFrontend.js');
        const isFrontendRunning = await checkFrontend();
        if (!isFrontendRunning) {
          logger.warn('⚠️  Frontend server is not running. Start it with: npm run dev:frontend');
          logger.warn('⚠️  Or run both frontend and backend with: npm run dev');
        } else {
          logger.info('✅ Frontend is running');
        }
      } catch (error) {
        logger.error('Error checking frontend status:', error);
      }
    });
    
    // Setup graceful shutdown
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Run cleanup tasks every hour (only if database is connected)
    if (mongoose.connection.readyState === 1) {
      setInterval(runCleanupTasks, 60 * 60 * 1000);
    }
    
    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
const server = await startServer();

export default app;