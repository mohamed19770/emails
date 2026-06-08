import { validateEmails } from './src/services/emailValidator.js';

async function testEmailValidation() {
  try {
    console.log('Testing email validation...');
    const result = await validateEmails(['test@mailinator.com'], true);
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

testEmailValidation();
