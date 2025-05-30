import React, { useState, useEffect, useCallback } from 'react';
import './BudgetWidget.css';

const BudgetWidget = ({ userId = "test_user" }) => {
  const [budgets, setBudgets] = useState([]);
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);

  // Budget category display info
  const categoryInfo = {
    foundations: { 
      name: 'Foundations', 
      icon: '🏠', 
      description: 'Essential expenses (rent, utilities, groceries)'
    },
    delights: { 
      name: 'Delights', 
      icon: '✨', 
      description: 'Fun and discretionary spending'
    },
    nest_egg: { 
      name: 'Nest Egg', 
      icon: '🥚', 
      description: 'Savings and investments'
    },
    wild_cards: { 
      name: 'Wild Cards', 
      icon: '🃏', 
      description: 'Unexpected and emergency expenses'
    }
  };

  const fetchBudgetData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch budgets and account data from Convex
      const [budgetsResponse, accountResponse] = await Promise.all([
        fetch('/api/convex/budgets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            function: 'getUserBudgets',
            args: { userId }
          })
        }),
        fetch('/api/convex/budgets', {
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            function: 'getUserAccount',
            args: { userId }
          })
        })
      ]);

      if (budgetsResponse.ok && accountResponse.ok) {
        const budgetsData = await budgetsResponse.json();
        const accountData = await accountResponse.json();
        
        setBudgets(budgetsData.result || []);
        setAccount(accountData.result);
      }
    } catch (error) {
      console.error('Error fetching budget data:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchBudgetData();
  }, [fetchBudgetData]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const getProgressPercentage = (spent, budget) => {
    if (!budget || budget === 0) return 0;
    return Math.min((spent / budget) * 100, 100);
  };

  const getProgressColor = (percentage) => {
    if (percentage >= 90) return '#e74c3c'; // Red
    if (percentage >= 75) return '#f39c12'; // Orange  
    if (percentage >= 50) return '#f1c40f'; // Yellow
    return '#2ecc71'; // Green
  };

  if (loading) {
    return (
      <div className="budget-widget loading">
        <div className="loading-spinner">💰</div>
        <p>Loading budget data...</p>
      </div>
    );
  }

  return (
    <div className="budget-widget">
      <div className="budget-header">
        <h3>💰 Your Budget Overview</h3>
        {account && (
          <div className="total-balance">
            Total Balance: <strong>{formatCurrency(account.totalBalance)}</strong>
          </div>
        )}
      </div>

      <div className="budget-categories">
        {budgets.map((budget) => {
          const categoryData = categoryInfo[budget.category];
          const progressPercentage = getProgressPercentage(budget.currentSpent, budget.budgetAmount);
          const progressColor = getProgressColor(progressPercentage);
          
          return (
            <div key={budget.category} className="budget-category">
              <div className="category-header">
                <span className="category-icon">{categoryData.icon}</span>
                <div className="category-info">
                  <h4>{categoryData.name}</h4>
                  <p className="category-description">{categoryData.description}</p>
                </div>
              </div>

              <div className="budget-amounts">
                <div className="amount-row">
                  <span className="label">Budget:</span>
                  <span className="amount budget-amount">
                    {budget.budgetAmount > 0 ? formatCurrency(budget.budgetAmount) : 'Not set'}
                  </span>
                </div>
                
                <div className="amount-row">
                  <span className="label">Spent:</span>
                  <span className="amount spent-amount">{formatCurrency(budget.currentSpent)}</span>
                </div>
                
                <div className="amount-row">
                  <span className="label">Feels like:</span>
                  <span className="amount feels-like-amount">
                    {formatCurrency(budget.feelsLikeAmount)}
                  </span>
                </div>
              </div>

              {budget.budgetAmount > 0 && (
                <div className="progress-section">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill"
                      style={{ 
                        width: `${progressPercentage}%`,
                        backgroundColor: progressColor
                      }}
                    />
                  </div>
                  <div className="progress-text">
                    {progressPercentage.toFixed(1)}% used
                  </div>
                </div>
              )}

              {budget.aiAnalysis && (
                <div className="ai-insight">
                  <span className="ai-icon">🤖</span>
                  <em>{budget.aiAnalysis}</em>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {budgets.every(b => b.budgetAmount === 0) && (
        <div className="no-budgets-message">
          <h4>💡 Get Started with AI Budgeting</h4>
          <p>Ask me to help set up your budget! Try saying:</p>
          <ul>
            <li>"Help me create a budget"</li>
            <li>"Set up my monthly budget"</li>
            <li>"I want to budget $3000 for foundations"</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default BudgetWidget;