#!/usr/bin/env node

/**
 * Simple test to verify Qwen can handle financial queries
 */

const axios = require('axios');

async function testQwenWithFinancialPrompt() {
  try {
    console.log('🧪 Testing Qwen 3-1.7b with Financial Context\n');
    
    const financialPrompt = `You are Finley, a friendly financial AI assistant. You have access to the user's current financial information:

CURRENT ACCOUNT BALANCES:
• Total Balance: $18,267.85
• Chase Total Checking: $2,847.52 (checking account)
• Chase Savings: $15,420.33 (savings account)

RECENT TRANSACTIONS:
• Starbucks Coffee - $4.75 (yesterday)
• Grocery Store - $127.43 (2 days ago)
• Gas Station - $52.18 (3 days ago)
• Netflix Subscription - $15.99 (5 days ago)

You can answer questions about account balances, spending patterns, and provide financial insights based on this data. Be helpful, friendly, and conversational. Always use the specific financial information provided above when relevant.

User's question: What's my checking account balance?