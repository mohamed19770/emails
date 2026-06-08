import mongoose from 'mongoose';
import crypto from 'crypto';

/**
 * File model for storing file sharing information
 */
const fileSchema = new mongoose.Schema({
  originalName: {
    type: String,
    required: true
  },
  storedName: {
    type: String,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  publicId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  lastDownloadedAt: {
    type: Date,
    default: null
  },
  expiresAt: {
    type: Date,
    default: function() {
      // Default to 7 days from now
      return new Date(Date.now() + (7 * 24 * 60 * 60 * 1000));
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
fileSchema.index({ publicId: 1, isActive: 1 });
fileSchema.index({ expiresAt: 1 });

// Pre-save middleware to generate public ID
fileSchema.pre('save', function(next) {
  if (!this.publicId) {
    this.publicId = crypto.randomBytes(16).toString('hex');
  }
  next();
});

// Method to increment download count
fileSchema.methods.incrementDownload = function() {
  this.downloadCount += 1;
  this.lastDownloadedAt = new Date();
  return this.save();
};

// Method to check if file is expired
fileSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt;
};

// Static method to clean up expired files
fileSchema.statics.cleanupExpiredFiles = function() {
  return this.updateMany(
    { 
      expiresAt: { $lt: new Date() },
      isActive: true 
    },
    { 
      isActive: false 
    }
  );
};

// Static method to get active file by public ID
fileSchema.statics.getActiveFile = function(publicId) {
  return this.findOne({
    publicId,
    isActive: true,
    expiresAt: { $gt: new Date() }
  });
};

export default mongoose.model('File', fileSchema);
