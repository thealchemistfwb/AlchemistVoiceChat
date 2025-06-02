import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get spending money calculation
export const getSpendingMoney = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = args.userId || "test_user";
    
    // Get latest spending money calculation
    const spendingMoney = await ctx.db
      .query("spendingMoney")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!spendingMoney) {
      return {
        availableBalance: 0,
        recurringDeductions: [],
        spendingMoney: 0,
        lastUpdated: null
      };
    }

    // Calculate current spending money
    const totalRecurring = spendingMoney.recurringDeductions.reduce(
      (sum, deduction) => sum + deduction.amount,
      0
    );

    return {
      availableBalance: spendingMoney.availableBalance,
      recurringDeductions: spendingMoney.recurringDeductions,
      spendingMoney: Math.max(0, spendingMoney.availableBalance - totalRecurring),
      lastUpdated: spendingMoney.lastUpdated
    };
  }
});

// Update spending money calculation
export const updateSpendingMoney = mutation({
  args: { 
    userId: v.optional(v.string()),
    plaidAccessToken: v.string()
  },
  handler: async (ctx, args) => {
    const userId = args.userId || "test_user";
    
    try {
      // Call the Convex action to get account balances
      const balances = await ctx.runAction("plaidActions:fetchPlaidAccountBalances", { 
        plaidAccessToken: args.plaidAccessToken 
      });
      
      // Filter for checking and cash management accounts only
      const relevantAccounts = balances.filter(acc => 
        acc.type === 'depository' && 
        (acc.subtype === 'checking' || acc.subtype === 'cash management')
      );

      // Sum available balances
      const availableBalance = relevantAccounts.reduce(
        (sum, acc) => sum + (acc.balances.available || 0),
        0
      );

      // Get recurring transactions for next 30 days
      const recurringTxs = await ctx.db
        .query("recurringTransactions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .filter((q) => {
          const thirtyDaysFromNow = new Date();
          thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
          return q.lte(q.field("nextDueDate"), thirtyDaysFromNow.toISOString());
        })
        .collect();

      // Format recurring deductions
      const recurringDeductions = recurringTxs.map(tx => ({
        name: tx.merchantName,
        amount: tx.amount,
        nextDueDate: tx.nextDueDate,
        isFixed: tx.isFixed
      }));

      // Store updated calculation
      const existing = await ctx.db
        .query("spendingMoney")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .first();

      const now = Date.now();
      const nextUpdate = now + (60 * 1000); // Update every minute

      if (existing) {
        await ctx.db.patch(existing._id, {
          availableBalance,
          recurringDeductions,
          lastUpdated: now,
          nextUpdate
        });
        return existing._id;
      } else {
        return await ctx.db.insert("spendingMoney", {
          userId,
          availableBalance,
          recurringDeductions,
          lastUpdated: now,
          nextUpdate
        });
      }
    } catch (error) {
      console.error("Error updating spending money:", error);
      throw error;
    }
  }
});

// Detect recurring transactions
export const detectRecurringTransactions = mutation({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = args.userId || "test_user";
    
    // Get all transactions for the user
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.lt(q.field("amount"), 0)) // Only negative transactions
      .collect();

    // Group transactions by merchant and rounded amount
    const groupedTxs = transactions.reduce((acc, tx) => {
      const roundedAmount = Math.round(tx.amount * 100) / 100;
      const patternKey = `${tx.merchantName || tx.name}-${roundedAmount}`;
      
      if (!acc[patternKey]) {
        acc[patternKey] = {
          merchantName: tx.merchantName || tx.name,
          amount: roundedAmount,
          dates: [],
          occurrences: 0
        };
      }
      
      acc[patternKey].dates.push(new Date(tx.date));
      acc[patternKey].occurrences++;
      
      return acc;
    }, {});

    // Analyze patterns and detect recurring transactions
    for (const [patternKey, data] of Object.entries(groupedTxs)) {
      if (data.occurrences >= 3) {
        // Sort dates
        data.dates.sort((a, b) => a - b);
        
        // Calculate average interval
        const intervals = [];
        for (let i = 1; i < data.dates.length; i++) {
          intervals.push(data.dates[i] - data.dates[i-1]);
        }
        
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const stdDev = Math.sqrt(
          intervals.reduce((a, b) => a + Math.pow(b - avgInterval, 2), 0) / intervals.length
        );
        
        // Check if intervals are consistent (std dev <= 5 days)
        if (stdDev <= 5 * 24 * 60 * 60 * 1000) {
          // Determine cadence
          let cadence = "monthly";
          if (avgInterval <= 7 * 24 * 60 * 60 * 1000) {
            cadence = "weekly";
          } else if (avgInterval <= 14 * 24 * 60 * 60 * 1000) {
            cadence = "biweekly";
          }
          
          // Calculate next due date
          const lastDate = new Date(Math.max(...data.dates));
          const nextDueDate = new Date(lastDate.getTime() + avgInterval);
          
          // Calculate confidence based on consistency
          const confidence = Math.min(1, 0.5 + (data.occurrences * 0.1) - (stdDev / (5 * 24 * 60 * 60 * 1000)));
          
          // Store recurring transaction
          const existing = await ctx.db
            .query("recurringTransactions")
            .withIndex("by_pattern", (q) => 
              q.eq("userId", userId).eq("patternKey", patternKey)
            )
            .first();
          
          if (existing) {
            await ctx.db.patch(existing._id, {
              occurrences: data.occurrences,
              lastOccurrence: lastDate.toISOString(),
              nextDueDate: nextDueDate.toISOString(),
              confidence
            });
          } else {
            await ctx.db.insert("recurringTransactions", {
              userId,
              patternKey,
              merchantName: data.merchantName,
              amount: data.amount,
              cadence,
              nextDueDate: nextDueDate.toISOString(),
              occurrences: data.occurrences,
              lastOccurrence: lastDate.toISOString(),
              isFixed: true,
              confidence
            });
          }
        }
      }
    }
  }
}); 