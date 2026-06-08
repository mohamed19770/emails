import logger from '../config/logger.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Normalized error response format
 * @typedef {Object} ErrorResponse
 * @property {string} error - Error code
 * @property {string} message - Human-readable error message
 * @property {Object} details - Additional error details
 * @property {string} traceId - Unique trace ID for debugging
 */

/**
 * Global error handler middleware
 * Provides normalized JSON error responses
 */
export const errorHandler = (error, req, res, next) => {
  // Generate unique trace ID
  const traceId = uuidv4();
  
  // Log error with trace ID
  logger.error('Unhandled error:', {
    error: error.message,
    stack: error.stack,
    traceId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  
  // Default error response
  let statusCode = error.status || error.statusCode || 500;
  let errorCode = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred';
  let details = {};
  
  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = {
      fields: Object.keys(error.errors || {}),
      errors: error.errors
    };
  } else if (error.name === 'CastError') {
    statusCode = 400;
    errorCode = 'INVALID_ID';
    message = 'Invalid ID format';
    details = {
      field: error.path,
      value: error.value
    };
  } else if (error.name === 'MongoError' || error.name === 'MongoServerError') {
    statusCode = 500;
    errorCode = 'DATABASE_ERROR';
    message = 'Database operation failed';
    
    if (error.code === 11000) {
      statusCode = 409;
      errorCode = 'DUPLICATE_KEY';
      message = 'Resource already exists';
      details = {
        field: Object.keys(error.keyPattern || {})[0]
      };
    }
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorCode = 'INVALID_TOKEN';
    message = 'Invalid authentication token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    errorCode = 'TOKEN_EXPIRED';
    message = 'Authentication token has expired';
  } else if (error.status === 400) {
    errorCode = 'BAD_REQUEST';
    message = error.message || 'Bad request';
  } else if (error.status === 401) {
    errorCode = 'UNAUTHORIZED';
    message = error.message || 'Unauthorized';
  } else if (error.status === 403) {
    errorCode = 'FORBIDDEN';
    message = error.message || 'Forbidden';
  } else if (error.status === 404) {
    errorCode = 'NOT_FOUND';
    message = error.message || 'Resource not found';
  } else if (error.status === 409) {
    errorCode = 'CONFLICT';
    message = error.message || 'Resource conflict';
  } else if (error.status === 422) {
    errorCode = 'UNPROCESSABLE_ENTITY';
    message = error.message || 'Unprocessable entity';
  } else if (error.status === 429) {
    errorCode = 'RATE_LIMIT_EXCEEDED';
    message = error.message || 'Rate limit exceeded';
  } else if (error.status === 503) {
    errorCode = 'SERVICE_UNAVAILABLE';
    message = error.message || 'Service unavailable';
  }
  
  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    details.stack = error.stack;
  }
  
  // Add request context to details
  details.request = {
    method: req.method,
    path: req.path,
    timestamp: new Date().toISOString()
  };
  
  // Send error response
  const errorResponse = {
    error: errorCode,
    message,
    details,
    traceId
  };
  
  res.status(statusCode).json(errorResponse);
};

/**
 * 404 handler for unmatched routes
 */
export const notFoundHandler = (req, res) => {
  const traceId = uuidv4();
  
  logger.warn('Route not found:', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    traceId
  });
  
  res.status(404).json({
    error: 'NOT_FOUND',
    message: 'Endpoint not found',
    details: {
      method: req.method,
      path: req.path,
      timestamp: new Date().toISOString()
    },
    traceId
  });
};

/**
 * Async error wrapper for route handlers
 * @param {Function} fn - Async route handler function
 * @returns {Function} Wrapped function that catches async errors
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default errorHandler;
