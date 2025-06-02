require('dotenv').config();
const convexService = require('./convexService');

// Manual webhook test - simulates what Plaid webhook would do
async function testWebhookFlow() {
  console.log('🧪 Testing manual webhook transaction sync...');
  
  try {
    // Get the stored access token from Convex
    const userId = 'test_user';
    const userAccount = await convexService.getUserAccount(userId);
    
    if (!userAccount?.plaidAccessToken) {
      console.log('❌ No access token found. Connect a bank account first.');
      return;
    }
    
    console.log('✅ Found stored access token, starting manual sync...');
    
    // Simulate what the webhook would do - call our transaction sync
    const { plaidClient } = require('./plaidClient');
    const accessToken = userAccount.plaidAccessToken;
    
    try {
      // Use modern /transactions/sync endpoint instead of /transactions/get
      console.log('📊 Calling /transactions/sync...');
      
      const syncResponse = await plaidClient.transactionsSync({
        access_token: accessToken,
        cursor: '', // Empty cursor for full sync
        count: 100
      });
      
      const { added, modified, removed, has_more, next_cursor } = syncResponse.data;
      
      console.log(`📊 Sync result: +${added.length} added, ~${modified.length} modified, -${removed.length} removed`);
      
      // Store added transactions in Convex
      let syncedCount = 0;
      for (const transaction of added) {
        try {
          const transactionData = {
            userId,
            txId: transaction.transaction_id,
            plaidTransactionId: transaction.transaction_id,
            accountId: transaction.account_id,
            amount: transaction.amount,
            date: Date.parse(transaction.date),
            merchantName: transaction.merchant_name || transaction.name,
            description: transaction.name,
            plaidCategory: transaction.category,
            plaidSubcategory: transaction.personal_finance_category?.primary || null,
            currencyCode: transaction.iso_currency_code || 'USD',
            createdAt: Date.now(),
            isApproved: false
          };
          
          await convexService.storeTransaction(transactionData);
          syncedCount++;
          console.log(`✅ Stored: ${transaction.transaction_id} - ${transaction.name}`);
        } catch (storeError) {
          console.error(`❌ Error storing ${transaction.transaction_id}:`, storeError.message);
        }
      }
      
      console.log(`\n🎉 Successfully synced ${syncedCount}/${added.length} real Plaid transactions to Convex!`);
      
      if (syncedCount > 0) {
        console.log('\n💡 Now try these chat messages:');
        console.log('   - "what are my transactions?"');
        console.log('   - "categorize my transactions"');
        console.log('   - "show uncategorized transactions"');
      }
      
    } catch (plaidError) {
      if (plaidError.response?.data?.error_code === 'PRODUCT_NOT_READY') {
        console.log('⏳ Transactions not ready yet. This is normal in sandbox mode.');
        console.log('💡 In production, Plaid would send a webhook when ready.');
        console.log('🔄 Try running this script again in a few minutes.');
      } else {
        console.error('❌ Plaid sync error:', plaidError.response?.data || plaidError.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testWebhookFlow();