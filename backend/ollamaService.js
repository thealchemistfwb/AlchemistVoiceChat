const axios = require('axios');

class OllamaService {
  constructor(baseUrl = 'http://127.0.0.1:11434', model = 'qwen3:1.7b') {
    this.baseUrl = baseUrl;
    this.model = model;
    this.endpoint = `${baseUrl}/v1/chat/completions`;
    
    console.log(`🦙 Ollama service initialized: ${this.endpoint}`);
    console.log(`🤖 Using model: ${this.model}`);
  }

  async generateContent(prompt, options = {}) {
    try {
      // Convert Google AI format to OpenAI format for Ollama
      let messages;
      
      if (typeof prompt === 'string') {
        messages = [{ role: 'user', content: prompt }];
      } else if (prompt.contents) {
        // Handle Google AI format
        messages = prompt.contents.map(content => ({
          role: content.role === 'model' ? 'assistant' : 'user',
          content: content.parts.map(part => part.text).join('')
        }));
      } else if (prompt.messages) {
        // Already in OpenAI format
        messages = prompt.messages;
      } else {
        throw new Error('Unsupported prompt format');
      }

      const requestBody = {
        model: this.model,
        messages: messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 2000,
        tools:      options.tools ?? prompt.tools ?? [],   // <-- add this line
        tool_choice: options.tool_choice ?? 'auto',        // optional, but helps
        stream: false
      };

      console.log('🦙 Sending request to Ollama...');
      console.log('📝 Request preview:', {
        model: requestBody.model,
        messageCount: messages.length,
        lastMessage: messages[messages.length - 1]?.content?.substring(0, 100) + '...'
      });

      const response = await axios.post(this.endpoint, requestBody, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 180000 // 3 minute timeout
      });

      // Return the full Ollama API response
      return response.data;

    } catch (error) {
      console.error('❌ Ollama API Error:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      throw error;
    }
  }

  // For compatibility with existing function calling code
  async models() {
    return {
      generateContent: this.generateContent.bind(this)
    };
  }
}

module.exports = OllamaService;