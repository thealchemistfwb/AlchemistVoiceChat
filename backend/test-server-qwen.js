#!/usr/bin/env node

/**
 * Test the server with Qwen integration
 */

const axios = require('axios');

async function testServerWithQwen() {
  try {
    console.log('🧪 Testing Server with Qwen Integration\n');
    
    const response = await axios.post('http://localhost:3001/api/chat', {
      message: "What is my checking account balance?",
      conversationHistory: [],
      accessToken: 'test_token',
      accountBalances: [
        {
          name: 'Plaid Checking',
          subtype: 'checking',
          balances: {
            current: 110
          }
        },
        {
          name: 'Plaid Saving',
          subtype: 'savings',
          balances: {
            current: 210
          }
        }
      ]
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    console.log('✅ Server Response:');
    console.log('─'.repeat(80));
    console.log(response.data.message);
    console.log('─'.repeat(80));
    
    // Check if response mentions the correct balance
    const responseText = response.data.message;
    if (responseText.includes('110') || responseText.includes('$110')) {
      console.log('✅ SUCCESS: Qwen correctly used the checking account balance!');
    } else {
      console.log('⚠️  Response may not have used the specific balance data');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testServerWithQwen();