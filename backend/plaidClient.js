require('dotenv').config();
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
const { categorizeTransactions, getCategoryStatistics } = require('./categorization');

if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
  console.error('PLAID_CLIENT_ID and PLAID_SECRET are required. Please set them in your .env file.');
}

const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

async function getAccountBalances(accessToken) {
  try {
    console.log('🏦 Fetching account balances from Plaid...');
    const response = await plaidClient.accountsGet({
      access_token: accessToken,
    });
    
    console.log('📊 Raw Plaid Account Response:');
    console.log(JSON.stringify(response.data.accounts, null, 2));
    
    const processedAccounts = response.data.accounts.map(account => ({
      accountId: account.account_id,
      name: account.name,
      type: account.type,
      subtype: account.subtype,
      balances: {
        current: account.balances.current,
        available: account.balances.available,
        currencyCode: account.balances.iso_currency_code
      }
    }));
    
    console.log('✅ Processed Account Balances:', processedAccounts);
    return processedAccounts;
  } catch (error) {
    console.error('❌ Error fetching account balances:', error);
    if (error.response && error.response.data) {
      console.error('❌ Plaid API Error Details:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

// Function to enrich transactions using Plaid's enrichment API
async function enrichTransactions(transactions) {
  try {
    console.log('🔧 Starting transaction enrichment...');
    
    // Prepare transactions for enrichment (max 100 per request)
    const transactionsToEnrich = transactions.slice(0, 100).map(transaction => ({
      description: transaction.name || transaction.merchantName || 'Unknown Transaction',
      amount: Math.abs(transaction.amount),
      direction: transaction.amount > 0 ? 'OUTFLOW' : 'INFLOW', // Must be uppercase
      account_type: 'depository', // Default to depository, could be enhanced
      iso_currency_code: transaction.currencyCode || 'USD',
      id: transaction.transactionId,
      date_posted: transaction.date
    }));

    if (transactionsToEnrich.length === 0) {
      console.log('⚠️ No transactions to enrich');
      return transactions;
    }

    console.log(`📤 Sending ${transactionsToEnrich.length} transactions for enrichment`);

    const enrichmentResponse = await plaidClient.transactionsEnrich({
      account_type: 'depository',
      transactions: transactionsToEnrich
    });

    console.log('✅ Transaction enrichment completed');
    console.log(`📊 Enriched ${enrichmentResponse.data.enriched_transactions.length} transactions`);

    // Merge enriched data back with original transactions
    const enrichedTransactions = transactions.map(originalTransaction => {
      const enrichedData = enrichmentResponse.data.enriched_transactions.find(
        enriched => enriched.id === originalTransaction.transactionId
      );

      if (enrichedData) {
        return {
          ...originalTransaction,
          // Enhanced merchant information
          enrichedMerchantName: enrichedData.counterparty?.name || originalTransaction.merchantName,
          merchantLogo: enrichedData.counterparty?.logo_url || null,
          merchantWebsite: enrichedData.counterparty?.website || null,
          merchantType: enrichedData.counterparty?.type || null,
          
          // Enhanced location data
          location: enrichedData.location || null,
          
          // Enhanced categorization
          enrichedCategory: enrichedData.category || null,
          
          // Payment channel
          paymentChannel: enrichedData.payment_channel || null,
          
          // Original enrichment confidence
          enrichmentConfidence: enrichedData.confidence_level || null
        };
      }

      return originalTransaction;
    });

    console.log('✅ Merged enriched data with original transactions');
    console.log('Sample enriched transaction:');
    console.log(JSON.stringify(enrichedTransactions.find(t => t.enrichedMerchantName), null, 2));

    return enrichedTransactions;

  } catch (error) {
    console.error('❌ Error enriching transactions:', error);
    if (error.response && error.response.data) {
      console.error('❌ Plaid Enrichment API Error Details:', JSON.stringify(error.response.data, null, 2));
    }
    
    // Return original transactions if enrichment fails
    console.log('⚠️ Falling back to original transactions without enrichment');
    return transactions;
  }
}

async function getRecentTransactions(accessToken, startDate, endDate) {
  try {
    console.log(`💳 Fetching transactions from Plaid (${startDate} to ${endDate})`);
    const response = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
    });

    console.log('📊 Raw Plaid Transactions Response:');
    console.log(`Total transactions returned: ${response.data.transactions.length}`);
    console.log('Sample transactions (first 5):');
    console.log(JSON.stringify(response.data.transactions.slice(0, 5), null, 2));
    
    if (response.data.transactions.length > 5) {
      console.log(`... and ${response.data.transactions.length - 5} more transactions`);
    }

    const processedTransactions = response.data.transactions.map(transaction => ({
      transactionId: transaction.transaction_id,
      accountId: transaction.account_id,
      amount: transaction.amount,
      date: transaction.date,
      merchantName: transaction.merchant_name,
      name: transaction.name,
      category: transaction.category,
      subcategory: transaction.personal_finance_category?.primary || null,
      currencyCode: transaction.iso_currency_code
    }));
    
    console.log('✅ Processed Transactions (first 5):');
    console.log(JSON.stringify(processedTransactions.slice(0, 5), null, 2));
    
    // Apply Plaid transaction enrichment
    console.log('🔧 Applying Plaid transaction enrichment...');
    const enrichedTransactions = await enrichTransactions(processedTransactions);
    
    // Apply AI-powered custom categorization (now with enriched data)
    console.log('🤖 Applying AI categorization with enriched data...');
    const categorizedTransactions = await categorizeTransactions(enrichedTransactions);
    
    console.log('✅ Final Processed Transactions (first 5):');
    console.log(JSON.stringify(categorizedTransactions.slice(0, 5).map(t => ({
      name: t.name,
      enrichedMerchantName: t.enrichedMerchantName,
      amount: t.amount,
      customCategory: t.customCategory,
      customSubcategory: t.customSubcategory,
      merchantLogo: t.merchantLogo
    })), null, 2));
    
    return categorizedTransactions;
  } catch (error) {
    console.error('❌ Error fetching transactions:', error);
    if (error.response && error.response.data) {
      console.error('❌ Plaid API Error Details:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

async function getFinancialSummary(accessToken) {
  try {
    console.log('📋 Starting Financial Summary Generation...');
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    console.log(`📅 Date range: ${startDate} to ${endDate}`);
    
    // Try to get both balances and transactions, but handle failures gracefully
    let balances = [];
    let transactions = [];
    
    try {
      balances = await getAccountBalances(accessToken);
    } catch (error) {
      console.error('❌ Failed to get account balances, continuing without them:', error.message);
    }
    
    try {
      transactions = await getRecentTransactions(accessToken, startDate, endDate);
    } catch (error) {
      console.error('❌ Failed to get transactions, continuing with balances only:', error.message);
      console.error('Transaction error details:', error.response?.data || error.message);
    }

    console.log('🧮 Processing financial calculations...');
    
    const totalBalance = balances.reduce((sum, account) => {
      return sum + (account.balances.current || 0);
    }, 0);

    const monthlySpending = transactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    // Calculate spending by custom categories
    const categorySpending = transactions
      .filter(t => t.amount > 0)
      .reduce((acc, t) => {
        const mainCategory = t.customCategory || 'Uncategorized';
        const subcategory = t.customSubcategory || 'Other';
        
        if (!acc[mainCategory]) {
          acc[mainCategory] = { total: 0, subcategories: {} };
        }
        acc[mainCategory].total += t.amount;
        
        if (!acc[mainCategory].subcategories[subcategory]) {
          acc[mainCategory].subcategories[subcategory] = 0;
        }
        acc[mainCategory].subcategories[subcategory] += t.amount;
        
        return acc;
      }, {});

    const topMerchants = transactions
      .filter(t => t.amount > 0 && t.merchantName)
      .reduce((acc, t) => {
        acc[t.merchantName] = (acc[t.merchantName] || 0) + t.amount;
        return acc;
      }, {});

    const financialSummary = {
      balances,
      recentTransactions: transactions.slice(0, 10),
      summary: {
        totalBalance: totalBalance.toFixed(2),
        monthlySpending: monthlySpending.toFixed(2),
        transactionCount: transactions.length,
        topCategories: Object.entries(categorySpending)
          .sort(([,a], [,b]) => b.total - a.total)
          .slice(0, 5)
          .map(([category, data]) => ({
            category,
            amount: data.total.toFixed(2),
            subcategories: Object.entries(data.subcategories)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 3)
              .map(([subcat, amount]) => ({ subcategory: subcat, amount: amount.toFixed(2) }))
          })),
        topMerchants: Object.entries(topMerchants)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([merchant, amount]) => ({ merchant, amount: amount.toFixed(2) }))
      }
    };
    
    console.log('📊 FINAL FINANCIAL SUMMARY BEING RETURNED:');
    console.log('='.repeat(60));
    console.log(JSON.stringify(financialSummary, null, 2));
    console.log('='.repeat(60));
    
    return financialSummary;
  } catch (error) {
    console.error('❌ Error creating financial summary:', error);
    throw error;
  }
}

module.exports = {
  plaidClient,
  getAccountBalances,
  getRecentTransactions,
  getFinancialSummary
};