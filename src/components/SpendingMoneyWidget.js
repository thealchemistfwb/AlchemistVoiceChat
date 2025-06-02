import React, { useEffect, useState } from 'react';
// Removed: import { CircularProgress } from '@mui/material'; // If not used or causing issues
import { formatCurrency } from '../utils/formatters';
import './SpendingMoneyWidget.css';

export default function SpendingMoneyWidget({ plaidAccessToken, userId }) { // Added plaidAccessToken and userId as props
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [spendingMoneyData, setSpendingMoneyData] = useState(null); // Renamed for clarity

  // Determine Plaid connection status based on the passed prop
  const isPlaidConnected = plaidAccessToken && plaidAccessToken !== 'test_plaid_access_token';

  useEffect(() => {
    const fetchSpendingMoney = async () => {
      if (!isPlaidConnected || !userId) { // Also check for userId
        setSpendingMoneyData(null);
        setIsLoading(false); // Ensure loading is false if not fetching
        return;
      }

      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch('/api/spending-money', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: userId, // Use userId from props
            plaidAccessToken // Use plaidAccessToken from props
          }),
        });

        if (!response.ok) {
          const errorData = await response.text();
          console.error('Failed to fetch spending money data:', response.status, errorData);
          throw new Error('Failed to fetch spending money data');
        }

        const data = await response.json();
        setSpendingMoneyData(data);
      } catch (err) {
        console.error('Error fetching spending money:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSpendingMoney();
    
    let interval;
    if (isPlaidConnected && userId) {
      interval = setInterval(fetchSpendingMoney, 60000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaidConnected, userId, plaidAccessToken]);

  if (!isPlaidConnected) {
    return (
      <div className="spending-money-widget connect-plaid">
        <h5>Connect to Plaid</h5>
        <p>Please connect your bank account via Plaid to see your spending money.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="spending-money-widget loading">
        <div className="loading-spinner">
          <div>Loading...</div> 
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="spending-money-widget">
        <div className="error">
          <h6>Error: {error}</h6>
        </div>
      </div>
    );
  }

  if (!spendingMoneyData) {
    return (
      <div className="spending-money-widget">
        <div className="no-data">
          <h6>No spending money data available. Waiting for sync...</h6>
        </div>
      </div>
    );
  }

  return (
    <div className="spending-money-widget">
      <h5>Spending Money</h5>
      
      <div className="amount">
        {formatCurrency(spendingMoneyData.spendingMoney)}
      </div>
      
      <div className="available-balance">
        Available Balance: {formatCurrency(spendingMoneyData.availableBalance)}
      </div>
      
      {/* Display Contributing Accounts */}
      {spendingMoneyData.contributingAccounts && spendingMoneyData.contributingAccounts.length > 0 && (
        <div className="contributing-accounts">
          <h6>(From {spendingMoneyData.contributingAccounts.length} checking account{spendingMoneyData.contributingAccounts.length > 1 ? 's' : ''}):</h6>
          <ul>
            {spendingMoneyData.contributingAccounts.map((account, index) => (
              <li key={index}>
                {account.name}: {formatCurrency(account.balance)}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {spendingMoneyData.recurringDeductions && spendingMoneyData.recurringDeductions.length > 0 && (
        <div className="deductions">
          <h6>Upcoming Deductions:</h6>
          {spendingMoneyData.recurringDeductions.map((deduction, index) => (
            <div key={index} className="deduction-item">
              <span className="deduction-name">{deduction.name}</span>
              <span className="deduction-amount">
                -{formatCurrency(deduction.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
      
      <div className="last-updated">
        Last updated: {new Date(spendingMoneyData.lastUpdated).toLocaleString()}
      </div>
    </div>
  );
} 