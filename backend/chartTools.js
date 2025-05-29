// Chart generation tools that AI can call to create dynamic visualizations

const CHART_TYPES = {
  PIE: 'pie',
  DONUT: 'doughnut', 
  BAR: 'bar',
  LINE: 'line',
  HORIZONTAL_BAR: 'bar', // Chart.js 3+ uses 'bar' with indexAxis: 'y'
  AREA: 'area'
};

const CHART_COLORS = {
  foundations: '#10B981', // emerald-500
  delights: '#F59E0B',    // amber-500
  nestEgg: '#3B82F6',     // blue-500
  wildCards: '#EF4444',   // red-500
  income: '#059669',      // emerald-600
  expenses: '#DC2626',    // red-600
  balance: '#6366F1'      // indigo-500
};

// Generate color palette for multiple data points
function generateColorPalette(count) {
  const baseColors = [
    '#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#8B5CF6', 
    '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6B7280'
  ];
  
  const colors = [];
  for (let i = 0; i < count; i++) {
    colors.push(baseColors[i % baseColors.length]);
  }
  return colors;
}

// Tool: Create spending breakdown by categories
function createSpendingBreakdown(financialData, chartType = 'auto') {
  try {
    const categories = financialData.summary?.topCategories || [];
    
    if (categories.length === 0) {
      return null;
    }

    // AI can choose chart type based on data
    let selectedType = chartType;
    if (chartType === 'auto') {
      // For 2-4 categories, use pie/donut. For 5+, use bar chart
      selectedType = categories.length <= 4 ? CHART_TYPES.DONUT : CHART_TYPES.BAR;
    }

    const data = {
      labels: categories.map(cat => cat.category),
      datasets: [{
        label: 'Spending by Category',
        data: categories.map(cat => parseFloat(cat.amount)),
        backgroundColor: generateColorPalette(categories.length),
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    };

    const config = {
      type: selectedType,
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Spending Breakdown by Category',
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            position: selectedType === CHART_TYPES.BAR ? 'top' : 'right'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((context.parsed / total) * 100).toFixed(1);
                return `${context.label}: $${context.parsed.toFixed(2)} (${percentage}%)`;
              }
            }
          }
        },
        ...(selectedType === CHART_TYPES.BAR && {
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: function(value) {
                  return '$' + value.toFixed(0);
                }
              }
            }
          }
        })
      }
    };

    return {
      id: `spending-breakdown-${Date.now()}`,
      type: 'chart',
      chartConfig: config,
      summary: `Spending breakdown across ${categories.length} categories, totaling $${financialData.summary.monthlySpending}`
    };

  } catch (error) {
    console.error('Error creating spending breakdown chart:', error);
    return null;
  }
}

// Tool: Create account balance overview
function createBalanceOverview(financialData, chartType = 'auto') {
  try {
    const accounts = financialData.balances || [];
    
    if (accounts.length === 0) {
      return null;
    }

    // Separate positive balances (assets) from negative balances (debts)
    const assets = accounts.filter(acc => (acc.balances.current || 0) >= 0);
    const debts = accounts.filter(acc => (acc.balances.current || 0) < 0);

    let selectedType = chartType;
    if (chartType === 'auto') {
      // Use horizontal bar for many accounts, regular bar for fewer
      selectedType = accounts.length > 6 ? CHART_TYPES.HORIZONTAL_BAR : CHART_TYPES.BAR;
    }

    const data = {
      labels: accounts.map(acc => acc.name || acc.type),
      datasets: [{
        label: 'Account Balances',
        data: accounts.map(acc => Math.abs(acc.balances.current || 0)),
        backgroundColor: accounts.map(acc => 
          (acc.balances.current || 0) >= 0 ? CHART_COLORS.income : CHART_COLORS.expenses
        ),
        borderWidth: 1
      }]
    };

    const isHorizontal = selectedType === CHART_TYPES.HORIZONTAL_BAR;
    
    const config = {
      type: selectedType,
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        ...(isHorizontal && { indexAxis: 'y' }),
        plugins: {
          title: {
            display: true,
            text: 'Account Balances Overview',
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const account = accounts[context.dataIndex];
                const balance = account.balances.current || 0;
                const status = balance >= 0 ? 'Asset' : 'Debt';
                return `${context.label}: $${Math.abs(balance).toFixed(2)} (${status})`;
              }
            }
          }
        },
        scales: {
          [isHorizontal ? 'x' : 'y']: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return '$' + value.toFixed(0);
              }
            }
          }
        }
      }
    };

    return {
      id: `balance-overview-${Date.now()}`,
      type: 'chart',
      chartConfig: config,
      summary: `Overview of ${accounts.length} accounts (${assets.length} assets, ${debts.length} debts)`
    };

  } catch (error) {
    console.error('Error creating balance overview chart:', error);
    return null;
  }
}

