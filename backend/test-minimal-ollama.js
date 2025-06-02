#!/usr/bin/env node

/**
 * Minimal test of just the Ollama service with financial context
 */

// Set environment to use Ollama
process.env.USE_OLLAMA = 'true';
process.env.OLLAMA_MODEL = 'qwen3:1.7b';

const OllamaService = require('./ollamaService');

async function testMinimalOllama() {
  try {
    console.log('🚀 Testing Minimal Ollama Integration\n');
    
    const ollama = new OllamaService('http://127.0.0.1:11434', 'qwen3:1.7b');
    
    const financialPrompt = `You are Finley, a friendly financial AI assistant. You have access to the user's current financial information:

CURRENT ACCOUNT BALANCES:
• Total Balance: $213,535.80
• Plaid Checking: $110.00 (checking account)
• Plaid Saving: $210.00 (savings account)
• Plaid Money Market: $43,200.00 (money market account)

You can answer questions about account balances, spending patterns, and provide financial insights based on this data. Be helpful, friendly, and conversational. Always use the specific financial information provided above when relevant.

User's question: What is my checking account balance?`;

    console.log('📝 Sending financial query to Qwen...');
    const response = await ollama.generateContent(financialPrompt);
    
    console.log('✅ Response from Qwen:');
    console.log('─'.repeat(80));
    console.log(response.response.text());
    console.log('─'.repeat(80));
    
    // Check if response mentions the correct balance
    const responseText = response.response.text();
    if (responseText.includes('110') || responseText.includes('$110')) {
      console.log('✅ SUCCESS: Qwen correctly used the checking account balance!');
    } else {
      console.log('⚠️  Qwen may not have used the specific balance data');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testMinimalOllama();