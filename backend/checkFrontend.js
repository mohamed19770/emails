#!/usr/bin/env node

/**
 * Standalone script to check if frontend server is running
 * Usage: node checkFrontend.js [frontend_url] [timeout_ms]
 * 
 * Examples:
 * node checkFrontend.js
 * node checkFrontend.js http://localhost:3000
 * node checkFrontend.js http://localhost:3000 10000
 */

import { checkFrontend, checkFrontendDetailed } from './src/utils/checkFrontend.js';

async function main() {
  const frontendUrl = process.argv[2] || null;
  const timeout = parseInt(process.argv[3]) || 5000;
  
  console.log('🔍 Checking frontend status...');
  console.log(`URL: ${frontendUrl || 'http://localhost:3000 (default)'}`);
  console.log(`Timeout: ${timeout}ms`);
  console.log('─'.repeat(50));
  
  try {
    const result = await checkFrontendDetailed(frontendUrl, timeout);
    
    console.log(result.message);
    console.log(`Response time: ${result.responseTime}ms`);
    
    if (result.isRunning) {
      console.log(`Status code: ${result.status}`);
      console.log('✅ Frontend is accessible');
      process.exit(0);
    } else {
      console.log(`Error: ${result.error}`);
      console.log('❌ Frontend is not accessible');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error checking frontend:', error.message);
    process.exit(1);
  }
}

// Run the main function
main();
