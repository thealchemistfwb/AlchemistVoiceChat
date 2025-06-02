const { ConvexClient } = require('convex/browser');
const convex = new ConvexClient(process.env.CONVEX_URL);

async function getRecurringTransactions(userId) {
  try {
    // Get recurring transactions for next 30 days
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    const transactions = await convex.query('recurringTransactions:list', {
      userId,
      endDate: thirtyDaysFromNow.toISOString()
    });
    
    return transactions;
  } catch (error) {
    console.error('Error getting recurring transactions:', error);
    return [];
  }
}

async function detectRecurringTransactions(userId, transactions) {
  try {
    // Group transactions by merchant and rounded amount
    const groupedTxs = transactions.reduce((acc, tx) => {
      if (tx.amount >= 0) return acc; // Skip positive transactions
      
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
          
          // Store recurring transaction in Convex
          await convex.mutation('recurringTransactions:upsert', {
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
  } catch (error) {
    console.error('Error detecting recurring transactions:', error);
  }
}

module.exports = {
  getRecurringTransactions,
  detectRecurringTransactions
}; 