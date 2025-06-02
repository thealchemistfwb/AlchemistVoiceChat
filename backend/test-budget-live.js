// Test script for live Convex budget functionality
const fetch = require('node-fetch');

async function testBudgetAPI() {
  console.log('🧪 Testing Live Budget API...\n');
  
  const baseUrl = 'http://localhost:5000'; // Your backend server
  
  try {
    // Test 1: Set a budget
    console.log('1. Setting budget for Foundations...');
    const setBudgetResponse = await fetch(`${baseUrl}/api/budget/set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'test_user',
        category: 'foundations',
        budgetAmount: 2000,
        aiAnalysis: 'Essential expenses for housing, utilities, and groceries'
      })
    });
    
    if (setBudgetResponse.ok) {
      const result = await setBudgetResponse.json();
      console.log('   ✅ Budget set successfully:', result);
    } else {
      console.log('   ❌ Error setting budget:', await setBudgetResponse.text());
    }
    
    // Test 2: Get user budgets
    console.log('\n2. Retrieving user budgets...');
    const getBudgetsResponse = await fetch(`${baseUrl}/api/budget/user?userId=test_user`);
    
    if (getBudgetsResponse.ok) {
      const budgets = await getBudgetsResponse.json();
      console.log('   ✅ Budgets retrieved:', budgets);
    } else {
      console.log('   ❌ Error getting budgets:', await getBudgetsResponse.text());
    }
    
    // Test 3: Test AI budget conversation
    console.log('\n3. Testing AI budget conversation...');
    const chatResponse = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'I want to set a budget of $500 for fun activities this month',
        conversationHistory: []
      })
    });
    
    if (chatResponse.ok) {
      const result = await chatResponse.json();
      console.log('   ✅ AI conversation response:', result.message.substring(0, 100) + '...');
    } else {
      console.log('   ❌ Error with AI conversation:', await chatResponse.text());
    }
    
    console.log('\n🎉 Budget functionality test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testBudgetAPI();