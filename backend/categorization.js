const { GoogleGenAI } = require('@google/genai');

const genAI = new GoogleGenAI(process.env.GOOGLE_AI_API_KEY);

// Define the custom category structure
const CATEGORY_STRUCTURE = {
  "Foundations": {
    description: "Essential day-to-day expenses required for living",
    subcategories: [
      "Housing", // Mortgage, rent, utilities, home insurance
      "Transportation", // Car payments, gas, insurance, maintenance, public transit
      "Groceries", // Food shopping for home consumption
      "Healthcare", // Medical expenses, prescriptions, health insurance
      "Utilities", // Electric, water, gas, internet, phone
      "Insurance", // All types of insurance payments
      "Debt Payments" // Minimum debt payments, student loans
    ]
  },
  "Delights": {
    description: "Entertainment and enjoyable spending",
    subcategories: [
      "Fast Food", // McDonald's, Taco Bell, etc.
      "Restaurants", // Sit-down dining experiences
      "Entertainment", // Movies, concerts, streaming services
      "Sporting Events", // SOS tickets, games, sports activities
      "Hobbies", // Recreational activities and interests
      "Travel", // Vacations, trips, hotels
      "Shopping" // Non-essential retail purchases
    ]
  },
  "Nest Egg": {
    description: "Savings and investments for the future",
    subcategories: [
      "Emergency Fund", // Emergency savings
      "Retirement", // 401k, IRA contributions
      "Investments", // Stocks, bonds, investment accounts
      "Savings Goals", // Specific savings targets
      "Education Fund" // Saving for education expenses
    ]
  },
  "Wild Cards": {
    description: "Everything else that doesn't fit standard categories",
    subcategories: [
      "Home Repair", // Home Depot, maintenance, unexpected home expenses
      "Car Repair", // Unexpected vehicle repairs and maintenance
      "Medical Emergency", // Unexpected medical expenses
      "Gifts", // Presents for others
      "Professional Services", // Legal, accounting, consulting
      "Miscellaneous", // Anything that doesn't fit elsewhere
      "ATM/Fees" // Bank fees, ATM fees, service charges
    ]
  }
};

// Create the AI categorization prompt with enriched data
function createCategorizationPrompt(transaction) {
  const categoriesText = Object.entries(CATEGORY_STRUCTURE)
    .map(([mainCat, data]) => {
      const subcats = data.subcategories.join(', ');
      return `${mainCat}: ${data.description}\n  Subcategories: ${subcats}`;
    })
    .join('\n\n');

  // Use enriched data if available, fall back to original data
  const merchantName = transaction.enrichedMerchantName || transaction.merchantName || 'Unknown';
  const transactionName = transaction.name || 'Unknown';
  const amount = Math.abs(transaction.amount);
  
  // Additional enriched data context
  const enrichedContext = [];
  if (transaction.merchantType) {
    enrichedContext.push(`- Merchant Type: ${transaction.merchantType}`);
  }
  if (transaction.enrichedCategory) {
    enrichedContext.push(`- Plaid Category: ${transaction.enrichedCategory}`);
  }
  if (transaction.paymentChannel) {
    enrichedContext.push(`- Payment Channel: ${transaction.paymentChannel}`);
  }
  if (transaction.location?.city && transaction.location?.region) {
    enrichedContext.push(`- Location: ${transaction.location.city}, ${transaction.location.region}`);
  }

  return `You are a financial transaction categorizer. Based on the merchant name, transaction description, and enriched data, categorize this transaction into the appropriate main category and subcategory.

CATEGORY STRUCTURE:
${categoriesText}

TRANSACTION TO CATEGORIZE:
- Merchant: ${merchantName}
- Description: ${transactionName}
- Amount: $${amount.toFixed(2)}
${enrichedContext.length > 0 ? enrichedContext.join('\n') : ''}

INSTRUCTIONS:
1. Choose the most appropriate main category (Foundations, Delights, Nest Egg, or Wild Cards)
2. Choose the most appropriate subcategory from that main category
3. Consider the merchant name as the primary indicator
4. Use your knowledge of common businesses and their purposes

EXAMPLES:
- McDonald's → Delights: Fast Food
- Shell Gas Station → Foundations: Transportation
- Home Depot → Wild Cards: Home Repair
- SOS (sports tickets) → Delights: Sporting Events
- Kroger → Foundations: Groceries
- Car repair shop → Wild Cards: Car Repair

Respond ONLY with this exact format:
MAIN_CATEGORY: SUBCATEGORY

For example: Delights: Fast Food`;
}

