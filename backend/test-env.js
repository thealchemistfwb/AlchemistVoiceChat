// Simple script to test environment variable loading
require('dotenv').config();

console.log('=== Environment Variables Test ===');
console.log('Current working directory:', process.cwd());
console.log('');

const envVars = [
  'GOOGLE_AI_API_KEY',
  'PLAID_CLIENT_ID', 
  'PLAID_SECRET',
  'PLAID_ENV',
  'PORT'
];

envVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${value.length > 20 ? value.substring(0, 20) + '...' : value}`);
  } else {
    console.log(`❌ ${varName}: Not set`);
  }
});

console.log('');
console.log('If any variables show as "Not set", please update your .env file');
console.log('Make sure the .env file is in the backend directory');
console.log('Make sure there are no spaces around the = sign');
console.log('Example: PLAID_CLIENT_ID=your_actual_client_id');