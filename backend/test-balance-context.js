#!/usr/bin/env node

/**
 * Test script to verify that account balance context is being used
 * with specific keywords that should trigger financial context
 */

const axios = require('axios');

const mockAccountBalances = [
  {
    account_id: 'test_checking_123',
    name: 'Chase Total Checking',
    subtype: 'checking',
    balances: {
      current: 2847.52,
      available: 2847.52
    }
  }
];

async function testWithFinancialKeywords() {
  const testMessages = [
    "Show me my spending summary",
    "How much money do I have available?",
    "What are my recent transactions?",
    "Help me categorize my budget transactions"
  ];

  for (const message of testMessages) {
    try {
      console.log(`\n🧪 Testing: "${message}"`);
      
      const response = await axios.post('http://localhost:3001/api/chat', {
        message,
        conversationHistory: [],
        accessToken: 'test_token',
        accountBalances: mockAccountBalances
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });

      console.log('✅ Response received');
      
      // Check if response mentions financial data
      const hasFinancialInfo = response.data.message.includes('2847') || 
                              response.data.message.includes('$2,847') ||
                              response.data.message.includes('Chase') ||
                              response.data.message.includes('checking');
      
      if (hasFinancialInfo) {
        console.log('✅ SUCCESS: Response includes financial context!');
      } else {
        console.log('⚠️  Response does not include specific financial data');
      }
      
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }
}

testWithFinancialKeywords();