import React, { useState, useEffect } from 'react';
import VoiceChatGeminiLiveStreaming from './VoiceChatGeminiLiveStreaming';
import PlaidLinkButton from './PlaidLink';
import AccountBalanceWidget from './AccountBalanceWidget';
import BudgetWidget from './BudgetWidget';
import SpendingMoneyWidget from './SpendingMoneyWidget';
import FloatingTransactionsList from './FloatingTransactionsList';
import HtmlRenderer from './HtmlRenderer';
import ChartRenderer from './ChartRenderer';
import './ChatBot.css';

const ChatBot = () => {
  const [messages, setMessages] = useState([
    { 
      id: 1, 
      text: `<div>
        <h4>👋 Hello! I'm <strong>Finley</strong></h4>
        <p>I'm your friendly financial insights assistant powered by <em>Qwen3</em>. I can help you understand your spending patterns and recent purchases.</p>
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
  const [isLoadingFinancialData, setIsLoadingFinancialData] = useState(false);
  const [financialDataReady, setFinancialDataReady] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('test_user');

  // Ref for the messages container to attach event listener
  const messagesEndRef = React.useRef(null); // We can reuse this or create a new one for the container
  const messagesContainerRef = React.useRef(null);

  // Send ready message when financial data loads
  useEffect(() => {
    if (financialDataReady && isConnected && accountBalances.length > 0) {
      const readyMessage = {
        id: Date.now(),
        text: `<div>
          <h4>✅ Ready to Help!</h4>
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
      setMessages(prev => [...prev, readyMessage]);
    }
  }, [financialDataReady, isConnected, accountBalances]);

  // Effect for handling clicks on .ai-thought-toggle buttons (event delegation)
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleToggleClick = (event) => {
      console.log('[handleToggleClick] Event Target:', event.target);
      console.log('[handleToggleClick] Event Current Target:', event.currentTarget);

      let button = null;
      const clickedElement = event.target;

      // Scenario 1: The click was directly on the button or an element inside it.
      if (clickedElement.closest('.ai-thought-toggle')) {
        button = clickedElement.closest('.ai-thought-toggle');
        console.log('[handleToggleClick] Button found via Scenario 1 (closest)');
      } 
      // Scenario 2: The click was on the .ai-thought div itself (the parent of the button).
      else if (clickedElement.classList && clickedElement.classList.contains('ai-thought') && clickedElement.classList.contains('collapsible')) {
        console.log('[handleToggleClick] Attempting Scenario 2 (clicked .ai-thought div)');
        button = clickedElement.querySelector('.ai-thought-toggle');
        if (button) {
          console.log('[handleToggleClick] Button found via Scenario 2 (querySelector)');
        } else {
          console.log('[handleToggleClick] Button NOT found via Scenario 2 (querySelector). Searched within:', clickedElement);
        }
      }
      
      console.log('[handleToggleClick] Final button state:', button);
      if (!button) {
        console.log('[handleToggleClick] No button found, exiting.');
        return;
      }

      const parentThoughtBlock = button.closest('.ai-thought.collapsible');
      console.log('[handleToggleClick] Parent thought block found:', parentThoughtBlock);
      if (!parentThoughtBlock) {
        console.log('[handleToggleClick] No parent thought block found for the button, exiting.');
        return;
      }

      const isCollapsed = parentThoughtBlock.classList.contains('collapsed');
      console.log('[handleToggleClick] Is collapsed:', isCollapsed);
      if (isCollapsed) {
        parentThoughtBlock.classList.remove('collapsed');
        button.textContent = 'Hide Thoughts';
        button.setAttribute('aria-expanded', 'true');
      } else {
        parentThoughtBlock.classList.add('collapsed');
        button.textContent = 'Show Thoughts';
        button.setAttribute('aria-expanded', 'false');
      }
    };

    container.addEventListener('click', handleToggleClick);

    return () => {
      container.removeEventListener('click', handleToggleClick);
    };
  }, [messages]); // Re-run if messages change, though the container ref should be stable

  const handleSendMessage = async () => {
    if (inputValue.trim() === '' || isLoading) return;
    
    // If connected but financial data not ready, prevent sending
    if (isConnected && !financialDataReady) {
      return;
    }

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
          accessToken: accessToken || undefined,
          accountBalances: accountBalances || undefined
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
    setIsLoadingFinancialData(true);
    setFinancialDataReady(false);
    
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
        setFinancialDataReady(true);
        console.log('✅ Financial data loaded:', data.balances?.length || 0, 'accounts');
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('Error fetching account balances:', error);
      // Still mark as ready even if it fails, so chat doesn't get stuck
      setFinancialDataReady(true);
    } finally {
      setIsLoadingFinancialData(false);
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
          <p>🔄 Loading your account information...</p>
          <p><em>I'll be ready to help in just a moment!</em></p>
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
      setFinancialDataReady(false);
      setIsLoadingFinancialData(false);
      
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
            {isConnected && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <AccountBalanceWidget accounts={accountBalances} isLoading={isLoadingFinancialData} />
              </div>
            )}
            
            {/* Spending Money Widget */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <SpendingMoneyWidget 
                plaidAccessToken={accessToken} 
                userId={currentUserId} 
              />
            </div>
            
            {/* Budget Widget */}
            {isConnected && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <BudgetWidget />
              </div>
            )}
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
                  <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-6 space-y-4">
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
                            <span className="text-[13px] italic">Thinking...</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Input Area */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="relative">
                      <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder={voiceChatMode ? "Voice input active..." : (isConnected && !financialDataReady ? "Loading financial data..." : "Type your message...")}
                        className="w-full p-3 pr-12 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                        disabled={isLoading || (isConnected && !financialDataReady)}
                      />
                      <button 
                        onClick={handleSendMessage} 
                        disabled={isLoading || (isConnected && !financialDataReady)}
                        className="absolute inset-y-0 right-0 px-4 text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                      >
                        {isLoading ? (
                          <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <FloatingTransactionsList userId={currentUserId} />
    </div>
  );
};

export default ChatBot;