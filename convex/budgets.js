import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Get all budgets for a user
export const getUserBudgets = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = args.userId || "test_user";
    return await ctx.db
      .query("budgets")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();
  },
});

// Set or update a budget
export const setBudget = mutation({
  args: {
    userId: v.optional(v.string()),
    category: v.string(),
    budgetAmount: v.number(),
    aiAnalysis: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const userId = args.userId || "test_user";
    
    // Check if budget already exists
    const existing = await ctx.db
      .query("budgets")
      .filter((q) => q.and(
        q.eq(q.field("userId"), userId),
        q.eq(q.field("category"), args.category)
      ))
      .first();

    const budgetData = {
      userId,
      category: args.category,
      budgetAmount: args.budgetAmount,
      currentSpent: existing?.currentSpent || 0,
      feelsLikeAmount: args.budgetAmount * 0.8, // Simple calculation
      aiAnalysis: args.aiAnalysis || "Budget set via API",
      lastUpdated: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, budgetData);
      return existing._id;
    } else {
      return await ctx.db.insert("budgets", budgetData);
    }
  },
});

// Get user account (for test user compatibility)
export const getUserAccount = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = args.userId || "test_user";
    
    // For test user, return mock data
    if (userId === "test_user") {
      return {
        userId: "test_user",
        totalBalance: 5000,
        lastSynced: Date.now(),
        isTestUser: true
      };
    }
    
    // For real users, query actual account data
    const account = await ctx.db
      .query("accounts")
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();
    
    return account || {
      userId,
      totalBalance: 0,
      lastSynced: 0,
      isTestUser: false
    };
  },
});

// Update account balance (for Plaid integration)
export const updateAccountBalance = mutation({
  args: {
    userId: v.optional(v.string()),
    totalBalance: v.number(),
    plaidAccessToken: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const userId = args.userId || "test_user";
    
    // Don't update test user account
    if (userId === "test_user") {
      return "test_user_account";
    }
    
    const existing = await ctx.db
      .query("accounts")
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();

    const accountData = {
      userId,
      totalBalance: args.totalBalance,
      lastSynced: Date.now(),
      plaidAccessToken: args.plaidAccessToken,
    };

    if (existing) {
      await ctx.db.patch(existing._id, accountData);
      return existing._id;
    } else {
      return await ctx.db.insert("accounts", accountData);
    }
  },
});

// Calculate "feels like" amount for a category
export const calculateFeelsLike = mutation({
  args: {
    userId: v.optional(v.string()),
    category: v.string()
  },
  handler: async (ctx, args) => {
    const userId = args.userId || "test_user";
    
    const budget = await ctx.db
      .query("budgets")
      .filter((q) => q.and(
        q.eq(q.field("userId"), userId),
        q.eq(q.field("category"), args.category)
      ))
      .first();

    if (!budget) {
      return { feelsLikeAmount: 0 };
    }

    // Simple feels-like calculation: budget - current spent + 20% buffer
    const feelsLikeAmount = Math.max(0, budget.budgetAmount - budget.currentSpent + (budget.budgetAmount * 0.2));
    
    // Update the budget record
    await ctx.db.patch(budget._id, {
      feelsLikeAmount: Math.round(feelsLikeAmount * 100) / 100,
      lastUpdated: Date.now(),
    });

    return {
      feelsLikeAmount: Math.round(feelsLikeAmount * 100) / 100
    };
  },
});

// Update spending for a category
export const updateSpending = mutation({
  args: {
    userId: v.optional(v.string()),
    category: v.string(),
    amount: v.number()
  },
  handler: async (ctx, args) => {
    const userId = args.userId || "test_user";
    
    const budget = await ctx.db
      .query("budgets")
      .filter((q) => q.and(
        q.eq(q.field("userId"), userId),
        q.eq(q.field("category"), args.category)
      ))
      .first();

    if (budget) {
      const newSpent = budget.currentSpent + args.amount;
      const feelsLikeAmount = budget.budgetAmount - newSpent + (newSpent * 0.2); // Adjust feels like calculation
      
      await ctx.db.patch(budget._id, {
        currentSpent: newSpent,
        feelsLikeAmount: Math.max(0, feelsLikeAmount),
        lastUpdated: Date.now(),
      });
      
      return budget._id;
    }
    
    return null;
  },
});