import mongoose from 'mongoose';

/**
 * Job model for tracking batch email checking operations
 */
const jobSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'running', 'processing', 'done', 'failed'],
    default: 'pending'
  },
  total: {
    type: Number,
    default: 0
  },
  processed: {
    type: Number,
    default: 0
  },
  failed: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  finishedAt: {
    type: Date,
    default: null
  },
  settings: {
    type: mongoose.Schema.Types.Mixed,
    default: {
      concurrency: 5,
      timeout: 8000,
      ports: [587, 25, 465]
    }
  },
  error: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient queries
jobSchema.index({ status: 1, createdAt: -1 });
jobSchema.index({ name: 1 });

// Virtual for progress percentage
jobSchema.virtual('progressPercentage').get(function() {
  if (this.total === 0) return 0;
  return Math.round((this.processed / this.total) * 100);
});

// Virtual for duration
jobSchema.virtual('duration').get(function() {
  if (!this.createdAt) return null;
  const endTime = this.finishedAt || new Date();
  return endTime - this.createdAt;
});

// Method to update progress
jobSchema.methods.updateProgress = function(processed, failed) {
  this.processed = processed;
  this.failed = failed;
  
  if (this.processed + this.failed >= this.total) {
    this.status = 'done';
    this.finishedAt = new Date();
  }
  
  return this.save();
};

// Method to mark as failed
jobSchema.methods.markAsFailed = function(error) {
  this.status = 'failed';
  this.error = error;
  this.finishedAt = new Date();
  return this.save();
};

// Method to start job
jobSchema.methods.start = function() {
  this.status = 'running';
  return this.save();
};

// Static method to clean up old jobs
jobSchema.statics.cleanupOldJobs = function(days = 7) {
  const cutoffTime = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
  return this.deleteMany({
    createdAt: { $lt: cutoffTime },
    status: { $in: ['done', 'failed'] }
  });
};

export default mongoose.model('Job', jobSchema);
