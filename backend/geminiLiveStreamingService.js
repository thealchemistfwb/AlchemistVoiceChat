const { GoogleGenAI, Modality } = require('@google/genai');
const { EventEmitter } = require('events');

class GeminiLiveStreamingService extends EventEmitter {
  constructor() {
    super();
    this.apiKey = process.env.GOOGLE_AI_API_KEY;
    this.client = null;
    this.session = null;
    this.isConnected = false;
    this.sessionConfig = {
      model: "gemini-2.0-flash-live-001", // For Google AI API
      systemInstruction: `You are Finley, a helpful financial assistant. You help users understand their financial situation, analyze transactions, and provide insights about spending patterns and budgeting.

Key Guidelines:
- Be conversational and friendly in voice interactions
- Provide clear, actionable financial advice
- Ask follow-up questions to better understand user needs
- When users want to analyze their bank data, guide them through connecting their accounts
- Keep responses concise for voice interactions (2-3 sentences max)
- Use natural speech patterns, avoid overly technical jargon
- Show empathy when discussing financial challenges

You have access to tools to help users:
- Connect their bank accounts securely via Plaid
- Analyze transaction data and spending patterns
- Provide personalized financial insights
- Answer questions about budgeting and financial planning`,
      voiceName: "Kore",
      tools: []
    };
  }

  // Check if service is properly configured
  isConfigured() {
    return !!this.apiKey && this.apiKey !== 'your-google-ai-api-key-here';
  }

  // Initialize the Gemini Live client
  async initialize() {
    try {
      if (!this.isConfigured()) {
        throw new Error('Google AI API key not configured. Please check GOOGLE_AI_API_KEY environment variable.');
      }

      this.client = new GoogleGenAI({
        apiKey: this.apiKey
      });

      console.log('✅ Gemini Live client initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Gemini Live client:', error);
      throw error;
    }
  }

  // Start a new Live API streaming session
  async startStreamingSession(sessionOptions = {}) {
    try {
      if (!this.client) {
        await this.initialize();
      }

      console.log('🎤 Starting Gemini Live streaming session...');

      // Merge custom options with default config
      const config = {
        ...this.sessionConfig,
        ...sessionOptions
      };

      // Initialize response queue for handling messages
      this.responseQueue = [];

      // Prepare Live API config
      const liveConfig = {
        responseModalities: [Modality.AUDIO], // We want audio responses
        systemInstruction: config.systemInstruction // Direct string, not object
      };

      // Add speech config if voice is specified
      if (config.voiceName) {
        liveConfig.speechConfig = {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: config.voiceName
            }
          }
        };
      }

      // Add tools if provided
      if (config.tools && config.tools.length > 0) {
        liveConfig.tools = config.tools;
      }

      // Connect to Live API with WebSocket using correct syntax
      this.session = await this.client.live.connect({
        model: config.model,
        callbacks: {
          onopen: () => {
            console.log('🔗 Gemini Live WebSocket connection opened');
            this.isConnected = true;
            this.emit('sessionStarted', { sessionId: Date.now() });
          },
          onmessage: (message) => {
            console.log('📨 Received message from Gemini Live:', message);
            this.responseQueue.push(message);
            this.handleLiveMessage(message);
          },
          onerror: (error) => {
            console.error('❌ Gemini Live WebSocket error:', error.message);
            this.emit('error', error);
          },
          onclose: (event) => {
            console.log('📡 Gemini Live WebSocket connection closed:', event.reason || 'Connection closed');
            this.isConnected = false;
            this.emit('sessionEnded');
          }
        },
        config: liveConfig
      });

