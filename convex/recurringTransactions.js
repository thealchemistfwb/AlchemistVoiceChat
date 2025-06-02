import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// List recurring transactions for a user within a date range
export const list = query({
  args: {
    userId: v.string(),
    endDate: v.string()
  },
  handler: async (ctx, args) => {
    const { userId, endDate } = args;
    
    return await ctx.db
      .query("recurringTransactions")
      .filter(q => q.eq(q.field("userId"), userId))
      .filter(q => q.lte(q.field("nextDueDate"), endDate))
      .collect();
  }
});

// Upsert a recurring transaction
export const upsert = mutation({
  args: {
    userId: v.string(),
    patternKey: v.string(),
    merchantName: v.string(),
    amount: v.number(),
    cadence: v.string(),
    nextDueDate: v.string(),
    occurrences: v.number(),
    lastOccurrence: v.string(),
    isFixed: v.boolean(),
    confidence: v.number()
  },
  handler: async (ctx, args) => {
    const { userId, patternKey, ...data } = args;
    
    // Check if transaction already exists
    const existing = await ctx.db
      .query("recurringTransactions")
      .filter(q => 
        q.and(
          q.eq(q.field("userId"), userId),
          q.eq(q.field("patternKey"), patternKey)
        )
      )
      .first();
    
    if (existing) {
      // Update existing transaction
      return await ctx.db.patch(existing._id, {
        ...data,
        updatedAt: new Date().toISOString()
      });
    } else {
      // Create new transaction
      return await ctx.db.insert("recurringTransactions", {
        userId,
        patternKey,
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  }
}); 