// Function to categorize a single transaction using AI
async function categorizeTransaction(transaction) {
  try {
    const prompt = createCategorizationPrompt(transaction);

    const result = await genAI.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: prompt,
    });
    
    const response = result.text.trim();
    
    // Parse the response
    const match = response.match(/^([^:]+):\s*(.+)$/);
    if (match) {
      const mainCategory = match[1].trim();
      const subcategory = match[2].trim();
      
      // Validate that the categories exist in our structure
      if (CATEGORY_STRUCTURE[mainCategory] && 
          CATEGORY_STRUCTURE[mainCategory].subcategories.includes(subcategory)) {
        return {
          mainCategory,
          subcategory,
          confidence: 'high'
        };
      }
    }
    
    // Fallback if parsing fails
    console.log(`⚠️ Could not parse AI categorization response: "${response}"`);
    return {
      mainCategory: 'Wild Cards',
      subcategory: 'Miscellaneous',
      confidence: 'low'
    };
    
  } catch (error) {
    console.error('❌ Error categorizing transaction:', error);
    return {
      mainCategory: 'Wild Cards',
      subcategory: 'Miscellaneous',
      confidence: 'error'
    };
  }
}

// Function to categorize multiple transactions in batches
async function categorizeTransactions(transactions) {
  console.log(`🏷️ Starting AI categorization for ${transactions.length} transactions...`);
  
  const categorizedTransactions = [];
  const batchSize = 5; // Process 5 at a time to avoid rate limits
  
  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = transactions.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(transactions.length/batchSize)}`);
    
    const batchPromises = batch.map(async (transaction) => {
      const categorization = await categorizeTransaction(transaction);
      return {
        ...transaction,
        customCategory: categorization.mainCategory,
        customSubcategory: categorization.subcategory,
        categorizationConfidence: categorization.confidence
      };
    });
    
    const batchResults = await Promise.all(batchPromises);
    categorizedTransactions.push(...batchResults);
    
    // Small delay between batches to be respectful to API limits
    if (i + batchSize < transactions.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log('✅ AI categorization completed');
  return categorizedTransactions;
}

// Function to get category statistics
function getCategoryStatistics(categorizedTransactions) {
  const stats = {
    byMainCategory: {},
    bySubcategory: {},
    totalSpending: 0
  };
  
  categorizedTransactions.forEach(transaction => {
    const amount = Math.abs(transaction.amount);
    stats.totalSpending += amount;
    
    // Main category stats
    if (!stats.byMainCategory[transaction.customCategory]) {
      stats.byMainCategory[transaction.customCategory] = {
        amount: 0,
        count: 0,
        subcategories: {}
      };
    }
    stats.byMainCategory[transaction.customCategory].amount += amount;
    stats.byMainCategory[transaction.customCategory].count += 1;
    
    // Subcategory stats
    const subcatKey = `${transaction.customCategory}: ${transaction.customSubcategory}`;
    if (!stats.bySubcategory[subcatKey]) {
      stats.bySubcategory[subcatKey] = { amount: 0, count: 0 };
    }
    stats.bySubcategory[subcatKey].amount += amount;
    stats.bySubcategory[subcatKey].count += 1;
    
    // Track subcategories within main categories
    if (!stats.byMainCategory[transaction.customCategory].subcategories[transaction.customSubcategory]) {
      stats.byMainCategory[transaction.customCategory].subcategories[transaction.customSubcategory] = {
        amount: 0,
        count: 0
      };
    }
    stats.byMainCategory[transaction.customCategory].subcategories[transaction.customSubcategory].amount += amount;
    stats.byMainCategory[transaction.customCategory].subcategories[transaction.customSubcategory].count += 1;
  });
  
  return stats;
}

module.exports = {
  categorizeTransaction,
  categorizeTransactions,
  getCategoryStatistics,
  CATEGORY_STRUCTURE
};