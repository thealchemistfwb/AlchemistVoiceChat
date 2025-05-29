import React, { useState, useCallback, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import './PlaidLink.css';

const PlaidLink = ({ onSuccess, onError, isConnected, connectedBank }) => {
  const [linkToken, setLinkToken] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Fetch link token from backend
  useEffect(() => {
    const fetchLinkToken = async () => {
      try {
        setIsLoading(true);
        setHasError(false);
        
        const response = await fetch('http://localhost:3001/api/plaid/create-link-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.details || `HTTP ${response.status}: Failed to create link token`);
        }
        
        const data = await response.json();
        setLinkToken(data.link_token);
      } catch (error) {
        console.error('Error fetching link token:', error);
        setHasError(true);
        onError(`Failed to initialize bank connection: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    if (!isConnected && !linkToken && !hasError) {
      fetchLinkToken();
    }
  }, [isConnected, linkToken, hasError, onError]);

  const onSuccessCallback = useCallback(async (public_token, metadata) => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/plaid/exchange-public-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ public_token }),
      });

      if (!response.ok) {
        throw new Error('Failed to exchange public token');
      }

      const data = await response.json();
      onSuccess(data.access_token, metadata);
    } catch (error) {
      console.error('Error exchanging public token:', error);
      onError('Failed to complete bank connection');
    } finally {
      setIsLoading(false);
    }
  }, [onSuccess, onError]);

  const config = {
    token: linkToken,
    onSuccess: onSuccessCallback,
    onError: (error) => {
      console.error('Plaid Link error:', error);
      onError('Bank connection failed');
    },
    onExit: (error) => {
      if (error) {
        console.error('Plaid Link exit error:', error);
        onError('Bank connection was cancelled');
      }
    },
  };

  const { open, ready } = usePlaidLink(config);

  const handleClick = () => {
    if (ready) {
      open();
    }
  };

  const handleRetry = () => {
    setHasError(false);
    setLinkToken(null);
  };

  if (isConnected) {
    return (
      <div className="plaid-status connected">
        <span className="bank-icon">🏦</span>
        <span className="connection-text">
          Connected to {connectedBank || 'Bank'}
        </span>
        <button 
          className="disconnect-btn"
          onClick={() => onSuccess(null, null)} // Clear connection
        >
          Disconnect
        </button>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="plaid-link-container">
        <button
          onClick={handleRetry}
          className="plaid-link-button error"
        >
          <span className="error-icon">⚠️</span>
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="plaid-link-container">
      <button
        onClick={handleClick}
        disabled={!ready || isLoading}
        className="plaid-link-button"
      >
        {isLoading ? (
          <>
            <span className="spinner"></span>
            Connecting...
          </>
        ) : ready ? (
          <>
            <span className="bank-icon">🏦</span>
            Connect Your Bank
          </>
        ) : (
          <>
            <span className="spinner"></span>
            Loading...
          </>
        )}
      </button>
    </div>
  );
};

export default PlaidLink;