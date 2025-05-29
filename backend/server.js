const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenAI } = require('@google/genai');
const { getFinancialSummary, plaidClient } = require('./plaidClient');
const { generateChart } = require('./chartTools');
const { textToSpeech, streamTextToSpeech, cleanTextForSpeech } = require('./cartesiaService');
const DailyService = require('./dailyService');
const GeminiLiveStreamingService = require('./geminiLiveStreamingService');
const OpenAI = require('openai');
const http = require('http');
const WebSocket = require('ws');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json());

// Initialize Google AI
const genAI = new GoogleGenAI({
  apiKey: process.env.GOOGLE_AI_API_KEY
});

// Initialize OpenAI for Whisper STT
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configure multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

if (!process.env.GOOGLE_AI_API_KEY) {
  console.error('GOOGLE_AI_API_KEY is required. Please set it in your .env file.');
  process.exit(1);
}

// Warn if Cartesia is not configured (voice features will be disabled)
if (!process.env.CARTESIA_API_KEY) {
  console.warn('⚠️  CARTESIA_API_KEY not set. Voice chat features will be disabled.');
}

// Initialize Gemini Live Streaming service
const geminiLiveStreaming = new GeminiLiveStreamingService();

// Store active voice sessions for real-time conversation
const voiceSessions = new Map();
const geminiLiveSessions = new Map();

class RealTimeVoiceSession {
  constructor(sessionId, userId = 'default') {
    this.sessionId = sessionId;
    this.userId = userId;
    this.isActive = false;
    this.conversationHistory = [];
    this.dailyRoom = null;
    this.wsConnection = null;
    this.isProcessing = false;
    this.audioChunkBuffer = [];
    this.speechTimer = null;
    this.speechDelay = 2000; // Wait 2 seconds after speech stops before processing
    this.lastTranscript = '';
    this.accumulatedTranscripts = [];
    
    console.log(`🎤 Created real-time voice session: ${sessionId}`);
  }

  async initialize() {
    try {
      // Create Daily.co room for WebRTC transport
      if (process.env.DAILY_API_KEY) {
        this.dailyRoom = await this.createDailyRoom();
      }
      
      // Initialize conversation context for real-time interaction
      this.conversationHistory = [{
        role: "system",
        content: `You are Finley, a friendly financial AI assistant in a REAL-TIME voice conversation.

        Guidelines for voice responses:
        - Keep responses under 2-3 sentences
        - Be conversational and natural
        - Respond quickly and concisely
        - Support interruption gracefully
        - Be empathetic about financial topics
        - Ask follow-up questions to keep conversation flowing
        
        You can be interrupted mid-sentence, so avoid long explanations unless specifically requested.`
      }];

      this.isActive = true;
      console.log(`✅ Real-time voice session ${this.sessionId} initialized`);
      
      return {
        sessionId: this.sessionId,
        dailyRoom: this.dailyRoom,
        status: 'active'
      };
      
    } catch (error) {
      console.error(`❌ Failed to initialize voice session ${this.sessionId}:`, error);
      throw error;
    }
  }

  async createDailyRoom() {
    try {
      const roomName = `finley-voice-${this.sessionId}`;
      
      const response = await fetch('https://api.daily.co/v1/rooms', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.DAILY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: roomName,
          properties: {
            max_participants: 2,
            enable_chat: false,
            enable_screenshare: false,
            enable_recording: false,
            start_video_off: true,
            start_audio_off: false,
            enable_prejoin_ui: false,
            enable_network_ui: false,
            owner_only_broadcast: false
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Daily.co room creation failed: ${response.status}`);
      }

      const roomData = await response.json();
      console.log(`✅ Created Daily.co room: ${roomData.url}`);
      
      return {
        url: roomData.url,
        name: roomData.name,
        userToken: await this.createDailyToken(roomData.url, 'user'),
        botToken: await this.createDailyToken(roomData.url, 'finley_bot')
      };

    } catch (error) {
      console.error('❌ Daily.co room creation error:', error);
      // Return fallback for direct WebSocket connection
      return null;
    }
  }

  async createDailyToken(roomUrl, userName) {
    try {
      const roomName = roomUrl.split('/').pop();
      
      const response = await fetch('https://api.daily.co/v1/meeting-tokens', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.DAILY_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: {
            room_name: roomName,
            user_name: userName,
            is_owner: userName === 'finley_bot',
            enable_recording: false
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Daily.co token creation failed: ${response.status}`);
      }

      const data = await response.json();
      return data.token;

    } catch (error) {
      console.error('❌ Daily.co token creation error:', error);
      return null;
    }
  }

  setWebSocketConnection(ws) {
    this.wsConnection = ws;
    console.log(`🔗 WebSocket connected to voice session ${this.sessionId}`);
  }

  debouncedProcessSpeech(transcript) {
    // Clear existing timer
    if (this.speechTimer) {
      clearTimeout(this.speechTimer);
    }
    
    // Accumulate transcripts to build complete sentences
    if (transcript && transcript.trim().length > 0) {
      this.accumulatedTranscripts.push(transcript.trim());
      console.log(`📝 Accumulated: "${transcript.trim()}" (${this.accumulatedTranscripts.length} parts)`);
    }
    
    // Set new timer to process after speech delay
    this.speechTimer = setTimeout(async () => {
      if (this.accumulatedTranscripts.length > 0) {
        // Combine all accumulated transcripts into one coherent sentence
        const fullTranscript = this.accumulatedTranscripts.join(' ').trim();
        console.log(`⏱️ Processing debounced speech: "${fullTranscript}"`);
        
        await this.processVoiceInput(fullTranscript);
        
        // Clear accumulated transcripts
        this.accumulatedTranscripts = [];
      }
    }, this.speechDelay);
    
    console.log(`⏳ Speech debounced, waiting ${this.speechDelay}ms for more input...`);
  }

  async processVoiceInput(transcript) {
    if (this.isProcessing) {
      console.log(`🛑 Interruption detected in session ${this.sessionId}`);
      this.isProcessing = false;
      // Allow immediate processing of new input
    }

    this.isProcessing = true;

    try {
      console.log(`👤 User (${this.sessionId}): ${transcript}`);
      
      // Add user message to conversation history
      this.conversationHistory.push({
        role: "user",
        content: transcript
      });

      // Get AI response using existing genAI service
      const aiResponse = await this.getAIResponse();
      console.log(`🤖 Finley (${this.sessionId}): ${aiResponse}`);

      // Convert to speech and send response
      await this.sendVoiceResponse(transcript, aiResponse);

      this.isProcessing = false;
      return aiResponse;

    } catch (error) {
      console.error(`❌ Error processing voice input for session ${this.sessionId}:`, error);
      this.isProcessing = false;
      
      const errorResponse = "I'm sorry, I had trouble processing that. Could you try again?";
      await this.sendVoiceResponse(transcript, errorResponse);
      return errorResponse;
    }
  }

  async getAIResponse() {
    try {
      // Keep conversation history manageable for real-time responses
      const recentHistory = this.conversationHistory.slice(-8);
      
      const prompt = recentHistory.map(msg => 
        msg.role === 'system' ? msg.content : 
        `${msg.role === 'user' ? 'User' : 'Finley'}: ${msg.content}`
      ).join('\n\n');

      const response = await genAI.models.generateContent({
        model: 'gemini-2.5-flash-preview-05-20',
        contents: prompt,
      });

      const aiText = response.text || "I'm here to help with your financial questions.";
      
      // Add to conversation history
      this.conversationHistory.push({
        role: "assistant",
        content: aiText
      });

      return aiText;

    } catch (error) {
      console.error('❌ AI response error:', error);
      return "I'm having trouble right now. Could you please try again?";
    }
  }

