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
}

module.exports = new ConvexService();