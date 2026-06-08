/**
 * Sample email verification script
 * Tests the email checker API with sample emails
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE_URL = process.env.API_URL || 'http://localhost:5000';

// Sample emails for testing
const sampleEmails = [
  'valid@gmail.com',
  'noone@yahoo.com',
  'user@example.com',
  'fake@mailinator.com',
  'admin@corp.com',
  'abc@test-catchall.com',
  'slow@corp.com',
  'bad@bad-domain.test',
  'BadFormat',
  'Another.BadFormat@',
  'duplicate@gmail.com',
  'duplicate@gmail.com'
];

async function verifyEmails(emails, safeMode = false) {
  try {
    console.log(`\n🔍 Verifying ${emails.length} emails (Safe Mode: ${safeMode})...`);
    console.log('=' .repeat(60));

    const response = await axios.post(`${API_BASE_URL}/api/email-checker-new/run`, {
      emails,
      safeMode
    });

    if (response.data.success) {
      const { summary, results } = response.data.data;
      
      console.log('\n📊 SUMMARY:');
      console.log(`Total: ${summary.total}`);
      console.log(`Valid: ${summary.valid}`);
      console.log(`Invalid: ${summary.invalid}`);
      console.log(`Risky: ${summary.risky}`);
      console.log(`Unknown: ${summary.unknown}`);
      console.log(`Duplicates: ${summary.duplicates}`);

      console.log('\n📋 DETAILED RESULTS:');
      console.log('=' .repeat(60));
      
      results.forEach((result, index) => {
        const statusIcon = getStatusIcon(result.status);
        const confidenceBar = getConfidenceBar(result.confidence);
        
        console.log(`\n${index + 1}. ${result.email}`);
        console.log(`   Status: ${statusIcon} ${result.status.toUpperCase()}`);
        console.log(`   Reason: ${result.reason}`);
        console.log(`   Domain: ${result.domain || 'N/A'}`);
        console.log(`   Method: ${result.method}`);
        console.log(`   Confidence: ${confidenceBar} ${(result.confidence * 100).toFixed(1)}%`);
        
        if (result.hasMX) console.log(`   ✅ Has MX records`);
        if (result.disposable) console.log(`   🗑️ Disposable email`);
        if (result.blacklisted) console.log(`   ⚠️ Blacklisted domain`);
        if (result.roleBased) console.log(`   👤 Role-based email`);
        if (result.catchAll) console.log(`   🎯 Catch-all domain`);
        if (result.startTLS) console.log(`   🔒 STARTTLS used`);
        if (result.smtpCode) console.log(`   📧 SMTP Code: ${result.smtpCode}`);
      });

      console.log('\n✅ Verification completed successfully!');
      
    } else {
      console.error('❌ Verification failed:', response.data.error);
    }

  } catch (error) {
    console.error('❌ Error during verification:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

function getStatusIcon(status) {
  switch (status) {
    case 'valid': return '✅';
    case 'invalid': return '❌';
    case 'risky': return '⚠️';
    case 'unknown': return '❓';
    default: return '❓';
  }
}

function getConfidenceBar(confidence) {
  const filled = Math.round(confidence * 10);
  const empty = 10 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

async function main() {
  console.log('🚀 Email Checker Verification Script');
  console.log(`API URL: ${API_BASE_URL}`);
  
  // Test safe mode
  await verifyEmails(sampleEmails, true);
  
  console.log('\n' + '='.repeat(60));
  
  // Test full mode
  await verifyEmails(sampleEmails, false);
  
  console.log('\n🎉 All tests completed!');
}

// Run the script
main().catch(console.error);
