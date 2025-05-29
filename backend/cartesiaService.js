const { CartesiaClient } = require('@cartesia/cartesia-js');
require('dotenv').config();

// Initialize Cartesia client only if API key is available
let cartesia = null;

if (process.env.CARTESIA_API_KEY) {
  try {
    cartesia = new CartesiaClient({
      apiKey: process.env.CARTESIA_API_KEY
    });
    console.log('✅ Cartesia client initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Cartesia client:', error);
  }
} else {
  console.warn('⚠️  CARTESIA_API_KEY not found. Voice features will be disabled.');
}

/**
 * Available Cartesia voices for financial assistant
 */
const VOICE_CONFIG = {
  // Professional, warm voices for financial guidance
  PRIMARY_VOICE: 'a0e99841-438c-4a64-b679-ae501e7d6091', // Barbershop Man - clear, professional
  
  // Alternative voices for variety
  ALTERNATIVE_VOICES: {
    BRITISH_LADY: '79a125e8-cd45-4c13-8a67-188112f4dd22', // British Lady - sophisticated
    CALM_LADY: '87748186-23bb-4158-a1eb-332911b0b708',    // Calm Lady - gentle, reassuring  
    POET_MAN: 'a167e0f3-df7e-4d52-a9c3-f949145efdab'      // Poet Man - warm, thoughtful
  }
};

/**
 * Convert text to speech using Cartesia
 * @param {string} text - Text to convert to speech
 * @param {string} voiceId - Voice ID to use (optional)
 * @param {object} options - Additional options
 * @returns {Promise<Buffer>} Audio buffer
 */
async function textToSpeech(text, voiceId = VOICE_CONFIG.PRIMARY_VOICE, options = {}) {
  try {
    if (!cartesia) {
      throw new Error('Cartesia client not initialized. Please check CARTESIA_API_KEY.');
    }

    console.log('🎤 Converting text to speech with Cartesia...');
    console.log('📝 Text:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
    console.log('🗣️ Voice ID:', voiceId);

    // Clean the text for speech synthesis
    const cleanText = cleanTextForSpeech(text);
    
    if (!cleanText.trim()) {
      throw new Error('No text content to synthesize after cleaning');
    }

    console.log('⚙️ Generating speech with Cartesia...');

    // Generate speech using Cartesia
    const response = await cartesia.tts.bytes({
      modelId: "sonic-2",
      transcript: cleanText,
      voice: {
        mode: "id",
        id: voiceId
      },
      outputFormat: {
        container: "wav",
        encoding: "pcm_f32le",
        sampleRate: 44100
      },
      language: "en"
    });

    // Convert response to buffer
    const audioBuffer = Buffer.from(response);
    
    console.log('✅ Audio generated successfully with Cartesia');
    console.log('📊 Audio size:', audioBuffer.length, 'bytes');
    
    return audioBuffer;

  } catch (error) {
    console.error('❌ Error in text-to-speech conversion:', error);
    throw new Error(`Cartesia TTS conversion failed: ${error.message}`);
  }
}

/**
 * Clean text for speech synthesis
 * @param {string} text - Raw text from AI response
 * @returns {string} Clean text suitable for TTS
 */
function cleanTextForSpeech(text) {
  if (!text) return '';

  return text
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Replace HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, 'and')
    .replace(/&lt;/g, 'less than')
    .replace(/&gt;/g, 'greater than')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Remove chart request markers
    .replace(/\[CHART_REQUEST:.*?\]/g, '')
    // Clean up multiple spaces and line breaks
    .replace(/\s+/g, ' ')
    // Remove excessive punctuation
    .replace(/\.{2,}/g, '.')
    .replace(/!{2,}/g, '!')
    .replace(/\?{2,}/g, '?')
    // Normalize financial amounts for speech
    .replace(/\$(\d+),(\d+)/g, '$$$1 thousand $2') // $1,234 -> $1 thousand 234
    .replace(/\$(\d+)\.(\d{2})/g, '$$$1 and $2 cents') // $12.34 -> $12 and 34 cents
    // Clean up
    .trim();
}

/**
 * Get available voices from Cartesia
 * @returns {Promise<Array>} List of available voices
 */
async function getAvailableVoices() {
  try {
    if (!cartesia) {
      console.warn('⚠️ Cartesia client not available');
      return [];
    }
    
    const voicesResponse = await cartesia.voices.list();
    return voicesResponse || [];
  } catch (error) {
    console.error('❌ Error fetching voices:', error);
    return [];
  }
}

/**
 * Get voice configuration
 * @returns {object} Voice configuration
 */
function getVoiceConfig() {
  return VOICE_CONFIG;
}

/**
 * Stream text to speech (for real-time applications)
 * @param {string} text - Text to convert
 * @param {string} voiceId - Voice ID
 * @param {object} options - TTS options
 * @returns {Promise<ReadableStream>} Audio stream
 */
async function streamTextToSpeech(text, voiceId = VOICE_CONFIG.PRIMARY_VOICE, options = {}) {
  try {
    if (!cartesia) {
      throw new Error('Cartesia client not initialized. Please check CARTESIA_API_KEY.');
    }

    console.log('🎵 Starting Cartesia TTS streaming...');
    
    const cleanText = cleanTextForSpeech(text);
    
    if (!cleanText.trim()) {
      throw new Error('No text content to synthesize after cleaning');
    }

    // Use Cartesia's WebSocket streaming for real-time audio
    const audioStream = await cartesia.tts.websocket({
      modelId: "sonic-2",
      transcript: cleanText,
      voice: {
        mode: "id",
        id: voiceId
      },
      outputFormat: {
        container: "wav",
        encoding: "pcm_f32le",
        sampleRate: 44100
      },
      language: "en"
    });

    console.log('✅ Cartesia TTS stream initiated');
    return audioStream;

  } catch (error) {
    console.error('❌ Error in Cartesia TTS streaming:', error);
    throw new Error(`Cartesia TTS streaming failed: ${error.message}`);
  }
}

module.exports = {
  textToSpeech,
  streamTextToSpeech,
  getAvailableVoices,
  getVoiceConfig,
  cleanTextForSpeech,
  VOICE_CONFIG
};