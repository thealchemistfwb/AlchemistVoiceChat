import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  budgets: defineTable({
    userId: v.string(),          // Convex IDs are strings, e.g. Auth UID
    category: v.string(),        // "Foundations" | "Delights" | "Nest Egg" | "Wildcards"
    budgetAmount: v.number(),    // Planned spend for the period
    currentSpent: v.number(),    // Sum of transactions to date
    feelsLikeAmount: v.number(), // "Real" balance after commitments
    aiAnalysis: v.string(),      // GPT/Gemini commentary or advice
    lastUpdated: v.number(),     // Unix epoch millis (Date.now())
  }),
  
  accounts: defineTable({
    userId: v.string(),          // User identifier
    totalBalance: v.number(),    // Current total balance across all accounts
    lastSynced: v.number(),      // When data was last synced with Plaid
    plaidAccessToken: v.optional(v.string()), // Plaid access token for this user
  }),

  transactions: defineTable({
    txId: v.string(),            // Plaid transaction ID (e.g., "tx_123")
    userId: v.string(),          // User identifier
    amount: v.number(),          // Transaction amount
    date: v.number(),            // Transaction date (Unix timestamp)
    merchant: v.string(),        // Merchant name
    category: v.optional(v.string()), // Budget category (foundations, delights, etc.)
    assistantSuggestedCategory: v.optional(v.string()), // AI suggested category
    suggestionConfidence: v.optional(v.number()), // AI confidence 0.0-1.0
    isApproved: v.boolean(),     // Whether categorization is approved
    rawPlaid: v.optional(v.string()), // Full Plaid JSON for 30 days
    createdAt: v.number(),       // When record was created
  }),

  transactionSuggestions: defineTable({
    txId: v.string(),            // Transaction ID
    suggestion: v.string(),      // Suggested category
    confidence: v.number(),      // Confidence level 0.0-1.0
    isApproved: v.boolean(),     // Whether suggestion was approved
    createdAt: v.number(),       // When suggestion was made
  }),

  spendingMoney: defineTable({
    userId: v.string(),
    availableBalance: v.number(),
    recurringDeductions: v.array(v.object({
      name: v.string(),
      amount: v.number(),
      nextDueDate: v.string(),
      isFixed: v.boolean()
    })),
    lastUpdated: v.number(),
    nextUpdate: v.number()
  }).index("by_user", ["userId"]),

  recurringTransactions: defineTable({
    userId: v.string(),
    patternKey: v.string(),
    merchantName: v.string(),
    amount: v.number(),
    cadence: v.string(),
    nextDueDate: v.string(),
    occurrences: v.number(),
    lastOccurrence: v.string(),
    isFixed: v.boolean(),
    confidence: v.number(),
    createdAt: v.string(),
    updatedAt: v.string()
  }).index("by_user_and_pattern", ["userId", "patternKey"])
    .index("by_next_due_date", ["nextDueDate"])
});

