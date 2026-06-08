import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Check if the frontend server is running
 * @param {string} frontendUrl - The frontend URL to check (optional, defaults to CLIENT_ORIGIN)
 * @param {number} timeout - Request timeout in milliseconds (default: 5000)
 * @returns {Promise<boolean>} - True if frontend is running, false otherwise
 */
export async function checkFrontend(frontendUrl = null, timeout = 5000) {
  try {
    // Get frontend URL from environment or use provided URL
    const url = frontendUrl || process.env.CLIENT_ORIGIN || 'http://localhost:3004';
    
    // Make request to frontend
    const response = await axios.get(url, {
      timeout: timeout,
      validateStatus: function (status) {
        // Accept any status code (200-299, 404, etc.) as "server is running"
        return status >= 200 && status < 600;
      }
    });
    
    // If we get any response, the server is running
    console.log('✅ Frontend is running');
    return true;
    
  } catch (error) {
    // Handle different types of errors
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Frontend is NOT running - Connection refused');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('❌ Frontend is NOT running - Request timeout');
    } else if (error.code === 'ENOTFOUND') {
      console.log('❌ Frontend is NOT running - Host not found');
    } else {
      console.log(`❌ Frontend is NOT running - ${error.message}`);
    }
    
    return false;
  }
}

/**
 * Check frontend with additional details
 * @param {string} frontendUrl - The frontend URL to check
 * @param {number} timeout - Request timeout in milliseconds
 * @returns {Promise<Object>} - Detailed status object
 */
export async function checkFrontendDetailed(frontendUrl = null, timeout = 5000) {
  const startTime = Date.now();
  
  try {
    const url = frontendUrl || process.env.CLIENT_ORIGIN || 'http://localhost:3004';
    
    const response = await axios.get(url, {
      timeout: timeout,
      validateStatus: function (status) {
        return status >= 200 && status < 600;
      }
    });
    
    const responseTime = Date.now() - startTime;
    
    return {
      isRunning: true,
      url: url,
      status: response.status,
      responseTime: responseTime,
      message: '✅ Frontend is running'
    };
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    return {
      isRunning: false,
        url: frontendUrl || process.env.CLIENT_ORIGIN || 'http://localhost:3004',
      error: error.code || error.message,
      responseTime: responseTime,
      message: `❌ Frontend is NOT running - ${error.code || error.message}`
    };
  }
}

/**
 * Check multiple frontend URLs
 * @param {string[]} urls - Array of URLs to check
 * @param {number} timeout - Request timeout in milliseconds
 * @returns {Promise<Object[]>} - Array of status objects
 */
export async function checkMultipleFrontends(urls, timeout = 5000) {
  const checks = urls.map(url => checkFrontendDetailed(url, timeout));
  return await Promise.all(checks);
}

/**
 * Monitor frontend status periodically
 * @param {number} interval - Check interval in milliseconds
 * @param {string} frontendUrl - The frontend URL to check
 * @param {number} timeout - Request timeout in milliseconds
 * @returns {Object} - Monitor control object with start/stop methods
 */
export function createFrontendMonitor(interval = 30000, frontendUrl = null, timeout = 5000) {
  let intervalId = null;
  let isRunning = false;
  
  const monitor = {
    start() {
      if (isRunning) {
        console.log('Frontend monitor is already running');
        return;
      }
      
      isRunning = true;
      console.log(`🔍 Starting frontend monitor (checking every ${interval/1000}s)`);
      
      // Initial check
      checkFrontend(frontendUrl, timeout);
      
      // Set up periodic checks
      intervalId = setInterval(async () => {
        await checkFrontend(frontendUrl, timeout);
      }, interval);
    },
    
    stop() {
      if (!isRunning) {
        console.log('Frontend monitor is not running');
        return;
      }
      
      isRunning = false;
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      console.log('🛑 Frontend monitor stopped');
    },
    
    getStatus() {
      return {
        isRunning: isRunning,
        interval: interval,
        url: frontendUrl || process.env.CLIENT_ORIGIN || 'http://localhost:3000'
      };
    }
  };
  
  return monitor;
}

// If this file is run directly, perform a check
if (import.meta.url === `file://${process.argv[1]}`) {
  const frontendUrl = process.argv[2] || null;
  const timeout = parseInt(process.argv[3]) || 5000;
  
  console.log('🔍 Checking frontend status...');
  checkFrontend(frontendUrl, timeout)
    .then(isRunning => {
      process.exit(isRunning ? 0 : 1);
    })
    .catch(error => {
      console.error('Error checking frontend:', error);
      process.exit(1);
    });
}
