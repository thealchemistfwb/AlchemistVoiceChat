require('dotenv').config();
const convexService = require('./convexService');

async function testChatIntegration() {
  console.log('🧪 Testing chat transaction categorization integration...');
  
  try {
    const userId = 'test_user';
    
    // Test 1: Add a mock transaction to test categorization
    console.log('\n📝 Test 1: Adding a mock transaction for testing...');
    const mockTransaction = {
      userId,
      txId: 'tx_test_starbucks_001',
      plaidTransactionId: 'test_starbucks_001',
      accountId: 'test_account',
      amount: 5.67,
      date: new Date().toISOString().split('T')[0],
      merchantName: 'Starbucks',
      description: 'Starbucks Coffee Purchase',
      plaidCategory: ['Food and Drink', 'Restaurants'],
      currencyCode: 'USD',
      createdAt: Date.now(),
      isApproved: false
    };
    
    await convexService.storeTransaction(mockTransaction);
    console.log('✅ Mock transaction added successfully');
    
    // Test 2: Check uncategorized transactions
    console.log('\n📋 Test 2: Checking for uncategorized transactions...');
    const uncategorizedTxs = await convexService.getUncategorizedTransactions(userId);
    console.log(`Found ${uncategorizedTxs.length} uncategorized transactions`);
    
    if (uncategorizedTxs.length > 0) {
      console.log('Uncategorized transactions:');
      uncategorizedTxs.forEach(tx => {
        console.log(`  - ${tx.txId}: ${tx.merchantName || tx.description} ($${Math.abs(tx.amount || 0).toFixed(2)})`);
      });
      
      // Test 3: Simulate chat categorization
      console.log('\n🤖 Test 3: Simulating AI categorization...');
      const firstTx = uncategorizedTxs[0];
      
      // Simulate the chat logic
      const merchantLower = (firstTx.merchantName || '').toLowerCase();
      let suggestion = 'wild_cards';
      let confidence = 0.6;
      
      if (merchantLower.includes('starbucks') || merchantLower.includes('coffee')) {
        suggestion = 'delights';
        confidence = 0.8;
      }
      
      console.log(`AI suggests: ${firstTx.txId} -> ${suggestion} (${Math.round(confidence * 100)}% confidence)`);
      
      // Execute categorization
      await convexService.suggestCategory(firstTx.txId, suggestion, confidence);
      console.log('✅ Category suggestion applied');
      
      // Verify categorization
      const updatedUncategorized = await convexService.getUncategorizedTransactions(userId);
      console.log(`Remaining uncategorized: ${updatedUncategorized.length}`);
    }
    
    // Test 4: List all transactions to verify state
    console.log('\n📊 Test 4: Final transaction state...');
    const allTxs = await convexService.listTransactions(userId);
    console.log(`Total transactions: ${allTxs.length}`);
    
    allTxs.forEach(tx => {
      const category = tx.category || tx.assistantSuggestedCategory || 'uncategorized';
      const approved = tx.isApproved ? '✅' : '⏳';
      console.log(`  ${approved} ${tx.txId}: ${tx.merchantName || tx.description} -> ${category}`);
    });
    
    console.log('\n✅ Chat integration test completed successfully!');
    console.log('\n💡 Now try these chat messages:');
    console.log('   - "show my transactions"');
    console.log('   - "categorize my transactions"');
    console.log('   - "what transactions need categorization?"');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error details:', error.message);
  }
}

testChatIntegration();