// Tool: Create subcategory breakdown for a specific main category
function createSubcategoryBreakdown(financialData, mainCategory, chartType = 'auto') {
  try {
    const categories = financialData.summary?.topCategories || [];
    const targetCategory = categories.find(cat => 
      cat.category.toLowerCase() === mainCategory.toLowerCase()
    );
    
    if (!targetCategory || !targetCategory.subcategories) {
      return null;
    }

    const subcategories = targetCategory.subcategories;
    
    let selectedType = chartType;
    if (chartType === 'auto') {
      selectedType = subcategories.length <= 3 ? CHART_TYPES.PIE : CHART_TYPES.DONUT;
    }

    const data = {
      labels: subcategories.map(sub => sub.subcategory),
      datasets: [{
        label: `${mainCategory} Breakdown`,
        data: subcategories.map(sub => parseFloat(sub.amount)),
        backgroundColor: generateColorPalette(subcategories.length),
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    };

    const config = {
      type: selectedType,
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: `${mainCategory} Spending Breakdown`,
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            position: 'right'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((context.parsed / total) * 100).toFixed(1);
                return `${context.label}: $${context.parsed.toFixed(2)} (${percentage}%)`;
              }
            }
          }
        }
      }
    };

    return {
      id: `subcategory-${mainCategory.toLowerCase()}-${Date.now()}`,
      type: 'chart',
      chartConfig: config,
      summary: `${mainCategory} spending breakdown across ${subcategories.length} subcategories`
    };

  } catch (error) {
    console.error('Error creating subcategory breakdown chart:', error);
    return null;
  }
}

// Tool: Create debt breakdown chart
function createDebtBreakdown(financialData, chartType = 'auto') {
  try {
    const accounts = financialData.balances || [];
    
    // Filter for debt accounts (loan and credit types, or negative balances)
    const debtAccounts = accounts.filter(acc => 
      acc.type === 'loan' || 
      acc.type === 'credit' || 
      (acc.balances.current || 0) < 0
    );
    
    if (debtAccounts.length === 0) {
      return null;
    }

    let selectedType = chartType;
    if (chartType === 'auto') {
      // Use pie chart for debt visualization
      selectedType = debtAccounts.length <= 3 ? CHART_TYPES.PIE : CHART_TYPES.DONUT;
    }

    const data = {
      labels: debtAccounts.map(acc => acc.name || acc.type),
      datasets: [{
        label: 'Debt Amounts',
        data: debtAccounts.map(acc => {
          // For loan/credit accounts, the balance represents the debt amount
          // For negative balances (overdrafts), use absolute value
          return acc.type === 'loan' || acc.type === 'credit' 
            ? acc.balances.current || 0 
            : Math.abs(acc.balances.current || 0);
        }),
        backgroundColor: [
          '#EF4444', // red-500
          '#F97316', // orange-500  
          '#DC2626', // red-600
          '#B91C1C', // red-700
          '#991B1B', // red-800
          '#7F1D1D'  // red-900
        ],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    };

    const totalDebt = debtAccounts.reduce((sum, acc) => {
      const debtAmount = acc.type === 'loan' || acc.type === 'credit' 
        ? acc.balances.current || 0 
        : Math.abs(acc.balances.current || 0);
      return sum + debtAmount;
    }, 0);

    const config = {
      type: selectedType,
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Debt Breakdown by Account',
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            position: 'right'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const percentage = ((context.parsed / totalDebt) * 100).toFixed(1);
                return `${context.label}: $${context.parsed.toFixed(2)} (${percentage}%)`;
              }
            }
          }
        }
      }
    };

    return {
      id: `debt-breakdown-${Date.now()}`,
      type: 'chart',
      chartConfig: config,
      summary: `Total debt of $${totalDebt.toFixed(2)} across ${debtAccounts.length} accounts`
    };

  } catch (error) {
    console.error('Error creating debt breakdown chart:', error);
    return null;
  }
}

