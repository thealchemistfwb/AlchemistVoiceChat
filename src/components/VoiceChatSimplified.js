import React, { useState, useEffect, useRef } from 'react';
import './VoiceChat.css';

const VoiceChat = ({ accessToken, onMessageUpdate }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [voiceMode, setVoiceMode] = useState('push-to-talk');
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [voiceChatEnabled, setVoiceChatEnabled] = useState(false);
  
  const recognitionRef = useRef(null);
  const currentAudioRef = useRef(null);

  // Check if voice chat is enabled on backend
  const checkVoiceChatStatus = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/health');
      const data = await response.json();
      setVoiceChatEnabled(data.voiceChatEnabled);
      console.log('🎤 Voice chat enabled:', data.voiceChatEnabled);
    } catch (error) {
      console.error('❌ Error checking voice chat status:', error);
      setVoiceChatEnabled(false);
    }
  };

  // Request microphone permissions
  const requestMicrophonePermission = async () => {
    console.log('🎙️ Requesting microphone permission...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('✅ Microphone permission granted');
      setPermissionGranted(true);
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('❌ Microphone permission denied:', error);
      setPermissionGranted(false);
      return false;
    }
  };

  // Initialize speech recognition
  const initializeSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.error('❌ Speech recognition not supported in this browser');
      return false;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-US';
    recognitionRef.current.maxAlternatives = 1;

    recognitionRef.current.onstart = () => {
      console.log('✅ Speech recognition started successfully');
      setIsListening(true);
    };

    recognitionRef.current.onresult = (event) => {
      console.log('📝 Speech recognition result received');
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const fullTranscript = finalTranscript + interimTranscript;
      console.log('🗣️ Transcript:', fullTranscript);
      setCurrentTranscript(fullTranscript);

      // Send final transcript to AI
      if (finalTranscript.trim()) {
        console.log('📤 Sending final transcript to voice AI:', finalTranscript.trim());
        handleVoiceInput(finalTranscript.trim());
      }
    };

    recognitionRef.current.onerror = (event) => {
      console.error('❌ Speech recognition error:', event.error);
      setIsListening(false);
      
      if (event.error === 'not-allowed') {
        console.error('🚫 Microphone access denied. Please grant permission.');
        setPermissionGranted(false);
      }
    };

    recognitionRef.current.onend = () => {
      console.log('🛑 Speech recognition ended');
      setIsListening(false);
      
      // Auto-restart if in always-on mode and not speaking
      if (voiceMode === 'always-on' && !isSpeaking && isConnected) {
        setTimeout(() => {
          if (!isSpeaking && !isListening && permissionGranted) {
            console.log('🔄 Auto-restarting speech recognition (always-on mode)');
            startListening();
          }
        }, 1000);
      }
    };
    
    console.log('🎤 Speech recognition initialized');
    return true;
  };

  // Handle voice input and send to AI backend with TTS
  const handleVoiceInput = async (transcript) => {
    try {
      console.log('🗣️ User said:', transcript);
      
      // Stop any current AI audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
        setIsSpeaking(false);
      }

      if (!voiceChatEnabled) {
        console.warn('⚠️ Voice chat not enabled on backend');
        setAiResponse('Voice chat is not available. Please check backend configuration.');
        return;
      }

      // Send to voice chat backend endpoint
      const response = await fetch('http://localhost:3001/api/voice-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: transcript,
          accessToken: accessToken,
          conversationHistory: [],
          voiceId: undefined // Use default voice
        }),
      });

      if (!response.ok) {
        throw new Error(`Voice chat failed: ${response.status} ${response.statusText}`);
      }

      // Get the original text from response headers
      const originalText = decodeURIComponent(response.headers.get('X-Original-Text') || '');
      const cleanText = decodeURIComponent(response.headers.get('X-Clean-Text') || '');
      
      console.log('🤖 AI Original Response:', originalText);
      console.log('🧹 AI Clean Response:', cleanText);
      
      setAiResponse(originalText);

      // Get audio buffer from response
      const audioBuffer = await response.arrayBuffer();
      console.log('🔊 Received audio buffer:', audioBuffer.byteLength, 'bytes');

      // Play audio directly
      await playAudioResponse(audioBuffer);
      
      // Update parent component
      if (onMessageUpdate) {
        onMessageUpdate({
          userMessage: transcript,
          aiResponse: originalText,
          charts: [] // Voice responses don't include charts
        });
      }

    } catch (error) {
      console.error('❌ Error processing voice input:', error);
      
      // Fallback: display error message
      const errorMessage = `Sorry, I had trouble processing that: ${error.message}`;
      setAiResponse(errorMessage);
    }
  };

  // Play audio response
  const playAudioResponse = async (audioBuffer) => {
    try {
      console.log('🔊 Playing audio response...');
      setIsSpeaking(true);

      // Create audio blob and URL
      const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);

      // Create audio element
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;

      // Set up audio event listeners
      audio.onloadeddata = () => {
        console.log('📱 Audio loaded, duration:', audio.duration);
      };

      audio.onplay = () => {
        console.log('▶️ Audio playback started');
        setIsSpeaking(true);
      };

      audio.onended = () => {
        console.log('🏁 Audio playback finished');
        setIsSpeaking(false);
        currentAudioRef.current = null;
        URL.revokeObjectURL(audioUrl);
        
        // Resume listening if in always-on mode
        if (voiceMode === 'always-on' && isConnected) {
          setTimeout(() => startListening(), 500);
        }
      };

      audio.onerror = (error) => {
        console.error('❌ Audio playback error:', error);
        setIsSpeaking(false);
        currentAudioRef.current = null;
        URL.revokeObjectURL(audioUrl);
      };

      // Play the audio
      await audio.play();

    } catch (error) {
      console.error('❌ Error playing audio:', error);
      setIsSpeaking(false);
    }
  };

  // Start listening
  const startListening = async () => {
    console.log('🎯 Attempting to start listening...');
    
    if (!recognitionRef.current) {
      console.error('❌ Speech recognition not initialized');
      return;
    }

    if (isListening) {
      console.log('⚠️ Already listening, skipping start');
      return;
    }

    if (isSpeaking) {
      console.log('⚠️ AI is speaking, skipping start');
      return;
    }

    // Check microphone permission first
    if (!permissionGranted) {
      console.log('🎙️ Requesting microphone permission before starting...');
      const granted = await requestMicrophonePermission();
      if (!granted) {
        console.error('❌ Cannot start listening without microphone permission');
        return;
      }
    }

    try {
      console.log('🎤 Starting speech recognition...');
      setCurrentTranscript('');
      recognitionRef.current.start();
    } catch (error) {
      console.error('❌ Failed to start speech recognition:', error);
      setIsListening(false);
    }
  };

  // Stop listening
  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  // Interrupt AI speech
  const interruptAI = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      setIsSpeaking(false);
      console.log('🛑 AI speech interrupted');
    }
  };

  // Connect to voice chat (simplified)
  const connectVoiceChat = async () => {
    console.log('🎤 Connecting to voice chat...');
    
    // Check if backend supports voice chat
    await checkVoiceChatStatus();
    
    if (!voiceChatEnabled) {
      alert('Voice chat is not available. Please configure ELEVENLABS_API_KEY on the backend.');
      return;
    }
    
    // Initialize speech recognition
    const initialized = initializeSpeechRecognition();
    if (initialized) {
      setIsConnected(true);
      console.log('✅ Voice chat connected');
    }
  };

  // Disconnect voice chat
  const disconnectVoiceChat = () => {
    console.log('👋 Disconnecting voice chat...');
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
    }
    
    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);
    console.log('✅ Voice chat disconnected');
  };

  // Initialize on mount
  useEffect(() => {
    console.log('🎤 Initializing simplified voice chat...');
    
    // Check if microphone permission is already granted
    navigator.permissions?.query({ name: 'microphone' })
      .then(result => {
        console.log('🎙️ Microphone permission status:', result.state);
        if (result.state === 'granted') {
          setPermissionGranted(true);
        }
      })
      .catch(error => {
        console.log('⚠️ Could not check microphone permissions:', error);
      });

    // Check voice chat status
    checkVoiceChatStatus();
    
    return () => {
      // Cleanup
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
    };
  }, []);

  return (
    <div className="voice-chat-container">
      <div className="voice-controls">
        <div className="voice-status">
          <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢 Voice Chat Ready' : '🔴 Disconnected'}
          </div>
          
          <div className="voice-settings">
            <div className="voice-mode-selector">
              <button 
                className={voiceMode === 'push-to-talk' ? 'active' : ''}
                onClick={() => setVoiceMode('push-to-talk')}
              >
                Push to Talk
              </button>
              <button 
                className={voiceMode === 'always-on' ? 'active' : ''}
                onClick={() => setVoiceMode('always-on')}
              >
                Always On
              </button>
            </div>
          </div>
        </div>

        <div className="voice-interface">
          {/* Connection Controls */}
          {!isConnected && (
            <div className="connection-controls">
              <button
                className="connect-button"
                onClick={connectVoiceChat}
              >
                🎤 Connect Voice Chat
              </button>
              {!voiceChatEnabled && (
                <div className="warning-message">
                  <small>⚠️ Voice chat requires ELEVENLABS_API_KEY configuration</small>
                </div>
              )}
            </div>
          )}

          {/* Voice Controls */}
          {isConnected && (
            <div className="voice-buttons">
              <button
                className="disconnect-button"
                onClick={disconnectVoiceChat}
              >
                🔌 Disconnect
              </button>
              
              {!permissionGranted ? (
                <button
                  className="permission-button"
                  onClick={requestMicrophonePermission}
                >
                  🎙️ Grant Microphone Access
                </button>
              ) : (
                <>
                  {voiceMode === 'push-to-talk' ? (
                    <button
                      className={`voice-button ${isListening ? 'listening' : ''}`}
                      onMouseDown={startListening}
                      onMouseUp={stopListening}
                      onTouchStart={startListening}
                      onTouchEnd={stopListening}
                      disabled={isSpeaking}
                    >
                      {isListening ? '🎤 Listening...' : '🎤 Hold to Talk'}
                    </button>
                  ) : (
                    <button
                      className={`voice-button ${isListening ? 'listening' : ''}`}
                      onClick={isListening ? stopListening : startListening}
                    >
                      {isListening ? '🛑 Stop Listening' : '🎤 Start Listening'}
                    </button>
                  )}
                  
                  {isSpeaking && (
                    <button
                      className="interrupt-button"
                      onClick={interruptAI}
                    >
                      ⏹️ Interrupt
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Current Transcript */}
        {currentTranscript && (
          <div className="current-transcript">
            <strong>You:</strong> {currentTranscript}
          </div>
        )}

        {/* AI Status */}
        {isSpeaking && (
          <div className="ai-speaking">
            <div className="speaking-indicator">
              <span>🤖 Finley is speaking...</span>
              <div className="speech-waves">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="wave" style={{ animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AI Response Display */}
      {aiResponse && (
        <div className="ai-response-display">
          <div className="response-content">
            <h4>🤖 Finley's Response:</h4>
            <p>{aiResponse}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceChat;