const { GoogleGenAI } = require('@google/genai');
const { textToSpeech } = require('./cartesiaService');
const { EventEmitter } = require('events');

class GeminiLiveService extends EventEmitter {
  constructor() {
    super();
    this.apiKey = process.env.GOOGLE_AI_API_KEY;
    this.client = null;
    this.model = null;
    this.isConnected = false;
    this.sessionConfig = {
      model: "gemini-2.0-flash-exp",
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
      voiceName: "Kore", // For TTS
      tools: []
    };
    this.conversationHistory = [];
  }

  // Check if service is properly configured
  isConfigured() {
    return !!this.apiKey && this.apiKey !== 'your-google-ai-api-key-here';
  }

  // Initialize the Gemini client
  async initialize() {
    try {
      if (!this.isConfigured()) {
        throw new Error('Google AI API key not configured. Please check GOOGLE_AI_API_KEY environment variable.');
      }

      this.client = new GoogleGenAI({
        apiKey: this.apiKey
      });

      console.log('✅ Gemini client initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Gemini client:', error);
      throw error;
    }
  }

  // Start a new session (simplified for current API)
  async startSession(sessionOptions = {}) {
    try {
      if (!this.client) {
        await this.initialize();
      }

      // Merge custom options with default config
      const config = {
        ...this.sessionConfig,
        ...sessionOptions
      };

      console.log('🎤 Starting Gemini session...');

      // Get the model with tools support
      const modelConfig = {
        model: config.model
      };

      // Add tools if provided
      if (config.tools && config.tools.length > 0) {
        modelConfig.tools = config.tools;
      }

      // Store model config for later use
      this.modelConfig = modelConfig;

      // Update voice name if provided
      if (config.voiceName) {
        this.sessionConfig.voiceName = config.voiceName;
      }

      // Update system instruction if provided
      if (config.systemInstruction) {
        this.sessionConfig.systemInstruction = config.systemInstruction;
      }

      // Reset conversation history for new session
      this.conversationHistory = [];

      this.isConnected = true;
      console.log('✅ Gemini session started successfully');
      
      this.emit('sessionStarted', { sessionId: Date.now() });
      return true;

    } catch (error) {
      console.error('❌ Error starting Gemini session:', error);
      this.isConnected = false;
      this.emit('error', error);
      throw error;
    }
  }

  // Send audio data to Gemini (with speech-to-text conversion)
  async sendAudio(audioBuffer, options = {}) {
    try {
      if (!this.isConnected || !this.client) {
        throw new Error('Gemini session not active. Please start a session first.');
      }

      console.log('🎵 Processing audio with Gemini...');
      console.log('📊 Audio buffer size:', audioBuffer.length, 'bytes');

      // Convert audio buffer to base64 for the API
      const audioData = audioBuffer.toString('base64');

      // Create the message with audio data
      const audioMessage = {
        inlineData: {
          mimeType: options.mimeType || 'audio/wav',
          data: audioData
        }
      };

      // Add system instruction as part of the conversation
      const fullPrompt = [
        { text: this.sessionConfig.systemInstruction },
        audioMessage
      ];

      console.log('🧠 Sending audio to Gemini...');
      
      // Send audio message to Gemini using the correct API
      const response = await this.client.models.generateContent({
        model: this.modelConfig.model,
        contents: [{
          parts: fullPrompt
        }]
      });
      
      console.log('✅ Audio processed by Gemini successfully');
      this.emit('audioSent', { size: audioBuffer.length });

      // Process the response and convert to audio
      return await this.processResponse(response, true);

    } catch (error) {
      console.error('❌ Error processing audio with Gemini:', error);
      this.emit('error', error);
      throw error;
    }
  }

  // Send text message to Gemini
  async sendText(message, options = {}) {
    try {
      if (!this.isConnected || !this.client) {
        throw new Error('Gemini session not active. Please start a session first.');
      }

      console.log('💬 Sending text to Gemini:', message.substring(0, 100) + '...');

      // Add conversation history context
      const fullPrompt = this.sessionConfig.systemInstruction + '\n\n' + 
                        this.getConversationContext() + '\n\n' +
                        'User: ' + message;

      const response = await this.client.models.generateContent({
        model: this.modelConfig.model,
        contents: [{
          parts: [{ text: fullPrompt }]
        }]
      });
      
      // Add to conversation history
      this.conversationHistory.push({ role: 'user', content: message });
      
      return await this.processResponse(response, options.returnAudio !== false);

    } catch (error) {
      console.error('❌ Error sending text to Gemini:', error);
      this.emit('error', error);
      throw error;
    }
  }

  // Process Gemini response
  async processResponse(response, convertToAudio = false) {
    try {
      const responseData = {
        text: '',
        audio: null,
        functionCalls: []
      };

      // Extract text content
      if (response && response.candidates && response.candidates[0] && response.candidates[0].content) {
        const content = response.candidates[0].content;
        if (content.parts && content.parts[0] && content.parts[0].text) {
          responseData.text = content.parts[0].text;
          console.log('📝 Text response:', responseData.text.substring(0, 100) + '...');
          
          // Add to conversation history
          this.conversationHistory.push({ role: 'assistant', content: responseData.text });
          
          // Convert to audio if requested
          if (convertToAudio && responseData.text) {
            try {
              console.log('🔊 Converting response to audio...');
              const audioBuffer = await textToSpeech(
                responseData.text, 
                this.getVoiceId(this.sessionConfig.voiceName)
              );
              
              responseData.audio = {
                mimeType: 'audio/wav',
                data: audioBuffer.toString('base64')
              };
              
              console.log('✅ Audio conversion successful, size:', audioBuffer.length, 'bytes');
            } catch (audioError) {
              console.error('❌ Audio conversion failed:', audioError);
              // Continue without audio
            }
          }
        }
      }

      // Check for function calls in the response
      const candidates = response.candidates || [];
      for (const candidate of candidates) {
        if (candidate.content && candidate.content.parts) {
          for (const part of candidate.content.parts) {
            if (part.functionCall) {
              responseData.functionCalls.push(part.functionCall);
              console.log('🔧 Function call:', part.functionCall.name);
            }
          }
        }
      }

      this.emit('responseReceived', responseData);
      return responseData;

    } catch (error) {
      console.error('❌ Error processing Gemini response:', error);
      this.emit('error', error);
      throw error;
    }
  }

  // Get conversation context for maintaining history
  getConversationContext() {
    if (this.conversationHistory.length === 0) return '';
    
    // Keep last 5 exchanges to maintain context without hitting token limits
    const recentHistory = this.conversationHistory.slice(-10);
    return recentHistory.map(msg => 
      `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
    ).join('\n');
  }

  // Map voice names to Cartesia voice IDs
  getVoiceId(voiceName) {
    const voiceMap = {
      'Kore': 'a0e99841-438c-4a64-b679-ae501e7d6091',
      'Charon': '79a125e8-cd45-4c13-8a67-188112f4dd22',
      'Fenrir': '87748186-23bb-4158-a1eb-332911b0b708',
      'Aoede': 'a167e0f3-df7e-4d52-a9c3-f949145efdab',
      'Puck': 'a0e99841-438c-4a64-b679-ae501e7d6091' // Fallback to Kore
    };
    
    return voiceMap[voiceName] || voiceMap['Kore'];
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

  // Handle function call execution
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
      if (this.client) {
        // Clean up session resources
        this.modelConfig = null;
        this.conversationHistory = [];
        this.isConnected = false;
        console.log('✅ Gemini session ended');
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
      hasSession: !!this.modelConfig,
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

module.exports = GeminiLiveService;