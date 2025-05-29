const fetch = require('node-fetch');

class DailyService {
  constructor() {
    this.apiKey = process.env.DAILY_API_KEY;
    this.domain = process.env.DAILY_DOMAIN || 'cloud-561d579d44574015b0db01160f789539.daily.co';
    this.baseUrl = 'https://api.daily.co/v1';
  }

  // Check if Daily.co is configured
  isConfigured() {
    return !!this.apiKey && this.apiKey !== 'your-daily-api-key-here';
  }

  // Create a new Daily.co room for voice chat
  async createRoom(roomName = null) {
    try {
      const name = roomName || `voice-chat-${Date.now()}`;
      
      if (!this.isConfigured()) {
        console.log('⚠️ Daily.co not configured, returning fallback room URL');
        return {
          url: `https://${this.domain}/${name}`,
          name: name,
          created_via_api: false
        };
      }

      console.log('🔑 Creating Daily.co room with API key...');
      
      const response = await fetch(`${this.baseUrl}/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          name: name,
          properties: {
            enable_chat: false,
            enable_screenshare: false,
            enable_recording: false,
            start_video_off: true,
            start_audio_off: false,
            exp: Math.round(Date.now() / 1000) + 60 * 60, // 1 hour expiry
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Daily.co API error:', response.status, errorText);
        
        // Fallback to simple room URL
        return {
          url: `https://${this.domain}/${name}`,
          name: name,
          created_via_api: false,
          error: `API error: ${response.status}`
        };
      }

      const room = await response.json();
      console.log('✅ Created Daily.co room via API:', room.url);
      
      return {
        ...room,
        created_via_api: true
      };

    } catch (error) {
      console.error('❌ Error creating Daily.co room:', error);
      
      // Final fallback
      const fallbackName = roomName || `fallback-${Date.now()}`;
      return {
        url: `https://${this.domain}/${fallbackName}`,
        name: fallbackName,
        created_via_api: false,
        error: error.message
      };
    }
  }

  // Create a meeting token for private rooms (optional)
  async createMeetingToken(roomName, options = {}) {
    try {
      if (!this.isConfigured()) {
        console.log('⚠️ Daily.co not configured, cannot create meeting tokens');
        return null;
      }

      const response = await fetch(`${this.baseUrl}/meeting-tokens`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          properties: {
            room_name: roomName,
            user_name: options.userName || 'Voice Chat User',
            exp: Math.round(Date.now() / 1000) + 60 * 60, // 1 hour expiry
            ...options
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error creating meeting token:', response.status, errorText);
        return null;
      }

      const tokenData = await response.json();
      console.log('✅ Created Daily.co meeting token');
      
      return tokenData.token;

    } catch (error) {
      console.error('❌ Error creating meeting token:', error);
      return null;
    }
  }

  // Delete a room (cleanup)
  async deleteRoom(roomName) {
    try {
      if (!this.isConfigured()) {
        console.log('⚠️ Daily.co not configured, cannot delete rooms');
        return false;
      }

      const response = await fetch(`${this.baseUrl}/rooms/${roomName}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        console.error('❌ Error deleting room:', response.status);
        return false;
      }

      console.log('✅ Deleted Daily.co room:', roomName);
      return true;

    } catch (error) {
      console.error('❌ Error deleting room:', error);
      return false;
    }
  }

  // Get room information
  async getRoomInfo(roomName) {
    try {
      if (!this.isConfigured()) {
        return null;
      }

      const response = await fetch(`${this.baseUrl}/rooms/${roomName}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();

    } catch (error) {
      console.error('❌ Error getting room info:', error);
      return null;
    }
  }
}

module.exports = DailyService; 