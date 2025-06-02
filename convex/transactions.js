import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Store a new transaction from Plaid
export const storeTransaction = mutation({
  args: {
    userId: v.string(),
    txId: v.string(),
    plaidTransactionId: v.string(),
    accountId: v.string(),
    amount: v.number(),
    date: v.union(v.string(), v.number()),
    merchantName: v.optional(v.string()),
    description: v.string(),
    plaidCategory: v.optional(v.array(v.string())),
    plaidSubcategory: v.optional(v.string()),
    currencyCode: v.optional(v.string()),
    enrichedMerchantName: v.optional(v.string()),
    merchantLogo: v.optional(v.string()),
    customCategory: v.optional(v.string()),
    customSubcategory: v.optional(v.string()),
    createdAt: v.number(),
    isApproved: v.boolean()
  },
  handler: async (ctx, args) => {
    console.log(`💾 Storing transaction: ${args.txId} - ${args.merchantName || args.description}`);
    
    // Check for duplicate transaction
    const existing = await ctx.db
      .query("transactions")
      .filter(q => q.eq(q.field("txId"), args.txId))
      .first();
    
    if (existing) {
      console.log(`⚠️ Transaction ${args.txId} already exists, skipping`);
      return existing._id;
    }
    
    // Insert new transaction
    // Convert date string to timestamp if needed
    const dateTimestamp = typeof args.date === 'string' ? Date.parse(args.date) : args.date;
    
    // Store all Plaid and merchant data as a JSON string in rawPlaid
    const rawPlaidData = {
      plaidTransactionId: args.plaidTransactionId,
      accountId: args.accountId,
      description: args.description,
      plaidCategory: args.plaidCategory,
      plaidSubcategory: args.plaidSubcategory,
      currencyCode: args.currencyCode,
      enrichedMerchantName: args.enrichedMerchantName,
      merchantLogo: args.merchantLogo,
      customCategory: args.customCategory,
      customSubcategory: args.customSubcategory
    };

    // Only include fields defined in the schema
    const transactionData = {
      userId: args.userId,
      txId: args.txId,
      amount: args.amount,
      date: dateTimestamp,
      merchant: args.merchantName || args.description,
      rawPlaid: JSON.stringify(rawPlaidData),
      isApproved: args.isApproved,
      createdAt: args.createdAt,
      // Explicitly set all optional fields to undefined if not provided
      category: args.category || undefined,
      assistantSuggestedCategory: args.assistantSuggestedCategory || undefined,
      suggestionConfidence: args.suggestionConfidence || undefined
    };
    
    const transactionId = await ctx.db.insert("transactions", transactionData);
    
    console.log(`✅ Stored transaction ${args.txId} with ID: ${transactionId}`);
    return transactionId;
  }
});

// Suggest a category for a transaction
export const suggestCategory = mutation({
  args: { 
    txId: v.string(), 
    suggestion: v.string(), 
    confidence: v.number() 
  },
  handler: async (ctx, args) => {
    console.log(`💡 AI suggests ${args.txId}: ${args.suggestion} (${args.confidence})`);
    
    // Store the suggestion
    const suggestionId = await ctx.db.insert("transactionSuggestions", {
      txId: args.txId,
      suggestion: args.suggestion,
      confidence: args.confidence,
      isApproved: args.confidence >= 0.6, // Auto-approve high confidence
      createdAt: Date.now()
    });

    // If high confidence, also create/update the transaction record
    if (args.confidence >= 0.6) {
      console.log(`✅ Auto-approving ${args.txId} as ${args.suggestion}`);
      
      // Check if transaction already exists
      const existing = await ctx.db
        .query("transactions")
        .filter(q => q.eq(q.field("txId"), args.txId))
        .first();

      if (existing) {
        // Update existing transaction
        await ctx.db.patch(existing._id, {
          category: args.suggestion,
          assistantSuggestedCategory: args.suggestion,
          suggestionConfidence: args.confidence,
          isApproved: true
        });
      } else {
        // Create new transaction record
        await ctx.db.insert("transactions", {
          txId: args.txId,
          userId: "test_user", // TODO: Get from auth
          amount: 0, // TODO: Parse from context
          date: Date.now(),
          merchant: "Unknown", // TODO: Parse from context
          category: args.suggestion,
          assistantSuggestedCategory: args.suggestion,
          suggestionConfidence: args.confidence,
          isApproved: true,
          createdAt: Date.now()
        });
      }
    }

    return suggestionId;
  }
});

// Approve a category for a transaction
export const approveCategory = mutation({
  args: { 
    txId: v.string(), 
    finalCategory: v.string() 
  },
  handler: async (ctx, args) => {
    console.log(`✅ User approves ${args.txId}: ${args.finalCategory}`);

    // Update suggestion as approved
    const suggestion = await ctx.db
      .query("transactionSuggestions")
      .filter(q => q.eq(q.field("txId"), args.txId))
      .order("desc")
      .first();

    if (suggestion) {
      await ctx.db.patch(suggestion._id, {
        isApproved: true,
        suggestion: args.finalCategory // Update if user changed it
      });
    }

    // Update or create transaction record
    const existing = await ctx.db
      .query("transactions")
      .filter(q => q.eq(q.field("txId"), args.txId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        category: args.finalCategory,
        isApproved: true
      });
    } else {
      await ctx.db.insert("transactions", {
        txId: args.txId,
        userId: "test_user", // TODO: Get from auth
        amount: 0,
        date: Date.now(),
        merchant: "Unknown",
        category: args.finalCategory,
        isApproved: true,
        createdAt: Date.now()
      });
    }

    return { success: true, txId: args.txId, category: args.finalCategory };
  }
});

// Sync Plaid transactions
export const syncPlaid = mutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    console.log(`🔄 Syncing Plaid transactions for user: ${args.userId}`);
    
    // TODO: Implement actual Plaid sync
    // For now, return mock data
    return { newCount: 0, message: "Plaid sync not implemented yet" };
  }
});

// List transactions with filtering
export const listTransactions = query({
  args: { 
    userId: v.string(),
    budgetId: v.optional(v.string()),
    from: v.optional(v.string()),
    to: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("transactions")
      .filter(q => q.eq(q.field("userId"), args.userId));

    // TODO: Add date filtering based on from/to
    
    return await query.collect();
  }
});

// Get uncategorized transactions
export const getUncategorizedTransactions = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("transactions")
      .filter(q => 
        q.and(
          q.eq(q.field("userId"), args.userId),
          q.eq(q.field("isApproved"), false)
        )
      )
      .collect();
  }
});

// Get transaction suggestions for review
export const getTransactionSuggestions = query({
  args: { userId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("transactionSuggestions")
      .order("desc")
      .take(50);
  }
});