  async sendVoiceResponse(userInput, aiResponse) {
    try {
      // Convert AI response to speech
      let audioData = null;
      if (process.env.CARTESIA_API_KEY) {
        try {
          const audioBuffer = await textToSpeech(aiResponse);
          audioData = audioBuffer.toString('base64');
          console.log(`🔊 Generated speech for session ${this.sessionId} (${audioBuffer.length} bytes)`);
        } catch (ttsError) {
          console.error('❌ TTS Error:', ttsError);
        }
      }

      // Send response via WebSocket
      if (this.wsConnection && this.wsConnection.readyState === 1) {
        this.wsConnection.send(JSON.stringify({
          type: 'voice_response',
          sessionId: this.sessionId,
          userInput,
          aiResponse,
          audioData,
          timestamp: new Date().toISOString(),
          canInterrupt: true
        }));
        console.log(`✅ Voice response sent for session ${this.sessionId}`);
      }

    } catch (error) {
      console.error(`❌ Error sending voice response for session ${this.sessionId}:`, error);
    }
  }

  async destroy() {
    this.isActive = false;
    this.isProcessing = false;
    
    // Clear speech timer
    if (this.speechTimer) {
      clearTimeout(this.speechTimer);
      this.speechTimer = null;
    }
    
    // Close WebSocket connection
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
    
    console.log(`🗑️ Real-time voice session ${this.sessionId} destroyed`);
  }
}

app.post('/api/chat', async (req, res) => {
  try {
    const { message, conversationHistory = [], accessToken } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    let financialContext = '';
    if (accessToken) {
      try {
        console.log('🤖 Fetching financial data for AI context...');
        const financialData = await getFinancialSummary(accessToken);
        
        financialContext = `
=== FINANCIAL CONTEXT FROM CONNECTED PLAID ACCOUNT (Last 30 days) ===

ACCOUNT BALANCES:
${financialData.balances.map(acc => `- ${acc.name} (${acc.type}): $${acc.balances.current || 'N/A'}`).join('\n')}

SUMMARY STATISTICS:
- Total Balance Across All Accounts: $${financialData.summary.totalBalance}
- Total Spending in Period: $${financialData.summary.monthlySpending}
- Number of Transactions Found: ${financialData.summary.transactionCount}

TOP SPENDING CATEGORIES (AI-powered custom categorization):
${financialData.summary.topCategories.length > 0 ? 
  financialData.summary.topCategories.map(cat => 
    `- ${cat.category}: $${cat.amount}\n${cat.subcategories.map(sub => `  • ${sub.subcategory}: $${sub.amount}`).join('\n')}`
  ).join('\n') : 
  '- No spending categories found in this period'}

TOP MERCHANTS (from actual transactions):
${financialData.summary.topMerchants.length > 0 ? 
  financialData.summary.topMerchants.map(merch => `- ${merch.merchant}: $${merch.amount}`).join('\n') : 
  '- No merchant data found in this period'}

ACTUAL RECENT TRANSACTIONS (up to 10 most recent with AI categorization and enrichment):
${financialData.recentTransactions.length > 0 ? 
  financialData.recentTransactions.map(t => {
    const merchantDisplay = t.enrichedMerchantName || t.merchantName || t.name;
    const enrichmentInfo = t.merchantLogo ? ' 🏪' : '';
    return `- ${t.date}: ${merchantDisplay}${enrichmentInfo} - $${t.amount.toFixed(2)} [${t.customCategory}: ${t.customSubcategory}]`;
  }).join('\n') : 
  '- No transactions found in this period'}

=== END OF ACTUAL FINANCIAL DATA ===`;

        console.log('🧠 FINANCIAL CONTEXT BEING SENT TO AI:');
        console.log('='.repeat(80));
        console.log(financialContext);
        console.log('='.repeat(80));
        
      } catch (error) {
        console.error('❌ Error fetching financial data:', error);
        financialContext = '\nNote: Unable to fetch current financial data for this conversation.';
      }
    }

    const systemPrompt = `
✨  FINLEY – Your Friendly Financial-Wellbeing Companion
───────────────────────────────────────────────────────

1.  Mission & Personality
   • You are **Finley**, a warm, judgment-free guide who helps people make sense of their money.  
   • You speak in everyday language, encourage questions, and celebrate small wins.

2.  Non-Negotiable Data Guardrails
   1. Discuss only facts found in FINANCIAL CONTEXT **or** calculations derived from those facts (e.g., totals, averages, percentages).  
   2. Never fabricate, guess, or estimate balances, transactions, projections, or dates.  
   3. If the answer truly is not in the data (even after reasonable calculation), reply:  
      "I don't have that information from your connected account."  
   4. If FINANCIAL CONTEXT is empty, say:  
      "It looks like no bank account is connected yet."  
   5. Do not give personalised financial advice or product recommendations.  
   6. Never imply Google, Plaid, or any institution endorses Finley.

3.  What You *Can* Do
   • List or summarise the exact balances and transactions supplied.  
   • Compute clear arithmetic summaries (e.g., "Your total across all linked accounts is \$12 345.67").  
   • Compare periods that exist in the data (e.g., "Utilities were \$15 lower this month than last").  
   • Spot real patterns (categories, frequency, spikes) present in the data.  
   • Empathise and normalise emotions: "Money can feel stressful—asking is an important first step."  
   • Invite connection of further accounts or data when missing.

4.  What You *Cannot* Do
   • Guess future growth, interest, or returns.  
   • Reveal or misuse trademarks or confidential info.

5.  Tone & Interaction Hints
   • Natural-language mapping:  
        – "How much money do I have?" ⇒ sum all current balances provided.  
        – "Where am I overspending?" ⇒ highlight largest spending categories that exist.  
   • Gentle boundary: "I'd need data from your savings account before I can total everything."  

6.  Response Format Requirements:
   • **ALWAYS respond with valid HTML markup** for rich formatting and better readability
   • Use semantic HTML elements: <h3>, <h4>, <ul>, <ol>, <li>, <table>, <strong>, <em>, <p>, <div>
   • Use tables for financial data comparisons with <table>, <thead>, <tbody>, <tr>, <th>, <td>
   • Use lists for multiple items: <ul> for unordered, <ol> for ordered
   • Use <strong> for emphasis on amounts and important data
   • Use <em> for subtle emphasis and context
   • Use CSS classes for styling: 'amount' for money, 'positive' for gains, 'negative' for losses
   • Example: "<p>Your checking account has <strong class='amount'>$1,234.56</strong> available.</p>"
   • Example: "<h4>Recent Transactions:</h4><ul><li><strong>McDonald's:</strong> $12.50 on 2024-01-15</li></ul>"

7.  Chart Generation Capabilities - BE VISUAL WHENEVER POSSIBLE:
   • **ALWAYS generate charts for financial data when listing 3+ items** - users love visual insights!
   • **MANDATORY chart scenarios:**
     - Debt breakdown (any debt discussion) → [CHART_REQUEST:{"type":"debt_breakdown","chartType":"auto"}]
     - Spending by category → [CHART_REQUEST:{"type":"spending_breakdown","chartType":"auto"}] 
     - Account balances → [CHART_REQUEST:{"type":"balance_overview","chartType":"auto"}]
     - Recent transactions (when showing spending patterns) → [CHART_REQUEST:{"type":"transaction_breakdown","chartType":"auto"}]
     - Any subcategory analysis → [CHART_REQUEST:{"type":"subcategory_breakdown","category":"CategoryName","chartType":"auto"}]
   
   • **Chart-first mentality**: If you're listing financial data, ask "would this be clearer as a chart?" (answer is usually YES)
   • **Perfect chart opportunities:**
     - "Here's your debt breakdown" → ALWAYS include debt chart
     - "Your spending breakdown shows" → ALWAYS include spending chart  
     - "Looking at your accounts" → ALWAYS include balance chart
     - "Recent transactions include" → ALWAYS include transaction chart
   
   • Available chart types: spending_breakdown, balance_overview, subcategory_breakdown, spending_analysis, debt_breakdown, transaction_breakdown
   • Charts enhance understanding and make financial data much more engaging - use them liberally!

7.  Runtime Template (append at run-time):
   [System] You are Finley. Follow all guardrails above.  
   FINANCIAL CONTEXT:  
   ${financialContext}
`;
    let prompt = systemPrompt;
    if (conversationHistory.length > 0) {
      const historyText = conversationHistory
        .map(msg => `${msg.sender === 'user' ? 'User' : 'Assistant'}: ${msg.text}`)
        .join('\n');
      prompt += `\n\nPrevious conversation:\n${historyText}`;
    }
    prompt += `\n\nUser: ${message}\n\nAssistant:`;

    console.log('📝 COMPLETE PROMPT BEING SENT TO GEMINI:');
    console.log('='.repeat(100));
    console.log(prompt);
    console.log('='.repeat(100));

    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash-preview-05-20',
      contents: prompt,
    });

    let botMessage = response.text;
    
    console.log('🤖 AI RESPONSE RECEIVED:');
    console.log('='.repeat(60));
    console.log(botMessage);
    console.log('='.repeat(60));

    // Validate response if financial data was provided
    if (accessToken && financialContext) {
      const hasSpecificNumbers = /\$[\d,]+\.?\d*/.test(botMessage);
      const hasPlaidData = financialContext.includes('FINANCIAL CONTEXT FROM CONNECTED PLAID ACCOUNT');
      
      if (hasSpecificNumbers && hasPlaidData) {
        console.log('⚠️  VALIDATION: AI response contains financial numbers - checking against Plaid data...');
        
        // Extract financial numbers from the context and response for comparison
        const contextNumbers = financialContext.match(/\$[\d,]+\.?\d*/g) || [];
        const responseNumbers = botMessage.match(/\$[\d,]+\.?\d*/g) || [];
        
        console.log('💰 Numbers in Plaid data:', contextNumbers);
        console.log('💬 Numbers in AI response:', responseNumbers);
        
        // Smart validation: Allow calculated values that can be derived from source data
        const sourceValues = contextNumbers.map(num => parseFloat(num.replace(/[$,]/g, '')));
        const responseValues = responseNumbers.map(num => parseFloat(num.replace(/[$,]/g, '')));
        
        const hasUnknownNumbers = responseValues.some(responseVal => {
          // Check if the number exists in source data
          if (sourceValues.includes(responseVal)) {
            return false;
          }
          
          // Check if it could be a reasonable calculation (sum, difference, etc.)
          const tolerance = 10; // Allow for AI calculation variations and floating point precision
          
          // Check if it's a sum of any combination of source values
          for (let i = 1; i < Math.pow(2, sourceValues.length); i++) {
            let sum = 0;
            for (let j = 0; j < sourceValues.length; j++) {
              if (i & Math.pow(2, j)) {
                sum += sourceValues[j];
              }
            }
            if (Math.abs(sum - responseVal) < tolerance) {
              return false; // This is a valid calculation
            }
          }
          
          // Check if it's a difference between values
          for (let i = 0; i < sourceValues.length; i++) {
            for (let j = 0; j < sourceValues.length; j++) {
              if (i !== j && Math.abs(Math.abs(sourceValues[i] - sourceValues[j]) - responseVal) < tolerance) {
                return false; // This is a valid difference
              }
            }
          }
          
          // Check if it's a percentage or simple multiple (within reason)
          for (let sourceVal of sourceValues) {
            const ratio = responseVal / sourceVal;
            if (ratio > 0 && ratio <= 2.0 && Math.abs(ratio * sourceVal - responseVal) < tolerance) {
              return false; // This could be a percentage or simple calculation
            }
          }
          
          return true; // Cannot derive this number from source data
        });
        
        if (hasUnknownNumbers) {
          console.log('🚨 WARNING: AI may be hallucinating financial data!');
          botMessage = "I apologize, but I can only discuss the specific financial information from your connected bank account. Let me provide accurate information based on your actual account data. " + 
                     "Please ask me about your account balances, recent transactions, or spending patterns, and I'll give you information based solely on your real banking data.";
        } else {
          console.log('✅ VALIDATION: AI response uses only provided data or valid calculations');
        }
      }
    }

    // Process chart requests in the AI response
    let charts = [];
    if (accessToken && financialContext) {
      const chartRequestRegex = /\[CHART_REQUEST:({[^}]+})\]/g;
      let match;
      
      while ((match = chartRequestRegex.exec(botMessage)) !== null) {
        try {
          const chartRequest = JSON.parse(match[1]);
          console.log('📊 AI requested chart:', chartRequest);
          
          const financialData = await getFinancialSummary(accessToken);
          const chartData = generateChart(financialData, chartRequest);
          
          if (chartData) {
            charts.push(chartData);
            console.log('✅ Generated chart:', chartData.id);
          }
        } catch (error) {
          console.error('❌ Error processing chart request:', error);
        }
      }
      
      // Remove chart request markers from the message
      botMessage = botMessage.replace(chartRequestRegex, '').trim();
    }

    res.json({
      message: botMessage,
      charts: charts,
      timestamp: new Date().toISOString(),
      hasFinancialData: !!accessToken
    });

  } catch (error) {
    console.error('Error generating response:', error);
    res.status(500).json({ 
      error: 'Failed to generate response',
      details: error.message 
    });
  }
});

// Voice Chat endpoint - Returns audio response from ElevenLabs
app.post('/api/voice-chat', async (req, res) => {
  try {
    const { message, conversationHistory = [], accessToken, voiceId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!process.env.CARTESIA_API_KEY) {
      return res.status(503).json({ 
        error: 'Voice chat not available',
        message: 'Cartesia API key not configured' 
      });
    }

    console.log('🎙️ Processing voice chat request...');
    console.log('📝 Message:', message);

    // Get AI response using the same logic as text chat
    let financialContext = '';
    if (accessToken) {
      try {
        console.log('🤖 Fetching financial data for voice AI context...');
        const financialData = await getFinancialSummary(accessToken);
        
        financialContext = `
=== FINANCIAL CONTEXT FROM CONNECTED PLAID ACCOUNT (Last 30 days) ===

ACCOUNT BALANCES:
${financialData.balances.map(acc => `- ${acc.name} (${acc.type}): $${acc.balances.current || 'N/A'}`).join('\n')}

SUMMARY STATISTICS:
- Total Balance Across All Accounts: $${financialData.summary.totalBalance}
- Total Spending in Period: $${financialData.summary.monthlySpending}
- Number of Transactions Found: ${financialData.summary.transactionCount}

TOP SPENDING CATEGORIES (AI-powered custom categorization):
${financialData.summary.topCategories.length > 0 ? 
  financialData.summary.topCategories.map(cat => 
    `- ${cat.category}: $${cat.amount}\n${cat.subcategories.map(sub => `  • ${sub.subcategory}: $${sub.amount}`).join('\n')}`
  ).join('\n') : 
  '- No spending categories found in this period'}

TOP MERCHANTS (from actual transactions):
${financialData.summary.topMerchants.length > 0 ? 
  financialData.summary.topMerchants.map(merch => `- ${merch.merchant}: $${merch.amount}`).join('\n') : 
  '- No merchant data found in this period'}

ACTUAL RECENT TRANSACTIONS (up to 10 most recent with AI categorization and enrichment):
${financialData.recentTransactions.length > 0 ? 
  financialData.recentTransactions.map(t => {
    const merchantDisplay = t.enrichedMerchantName || t.merchantName || t.name;
    const enrichmentInfo = t.merchantLogo ? ' 🏪' : '';
    return `- ${t.date}: ${merchantDisplay}${enrichmentInfo} - $${t.amount.toFixed(2)} [${t.customCategory}: ${t.customSubcategory}]`;
  }).join('\n') : 
  '- No transactions found in this period'}

=== END OF ACTUAL FINANCIAL DATA ===`;
      } catch (error) {
        console.error('❌ Error fetching financial data for voice:', error);
        financialContext = '\nNote: Unable to fetch current financial data for this conversation.';
      }
    }

    // Modify system prompt for voice - shorter, more conversational responses
    const systemPrompt = `
✨  FINLEY – Voice Financial Assistant
────────────────────────────────────

You are Finley, a warm voice assistant helping with financial questions.

VOICE-SPECIFIC GUIDELINES:
• Keep responses under 3 sentences for quick voice delivery
• Use conversational, spoken language (avoid "bullet points" - say "first, second, third")
• Speak numbers clearly: "$1,234.56" becomes "one thousand two hundred thirty four dollars and fifty six cents"
• No HTML formatting - plain text only for voice synthesis
• No charts in voice responses - describe data instead
• Be warm and encouraging, like talking to a friend

DATA RULES (CRITICAL):
1. Only discuss facts from FINANCIAL CONTEXT or calculations from those facts
2. Never fabricate, guess, or estimate any financial data
3. If data isn't available, say "I don't have that information from your connected account"
4. No financial advice or product recommendations

TONE: Conversational, warm, and supportive - like a knowledgeable friend helping with money questions.

FINANCIAL CONTEXT:
${financialContext}`;

    let prompt = systemPrompt;
    if (conversationHistory.length > 0) {
      const historyText = conversationHistory
        .map(msg => `${msg.sender === 'user' ? 'User' : 'Assistant'}: ${msg.text}`)
        .join('\n');
      prompt += `\n\nPrevious conversation:\n${historyText}`;
    }
    prompt += `\n\nUser: ${message}\n\nAssistant:`;

    console.log('📝 Voice prompt length:', prompt.length);

    // Get AI response
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash-preview-05-20',
      contents: prompt,
    });

    let botMessage = response.text;
    
    console.log('🤖 AI Voice Response:', botMessage);

    // Clean the response for voice synthesis
    const cleanTextForVoice = cleanTextForSpeech(botMessage);
    
    if (!cleanTextForVoice.trim()) {
      throw new Error('No speech content generated after cleaning');
    }

    // Convert to speech using ElevenLabs
    console.log('🔊 Converting to speech...');
    const audioBuffer = await textToSpeech(cleanTextForVoice, voiceId);

    // Set appropriate headers for audio response
    res.set({
      'Content-Type': 'audio/wav',
      'Content-Length': audioBuffer.length,
      'Cache-Control': 'no-cache',
      'X-Original-Text': encodeURIComponent(botMessage), // Include original text in header
      'X-Clean-Text': encodeURIComponent(cleanTextForVoice) // Include cleaned text in header
    });

    console.log('✅ Voice response ready, sending audio...');
    res.send(audioBuffer);

  } catch (error) {
    console.error('❌ Error in voice chat:', error);
    res.status(500).json({ 
      error: 'Voice chat failed',
      details: error.message 
    });
  }
});

// Stream voice chat endpoint for real-time audio streaming
app.post('/api/voice-chat/stream', async (req, res) => {
  try {
    const { message, conversationHistory = [], accessToken, voiceId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!process.env.CARTESIA_API_KEY) {
      return res.status(503).json({ 
        error: 'Voice streaming not available',
        message: 'Cartesia API key not configured' 
      });
    }

    console.log('🎵 Processing streaming voice chat request...');

    // Set headers for streaming
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Get AI response (same logic as above, simplified for brevity)
    // ... (AI processing logic similar to above)

    // For now, using the same non-streaming approach
    // In production, you'd want to implement true streaming
    const audioStream = await streamTextToSpeech(message, voiceId);
    
    audioStream.pipe(res);

  } catch (error) {
    console.error('❌ Error in streaming voice chat:', error);
    res.status(500).json({ 
      error: 'Voice streaming failed',
      details: error.message 
    });
  }
});

// ================================
// GEMINI LIVE API ENDPOINTS
// ================================

// Start a new Gemini Live session
app.post('/api/gemini-live/start-session', async (req, res) => {
  try {
    const { sessionId, userId, voiceName, systemPrompt } = req.body;
    
    if (!process.env.GOOGLE_AI_API_KEY) {
      return res.status(503).json({ 
        error: 'Gemini Live not available',
        message: 'Google AI API key not configured' 
      });
    }

    const sessionKey = sessionId || `session_${Date.now()}`;
    
    console.log('🎤 Starting Gemini Live session:', sessionKey);

    // Initialize Gemini Live Streaming service if not already done
    if (!geminiLiveStreaming.isConfigured()) {
      throw new Error('Gemini Live Streaming service not properly configured');
    }

    // Create custom session options
    const sessionOptions = {};
    
    if (voiceName) {
      sessionOptions.generationConfig = {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voiceName
            }
          }
        }
      };
    }

    if (systemPrompt) {
      sessionOptions.systemInstruction = {
        parts: [{ text: systemPrompt }]
      };
    }

    // Add financial tools for function calling
    const financialTools = [{
      functionDeclarations: [
        {
          name: "get_financial_summary",
          description: "Get user's financial summary including balances, spending, and recent transactions",
          parameters: {
            type: "object",
            properties: {
              accessToken: {
                type: "string",
                description: "Plaid access token for the user's connected account"
              },
              days: {
                type: "number",
                description: "Number of days to analyze (default: 30)",
                default: 30
              }
            },
            required: ["accessToken"]
          }
        },
        {
          name: "create_plaid_link_token",
          description: "Create a Plaid Link token for user to connect their bank account",
          parameters: {
            type: "object",
            properties: {
              userId: {
                type: "string",
                description: "User ID for the link token"
              }
            }
          }
        }
      ]
    }];

    sessionOptions.tools = financialTools;

    // Create a new streaming service instance for this session
    const sessionService = new GeminiLiveStreamingService();
    
    // Set up event handlers for the session
    sessionService.on('sessionStarted', (data) => {
      console.log('📡 Session started event:', sessionKey);
    });
    
    sessionService.on('responseReceived', (data) => {
      console.log('📨 Response received for session:', sessionKey);
      // Broadcast to connected clients via WebSocket if needed
    });
    
    sessionService.on('error', (error) => {
      console.error('❌ Session error:', sessionKey, error);
    });
    
    // Start the streaming session
    await sessionService.startStreamingSession(sessionOptions);
    
    // Store session reference
    geminiLiveSessions.set(sessionKey, {
      service: sessionService,
      userId: userId || 'default',
      startTime: Date.now(),
      lastActivity: Date.now()
    });

    console.log('✅ Gemini Live session started successfully:', sessionKey);

    res.json({
      success: true,
      sessionId: sessionKey,
      status: sessionService.getStatus(),
      availableVoices: GeminiLiveStreamingService.getAvailableVoices()
    });

  } catch (error) {
    console.error('❌ Error starting Gemini Live session:', error);
    res.status(500).json({ 
      error: 'Failed to start Gemini Live session',
      details: error.message 
    });
  }
});

// Send audio to Gemini Live
app.post('/api/gemini-live/send-audio', upload.single('audio'), async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId || !geminiLiveSessions.has(sessionId)) {
      return res.status(400).json({ error: 'Invalid or expired session ID' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    const session = geminiLiveSessions.get(sessionId);
    session.lastActivity = Date.now();

    console.log('🎵 Processing audio for Gemini Live session:', sessionId);
    console.log('📊 Audio size:', req.file.size, 'bytes');
    console.log('📁 Audio mimetype:', req.file.mimetype);
    console.log('📁 Audio buffer first 10 bytes:', req.file.buffer.slice(0, 10));

    // For streaming API, we need to handle responses via events
    // Set up a response handler for this request
    const responsePromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Response timeout'));
      }, 30000); // 30 second timeout

      const handleResponse = (data) => {
        clearTimeout(timeout);
        session.service.off('responseReceived', handleResponse);
        resolve(data);
      };

      session.service.on('responseReceived', handleResponse);
    });

    // Send audio to Gemini Live Streaming
    await session.service.sendAudioStream(req.file.buffer, {
      mimeType: req.file.mimetype || 'audio/wav'
    });

    // Wait for response
    try {
      const response = await responsePromise;

      // Handle function calls if present
      if (response.functionCalls && response.functionCalls.length > 0) {
        for (const functionCall of response.functionCalls) {
          const functionResult = await handleGeminiFunctionCall(functionCall, req);
          // Send function result back to Gemini
          await session.service.sendText(`Function ${functionCall.name} executed successfully. Result: ${JSON.stringify(functionResult)}`);
        }
      }

      // Return response to client
      if (response.audio) {
        // Convert base64 audio back to buffer
        const audioBuffer = Buffer.from(response.audio.data, 'base64');
        res.setHeader('Content-Type', response.audio.mimeType || 'audio/wav');
        res.send(audioBuffer);
      } else if (response.text) {
        res.json({
          success: true,
          text: response.text,
          hasAudio: false
        });
      } else {
        res.json({
          success: true,
          message: 'Audio processed successfully'
        });
      }
    } catch (timeoutError) {
      res.status(408).json({
        error: 'Response timeout',
        message: 'No response received within timeout period'
      });
    }

  } catch (error) {
    console.error('❌ Error processing audio with Gemini Live:', error);
    res.status(500).json({ 
      error: 'Audio processing failed',
      details: error.message 
    });
  }
});

