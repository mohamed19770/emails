import express from 'express';
import rateLimit from 'express-rate-limit';
import Job from '../models/Job.js';
import emailCheckService from '../services/emailCheck.js';
import logger from '../config/logger.js';

const router = express.Router();

// Rate limiting for job endpoints
const jobLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many requests, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @route POST /api/jobs/batch-check
 * @desc Create a batch email checking job
 * @access Public
 */
router.post('/batch-check', jobLimiter, async (req, res) => {
  try {
    const { emails } = req.body;

    if (!emails) {
      return res.status(400).json({
        success: false,
        error: 'Emails array is required'
      });
    }

    if (!Array.isArray(emails)) {
      return res.status(400).json({
        success: false,
        error: 'Emails must be an array'
      });
    }

    if (emails.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Emails array cannot be empty'
      });
    }

    if (emails.length > 1000) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 1000 emails allowed per job'
      });
    }

    // Validate that all items are strings
    const invalidEmails = emails.filter(email => typeof email !== 'string' || !email.trim());
    if (invalidEmails.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'All emails must be non-empty strings'
      });
    }

    // Create job
    const job = new Job({
      name: `Batch Email Check - ${emails.length} emails`,
      type: 'batch_email_check',
      status: 'pending',
      totalEmails: emails.length,
      results: []
    });

    await job.save();

    // Start processing asynchronously
    processBatchJob(job._id, emails.map(email => email.trim()));

    res.status(201).json({
      success: true,
      data: {
        jobId: job._id,
        status: job.status,
        totalEmails: job.totalEmails,
        message: 'Batch job created successfully. Processing will begin shortly.'
      }
    });
  } catch (error) {
    logger.error('Batch job creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while creating batch job'
    });
  }
});

/**
 * @route GET /api/jobs/:jobId
 * @desc Get job status and results
 * @access Public
 */
router.get('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: 'Job ID is required'
      });
    }

    const job = await Job.findById(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    res.json({
      success: true,
      data: {
        jobId: job._id,
        type: job.type,
        status: job.status,
        totalEmails: job.totalEmails,
        processedEmails: job.processedEmails,
        validEmails: job.validEmails,
        invalidEmails: job.invalidEmails,
        progressPercentage: job.progressPercentage,
        duration: job.duration,
        results: job.results,
        error: job.error,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt
      }
    });
  } catch (error) {
    logger.error('Job retrieval error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while retrieving job'
    });
  }
});

/**
 * @route GET /api/jobs
 * @desc Get list of recent jobs
 * @access Public
 */
router.get('/', async (req, res) => {
  try {
    const { limit = 10, page = 1, status } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = Math.min(parseInt(limit), 50); // Max 50 records per page

    const filter = {};
    if (status && ['pending', 'processing', 'completed', 'failed'].includes(status)) {
      filter.status = status;
    }

    const jobs = await Job.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .select('-results'); // Exclude results for list view

    const total = await Job.countDocuments(filter);

    res.json({
      success: true,
      data: {
        jobs,
        pagination: {
          page: parseInt(page),
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    });
  } catch (error) {
    logger.error('Jobs list error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while fetching jobs'
    });
  }
});

/**
 * @route DELETE /api/jobs/:jobId
 * @desc Delete a job
 * @access Public
 */
router.delete('/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        error: 'Job ID is required'
      });
    }

    const job = await Job.findByIdAndDelete(jobId);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    res.json({
      success: true,
      message: 'Job deleted successfully'
    });
  } catch (error) {
    logger.error('Job deletion error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error while deleting job'
    });
  }
});

/**
 * Process batch job asynchronously
 */
async function processBatchJob(jobId, emails) {
  try {
    const job = await Job.findById(jobId);
    if (!job) {
      logger.error(`Job ${jobId} not found for processing`);
      return;
    }

    // Update job status to processing
    job.status = 'processing';
    job.startedAt = new Date();
    await job.save();

    logger.info(`Starting batch processing for job ${jobId} with ${emails.length} emails`);

    // Process emails in batches
    const batchSize = 10;
    let processedCount = 0;
    let validCount = 0;
    let invalidCount = 0;
    const results = [];

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      try {
        const batchResults = await emailCheckService.validateEmailsBatch(batch, jobId);
        
        batchResults.forEach(result => {
          results.push({
            email: result.email,
            isValid: result.isValid,
            error: result.error
          });
          
          if (result.isValid) {
            validCount++;
          } else {
            invalidCount++;
          }
          processedCount++;
        });

        // Update job progress
        job.processedEmails = processedCount;
        job.validEmails = validCount;
        job.invalidEmails = invalidCount;
        job.results = results;
        await job.save();

        // Small delay between batches
        if (i + batchSize < emails.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        logger.error(`Batch processing error for job ${jobId}:`, error);
        
        // Add error results for failed batch
        batch.forEach(email => {
          results.push({
            email: email,
            isValid: false,
            error: 'Processing error'
          });
          invalidCount++;
          processedCount++;
        });
      }
    }

    // Mark job as completed
    job.status = 'completed';
    job.completedAt = new Date();
    job.processedEmails = processedCount;
    job.validEmails = validCount;
    job.invalidEmails = invalidCount;
    job.results = results;
    await job.save();

    logger.info(`Batch processing completed for job ${jobId}. Processed: ${processedCount}, Valid: ${validCount}, Invalid: ${invalidCount}`);
  } catch (error) {
    logger.error(`Batch job processing failed for job ${jobId}:`, error);
    
    try {
      const job = await Job.findById(jobId);
      if (job) {
        job.status = 'failed';
        job.error = error.message;
        job.completedAt = new Date();
        await job.save();
      }
    } catch (saveError) {
      logger.error(`Failed to update job ${jobId} status to failed:`, saveError);
    }
  }
}

export default router;


