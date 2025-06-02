require('dotenv').config();
const convexService = require('./convexService');

async function testCategorization() {
  console.log('🧪 Testing transaction categorization flow...');
  
  const userId = 'test_user';
  
  try {
    console.log('\n🔍 Fetching uncategorized transactions...');
    const uncategorizedTxs = await convexService.getUncategorizedTransactions(userId);
    console.log(`Found ${uncategorizedTxs.length} uncategorized transactions:`);
    
    for (const tx of uncategorizedTxs) {
      console.log(`  - ${tx.txId}: ${tx.merchant} ($${Math.abs(tx.amount).toFixed(2)})`);
    }
    
    if (uncategorizedTxs.length === 0) {
      console.log('\n❌ No uncategorized transactions found! Expected 5 sample transactions.');
      console.log('Try running: node populate-sample-transactions.js');
    }
    
  } catch (error) {
    console.error('❌ Error testing categorization:', error);
  }
}

testCategorization();