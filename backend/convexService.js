const { ConvexHttpClient } = require("convex/browser");

class ConvexService {
  constructor() {
    // Initialize Convex client with your deployment URL
    // You'll get this URL when you deploy to Convex
    this.convex = new ConvexHttpClient(process.env.CONVEX_URL || "https://glad-raven-65.convex.cloud");
  }

  // Budget operations
  async getUserBudgets(userId) {
    try {
      return await this.convex.query("budgets:getUserBudgets", { userId });
    } catch (error) {
      console.error('Error fetching user budgets:', error);
      throw error;
    }
  }

  async setBudget(userId, category, budgetAmount, aiAnalysis) {
    try {
      return await this.convex.mutation("budgets:setBudget", {
        userId,
        category,
        budgetAmount,
        aiAnalysis
      });
    } catch (error) {
      console.error('Error setting budget:', error);
      throw error;
    }
  }

  async getUserAccount(userId) {
    try {
      return await this.convex.query("budgets:getUserAccount", { userId });
    } catch (error) {
      console.error('Error fetching user account:', error);
      throw error;
    }
  }

  async updateAccountBalance(userId, totalBalance, plaidAccessToken) {
    try {
      return await this.convex.mutation("budgets:updateAccountBalance", {
        userId,
        totalBalance,
        plaidAccessToken
      });
    } catch (error) {
      console.error('Error updating account balance:', error);
      throw error;
    }
  }

  async calculateFeelsLike(userId, category) {
    try {
      return await this.convex.mutation("budgets:calculateFeelsLike", {
        userId,
        category
      });
    } catch (error) {
      console.error('Error calculating feels like amount:', error);
      throw error;
    }
  }

  // Transaction operations
  async storeTransaction(transactionData) {
    try {
      return await this.convex.mutation("transactions:storeTransaction", transactionData);
    } catch (error) {
      console.error('Error storing transaction:', error);
      throw error;
    }
  }

  async getUserTransactions(userId, category = null, limit = 50) {
    try {
      const args = { userId, limit };
      if (category) args.category = category;
      
      return await this.convex.query("transactions:getUserTransactions", args);
    } catch (error) {
      console.error('Error fetching user transactions:', error);
      throw error;
    }
  }

  async categorizeTransaction(userId, plaidTransactionId, aiCategory, confidence, reasoning) {
    try {
      return await this.convex.mutation("transactions:categorizeTransaction", {
        userId,
        plaidTransactionId,
        aiCategory,
        confidence,
        reasoning
      });
    } catch (error) {
      console.error('Error categorizing transaction:', error);
      throw error;
    }
  }

  async getSpendingSummary(userId) {
    try {
      return await this.convex.query("transactions:getSpendingSummary", { userId });
    } catch (error) {
      console.error('Error fetching spending summary:', error);
      throw error;
    }
  }

  // AI Budget Analysis
  async analyzeSpendingForBudget(userId, category) {
    try {
      // Get recent transactions for the category
      const transactions = await this.getUserTransactions(userId, category, 100);
      const summary = await this.getSpendingSummary(userId);
      
      return {
        transactions,
        summary: summary[category] || { total: 0, count: 0, recent: 0 },
        categoryData: {
          category,
          recentSpending: summary[category]?.recent || 0,
          totalSpending: summary[category]?.total || 0,
          transactionCount: summary[category]?.count || 0
        }
      };
    } catch (error) {
      console.error('Error analyzing spending for budget:', error);
      throw error;
    }
  }

  // Conversational Budgeting Functions
  async syncPlaid(userId) {
    try {
      return await this.convex.mutation("transactions:syncPlaid", { userId });
    } catch (error) {
      console.error('Error syncing Plaid transactions:', error);
      throw error;
    }
  }

  async suggestCategory(txId, suggestion, confidence) {
    try {
      return await this.convex.mutation("transactions:suggestCategory", {
        txId,
        suggestion,
        confidence
      });
    } catch (error) {
      console.error('Error suggesting category:', error);
      throw error;
    }
  }

  async approveCategory(txId, finalCategory) {
    try {
      return await this.convex.mutation("transactions:approveCategory", {
        txId,
        finalCategory
      });
    } catch (error) {
      console.error('Error approving category:', error);
      throw error;
    }
  }

  async listTransactions(params) {
    try {
      // params should be an object like { userId: "string", budgetId: "string|null", from: "string|null", to: "string|null" }
      const args = { 
        userId: params.userId,
        budgetId: params.budgetId,
        from: params.from,
        to: params.to
      };
      
      // Ensure only defined values are passed to the Convex query
      Object.keys(args).forEach(key => args[key] === undefined && delete args[key]);

      console.log('[convexService.listTransactions] Calling Convex query with args:', args);
      return await this.convex.query("transactions:listTransactions", args);
    } catch (error) {
      console.error('Error listing transactions:', error);
      throw error;
    }
  }

  async getUncategorizedTransactions(userId) {
    try {
      return await this.convex.query("transactions:getUncategorizedTransactions", { userId });
    } catch (error) {
      console.error('Error fetching uncategorized transactions:', error);
      throw error;
    }
  }
}

module.exports = new ConvexService();