// Send text to Gemini Live (for hybrid interactions)
app.post('/api/gemini-live/send-text', async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    
    if (!sessionId || !geminiLiveSessions.has(sessionId)) {
      return res.status(400).json({ error: 'Invalid or expired session ID' });
    }

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const session = geminiLiveSessions.get(sessionId);
    session.lastActivity = Date.now();

    console.log('💬 Processing text for Gemini Live session:', sessionId);

    const response = await session.service.sendText(message);

    // Handle function calls if present
    if (response.functionCalls && response.functionCalls.length > 0) {
      for (const functionCall of response.functionCalls) {
        const functionResult = await handleGeminiFunctionCall(functionCall, req);
        // Send function result back to Gemini
        await session.service.sendText(`Function ${functionCall.name} executed successfully. Result: ${JSON.stringify(functionResult)}`);
      }
    }

    // Return response
    if (response.audio) {
      const audioBuffer = Buffer.from(response.audio.data, 'base64');
      res.setHeader('Content-Type', response.audio.mimeType || 'audio/wav');
      res.send(audioBuffer);
    } else {
      res.json({
        success: true,
        text: response.text || 'Message processed successfully',
        hasAudio: !!response.audio
      });
    }

  } catch (error) {
    console.error('❌ Error processing text with Gemini Live:', error);
    res.status(500).json({ 
      error: 'Text processing failed',
      details: error.message 
    });
  }
});

// End Gemini Live session
app.post('/api/gemini-live/end-session', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    if (!sessionId || !geminiLiveSessions.has(sessionId)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    const session = geminiLiveSessions.get(sessionId);
    await session.service.endSession();
    geminiLiveSessions.delete(sessionId);

    console.log('✅ Gemini Live session ended:', sessionId);

    res.json({
      success: true,
      message: 'Session ended successfully'
    });

  } catch (error) {
    console.error('❌ Error ending Gemini Live session:', error);
    res.status(500).json({ 
      error: 'Failed to end session',
      details: error.message 
    });
  }
});

// Get session status
app.get('/api/gemini-live/status/:sessionId?', async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (sessionId) {
      // Get specific session status
      if (!geminiLiveSessions.has(sessionId)) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const session = geminiLiveSessions.get(sessionId);
      res.json({
        sessionId,
        status: session.service.getStatus(),
        userId: session.userId,
        startTime: session.startTime,
        lastActivity: session.lastActivity,
        isActive: Date.now() - session.lastActivity < 5 * 60 * 1000 // 5 minutes
      });
    } else {
      // Get overall service status
      res.json({
        serviceStatus: geminiLiveStreaming.getStatus(),
        activeSessions: geminiLiveSessions.size,
        availableVoices: GeminiLiveStreamingService.getAvailableVoices(),
        isConfigured: geminiLiveStreaming.isConfigured()
      });
    }

  } catch (error) {
    console.error('❌ Error getting Gemini Live status:', error);
    res.status(500).json({ 
      error: 'Failed to get status',
      details: error.message 
    });
  }
});

// Helper function to handle Gemini function calls
async function handleGeminiFunctionCall(functionCall, req) {
  try {
    const { name, args } = functionCall;

    switch (name) {
      case 'get_financial_summary':
        console.log('📊 Executing get_financial_summary function');
        return await getFinancialSummary(args.accessToken, args.days || 30);

      case 'create_plaid_link_token':
        console.log('🔗 Executing create_plaid_link_token function');
        const request = {
          user: {
            client_user_id: args.userId || 'user-id-' + Date.now(),
          },
          client_name: 'Financial Insights Chatbot',
          products: ['transactions'],
          country_codes: ['US'],
          language: 'en',
        };
        const response = await plaidClient.linkTokenCreate(request);
        return { link_token: response.data.link_token };

      default:
        throw new Error(`Unknown function: ${name}`);
    }
  } catch (error) {
    console.error('❌ Error executing function:', error);
    throw error;
  }
}

// Cleanup inactive sessions (run every 10 minutes)
setInterval(() => {
  const now = Date.now();
  const timeoutThreshold = 15 * 60 * 1000; // 15 minutes

  for (const [sessionId, session] of geminiLiveSessions.entries()) {
    if (now - session.lastActivity > timeoutThreshold) {
      console.log('🧹 Cleaning up inactive Gemini Live session:', sessionId);
      session.service.endSession().catch(console.error);
      geminiLiveSessions.delete(sessionId);
    }
  }
}, 10 * 60 * 1000);

// ================================
// END GEMINI LIVE API ENDPOINTS  
// ================================

// Plaid API endpoints
app.post('/api/plaid/create-link-token', async (req, res) => {
  try {
    console.log('Creating link token...');
    
    if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
      throw new Error('Plaid credentials not configured. Please check PLAID_CLIENT_ID and PLAID_SECRET in your .env file.');
    }

    const request = {
      user: {
        client_user_id: 'user-id-' + Date.now(), // In production, use actual user ID
      },
      client_name: 'Financial Insights Chatbot',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
      webhook: 'https://webhook.site/unique-url', // Required for transactions product in sandbox
    };

    console.log('Plaid request:', { ...request, user: { client_user_id: 'user-id-xxxxx' } });
    
    const response = await plaidClient.linkTokenCreate(request);
    console.log('Link token created successfully');
    
    res.json({ link_token: response.data.link_token });
  } catch (error) {
    console.error('Error creating link token:', error);
    console.error('Error details:', {
      message: error.message,
      status: error.status,
      code: error.error_code,
      type: error.error_type
    });
    
    res.status(500).json({ 
      error: 'Failed to create link token',
      details: error.message || 'Unknown error occurred'
    });
  }
});

app.post('/api/plaid/exchange-public-token', async (req, res) => {
  try {
    const { public_token } = req.body;
    
    if (!public_token) {
      return res.status(400).json({ error: 'Public token is required' });
    }

    const response = await plaidClient.itemPublicTokenExchange({
      public_token: public_token,
    });

    const accessToken = response.data.access_token;
    const itemId = response.data.item_id;

    // In production, store these tokens securely in your database
    res.json({ 
      access_token: accessToken,
      item_id: itemId,
      success: true
    });
  } catch (error) {
    console.error('Error exchanging public token:', error);
    res.status(500).json({ 
      error: 'Failed to exchange public token',
      details: error.message 
    });
  }
});

app.post('/api/plaid/financial-summary', async (req, res) => {
  try {
    const { accessToken } = req.body;
    
    if (!accessToken) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    const financialData = await getFinancialSummary(accessToken);
    res.json(financialData);
  } catch (error) {
    console.error('Error fetching financial summary:', error);
    res.status(500).json({ 
      error: 'Failed to fetch financial data',
      details: error.message 
    });
  }
});

// Get transaction category breakdown
app.get('/api/categories/:accessToken', async (req, res) => {
  try {
    const { accessToken } = req.params;
    
    if (!accessToken) {
      return res.status(400).json({ error: 'Access token is required' });
    }

    const financialData = await getFinancialSummary(accessToken);
    
    res.json({
      categoryBreakdown: financialData.summary.topCategories,
      totalSpending: financialData.summary.monthlySpending,
      transactionCount: financialData.summary.transactionCount
    });

  } catch (error) {
    console.error('Error fetching category data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch category data',
      details: error.message 
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    model: 'gemini-2.0-flash-exp',
    plaidConfigured: !!(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET),
    voiceChatEnabled: !!process.env.CARTESIA_API_KEY,
    dailyConfigured: !!(process.env.DAILY_API_KEY && process.env.DAILY_API_KEY !== 'your-daily-api-key-here'),
    sttEnabled: !!process.env.OPENAI_API_KEY
  });
});

