#!/usr/bin/env node

/**
 * Test what the frontend is actually sending to cause 500 errors
 */

const axios = require('axios');

async function testFrontendRequest() {
  try {
    console.log('🧪 Testing Frontend-style Request\n');
    
    // Simulate what the frontend sends when clicking "What is my checking account balance?"
    const frontendRequest = {
      message: "What is my checking account balance?",
      conversationHistory: [
        {
          id: 1,
          text: '<div>\n        <h4>👋 Hello! I\'m <strong>Finley</strong></h4>\n        <p>I\'m your friendly financial insights assistant powered by <em>Qwen3</em>. I can help you understand your spending patterns and recent purchases.</p>\n        <p><strong>To get started:</strong> Connect your bank account above for personalized insights, or ask me general questions about finances!</p>\n      </div>',
          sender: 'bot'
        },
        {
          id: 1748649675035,
          text: '<div>\n          <h4>🎉 Successfully Connected!</h4>\n          <p>Great! I\'ve connected to your <strong class="checking">Tartan Bank</strong> account.</p>\n          <p>🔄 Loading your account information...</p>\n          <p><em>I\'ll be ready to help in just a moment!</em></p>\n        </div>',
          sender: 'bot'
        },
        {
          id: 1748649678907,
          text: '<div>\n          <h4>✅ Ready to Help!</h4>\n          <p>I can now provide personalized insights about your:</p>\n          <ul>\n            <li><strong>Account balances</strong> (shown above)</li>\n            <li><strong>Spending patterns</strong> and trends</li>\n            <li><strong>Recent transactions</strong> and categories</li>\n            <li><strong>Monthly summaries</strong> and comparisons</li>\n          </ul>\n          <p><em>What would you like to explore first?</em></p>\n        </div>',
          sender: 'bot'
        }
      ],
      accessToken: 'access-sandbox-7b52cf7c-a0ba-4ab2-9970-c245e31e0c41',
      accountBalances: [
        {
          accountId: 'LXrzJ1vWjyIrNDloaB88FvvE3PB9ldCe7Qmg1',
          name: 'Plaid Checking',
          type: 'depository',
          subtype: 'checking',
          balances: { current: 110, available: 100, currencyCode: 'USD' }
        },
        {
          accountId: 'p4ydvjNzLphwMeqa1AZZf77Xvme9g5tJwrq9a',
          name: 'Plaid Saving',
          type: 'depository',
          subtype: 'savings',
          balances: { current: 210, available: 200, currencyCode: 'USD' }
        }
      ]
    };
    
    console.log('📤 Sending frontend-style request...');
    
    const response = await axios.post('http://localhost:3001/api/chat', frontendRequest, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    console.log('✅ Success! Response received:');
    console.log('Status:', response.status);
    console.log('Message:', response.data.message.substring(0, 200) + '...');
    
  } catch (error) {
    console.error('❌ Error occurred:');
    console.error('Status:', error.response?.status);
    console.error('Message:', error.message);
    
    if (error.response?.data) {
      console.error('Response data:', error.response.data);
    }
    
    // Check server logs for this specific error
    console.log('\n📋 Server logs might show more details...');
  }
}

testFrontendRequest();