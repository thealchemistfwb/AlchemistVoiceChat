#!/usr/bin/env node

/**
 * Test script to verify Ollama integration works correctly
 */

// Set environment variable to use Ollama
process.env.USE_OLLAMA = 'true';
process.env.OLLAMA_URL = 'http://127.0.0.1:11434';
process.env.OLLAMA_MODEL = 'qwen3:1.7b';

const axios = require('axios');

// Test direct Ollama API first
async function testDirectOllama() {
  try {
    console.log('🧪 Testing direct Ollama API...');
    
    const response = await axios.post('http://127.0.0.1:11434/v1/chat/completions', {
      model: 'qwen3:1.7b',
      messages: [
        {
          role: 'system',
          content: 'You are Finley, a friendly financial AI assistant. You have access to the user\'s current financial information:\n\nCURRENT ACCOUNT BALANCES:\n• Total Balance: $18,267.85\n• Chase Total Checking: $2,847.52 (checking account)\n• Chase Savings: $15,420.33 (savings account)\n\nYou can answer questions about account balances, spending patterns, and provide financial insights based on this data. Be helpful, friendly, and conversational.'
        },
        {
          role: 'user',
          content: 'What\'s my checking account balance?'
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    console.log('✅ Direct Ollama API works!');
    console.log('📝 Response:', response.data.choices[0].message.content);
    
    return true;
  } catch (error) {
    console.error('❌ Direct Ollama API failed:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    return false;
  }
}

// Test via our backend
async function testBackendWithOllama() {
  try {
    console.log('\n🧪 Testing backend with Ollama...');
    
    const response = await axios.post('http://localhost:3001/api/chat', {
      message: "What's my checking account balance?",
      conversationHistory: [],
      accessToken: 'test_token',
      accountBalances: [
        {
          account_id: 'test_checking_123',
          name: 'Chase Total Checking',
          subtype: 'checking',
          balances: {
            current: 2847.52,
            available: 2847.52
          }
        }
      ]
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    console.log('✅ Backend with Ollama works!');
    console.log('📝 Response preview:', response.data.message.substring(0, 300) + '...');
    
    // Check if response includes balance information
    const includesBalance = response.data.message.includes('2,847') || 
                           response.data.message.includes('2847') ||
                           response.data.message.includes('checking');
    
    if (includesBalance) {
      console.log('✅ SUCCESS: Qwen used the financial data correctly!');
    } else {
      console.log('⚠️  Response may not have used financial data');
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Backend server not running. Start with: USE_OLLAMA=true node server.js');
    } else {
      console.error('❌ Backend test failed:', error.message);
    }
  }
}

async function runTests() {
  console.log('🚀 Testing Ollama Integration\n');
  
  const directWorking = await testDirectOllama();
  
  if (directWorking) {
    await testBackendWithOllama();
  } else {
    console.log('\n❌ Direct Ollama API failed, skipping backend test.');
    console.log('💡 Make sure Ollama is running: ollama serve');
    console.log('💡 And that qwen2.5:1.5b is installed: ollama pull qwen2.5:1.5b');
  }
}

runTests();