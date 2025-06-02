"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

// Import Plaid client configuration and PlaidApi directly here
// This assumes your Plaid client setup doesn't have other non-Node compatible dependencies
// when used in this action context.
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

const plaidClientSingleton = (() => {
  if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
    console.error('PLAID_CLIENT_ID and PLAID_SECRET are required for Plaid Actions. Please set them in your Convex dashboard environment variables.');
    // Return a stub or throw an error if not configured, to prevent crashes at runtime
    return null; 
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
  return new PlaidApi(configuration);
})();

export const fetchPlaidAccountBalances = action({
  args: { plaidAccessToken: v.string() },
  handler: async (ctx, { plaidAccessToken }) => {
    if (!plaidClientSingleton) {
      throw new Error("Plaid client is not configured. Check server logs and Convex environment variables.");
    }
    try {
      console.log('(Action) 🏦 Fetching account balances from Plaid...');
      const response = await plaidClientSingleton.accountsGet({
        access_token: plaidAccessToken,
      });
      
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
      
      console.log('(Action) ✅ Processed Account Balances:', processedAccounts.length);
      return processedAccounts;
    } catch (error) {
      console.error('(Action) ❌ Error fetching account balances:', error.response?.data || error.message);
      // It's often better to throw the error so the calling mutation can handle it
      // or return a specific error structure.
      throw new Error(`Plaid API error in action: ${error.response?.data?.error_message || error.message}`);
    }
  },
}); 