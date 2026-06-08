import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import File from '../models/File.js';
import Configuration from '../models/Configuration.js';
import logger from '../config/logger.js';
import safeModeMiddleware from '../middleware/safeMode.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Multer configuration with fallback values
const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB default
    files: 1 // Only one file at a time
  },
  fileFilter: (req, file, cb) => {
    // Only allow .txt files by default
    if (path.extname(file.originalname).toLowerCase() === '.txt') {
      cb(null, true);
    } else {
      cb(new Error('Only .txt files are allowed'), false);
    }
  }
});

// Rate limiting for file operations
const fileLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many file requests, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// No rate limiting for downloads
const downloadLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 20, // 20 downloads per minute per IP
  message: {
    error: 'Too many download requests, please try again later.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @route POST /api/files/upload
 * @desc Upload a .txt file
 * @access Public
 */
router.post('/upload', fileLimiter, safeModeMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Create file record in database
    const fileRecord = new File({
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    });

    await fileRecord.save();

    logger.info(`File uploaded: ${req.file.originalname} (${req.file.size} bytes) - ID: ${fileRecord.publicId}`);

    res.status(201).json({
      success: true,
      data: {
        fileId: fileRecord.publicId,
        originalName: fileRecord.originalName,
        size: fileRecord.size,
        downloadUrl: `/api/files/download/${fileRecord.publicId}`,
        expiresAt: fileRecord.expiresAt,
        message: 'File uploaded successfully'
      }
    });
  } catch (error) {
    logger.error('File upload error:', error);
    
    // Clean up uploaded file if database save failed
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        logger.error('Failed to clean up uploaded file:', unlinkError);
      }
    }

    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 10MB.'
      });
    }

    if (error.message === 'Only .txt files are allowed') {
      return res.status(400).json({
        success: false,
        error: 'Only .txt files are allowed'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error during file upload'
    });
  }
});

/**
 * @route GET /api/files/download/:publicId
 * @desc Download a file by public ID
 * @access Public
 */
router.get('/download/:publicId', downloadLimiter, async (req, res) => {
  try {
    const { publicId } = req.params;

    if (!publicId) {
      return res.status(400).json({
        success: false,
        error: 'File ID is required'
      });
    }

    // Get file record
    const fileRecord = await File.getActiveFile(publicId);
    
    if (!fileRecord) {
      return res.status(404).json({
        success: false,
        error: 'File not found or expired'
      });
    }

    // Check if file exists on disk
    try {
      await fs.access(fileRecord.path);
    } catch (error) {
      logger.error(`File not found on disk: ${fileRecord.path}`);
      return res.status(404).json({
        success: false,
        error: 'File not found on server'
      });
    }

    // Increment download count
    await fileRecord.incrementDownload();

    // Set headers for file download
    res.setHeader('Content-Type', fileRecord.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileRecord.originalName}"`);
    res.setHeader('Content-Length', fileRecord.size);

    // Stream file to response
    const fileStream = await fs.readFile(fileRecord.path);
    res.send(fileStream);

    logger.info(`File downloaded: ${fileRecord.originalName} - ID: ${publicId}`);
  } catch (error) {
    logger.error('File download error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during file download'
    });
  }
});

/**
 * @route GET /api/files/info/:publicId
 * @desc Get file information by public ID
 * @access Public
 */
router.get('/info/:publicId', async (req, res) => {
  try {
    const { publicId } = req.params;

    if (!publicId) {
      return res.status(400).json({
        success: false,
        error: 'File ID is required'
      });
    }

    const fileRecord = await File.getActiveFile(publicId);
    
    if (!fileRecord) {
      return res.status(404).json({
        success: false,
        error: 'File not found or expired'
      });
    }

    res.json({
      success: true,
      data: {
        fileId: fileRecord.publicId,
        originalName: fileRecord.originalName,
        size: fileRecord.size,
        mimeType: fileRecord.mimeType,
        downloadCount: fileRecord.downloadCount,
        lastDownloadedAt: fileRecord.lastDownloadedAt,
        expiresAt: fileRecord.expiresAt,
        createdAt: fileRecord.createdAt,
        downloadUrl: `/api/files/download/${fileRecord.publicId}`
      }
    });
  } catch (error) {
    logger.error('File info error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while fetching file information'
    });
  }
});

/**
 * @route GET /api/files/stats
 * @desc Get file sharing statistics
 * @access Public
 */
router.get('/stats', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const daysNum = Math.min(parseInt(days), 30); // Max 30 days
    const cutoffDate = new Date(Date.now() - (daysNum * 24 * 60 * 60 * 1000));

    const stats = await File.aggregate([
      {
        $match: {
          createdAt: { $gte: cutoffDate },
          isActive: true
        }
      },
      {
        $group: {
          _id: null,
          totalFiles: { $sum: 1 },
          totalSize: { $sum: '$size' },
          totalDownloads: { $sum: '$downloadCount' },
          avgFileSize: { $avg: '$size' },
          avgDownloads: { $avg: '$downloadCount' }
        }
      }
    ]);

    const result = stats[0] || {
      totalFiles: 0,
      totalSize: 0,
      totalDownloads: 0,
      avgFileSize: 0,
      avgDownloads: 0
    };

    res.json({
      success: true,
      data: {
        period: `${daysNum} days`,
        ...result,
        avgFileSize: Math.round(result.avgFileSize),
        avgDownloads: Math.round(result.avgDownloads * 100) / 100
      }
    });
  } catch (error) {
    logger.error('File stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while fetching file statistics'
    });
  }
});

/**
 * @route DELETE /api/files/:publicId
 * @desc Delete a file
 * @access Public
 */
router.delete('/:publicId', async (req, res) => {
  try {
    const { publicId } = req.params;

    if (!publicId) {
      return res.status(400).json({
        success: false,
        error: 'File ID is required'
      });
    }

    const fileRecord = await File.findOne({ publicId });
    
    if (!fileRecord) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    // Delete file from disk
    try {
      await fs.unlink(fileRecord.path);
    } catch (error) {
      logger.warn(`Failed to delete file from disk: ${fileRecord.path}`, error);
    }

    // Delete file record from database
    await File.findByIdAndDelete(fileRecord._id);

    logger.info(`File deleted: ${fileRecord.originalName} - ID: ${publicId}`);

    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    logger.error('File deletion error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during file deletion'
    });
  }
});

export default router;

