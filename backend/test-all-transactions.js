require('dotenv').config();
const convexService = require('./convexService');

async function testAllTransactions() {
  console.log('🧪 Testing all transactions in Convex...');
  
  const userId = 'test_user';
  
  try {
    console.log('\n🔍 Fetching ALL transactions...');
    const allTxs = await convexService.listTransactions(userId);
    console.log(`Found ${allTxs.length} total transactions:`);
    
    for (const tx of allTxs) {
      console.log(`  - ${tx.txId}: ${tx.merchant} ($${Math.abs(tx.amount).toFixed(2)}) - ${tx.isApproved ? 'APPROVED' : 'UNCATEGORIZED'} - Category: ${tx.category || 'none'}`);
    }
    
    console.log('\n🔍 Fetching UNCATEGORIZED transactions...');
    const uncategorizedTxs = await convexService.getUncategorizedTransactions(userId);
    console.log(`Found ${uncategorizedTxs.length} uncategorized transactions:`);
    
    for (const tx of uncategorizedTxs) {
      console.log(`  - ${tx.txId}: ${tx.merchant} ($${Math.abs(tx.amount).toFixed(2)})`);
    }
    
  } catch (error) {
    console.error('❌ Error testing transactions:', error);
  }
}

testAllTransactions();