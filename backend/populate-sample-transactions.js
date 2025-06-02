require('dotenv').config();
const convexService = require('./convexService');

async function populateSampleTransactions() {
  console.log('🧪 Populating sample transactions for testing...');
  
  const sampleTransactions = [
    {
      userId: 'test_user',
      txId: 'tx_starbucks_001',
      plaidTransactionId: 'plaid_starbucks_001',
      accountId: 'J5yApMa9rKi7Q679PRQlhMLVyDmeWqhBEa6Kp',
      amount: 5.67,
      date: Date.now() - 24 * 60 * 60 * 1000, // 1 day ago
      merchantName: 'Starbucks',
      description: 'Starbucks Coffee - Downtown',
      plaidCategory: ['Food and Drink', 'Restaurants', 'Coffee'],
      currencyCode: 'USD',
      createdAt: Date.now(),
      isApproved: false
    },
    {
      userId: 'test_user',
      txId: 'tx_grocery_001',
      plaidTransactionId: 'plaid_grocery_001',
      accountId: 'J5yApMa9rKi7Q679PRQlhMLVyDmeWqhBEa6Kp',
      amount: 87.43,
      date: Date.now() - 2 * 24 * 60 * 60 * 1000, // 2 days ago
      merchantName: 'Whole Foods Market',
      description: 'Whole Foods Market #123',
      plaidCategory: ['Food and Drink', 'Groceries'],
      currencyCode: 'USD',
      createdAt: Date.now(),
      isApproved: false
    },
    {
      userId: 'test_user',
      txId: 'tx_gas_001',
      plaidTransactionId: 'plaid_gas_001',
      accountId: 'J5yApMa9rKi7Q679PRQlhMLVyDmeWqhBEa6Kp',
      amount: 42.18,
      date: Date.now() - 3 * 24 * 60 * 60 * 1000, // 3 days ago
      merchantName: 'Shell Gas Station',
      description: 'Shell #4567 - Gas Purchase',
      plaidCategory: ['Transportation', 'Gas Stations'],
      currencyCode: 'USD',
      createdAt: Date.now(),
      isApproved: false
    },
    {
      userId: 'test_user',
      txId: 'tx_netflix_001',
      plaidTransactionId: 'plaid_netflix_001',
      accountId: 'J5yApMa9rKi7Q679PRQlhMLVyDmeWqhBEa6Kp',
      amount: 15.99,
      date: Date.now() - 4 * 24 * 60 * 60 * 1000, // 4 days ago
      merchantName: 'Netflix',
      description: 'Netflix Subscription',
      plaidCategory: ['Entertainment', 'Digital Entertainment'],
      currencyCode: 'USD',
      createdAt: Date.now(),
      isApproved: false
    },
    {
      userId: 'test_user',
      txId: 'tx_rent_001',
      plaidTransactionId: 'plaid_rent_001',
      accountId: 'J5yApMa9rKi7Q679PRQlhMLVyDmeWqhBEa6Kp',
      amount: 1250.00,
      date: Date.now() - 29 * 24 * 60 * 60 * 1000, // 29 days ago
      merchantName: 'Property Management Inc',
      description: 'Monthly Rent Payment',
      plaidCategory: ['Payment', 'Rent'],
      currencyCode: 'USD',
      createdAt: Date.now(),
      isApproved: false
    }
  ];

  try {
    let successCount = 0;
    for (const transaction of sampleTransactions) {
      try {
        await convexService.storeTransaction(transaction);
        console.log(`✅ Stored: ${transaction.txId} - ${transaction.merchantName}`);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to store ${transaction.txId}:`, error.message);
      }
    }
    
    console.log(`\n🎉 Successfully stored ${successCount}/${sampleTransactions.length} sample transactions!`);
    console.log('\n💡 Now try these chat messages:');
    console.log('   - "what are my transactions?"');
    console.log('   - "categorize my transactions"');
    console.log('   - "show uncategorized transactions"');
    console.log('   - "categorize tx_starbucks_001 as delights"');
    
  } catch (error) {
    console.error('❌ Error populating sample transactions:', error);
  }
}

populateSampleTransactions();