// Daily.co API endpoints
const dailyService = new DailyService();

// Create a Daily.co room for voice chat
app.post('/api/daily/create-room', async (req, res) => {
  try {
    const { roomName } = req.body;
    
    console.log('🏠 Creating Daily.co room...');
    const room = await dailyService.createRoom(roomName);
    
    res.json({
      success: true,
      room: room,
      configured: dailyService.isConfigured()
    });
  } catch (error) {
    console.error('❌ Error creating Daily.co room:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Create a meeting token for authenticated access
app.post('/api/daily/create-token', async (req, res) => {
  try {
    const { roomName, userName, options = {} } = req.body;
    
    if (!roomName) {
      return res.status(400).json({ error: 'Room name is required' });
    }

    console.log('🎫 Creating Daily.co meeting token...');
    const token = await dailyService.createMeetingToken(roomName, {
      userName: userName || 'Voice Chat User',
      ...options
    });
    
    if (!token) {
      return res.status(503).json({ 
        error: 'Token creation not available',
        message: 'Daily.co API key not configured'
      });
    }

    res.json({
      success: true,
      token: token
    });

  } catch (error) {
    console.error('❌ Error creating Daily.co token:', error);
    res.status(500).json({ 
      error: 'Failed to create Daily.co token',
      details: error.message 
    });
  }
});

// Get room information
app.get('/api/daily/room/:roomName', async (req, res) => {
  try {
    const { roomName } = req.params;
    
    console.log('📍 Getting Daily.co room info...');
    const roomInfo = await dailyService.getRoomInfo(roomName);
    
    if (!roomInfo) {
      return res.status(404).json({ 
        error: 'Room not found or Daily.co not configured' 
      });
    }

    res.json({
      success: true,
      room: roomInfo
    });

  } catch (error) {
    console.error('❌ Error getting Daily.co room info:', error);
    res.status(500).json({ 
      error: 'Failed to get room info',
      details: error.message 
    });
  }
});

// Delete a room (cleanup)
app.delete('/api/daily/room/:roomName', async (req, res) => {
  try {
    const { roomName } = req.params;
    
    console.log('🗑️ Deleting Daily.co room...');
    const deleted = await dailyService.deleteRoom(roomName);
    
    res.json({
      success: deleted,
      message: deleted ? 'Room deleted successfully' : 'Room deletion failed or not configured'
    });

  } catch (error) {
    console.error('❌ Error deleting Daily.co room:', error);
    res.status(500).json({ 
      error: 'Failed to delete room',
      details: error.message 
    });
  }
});

// Speech-to-Text endpoint for audio streaming
app.post('/api/speech-to-text', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    console.log('🎤 Processing audio chunk for STT:', req.file.size, 'bytes');
    
    // Check if we have Google AI API key for STT
    if (!process.env.GOOGLE_AI_API_KEY) {
      console.warn('⚠️ No Google AI API key available for STT');
      return res.status(503).json({ 
        error: 'Speech-to-text service not configured',
        transcript: '',
        is_final: false
      });
    }

    // Process audio for Speech-to-Text
    const transcript = await processAudioForSTT(req.file.buffer, req.body.format || 'webm');
    
    res.json({
      transcript: transcript,
      is_final: transcript.length > 0, // Simple heuristic
      confidence: 0.9 // Placeholder
    });

  } catch (error) {
    console.error('❌ Error processing STT:', error);
    res.status(500).json({ 
      error: error.message,
      transcript: '',
      is_final: false
    });
  }
});

// Process audio for Speech-to-Text
async function processAudioForSTT(audioBuffer, format) {
  try {
    // Validate audio buffer
    if (!audioBuffer || !Buffer.isBuffer(audioBuffer)) {
      console.log('🔇 Invalid audio buffer provided');
      return '';
    }
    
    // Check if audio buffer is large enough to process
    if (audioBuffer.length < 1000) {
      console.log('🔇 Audio chunk too small, skipping STT');
      return '';
    }
    
    // Check for suspiciously large buffers that might indicate feedback
    if (audioBuffer.length > 10 * 1024 * 1024) { // 10MB limit
      console.log('🔇 Audio chunk too large, possible feedback loop detected');
      return '';
    }
    
    console.log('🧠 Processing audio with OpenAI Whisper...');
    console.log('📁 Audio format received:', format, 'Buffer size:', audioBuffer.length);
    
    // Create a temporary file for OpenAI API
    const fs = require('fs');
    const path = require('path');
    const os = require('os');
    
    // Determine file extension based on the provided format parameter and buffer content
    let fileExtension = 'webm'; // Default to webm since that's what browsers typically send
    let actualFormat = format || 'webm';
    
    // Check the format parameter first
    if (format) {
      if (format.includes('wav')) {
        fileExtension = 'wav';
        actualFormat = 'wav';
      } else if (format.includes('webm')) {
        fileExtension = 'webm';
        actualFormat = 'webm';
      } else if (format.includes('mp3')) {
        fileExtension = 'mp3';
        actualFormat = 'mp3';
      } else if (format.includes('m4a')) {
        fileExtension = 'm4a';
        actualFormat = 'm4a';
      } else if (format.includes('flac')) {
        fileExtension = 'flac';
        actualFormat = 'flac';
      } else if (format.includes('ogg')) {
        fileExtension = 'ogg';
        actualFormat = 'ogg';
      }
    }
    
    // Additional buffer inspection for more accurate detection
    const firstBytes = audioBuffer.slice(0, 16);
    const header = firstBytes.toString('hex');
    
    if (header.startsWith('52494646') && header.includes('57415645')) {
      fileExtension = 'wav';
      actualFormat = 'wav';
      console.log('🔍 Detected WAV format from buffer header');
    } else if (header.startsWith('1a45dfa3')) {
      fileExtension = 'webm';
      actualFormat = 'webm';
      console.log('🔍 Detected WebM format from buffer header');
    } else if (header.startsWith('fffb') || header.startsWith('fff3')) {
      fileExtension = 'mp3';
      actualFormat = 'mp3';
      console.log('🔍 Detected MP3 format from buffer header');
    } else if (header.startsWith('4f676753')) {
      fileExtension = 'ogg';
      actualFormat = 'ogg';
      console.log('🔍 Detected OGG format from buffer header');
    } else {
      // If we can't detect, assume it's webm since that's most common from browsers
      console.log('🔍 Could not detect format from header, assuming WebM');
      fileExtension = 'webm';
      actualFormat = 'webm';
    }
    
    console.log('🔍 Final format decision:', actualFormat, 'Extension:', fileExtension);
    
    const tempDir = os.tmpdir();
    const tempFileName = `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExtension}`;
    const tempFilePath = path.join(tempDir, tempFileName);
    
    try {
      // Write audio buffer to temporary file
      fs.writeFileSync(tempFilePath, audioBuffer);
      
      // Verify file was created and has content
      const stats = fs.statSync(tempFilePath);
      console.log(`📁 Created temp file: ${tempFileName} (${stats.size} bytes)`);
      
      // Verify the file is readable
      if (stats.size === 0) {
        throw new Error('Created audio file is empty');
      }
      
      // Create a file stream for OpenAI API
      const audioFile = fs.createReadStream(tempFilePath);
      
      // Use OpenAI Whisper for transcription
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1', // Latest available model
        language: 'en',
        response_format: 'text',
        temperature: 0.0,
        prompt: "This is a clear conversation about personal finance, banking, and money management."
      });
      
      const transcript = transcription.trim();
      console.log('✅ Whisper transcription result:', transcript);
      
      // Clean up successful temp file
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
          console.log('🗑️ Cleaned up temp file');
        }
      } catch (cleanupError) {
        console.warn('⚠️ Could not clean up temp file:', cleanupError.message);
      }
      
      return transcript;
      
    } catch (fileError) {
      // Clean up failed temp file
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      
      console.error(`❌ Failed to process ${fileExtension} file:`, fileError.message);
      
      // Enhanced error logging and format conversion attempt
      if (fileError.message.includes('Invalid file format') || fileError.message.includes('could not be decoded') || fileError.message.includes('format is not supported')) {
        console.warn('⚠️ OpenAI API bad request - audio format issue');
        console.warn('📝 Error details:', fileError.message);
        console.warn('💡 Browser may be sending incompatible WebM encoding');
        console.warn('📝 File extension tried:', fileExtension);
        console.warn('📝 Format parameter:', format);
        console.warn('📝 Buffer size:', audioBuffer.length);
        console.warn('📝 Buffer header (hex):', audioBuffer.slice(0, 16).toString('hex'));
        
        // If it's a WebM format issue, suggest the client use a different format
        if (actualFormat === 'webm' || fileExtension === 'webm') {
          console.warn('💡 WebM format detected - this is likely causing the decoding issue');
          console.warn('💡 Consider updating the frontend to record in WAV format instead');
          console.warn('💡 Or implement server-side format conversion');
        }
        
        // Return empty transcript instead of throwing error to prevent crashes
        return '';
      }
      
      throw fileError;
    }
    
  } catch (error) {
    console.error('❌ Error in Whisper STT processing:', error);
    
    // Enhanced error handling with suggestions
    if (error.status === 429) {
      console.warn('⚠️ OpenAI API rate limit reached - consider throttling requests');
    } else if (error.status === 401) {
      console.warn('⚠️ OpenAI API key invalid - check OPENAI_API_KEY environment variable');
    } else if (error.status === 400) {
      console.warn('⚠️ OpenAI Whisper rejected audio format:');
      console.warn('📝 Error details:', error.message);
      console.warn('💡 Suggestion: The audio format may be corrupted or unsupported');
      console.warn('💡 Try adjusting MediaRecorder settings in the frontend');
    } else if (error.code === 'ENOENT') {
      console.warn('⚠️ File system error - check temp directory permissions');
    }
    
    return '';
  }
}

