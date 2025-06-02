require('dotenv').config();
const convexService = require('./convexService');

async function testTransactionSync() {
  console.log('🧪 Testing transaction sync functionality...');
  
  try {
    const userId = 'test_user';
    
    // Test 1: Check for uncategorized transactions
    console.log('\n📋 Test 1: Checking for uncategorized transactions...');
    const uncategorizedTxs = await convexService.getUncategorizedTransactions(userId);
    console.log(`Found ${uncategorizedTxs.length} uncategorized transactions`);
    
    if (uncategorizedTxs.length > 0) {
      console.log('Sample transactions:');
      uncategorizedTxs.slice(0, 3).forEach(tx => {
        console.log(`  - ${tx.txId}: ${tx.merchantName || tx.description} ($${Math.abs(tx.amount || 0).toFixed(2)})`);
      });
    }
    
    // Test 2: Try categorizing a transaction (if any exist)
    if (uncategorizedTxs.length > 0) {
      console.log('\n🔧 Test 2: Attempting to categorize first transaction...');
      const firstTx = uncategorizedTxs[0];
      
      await convexService.suggestCategory(firstTx.txId, 'delights', 0.8);
      console.log(`✅ Successfully suggested category for ${firstTx.txId}`);
    }
    
    // Test 3: List all transactions for user
    console.log('\n📊 Test 3: Listing all user transactions...');
    const allTxs = await convexService.listTransactions(userId);
    console.log(`Found ${allTxs.length} total transactions for user`);
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error details:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  }
}

testTransactionSync();