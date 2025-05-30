import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  budgets: defineTable({
    userId: v.string(),          // Convex IDs are strings, e.g. Auth UID
    category: v.string(),        // "Foundations" | "Delights" | "Nest Egg" | "Wildcards"
    budgetAmount: v.number(),    // Planned spend for the period
    currentSpent: v.number(),    // Sum of transactions to date
    feelsLikeAmount: v.number(), // “Real” balance after commitments
    aiAnalysis: v.string(),      // GPT/Gemini commentary or advice
    lastUpdated: v.number(),     // Unix epoch millis (Date.now())
  }),
  
  accounts: defineTable({
    userId: v.string(),          // User identifier
    totalBalance: v.number(),    // Current total balance across all accounts
    lastSynced: v.number(),      // When data was last synced with Plaid
    plaidAccessToken: v.optional(v.string()), // Plaid access token for this user
  })
});

