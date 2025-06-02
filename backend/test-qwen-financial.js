#!/usr/bin/env node

/**
 * Test Qwen with financial data through our backend
 */

const axios = require('axios');

async function testQwenFinancialChat() {
  const testCases = [
    {
      message: "What's my checking account balance?",
      description: "Direct balance query"
    },
    {
      message: "How much money do I have in total?",
      description: "Total balance query"
    },
    {
      message: "Can you help me categorize my transactions?",
      description: "Transaction categorization"
    },
    {
      message: "Show me my spending summary",
      description: "Spending summary with financial context"
    }
  ];

  const mockAccountBalances = [
    {
      account_id: 'test_checking_123',
      name: 'Chase Total Checking',
      subtype: 'checking',
      balances: {
        current: 2847.52,
        available: 2847.52
      }
    },
    {
      account_id: 'test_savings_456',
      name: 'Chase Savings',
      subtype: 'savings',
      balances: {
        current: 15420.33,
        available: 15420.33
      }
    }
  ];

  console.log('🧪 Testing Qwen (qwen3:1.7b) with Financial Data\n');

  for (const testCase of testCases) {
    try {
      console.log(`\n📝 Test: "${testCase.message}"`);
      console.log(`📋 Description: ${testCase.description}`);
      
      const startTime = Date.now();
      
      const response = await axios.post('http://localhost:3001/api/chat', {
        message: testCase.message,
        conversationHistory: [],
        accessToken: 'test_token',
        accountBalances: mockAccountBalances
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      console.log(`✅ Response received (${responseTime}ms)`);
      console.log('📝 Response:');
      console.log('─'.repeat(80));
      console.log(response.data.message);
      console.log('─'.repeat(80));
      
      // Check if response mentions financial data
      const hasFinancialInfo = response.data.message.includes('2,847') || 
                              response.data.message.includes('2847') ||
                              response.data.message.includes('15,420') ||
                              response.data.message.includes('15420') ||
                              response.data.message.includes('Chase') ||
                              response.data.message.includes('18,267') ||
                              response.data.message.includes('checking') ||
                              response.data.message.includes('savings');
      
      if (hasFinancialInfo) {
        console.log('✅ SUCCESS: Qwen used financial context!');
      } else {
        console.log('⚠️  Qwen may not have used specific financial data');
      }
      
    } catch (error) {
      console.error(`❌ Test failed: ${error.message}`);
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Response:', error.response.data);
      }
    }
  }
}

testQwenFinancialChat();