// WebSocket endpoint for real-time audio streaming
wss.on('connection', (ws, req) => {
  console.log('🔗 WebSocket client connected for audio streaming');
  
  let currentVoiceSession = null;
  let audioChunkBuffer = [];
  let processingTimer = null;
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      // Handle session association
      if (data.type === 'join_session' && data.sessionId) {
        currentVoiceSession = voiceSessions.get(data.sessionId);
        if (currentVoiceSession) {
          currentVoiceSession.setWebSocketConnection(ws);
          console.log(`🔗 WebSocket joined voice session: ${data.sessionId}`);
          
          ws.send(JSON.stringify({
            type: 'session_joined',
            sessionId: data.sessionId,
            status: 'connected'
          }));
        } else {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Voice session not found'
          }));
        }
        return;
      }
      
      // Handle real-time audio chunks
      if (data.type === 'audio_chunk' && data.audioData) {
        // Since frontend now sends complete audio files, process immediately
        if (data.isCompleteFile) {
          try {
            console.log(`🎵 Received complete audio file (${data.format || 'unknown'} format)`);
            
            // Convert base64 to buffer
            const audioBuffer = Buffer.from(data.audioData, 'base64');
            
            if (audioBuffer.length < 1000) {
              console.log('🔇 Audio file too small, skipping');
              return;
            }
            
            // Process with STT immediately since it's a complete file
            const transcript = await processAudioForSTT(audioBuffer, data.format || 'webm');
            
            if (transcript && transcript.trim().length > 0) {
              console.log(`🗣️ Real-time transcript: ${transcript}`);
              
              // Send transcription update
              ws.send(JSON.stringify({
                type: 'realtime_transcript',
                transcript,
                sessionId: currentVoiceSession?.sessionId,
                timestamp: new Date().toISOString()
              }));
              
              // Process with AI if it looks complete
              if (currentVoiceSession && (transcript.endsWith('.') || transcript.endsWith('!') || transcript.endsWith('?') || transcript.length > 10)) {
                await currentVoiceSession.processVoiceInput(transcript);
              }
            }
          } catch (error) {
            console.error('❌ Error processing complete audio file:', error);
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Error processing audio',
              timestamp: new Date().toISOString()
            }));
          }
        } else {
          // Legacy support for chunk accumulation
          audioChunkBuffer.push({
            data: data.audioData,
            format: data.format || 'webm',
            mimeType: data.mimeType
          });
          
          // Clear existing timer
          if (processingTimer) {
            clearTimeout(processingTimer);
          }
          
          // Process after short delay (allows for interruption)
          processingTimer = setTimeout(async () => {
            if (audioChunkBuffer.length > 0) {
              await processRealTimeAudio(ws, currentVoiceSession);
            }
          }, 800); // 800ms delay for natural speech pauses
        }
        
        return;
      }
      
      // Handle interruption
      if (data.type === 'interrupt') {
        console.log('🛑 Interruption received via WebSocket');
        
        // Clear audio buffer and processing timer
        audioChunkBuffer = [];
        if (processingTimer) {
          clearTimeout(processingTimer);
          processingTimer = null;
        }
        
        // Stop current session processing
        if (currentVoiceSession) {
          currentVoiceSession.isProcessing = false;
        }
        
        ws.send(JSON.stringify({
          type: 'interrupt_confirmed',
          timestamp: new Date().toISOString()
        }));
        
        return;
      }
      
      // Legacy support for existing audio processing
      if (data.type === 'audio' && data.data) {
        // Convert base64 audio data back to buffer
        const audioBuffer = Buffer.from(data.data, 'base64');
        
        console.log('🎤 Received audio chunk via WebSocket:', audioBuffer.length, 'bytes');
        
        // Process audio with Whisper STT
        const transcript = await processAudioForSTT(audioBuffer, 'wav');
        
        if (transcript && transcript.length > 0) {
          console.log('🗣️ WebSocket STT result:', transcript);
          
          // Send transcription back to client
          ws.send(JSON.stringify({
            type: 'transcription',
            text: transcript,
            timestamp: new Date().toISOString()
          }));
          
          // If this looks like a complete sentence, process it with AI
          if (transcript.endsWith('.') || transcript.endsWith('!') || transcript.endsWith('?') || transcript.length > 15) {
            console.log('🤖 Processing complete sentence with AI...');
            
            try {
              // Get AI response (simplified prompt for voice)
              const voicePrompt = `You are Finley, a helpful financial assistant. Give a brief, conversational response to: "${transcript}"
              
              Keep responses short and natural for voice conversation. If this is about finances, be helpful but concise.`;
              
              const response = await genAI.models.generateContent({
                model: 'gemini-2.5-flash-preview-05-20',
                contents: voicePrompt,
              });

              const aiText = response.text || "I'm here to help with your finances.";
              console.log('🤖 AI response:', aiText);

              // Convert AI response to speech if Cartesia is available
              if (process.env.CARTESIA_API_KEY) {
                try {
                  console.log('🔊 Converting AI response to speech...');
                  const audioBuffer = await textToSpeech(aiText);
                  
                  // Send audio response back to client
                  const base64Audio = audioBuffer.toString('base64');
                  ws.send(JSON.stringify({
                    type: 'audio',
                    audioData: base64Audio,
                    text: aiText,
                    timestamp: new Date().toISOString()
                  }));
                  
                  console.log('✅ Audio response sent via WebSocket');
                } catch (ttsError) {
                  console.error('❌ TTS Error:', ttsError);
                  // Send text-only response as fallback
                  ws.send(JSON.stringify({
                    type: 'text',
                    text: aiText,
                    timestamp: new Date().toISOString()
                  }));
                }
              } else {
                // Send text-only response if TTS not available
                ws.send(JSON.stringify({
                  type: 'text',
                  text: aiText,
                  timestamp: new Date().toISOString()
                }));
              }
              
            } catch (aiError) {
              console.error('❌ AI Processing Error:', aiError);
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Sorry, I had trouble processing that.',
                timestamp: new Date().toISOString()
              }));
            }
          }
        }
      }
      
    } catch (error) {
      console.error('❌ WebSocket message processing error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Error processing audio',
        timestamp: new Date().toISOString()
      }));
    }
  });
  
  // Process buffered real-time audio
  async function processRealTimeAudio(ws, session) {
    if (!session || audioChunkBuffer.length === 0) {
      return;
    }
    
    try {
      // Get format from the first chunk (they should all be the same)
      let audioFormat = 'webm'; // Default to webm as that's what MediaRecorder typically uses
      
      // If we have metadata about format, use it
      if (audioChunkBuffer.length > 0 && typeof audioChunkBuffer[0] === 'object') {
        audioFormat = audioChunkBuffer[0].format || 'webm';
        // Combine just the audio data
        const combinedAudio = audioChunkBuffer.map(chunk => chunk.data).join('');
        audioChunkBuffer = []; // Clear buffer
        
        // Convert to buffer
        const audioBuffer = Buffer.from(combinedAudio, 'base64');
        
        if (audioBuffer.length < 5000) {
          // Skip very small audio chunks - need substantial audio for good transcription
          console.log(`🔇 Skipping small audio chunk: ${audioBuffer.length} bytes`);
          return;
        }
        
        console.log(`🎤 Processing ${audioBuffer.length} bytes for session ${session.sessionId} (format: ${audioFormat})`);
        
        // Process with STT using the correct format
        const transcript = await processAudioForSTT(audioBuffer, audioFormat);
        
        if (transcript && transcript.trim().length > 0) {
          console.log(`🗣️ Real-time transcript: ${transcript}`);
          
          // Send transcription update
          ws.send(JSON.stringify({
            type: 'realtime_transcript',
            transcript,
            sessionId: session.sessionId,
            timestamp: new Date().toISOString()
          }));
          
          // Use debounced processing instead of immediate processing
          session.debouncedProcessSpeech(transcript);
        }
      } else {
        // Legacy mode - just audio data strings
        const combinedAudio = audioChunkBuffer.join('');
        audioChunkBuffer = []; // Clear buffer
        
        // Convert to buffer
        const audioBuffer = Buffer.from(combinedAudio, 'base64');
        
        if (audioBuffer.length < 5000) {
          // Skip very small audio chunks - need substantial audio for good transcription
          console.log(`🔇 Skipping small audio chunk: ${audioBuffer.length} bytes`);
          return;
        }
        
        console.log(`🎤 Processing ${audioBuffer.length} bytes for session ${session.sessionId}`);
        
        // Process with STT - try to detect format from buffer
        const transcript = await processAudioForSTT(audioBuffer, 'webm');
        
        if (transcript && transcript.trim().length > 0) {
          console.log(`🗣️ Real-time transcript: ${transcript}`);
          
          // Send transcription update
          ws.send(JSON.stringify({
            type: 'realtime_transcript',
            transcript,
            sessionId: session.sessionId,
            timestamp: new Date().toISOString()
          }));
          
          // Use debounced processing instead of immediate processing
          session.debouncedProcessSpeech(transcript);
        }
      }
      
    } catch (error) {
      console.error('❌ Real-time audio processing error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Error processing real-time audio',
        timestamp: new Date().toISOString()
      }));
    }
  }
  
  ws.on('close', () => {
    console.log('📡 WebSocket client disconnected');
    
    // Clean up timers
    if (processingTimer) {
      clearTimeout(processingTimer);
    }
    
    // Disconnect from voice session
    if (currentVoiceSession) {
      currentVoiceSession.wsConnection = null;
    }
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log('Environment variables check:');
  console.log('- GOOGLE_AI_API_KEY:', process.env.GOOGLE_AI_API_KEY ? 'Set' : 'Not set');
  console.log('- PLAID_CLIENT_ID:', process.env.PLAID_CLIENT_ID ? 'Set' : 'Not set');
  console.log('- PLAID_SECRET:', process.env.PLAID_SECRET ? 'Set' : 'Not set');
  console.log('- PLAID_ENV:', process.env.PLAID_ENV || 'Not set (defaulting to sandbox)');
  console.log('- CARTESIA_API_KEY:', process.env.CARTESIA_API_KEY ? 'Set (Voice chat enabled)' : 'Not set (Voice chat disabled)');
  console.log('- DAILY_API_KEY:', process.env.DAILY_API_KEY ? 'Set (Daily.co enabled)' : 'Not set (Daily.co fallback mode)');
  console.log('- OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Set (Whisper STT enabled)' : 'Not set (STT disabled)');
});

