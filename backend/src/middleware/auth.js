import jwt from 'jsonwebtoken';
import logger from '../config/logger.js';

/**
 * JWT authentication middleware
 * Verifies JWT token from Authorization header
 */
export const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      return res.status(401).json({
        error: 'MISSING_TOKEN',
        message: 'Access token is required'
      });
    }
    
    const secret = process.env.JWT_SECRET || 'SuperSecretMegaKey123';
    
    jwt.verify(token, secret, (err, user) => {
      if (err) {
        logger.warn('Invalid JWT token:', err.message);
        return res.status(403).json({
          error: 'INVALID_TOKEN',
          message: 'Invalid or expired token'
        });
      }
      
      req.user = user;
      next();
    });
  } catch (error) {
    logger.error('Error in authentication middleware:', error);
    res.status(500).json({
      error: 'AUTH_ERROR',
      message: 'Authentication error'
    });
  }
};

/**
 * Require admin role middleware
 * Checks if user has admin role
 */
export const requireAdmin = (req, res, next) => {
  try {
    // Allow DEV override for local testing
    if (process.env.ADMIN_BYPASS === 'true' && process.env.NODE_ENV === 'development') {
      logger.warn('Admin bypass enabled in development mode');
      req.user = { role: 'admin', id: 'dev-bypass' };
      return next();
    }
    
    if (!req.user) {
      return res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }
    
    if (req.user.role !== 'admin') {
      logger.warn(`Non-admin user attempted admin action: ${req.user.id}`);
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Admin privileges required'
      });
    }
    
    next();
  } catch (error) {
    logger.error('Error in admin middleware:', error);
    res.status(500).json({
      error: 'AUTH_ERROR',
      message: 'Authorization error'
    });
  }
};

/**
 * Optional authentication middleware
 * Attaches user if token is valid, but doesn't require it
 */
export const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return next();
    }
    
    const secret = process.env.JWT_SECRET || 'SuperSecretMegaKey123';
    
    jwt.verify(token, secret, (err, user) => {
      if (!err) {
        req.user = user;
      }
      next();
    });
  } catch (error) {
    logger.error('Error in optional auth middleware:', error);
    next(); // Continue without authentication
  }
};

/**
 * Generate JWT token
 * @param {Object} payload - Token payload
 * @param {string} expiresIn - Token expiration
 * @returns {string} JWT token
 */
export const generateToken = (payload, expiresIn = '24h') => {
  const secret = process.env.JWT_SECRET || 'SuperSecretMegaKey123';
  return jwt.sign(payload, secret, { expiresIn });
};

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {Object} Decoded token payload
 */
export const verifyToken = (token) => {
  const secret = process.env.JWT_SECRET || 'SuperSecretMegaKey123';
  return jwt.verify(token, secret);
};

export default {
  authenticateToken,
  requireAdmin,
  optionalAuth,
  generateToken,
  verifyToken
};