// Tool: Create transaction breakdown chart
function createTransactionBreakdown(financialData, chartType = 'auto') {
  try {
    const transactions = financialData.recentTransactions || [];
    
    // Get top spending transactions (exclude deposits/credits)
    const spendingTransactions = transactions
      .filter(t => t.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10); // Top 10 transactions
    
    if (spendingTransactions.length === 0) {
      return null;
    }

    let selectedType = chartType;
    if (chartType === 'auto') {
      // Use horizontal bar for transaction lists (easier to read merchant names)
      selectedType = CHART_TYPES.HORIZONTAL_BAR;
    }

    const data = {
      labels: spendingTransactions.map(t => {
        const merchantName = t.enrichedMerchantName || t.merchantName || t.name;
        return merchantName.length > 25 ? merchantName.substring(0, 25) + '...' : merchantName;
      }),
      datasets: [{
        label: 'Transaction Amount',
        data: spendingTransactions.map(t => t.amount),
        backgroundColor: generateColorPalette(spendingTransactions.length),
        borderWidth: 1
      }]
    };

    const config = {
      type: selectedType,
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y', // This makes it horizontal
        plugins: {
          title: {
            display: true,
            text: 'Recent Transactions Breakdown',
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const transaction = spendingTransactions[context.dataIndex];
                return `${transaction.enrichedMerchantName || transaction.merchantName || transaction.name}: $${context.parsed.x.toFixed(2)}`;
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return '$' + value.toFixed(0);
              }
            }
          }
        }
      }
    };

    const totalShown = spendingTransactions.reduce((sum, t) => sum + t.amount, 0);

    return {
      id: `transaction-breakdown-${Date.now()}`,
      type: 'chart',
      chartConfig: config,
      summary: `Top ${spendingTransactions.length} transactions totaling $${totalShown.toFixed(2)}`
    };

  } catch (error) {
    console.error('Error creating transaction breakdown chart:', error);
    return null;
  }
}

// Tool: Create spending vs income comparison (if we have income data)
function createSpendingVsIncome(financialData, chartType = 'auto') {
  try {
    const totalSpending = parseFloat(financialData.summary?.monthlySpending || 0);
    
    // For now, we'll show spending breakdown. In the future, we could add income tracking
    const categories = financialData.summary?.topCategories || [];
    
    if (categories.length === 0) {
      return null;
    }

    let selectedType = chartType;
    if (chartType === 'auto') {
      selectedType = CHART_TYPES.BAR;
    }

    const data = {
      labels: categories.map(cat => cat.category),
      datasets: [{
        label: 'Monthly Spending',
        data: categories.map(cat => parseFloat(cat.amount)),
        backgroundColor: categories.map(cat => {
          switch(cat.category.toLowerCase()) {
            case 'foundations': return CHART_COLORS.foundations;
            case 'delights': return CHART_COLORS.delights;
            case 'nest egg': return CHART_COLORS.nestEgg;
            case 'wild cards': return CHART_COLORS.wildCards;
            default: return CHART_COLORS.expenses;
          }
        }),
        borderWidth: 1
      }]
    };

    const config = {
      type: selectedType,
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Monthly Spending Analysis',
            font: { size: 16, weight: 'bold' }
          },
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return '$' + value.toFixed(0);
              }
            }
          }
        }
      }
    };

    return {
      id: `spending-analysis-${Date.now()}`,
      type: 'chart',
      chartConfig: config,
      summary: `Monthly spending analysis totaling $${totalSpending.toFixed(2)}`
    };

  } catch (error) {
    console.error('Error creating spending analysis chart:', error);
    return null;
  }
}

// Main function that AI can call with different chart requests
function generateChart(financialData, chartRequest) {
  const { type, category, chartType = 'auto' } = chartRequest;
  
  switch(type.toLowerCase()) {
    case 'spending_breakdown':
    case 'category_breakdown':
      return createSpendingBreakdown(financialData, chartType);
      
    case 'balance_overview':
    case 'account_balances':
      return createBalanceOverview(financialData, chartType);
      
    case 'subcategory_breakdown':
      return createSubcategoryBreakdown(financialData, category, chartType);
      
    case 'spending_analysis':
    case 'spending_vs_income':
      return createSpendingVsIncome(financialData, chartType);
      
    case 'debt_breakdown':
    case 'debt_analysis':
      return createDebtBreakdown(financialData, chartType);
      
    case 'transaction_breakdown':
    case 'recent_transactions':
      return createTransactionBreakdown(financialData, chartType);
      
    default:
      console.log(`Unknown chart type requested: ${type}`);
      return null;
  }
}

module.exports = {
  generateChart,
  createSpendingBreakdown,
  createBalanceOverview,
  createSubcategoryBreakdown,
  createSpendingVsIncome,
  createDebtBreakdown,
  createTransactionBreakdown,
  CHART_TYPES,
  CHART_COLORS
};