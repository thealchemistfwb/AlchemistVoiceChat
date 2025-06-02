import React, { useState, useEffect } from 'react';
import './FloatingTransactionsList.css'; // We'll create this CSS file next

const FloatingTransactionsList = ({ userId }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const toggleVisibility = () => setIsVisible(!isVisible);

  useEffect(() => {
    if (isVisible && userId) {
      const fetchTransactions = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const response = await fetch('/api/transactions/list-all', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId }),
          });
          if (!response.ok) {
            const errData = await response.json().catch(() => ({ message: 'Failed to fetch transactions' }));
            throw new Error(errData.details || errData.message || 'Server error');
          }
          const data = await response.json();
          setTransactions(data.transactions || []);
        } catch (err) {
          console.error('Error fetching transactions:', err);
          setError(err.message);
          setTransactions([]); // Clear transactions on error
        } finally {
          setIsLoading(false);
        }
      };
      fetchTransactions();
    }
  }, [isVisible, userId]);

  return (
    <div className={`floating-transactions-container ${isVisible ? 'visible' : ''}`}>
      <button onClick={toggleVisibility} className="toggle-button">
        {isVisible ? 'Hide' : 'Show'} Test Transactions
      </button>
      {isVisible && (
        <div className="transactions-list">
          {isLoading && <p>Loading transactions...</p>}
          {error && <p className="error-message">Error: {error}</p>}
          {!isLoading && !error && transactions.length === 0 && <p>No transactions found.</p>}
          {!isLoading && !error && transactions.length > 0 && (
            <ul>
              {transactions.map((tx) => (
                <li key={tx._id || tx.txId}> {/* Use _id if from Convex, fallback to txId */}
                  <strong>{tx.merchant || tx.description}</strong>: ${tx.amount.toFixed(2)} on {new Date(tx.date).toLocaleDateString()}
                  {tx.category && <span className="category-badge">{tx.category}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default FloatingTransactionsList; 