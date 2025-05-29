import React from 'react';
import './AccountBalanceWidget.css';

const AccountBalanceWidget = ({ balances }) => {
  if (!balances || balances.length === 0) {
    return null;
  }

  const getAccountTypeColor = (account) => {
    const { type, subtype } = account;
    
    // Positive cash flow accounts (assets/income sources)
    if (type === 'depository') {
      switch (subtype) {
        case 'checking': return 'emerald';
        case 'savings': return 'blue';
        case 'money market': return 'cyan';
        case 'cd': return 'teal';
        case 'hsa': return 'green';
        case 'cash management': return 'mint';
        default: return 'blue';
      }
    }
    
    if (type === 'investment') {
      switch (subtype) {
        case '401k': return 'purple';
        case 'ira': return 'indigo';
        default: return 'violet';
      }
    }
    
    // Negative cash flow accounts (debts/liabilities)
    if (type === 'credit') {
      return 'amber';
    }
    
    if (type === 'loan') {
      switch (subtype) {
        case 'mortgage': return 'red';
        case 'student': return 'orange';
        default: return 'pink';
      }
    }
    
    return 'gray';
  };

  const formatBalance = (balance) => {
    if (balance === null || balance === undefined) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(Math.abs(balance));
  };

  const isDebtAccount = (account) => {
    return account.type === 'credit' || account.type === 'loan';
  };

  return (
    <div className="account-balance-widget">
      <div className="widget-header">
        <h3>Account Balances</h3>
        <span className="account-count">{balances.length} accounts</span>
      </div>
      <div className="accounts-grid">
        {balances.map((account) => {
          const colorClass = getAccountTypeColor(account);
          const isDebt = isDebtAccount(account);
          
          return (
            <div 
              key={account.accountId} 
              className={`account-card ${colorClass}`}
            >
              <div className="account-header">
                <div className="account-name">{account.name}</div>
                <div className="account-type">{account.subtype}</div>
              </div>
              <div className="account-balance">
                {isDebt && account.balances.current > 0 && (
                  <span className="debt-indicator">-</span>
                )}
                {formatBalance(account.balances.current)}
              </div>
              {account.balances.available !== null && account.balances.available !== account.balances.current && (
                <div className="available-balance">
                  Available: {formatBalance(account.balances.available)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AccountBalanceWidget;