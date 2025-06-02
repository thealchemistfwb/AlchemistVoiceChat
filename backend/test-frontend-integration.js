#!/usr/bin/env node

/**
 * Test script to verify frontend-backend integration
 * Tests that account balances are properly handled in chat requests
 */

const axios = require('axios');

// Mock account balances data (simulating what frontend would send)
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

async function testChatWithAccountBalances() {
  try {
    console.log('🧪 Testing chat with account balances integration...');
    
    const response = await axios.post('http://localhost:3001/api/chat', {
      message: "What's my current account balance?",
      conversationHistory: [],
      accessToken: 'test_token',
      accountBalances: mockAccountBalances
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('✅ Response received:');
    console.log('Status:', response.status);
    console.log('Message preview:', response.data.message.substring(0, 200) + '...');
    
    // Check if the response includes balance information
    const includesBalance = response.data.message.includes('2,847') || 
                           response.data.message.includes('2847') ||
                           response.data.message.includes('15,420') ||
                           response.data.message.includes('15420');
    
    if (includesBalance) {
      console.log('✅ SUCCESS: AI used account balance data from frontend!');
    } else {
      console.log('⚠️  WARNING: AI response may not have used balance data');
      console.log('Full response:', response.data.message);
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Server not running. Start with: node server.js');
    } else {
      console.error('❌ Test failed:', error.message);
    }
  }
}

// Run the test
testChatWithAccountBalances();