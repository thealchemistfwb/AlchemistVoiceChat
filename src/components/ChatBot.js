import React, { useState } from 'react';
import VoiceChatGeminiLiveStreaming from './VoiceChatGeminiLiveStreaming';
import PlaidLinkButton from './PlaidLink';
import AccountBalanceWidget from './AccountBalanceWidget';
import HtmlRenderer from './HtmlRenderer';
import ChartRenderer from './ChartRenderer';
import './ChatBot.css';

const ChatBot = () => {
  const [messages, setMessages] = useState([
    { 
      id: 1, 
      text: `<div>
        <h4>👋 Hello! I'm <strong>Finley</strong></h4>
        <p>I'm your friendly financial insights assistant powered by <em>Google Gemini 2.5 Pro</em>. I can help you understand your spending patterns and recent purchases.</p>
        <p><strong>To get started:</strong> Connect your bank account above for personalized insights, or ask me general questions about finances!</p>
      </div>`, 
      sender: 'bot' 
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [accessToken, setAccessToken] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [connectedBank, setConnectedBank] = useState('');
  const [accountBalances, setAccountBalances] = useState([]);
  const [voiceChatMode, setVoiceChatMode] = useState(false);

  const handleSendMessage = async () => {
    if (inputValue.trim() === '' || isLoading) return;

    const userMessage = {
      id: Date.now(),
      text: inputValue,
      sender: 'user'
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputValue;
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: currentInput,
          conversationHistory: messages,
          accessToken: accessToken || undefined
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      const botResponse = {
        id: Date.now() + 1,
        text: data.message,
        charts: data.charts || [],
        sender: 'bot'
      };

      setMessages(prev => [...prev, botResponse]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorResponse = {
        id: Date.now() + 1,
        text: "Sorry, I'm having trouble connecting to the server. Please make sure the backend is running and try again.",
        sender: 'bot'
      };
      setMessages(prev => [...prev, errorResponse]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  const handleVoiceMessage = ({ userMessage, aiResponse, charts }) => {
    const userMsg = {
      id: Date.now(),
      text: userMessage,
      sender: 'user'
    };
    
    const botMsg = {
      id: Date.now() + 1,
      text: aiResponse,
      charts: charts || [],
      sender: 'bot'
    };

    setMessages(prev => [...prev, userMsg, botMsg]);
  };

  const fetchAccountBalances = async (token) => {
    try {
      const response = await fetch('http://localhost:3001/api/plaid/financial-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accessToken: token }),
      });

      if (response.ok) {
        const data = await response.json();
        setAccountBalances(data.balances || []);
      }
    } catch (error) {
      console.error('Error fetching account balances:', error);
    }
  };

  const handlePlaidSuccess = (token, metadata) => {
    if (token) {
      setAccessToken(token);
      setIsConnected(true);
      setConnectedBank(metadata?.institution?.name || 'Bank');
      
      // Fetch account balances for the widget
      fetchAccountBalances(token);
      
      const successMessage = {
        id: Date.now(),
        text: `<div>
          <h4>🎉 Successfully Connected!</h4>
          <p>Great! I've connected to your <strong class="checking">${metadata?.institution?.name || 'bank'}</strong> account.</p>
          <p>I can now provide personalized insights about your:</p>
          <ul>
            <li><strong>Account balances</strong> (shown above)</li>
            <li><strong>Spending patterns</strong> and trends</li>
            <li><strong>Recent transactions</strong> and categories</li>
            <li><strong>Monthly summaries</strong> and comparisons</li>
          </ul>
          <p><em>What would you like to explore first?</em></p>
        </div>`,
        sender: 'bot'
      };
      setMessages(prev => [...prev, successMessage]);
    } else {
      // Disconnect
      setAccessToken('');
      setIsConnected(false);
      setConnectedBank('');
      setAccountBalances([]);
      
      const disconnectMessage = {
        id: Date.now(),
        text: `<div>
          <h4>👋 Disconnected</h4>
          <p>I've disconnected from your bank account. You can still ask me general financial questions, or reconnect your bank for personalized insights.</p>
        </div>`,
        sender: 'bot'
      };
      setMessages(prev => [...prev, disconnectMessage]);
    }
  };

  const handlePlaidError = (error) => {
    // Only add error message if it's not a duplicate
    setMessages(prev => {
      const lastMessage = prev[prev.length - 1];
      if (lastMessage && lastMessage.text.includes('issue connecting to your bank')) {
        return prev; // Don't add duplicate error messages
      }
      
      const errorMessage = {
        id: Date.now(),
        text: `<div>
          <h4>⚠️ Connection Issue</h4>
          <p>Sorry, I encountered an issue connecting to your bank:</p>
          <p><code>${error}</code></p>
          <p><em>Please use the retry button to try again.</em></p>
        </div>`,
        sender: 'bot'
      };
      return [...prev, errorMessage];
    });
  };

  return (
    <div className="chatbot-container">
      <div className="chatbot-header">
        <h2>Financial Insights Assistant</h2>
        <div className="header-controls">
          <div className="chat-mode-toggle">
            <button 
              className={`mode-button ${!voiceChatMode ? 'active' : ''}`}
              onClick={() => setVoiceChatMode(false)}
            >
              💬 Text Chat
            </button>
            <button 
              className={`mode-button ${voiceChatMode ? 'active' : ''}`}
              onClick={() => setVoiceChatMode(true)}
            >
              🎤 Voice Chat
            </button>
          </div>
          <div className="plaid-connection-section">
            <PlaidLinkButton 
              onSuccess={handlePlaidSuccess}
              onError={handlePlaidError}
              isConnected={isConnected}
              connectedBank={connectedBank}
            />
          </div>
        </div>
      </div>
      {accountBalances.length > 0 && (
        <AccountBalanceWidget balances={accountBalances} />
      )}
      
      {/* Voice Chat Interface */}
      {voiceChatMode && (
        <VoiceChatGeminiLiveStreaming 
          accessToken={accessToken}
          onMessageUpdate={handleVoiceMessage}
        />
      )}
      
      {/* Text Chat Interface */}
      {!voiceChatMode && (
        <>
          <div className="chatbot-messages">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.sender}`}>
            <div className="message-content">
              <HtmlRenderer content={message.text} sender={message.sender} />
              {message.charts && message.charts.length > 0 && (
                <div className="message-charts">
                  {message.charts.map((chart, index) => (
                    <ChartRenderer key={`${message.id}-chart-${index}`} chartData={chart} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message bot">
            <div className="message-content loading">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
              Thinking...
            </div>
          </div>
        )}
          </div>
          <div className="chatbot-input">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="message-input"
              disabled={isLoading}
            />
            <button 
              onClick={handleSendMessage} 
              className="send-button"
              disabled={isLoading || inputValue.trim() === ''}
            >
              {isLoading ? 'Sending...' : 'Send'}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ChatBot;