      console.log('✅ Gemini Live streaming session started successfully');
      return this.session;

    } catch (error) {
      console.error('❌ Error starting Gemini Live streaming session:', error);
      this.isConnected = false;
      this.emit('error', error);
      throw error;
    }
  }

  // Handle incoming messages from Gemini Live
  handleLiveMessage(message) {
    try {
      // Handle different types of Live API messages
      if (message.type === 'modelTurn') {
        // AI is starting to respond
        this.emit('aiSpeaking', true);
      } else if (message.type === 'turnComplete') {
        // AI finished responding
        this.emit('aiSpeaking', false);
      } else if (message.type === 'serverContent') {
        // Process server content (text/audio responses)
        this.handleServerContent(message);
      } else if (message.type === 'toolCall') {
        // Handle function calls
        this.emit('functionCall', message);
      } else if (message.type === 'setupComplete') {
        console.log('✅ Gemini Live setup completed');
        this.emit('setupComplete');
      }
    } catch (error) {
      console.error('❌ Error handling Live message:', error);
      this.emit('error', error);
    }
  }

  // Handle server content (responses)
  handleServerContent(message) {
    try {
      const responseData = {
        text: '',
        audio: null,
        functionCalls: []
      };

      // Extract content parts
      if (message.serverContent && message.serverContent.parts) {
        for (const part of message.serverContent.parts) {
          if (part.text) {
            responseData.text = part.text;
            console.log('📝 Text response:', responseData.text.substring(0, 100) + '...');
          } else if (part.inlineData && part.inlineData.mimeType.startsWith('audio/')) {
            responseData.audio = {
              mimeType: part.inlineData.mimeType,
              data: part.inlineData.data
            };
            console.log('🔊 Audio response received');
          }
        }
      }

      this.emit('responseReceived', responseData);
    } catch (error) {
      console.error('❌ Error handling server content:', error);
      this.emit('error', error);
    }
  }

  // Send audio data to Gemini Live (real-time streaming)
  async sendAudioStream(audioBuffer, options = {}) {
    try {
      if (!this.isConnected || !this.session) {
        throw new Error('Gemini Live session not active. Please start a session first.');
      }

      console.log('🎵 Streaming audio to Gemini Live...');
      console.log('📊 Audio buffer size:', audioBuffer.length, 'bytes');
      console.log('📊 Audio buffer type:', typeof audioBuffer);
      console.log('📊 Options:', options);

      // For Node.js, we need to create a blob-like object
      // The Live API expects a File/Blob interface
      const audioBlob = {
        arrayBuffer: () => Promise.resolve(audioBuffer.buffer),
        size: audioBuffer.length,
        type: options.mimeType || 'audio/wav'
      };

      // Send real-time audio input using correct Live API method
      console.log('📡 Attempting to send to Gemini Live WebSocket...');
      
      try {
        await this.session.sendRealtimeInput({
          media: audioBlob
        });
        console.log('✅ Audio streamed to Gemini Live successfully');
      } catch (apiError) {
        console.error('❌ Gemini Live API error:', apiError);
        console.error('❌ Error details:', apiError.message);
        throw apiError;
      }
      this.emit('audioSent', { size: audioBuffer.length });

    } catch (error) {
      console.error('❌ Error streaming audio to Gemini Live:', error);
      this.emit('error', error);
      throw error;
    }
  }

  // Send text message (can be mixed with audio)
  async sendText(message, options = {}) {
    try {
      if (!this.isConnected || !this.session) {
        throw new Error('Gemini Live session not active. Please start a session first.');
      }

      console.log('💬 Sending text to Gemini Live:', message.substring(0, 100) + '...');

      // Send client content using correct Live API syntax
      await this.session.sendClientContent({
        turns: message,
        turnComplete: true
      });

      console.log('✅ Text sent to Gemini Live successfully');

    } catch (error) {
      console.error('❌ Error sending text to Gemini Live:', error);
      this.emit('error', error);
      throw error;
    }
  }

  // Start voice activity detection (begin audio input)
  async startVoiceInput() {
    try {
      if (!this.isConnected || !this.session) {
        throw new Error('Gemini Live session not active');
      }

      // Start user turn for voice input
      // Live API handles voice activity detection automatically
      console.log('🎤 Voice input started');
      this.emit('voiceInputStarted');

    } catch (error) {
      console.error('❌ Error starting voice input:', error);
      this.emit('error', error);
      throw error;
    }
  }

  // End voice activity detection (complete audio input)
  async endVoiceInput() {
    try {
      if (!this.isConnected || !this.session) {
        return;
      }

      // Live API automatically handles turn completion
      // No explicit turn completion needed

      console.log('🛑 Voice input ended');
      this.emit('voiceInputEnded');

    } catch (error) {
      console.error('❌ Error ending voice input:', error);
      this.emit('error', error);
    }
  }

  // Interrupt AI response
  async interrupt() {
    try {
      if (!this.isConnected || !this.session) {
        return;
      }

      // Send interrupt signal
      await this.session.interrupt();
      
      console.log('🛑 AI response interrupted');
      this.emit('interrupted');

    } catch (error) {
      console.error('❌ Error interrupting AI:', error);
      this.emit('error', error);
    }
  }

  // Add function calling support
  addTools(tools) {
    try {
      this.sessionConfig.tools = [...(this.sessionConfig.tools || []), ...tools];
      console.log('🔧 Added tools to Gemini Live:', tools.map(t => t.functionDeclarations?.[0]?.name || 'unknown').join(', '));
    } catch (error) {
      console.error('❌ Error adding tools:', error);
      throw error;
    }
  }

  // Execute function call
  async executeFunction(functionCall, functionImplementations) {
    try {
      const { name, args } = functionCall;
      
      if (!functionImplementations[name]) {
        throw new Error(`Function '${name}' not implemented`);
      }

      console.log('⚙️ Executing function:', name, 'with args:', args);
      
      const result = await functionImplementations[name](args);
      
      // Send function result back to Gemini
      await this.session.sendClientContent({
        turns: [{
          role: "function",
          parts: [{ 
            functionResponse: {
              name: name,
              response: result
            }
          }]
        }],
        turnComplete: true
      });
      
      console.log('✅ Function executed and result sent:', name);
      this.emit('functionExecuted', { name, args, result });
      
      return result;

    } catch (error) {
      console.error('❌ Error executing function:', error);
      this.emit('error', error);
      throw error;
    }
  }

  // End the current session
  async endSession() {
    try {
      if (this.session) {
        await this.session.close();
        this.session = null;
        this.isConnected = false;
        this.responseQueue = [];
        console.log('✅ Gemini Live session ended');
        this.emit('sessionEnded');
      }
    } catch (error) {
      console.error('❌ Error ending session:', error);
      this.emit('error', error);
    }
  }

  // Get session status
  getStatus() {
    return {
      isConnected: this.isConnected,
      hasSession: !!this.session,
      isConfigured: this.isConfigured()
    };
  }

  // Update voice settings
  updateVoiceConfig(voiceName = 'Kore') {
    this.sessionConfig.voiceName = voiceName;
    console.log('🗣️ Updated voice to:', voiceName);
  }

  // Available voices for financial assistant
  static getAvailableVoices() {
    return {
      'Kore': 'Professional, clear voice (default)',
      'Charon': 'Calm, reassuring voice',
      'Fenrir': 'Warm, friendly voice',
      'Aoede': 'Gentle, approachable voice',
      'Puck': 'Energetic, engaging voice'
    };
  }
}

module.exports = GeminiLiveStreamingService;