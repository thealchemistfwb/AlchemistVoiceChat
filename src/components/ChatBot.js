import React, { useState } from 'react';
import VoiceChatGeminiLiveStreaming from './VoiceChatGeminiLiveStreaming';
import PlaidLinkButton from './PlaidLink';
import AccountBalanceWidget from './AccountBalanceWidget';
import BudgetWidget from './BudgetWidget';
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
      const response = await fetch('/api/chat', {
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
      const response = await fetch('/api/plaid/financial-summary', {
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">Financial Insights Assistant</h1>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-8rem)]">
          
          {/* Left Sidebar */}
          <div className="w-full lg:w-80 flex-shrink-0 space-y-6 overflow-y-auto">
            {/* Chat Mode Toggle */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Chat Mode</h3>
              <div className="flex space-x-3">
                <button 
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                    !voiceChatMode 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  onClick={() => setVoiceChatMode(false)}
                >
                  💬 Text Chat
                </button>
                <button 
                  className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                    voiceChatMode 
                      ? 'bg-blue-600 text-white shadow-md' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  onClick={() => setVoiceChatMode(true)}
                >
                  🎤 Voice Chat
                </button>
              </div>
            </div>

            {/* Plaid Connection */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Bank Connection</h3>
              <PlaidLinkButton 
                onSuccess={handlePlaidSuccess}
                onError={handlePlaidError}
                isConnected={isConnected}
                connectedBank={connectedBank}
              />
            </div>

            {/* Account Balances */}
            {accountBalances.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <AccountBalanceWidget balances={accountBalances} />
              </div>
            )}
            
            {/* Budget Widget */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <BudgetWidget userId="test_user" />
            </div>
          </div>

          {/* Right Chat Area */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full flex flex-col">
              {/* Voice Chat Interface */}
              {voiceChatMode && (
                <div className="flex-1 p-6">
                  <VoiceChatGeminiLiveStreaming 
                    accessToken={accessToken}
                    onMessageUpdate={handleVoiceMessage}
                  />
                </div>
              )}
              
              {/* Text Chat Interface */}
              {!voiceChatMode && (
                <>
                  {/* Messages Area */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {messages.map((message) => (
                      <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-3xl rounded-xl px-4 py-3 ${
                          message.sender === 'user' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-100 text-gray-900'
                        }`}>
                          <HtmlRenderer content={message.text} sender={message.sender} />
                          {message.charts && message.charts.length > 0 && (
                            <div className="mt-4 space-y-4">
                              {message.charts.map((chart, index) => (
                                <ChartRenderer key={`${message.id}-chart-${index}`} chartData={chart} />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 text-gray-900 rounded-xl px-4 py-3">
                          <div className="flex items-center space-x-2">
                            <div className="flex space-x-1">
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                            </div>
                            <span className="text-sm">Thinking...</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Input Area */}
                  <div className="border-t border-gray-200 p-6">
                    <div className="flex space-x-4">
                      <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Type your message..."
                        className="flex-1 border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={isLoading}
                      />
                      <button 
                        onClick={handleSendMessage} 
                        className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                          isLoading || inputValue.trim() === ''
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
                        }`}
                        disabled={isLoading || inputValue.trim() === ''}
                      >
                        {isLoading ? 'Sending...' : 'Send'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatBot;