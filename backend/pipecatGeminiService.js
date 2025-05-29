const { EventEmitter } = require('events');

class PipecatGeminiService extends EventEmitter {
  constructor() {
    super();
    this.apiKey = process.env.GOOGLE_AI_API_KEY;
    this.transport = null;
    this.rtviClient = null;
    this.isConnected = false;
    this.sessionConfig = {
      voiceName: "Kore",
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
- Answer questions about budgeting and financial planning`
    };
  }

  // Check if service is properly configured
  isConfigured() {
    return !!this.apiKey && this.apiKey !== 'your-google-ai-api-key-here';
  }

  // Initialize Pipecat Gemini Live transport
  async initialize() {
    try {
      if (!this.isConfigured()) {
        throw new Error('Google AI API key not configured. Please check GOOGLE_AI_API_KEY environment variable.');
      }

      // Import Pipecat modules
      const { GeminiLiveWebsocketTransport } = require('@pipecat-ai/gemini-live-websocket-transport');
      const { RTVIClient } = require('@pipecat-ai/client-js');

      // Configure Gemini Live transport
      const geminiOptions = {
        api_key: this.apiKey,
        generation_config: {
          temperature: 0.7,
          max_output_tokens: 1000,
          response_modalities: ['AUDIO']
        },
        initial_messages: [
          {
            role: 'system',
            content: this.sessionConfig.systemInstruction
          }
        ],
        speech_config: {
          voice_config: {
            prebuilt_voice_config: {
              voice_name: this.sessionConfig.voiceName
            }
          }
        }
      };

      // Create transport
      this.transport = new GeminiLiveWebsocketTransport(geminiOptions);

      // Configure RTVI client
      const rtviConfig = {
        transport: this.transport,
        enableMic: true,
        enableCam: false,
        callbacks: {
          onConnected: () => {
            console.log('🔗 Pipecat Gemini Live connected');
            this.isConnected = true;
            this.emit('sessionStarted');
          },
          onDisconnected: () => {
            console.log('📡 Pipecat Gemini Live disconnected');
            this.isConnected = false;
            this.emit('sessionEnded');
          },
          onError: (error) => {
            console.error('❌ Pipecat Gemini Live error:', error);
            this.emit('error', error);
          },
          onUserStartedSpeaking: () => {
            console.log('🎤 User started speaking');
            this.emit('userSpeaking', true);
          },
          onUserStoppedSpeaking: () => {
            console.log('🛑 User stopped speaking');
            this.emit('userSpeaking', false);
          },
          onBotStartedSpeaking: () => {
            console.log('🤖 Bot started speaking');
            this.emit('botSpeaking', true);
          },
          onBotStoppedSpeaking: () => {
            console.log('🏁 Bot stopped speaking');
            this.emit('botSpeaking', false);
          }
        }
      };

      // Create RTVI client
      this.rtviClient = new RTVIClient(rtviConfig);

      console.log('✅ Pipecat Gemini Live service initialized successfully');
      return true;

    } catch (error) {
      console.error('❌ Failed to initialize Pipecat Gemini Live service:', error);
      throw error;
    }
  }

  // Start streaming session
  async startStreamingSession(sessionOptions = {}) {
    try {
      if (!this.rtviClient) {
        await this.initialize();
      }

      console.log('🎤 Starting Pipecat Gemini Live streaming session...');

      // Update configuration if provided
      if (sessionOptions.voiceName) {
        this.sessionConfig.voiceName = sessionOptions.voiceName;
      }

      if (sessionOptions.systemInstruction) {
        this.sessionConfig.systemInstruction = sessionOptions.systemInstruction;
      }

      // Connect to the service
      await this.rtviClient.connect();

      console.log('✅ Pipecat Gemini Live streaming session started successfully');
      return true;

    } catch (error) {
      console.error('❌ Error starting Pipecat Gemini Live streaming session:', error);
      this.isConnected = false;
      this.emit('error', error);
      throw error;
    }
  }

  // Send text message
  async sendText(message, options = {}) {
    try {
      if (!this.isConnected || !this.rtviClient) {
        throw new Error('Pipecat Gemini Live session not active. Please start a session first.');
      }

      console.log('💬 Sending text to Pipecat Gemini Live:', message.substring(0, 100) + '...');

      // Get LLM helper
      const llmHelper = this.rtviClient.getHelper('llm');
      if (!llmHelper) {
        throw new Error('LLM helper not available');
      }

      // Send message
      await llmHelper.appendToMessages({
        role: 'user',
        content: message
      });

      console.log('✅ Text sent to Pipecat Gemini Live successfully');

    } catch (error) {
      console.error('❌ Error sending text to Pipecat Gemini Live:', error);
      this.emit('error', error);
      throw error;
    }
  }

  // Start voice input (microphone)
  async startVoiceInput() {
    try {
      if (!this.isConnected || !this.rtviClient) {
        throw new Error('Pipecat session not active');
      }

      // Enable microphone
      await this.rtviClient.enableMic(true);
      
      console.log('🎤 Voice input started');
      this.emit('voiceInputStarted');

    } catch (error) {
      console.error('❌ Error starting voice input:', error);
      this.emit('error', error);
      throw error;
    }
  }

  // Stop voice input
  async stopVoiceInput() {
    try {
      if (!this.isConnected || !this.rtviClient) {
        return;
      }

      // Disable microphone
      await this.rtviClient.enableMic(false);
      
      console.log('🛑 Voice input stopped');
      this.emit('voiceInputStopped');

    } catch (error) {
      console.error('❌ Error stopping voice input:', error);
      this.emit('error', error);
    }
  }

  // Interrupt AI response
  async interrupt() {
    try {
      if (!this.isConnected || !this.rtviClient) {
        return;
      }

      // Send interrupt action
      await this.rtviClient.sendMessage({
        type: 'action',
        action: 'interrupt'
      });
      
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
      // Store tools configuration for when we start the session
      this.sessionConfig.tools = [...(this.sessionConfig.tools || []), ...tools];
      console.log('🔧 Added tools to Pipecat configuration:', tools.map(t => t.functionDeclarations?.[0]?.name || 'unknown').join(', '));
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
      
      console.log('✅ Function executed successfully:', name);
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
      if (this.rtviClient && this.isConnected) {
        await this.rtviClient.disconnect();
        this.rtviClient = null;
        this.isConnected = false;
        console.log('✅ Pipecat Gemini Live session ended');
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
      hasSession: !!this.rtviClient,
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

module.exports = PipecatGeminiService;