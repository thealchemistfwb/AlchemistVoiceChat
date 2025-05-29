// Daily.co configuration for production voice streaming
// This can be used for enhanced audio quality and multi-user voice features

export const DAILY_CONFIG = {
  // Your Daily.co domain - you can get this from your Daily.co dashboard
  domain: process.env.REACT_APP_DAILY_DOMAIN || 'cloud-561d579d44574015b0db01160f789539.daily.co',
  
  // Room creation properties (used when creating rooms via API)
  roomProperties: {
    enable_chat: false,
    enable_screenshare: false,
    enable_recording: false,
    start_video_off: true,
    start_audio_off: false,
    exp: Math.round(Date.now() / 1000) + 60 * 60, // 1 hour expiry
  },

  // Call object configuration (used when joining rooms)
  callConfig: {
    startVideoOff: true,
    startAudioOff: false
  },

  // Audio settings optimized for voice chat
  audioSettings: {
    autoGainControl: true,
    echoCancellation: true,
    noiseSuppression: true,
    sampleRate: 44100,
    channelCount: 1
  }
};

// Create a Daily room for voice chat
export const createDailyRoom = async () => {
  try {
    const roomName = `voice-chat-${Date.now()}`;
    
    // Try to create room with API if available
    const apiKey = process.env.REACT_APP_DAILY_API_KEY;
    if (apiKey && apiKey !== 'your-daily-api-key-here') {
      console.log('🔑 Creating Daily.co room with API key...');
      
      const response = await fetch('https://api.daily.co/v1/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          name: roomName,
          ...DAILY_CONFIG.roomProperties
        })
      });
      
      if (response.ok) {
        const room = await response.json();
        console.log('✅ Created Daily.co room with API:', room.url);
        return { url: room.url, name: room.name };
      } else {
        console.warn('⚠️ API room creation failed, falling back to simple room URL');
      }
    }
    
    // Fallback: create simple room URL (this may not work with private domains)
    const roomUrl = `https://${DAILY_CONFIG.domain}/${roomName}`;
    console.log('✅ Created simple Daily.co room (fallback):', roomUrl);
    return { url: roomUrl, name: roomName };
    
  } catch (error) {
    console.error('❌ Error creating Daily room:', error);
    // Final fallback: return a generic room URL
    return { 
      url: `https://${DAILY_CONFIG.domain}/fallback-room`,
      name: 'fallback-room'
    };
  }
};

// Join a Daily room with audio-only configuration
export const joinDailyRoom = async (callFrame, roomUrl) => {
  try {
    await callFrame.join({
      url: roomUrl,
      ...DAILY_CONFIG.callConfig
    });
    
    // Configure audio settings
    await callFrame.setLocalAudio(true);
    await callFrame.setLocalVideo(false);
    
    return true;
  } catch (error) {
    console.error('Error joining Daily room:', error);
    return false;
  }
};