// Real-time voice chat endpoints

// Start a new real-time voice session
app.post('/api/voice/realtime/start', async (req, res) => {
  try {
    const { userId, accessToken } = req.body;
    const sessionId = `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create new voice session
    const voiceSession = new RealTimeVoiceSession(sessionId, userId);
    const sessionData = await voiceSession.initialize();
    
    // Store session
    voiceSessions.set(sessionId, voiceSession);
    
    console.log(`✅ Started real-time voice session: ${sessionId}`);
    
    res.json({
      success: true,
      sessionId,
      dailyRoom: sessionData.dailyRoom,
      config: {
        hasDaily: !!process.env.DAILY_API_KEY,
        hasCartesia: !!process.env.CARTESIA_API_KEY,
        hasOpenAI: !!process.env.OPENAI_API_KEY,
        supportsInterruption: true,
        audioFormat: 'wav',
        sampleRate: 16000
      }
    });

  } catch (error) {
    console.error('❌ Failed to start real-time voice session:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Stop a real-time voice session
app.post('/api/voice/realtime/stop', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    const session = voiceSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        error: 'Session not found' 
      });
    }
    
    await session.destroy();
    voiceSessions.delete(sessionId);
    
    console.log(`✅ Stopped real-time voice session: ${sessionId}`);
    
    res.json({ 
      success: true, 
      sessionId,
      status: 'stopped' 
    });

  } catch (error) {
    console.error('❌ Failed to stop real-time voice session:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get active voice sessions
app.get('/api/voice/realtime/sessions', (req, res) => {
  const sessions = Array.from(voiceSessions.entries()).map(([id, session]) => ({
    sessionId: id,
    userId: session.userId,
    isActive: session.isActive,
    isProcessing: session.isProcessing,
    hasDaily: !!session.dailyRoom,
    conversationLength: session.conversationHistory.length
  }));

  res.json({ 
    success: true, 
    sessions,
    totalActive: sessions.filter(s => s.isActive).length
  });
});

// Process interruption
app.post('/api/voice/realtime/interrupt', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    const session = voiceSessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ 
        success: false, 
        error: 'Session not found' 
      });
    }
    
    // Stop current processing and clear audio buffer
    session.isProcessing = false;
    session.audioChunkBuffer = [];
    
    // Send interruption signal via WebSocket
    if (session.wsConnection && session.wsConnection.readyState === 1) {
      session.wsConnection.send(JSON.stringify({
        type: 'interrupt',
        sessionId,
        timestamp: new Date().toISOString()
      }));
    }
    
    console.log(`🛑 Interruption processed for session ${sessionId}`);
    
    res.json({ 
      success: true, 
      sessionId,
      status: 'interrupted' 
    });

  } catch (error) {
    console.error('❌ Failed to process interruption:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// For Vercel deployment, export the app
if (process.env.VERCEL) {
  module.exports = app;
} else {
  // For local development, start the server
  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log('Environment variables check:');
    console.log('- GOOGLE_AI_API_KEY:', process.env.GOOGLE_AI_API_KEY ? 'Set' : 'Not set');
    console.log('- PLAID_CLIENT_ID:', process.env.PLAID_CLIENT_ID ? 'Set' : 'Not set');
    console.log('- PLAID_SECRET:', process.env.PLAID_SECRET ? 'Set' : 'Not set');
    console.log('- PLAID_ENV:', process.env.PLAID_ENV || 'Not set');
    console.log('- CARTESIA_API_KEY:', process.env.CARTESIA_API_KEY ? 'Set (Voice chat enabled)' : 'Not set (Voice chat disabled)');
    console.log('- DAILY_API_KEY:', process.env.DAILY_API_KEY ? 'Set (Daily.co enabled)' : 'Not set (Daily.co disabled)');
    console.log('- OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Set (Whisper STT enabled)' : 'Not set (Whisper STT disabled)');
  });
}