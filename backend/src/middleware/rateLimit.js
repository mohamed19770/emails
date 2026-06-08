import configService from '../services/configService.js';
import logger from '../config/logger.js';

/**
 * Simple token bucket rate limiter per IP
 */
class TokenBucket {
  constructor(capacity, refillRate) {
    this.capacity = capacity;
    this.refillRate = refillRate; // tokens per second
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  tryConsume(tokens = 1) {
    this.refill();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    
    return false;
  }

  refill() {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000; // seconds
    const tokensToAdd = timePassed * this.refillRate;
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  getTokensRemaining() {
    this.refill();
    return Math.floor(this.tokens);
  }
}

// Store token buckets per IP
const buckets = new Map();

/**
 * Rate limiting middleware using token bucket algorithm
 */
export const rateLimitMiddleware = async (req, res, next) => {
  try {
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    
    // Get rate limit configuration - disabled for now
    const rps = 10; // Default rate limit
    const capacity = rps * 2; // Allow burst of 2x the rate
    
    // Get or create token bucket for this IP
    if (!buckets.has(clientIP)) {
      buckets.set(clientIP, new TokenBucket(capacity, rps));
    }
    
    const bucket = buckets.get(clientIP);
    
    // Try to consume a token
    if (bucket.tryConsume(1)) {
      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': rps,
        'X-RateLimit-Remaining': bucket.getTokensRemaining(),
        'X-RateLimit-Reset': new Date(Date.now() + 1000).toISOString()
      });
      
      next();
    } else {
      // Rate limit exceeded
      logger.warn(`Rate limit exceeded for IP: ${clientIP}`);
      
      res.set({
        'X-RateLimit-Limit': rps,
        'X-RateLimit-Remaining': 0,
        'X-RateLimit-Reset': new Date(Date.now() + 1000).toISOString()
      });
      
      res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later.',
        details: {
          limit: rps,
          remaining: 0,
          resetTime: new Date(Date.now() + 1000).toISOString()
        }
      });
    }
  } catch (error) {
    logger.error('Error in rate limit middleware:', error);
    
    // In case of error, allow the request to proceed
    next();
  }
};

/**
 * Clean up old token buckets periodically
 */
setInterval(() => {
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutes
  
  for (const [ip, bucket] of buckets.entries()) {
    if (now - bucket.lastRefill > maxAge) {
      buckets.delete(ip);
    }
  }
}, 60000); // Clean up every minute

export default rateLimitMiddleware;
