import mongoose from 'mongoose';

/**
 * EmailCheck model for storing email validation results
 */
const emailCheckSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  domain: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  isValidFormat: {
    type: Boolean,
    required: true
  },
  mx: [{
    priority: {
      type: Number,
      required: true
    },
    exchange: {
      type: String,
      required: true
    }
  }],
  smtpBanner: {
    type: String,
    default: null
  },
  smtpStatus: {
    type: String,
    enum: ['open', 'closed', 'timeout', 'error'],
    default: null
  },
  deliverability: {
    type: String,
    enum: ['deliverable', 'undeliverable', 'unknown'],
    required: true
  },
  responseCode: {
    type: String,
    default: null
  },
  checkedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  attempts: {
    type: Number,
    default: 1
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    default: null
  },
  rawLog: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Index for efficient queries
emailCheckSchema.index({ email: 1, checkedAt: -1 });
emailCheckSchema.index({ domain: 1, checkedAt: -1 });
emailCheckSchema.index({ jobId: 1 });
emailCheckSchema.index({ deliverability: 1 });

// Static method to get recent checks for an email
emailCheckSchema.statics.getRecentCheck = function(email, hours = 24) {
  const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
  return this.findOne({
    email: email.toLowerCase(),
    checkedAt: { $gte: cutoffTime }
  }).sort({ checkedAt: -1 });
};

// Static method to clean up old records
emailCheckSchema.statics.cleanupOldRecords = function(days = 30) {
  const cutoffTime = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
  return this.deleteMany({
    checkedAt: { $lt: cutoffTime }
  });
};

export default mongoose.model('EmailCheck', emailCheckSchema);
