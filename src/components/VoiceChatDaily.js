import React, { useState, useEffect, useRef } from 'react';
import './VoiceChat.css';

const VoiceChat = ({ accessToken, onMessageUpdate }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [voiceMode, setVoiceMode] = useState('push-to-talk');
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [voiceChatEnabled, setVoiceChatEnabled] = useState(false);
  const [dailyRoom, setDailyRoom] = useState(null);
  const [dailyCall, setDailyCall] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [backendStatus, setBackendStatus] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const currentAudioRef = useRef(null);
  const chunksRef = useRef([]);

  // Check if voice chat is enabled on backend
  const checkVoiceChatStatus = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/health');
      const data = await response.json();
      setVoiceChatEnabled(data.voiceChatEnabled && data.sttEnabled);
      console.log('🎤 Voice chat enabled:', data.voiceChatEnabled && data.sttEnabled);
    } catch (error) {
      console.error('❌ Error checking voice chat status:', error);
      setVoiceChatEnabled(false);
    }
  };

  // Request microphone permissions
  const requestMicrophonePermission = async () => {
    console.log('🎙️ Requesting microphone permission...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 44100,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      console.log('✅ Microphone permission granted');
      
      // Store the stream for later use
      streamRef.current = stream;
      setIsConnected(true);
      setConnectionStatus('connected');
      
      return true;
    } catch (error) {
      console.error('❌ Microphone permission denied:', error);
      setConnectionStatus('error');
      return false;
    }
  };

  // Initialize voice chat connection
  const connectVoiceChat = async () => {
    console.log('🎤 Connecting to voice chat...');
    setConnectionStatus('connecting');
    
    // Check if backend supports voice chat
    await checkVoiceChatStatus();
    
    if (!voiceChatEnabled) {
      alert('Voice chat is not available. Please configure OPENAI_API_KEY and CARTESIA_API_KEY on the backend.');
      setConnectionStatus('error');
      return;
    }
    
    // Request microphone permission and set up connection
    const success = await requestMicrophonePermission();
    
    if (success) {
      console.log('✅ Voice chat connected successfully');
    }
  };

  // Start listening with MediaRecorder
  const startListening = async () => {
    console.log('🎯 Starting voice recording...');
    
    if (!isConnected || !streamRef.current) {
      console.error('❌ Not connected to voice chat');
      return;
    }

    if (isListening) {
      console.log('⚠️ Already listening');
      return;
    }

    if (isSpeaking) {
      console.log('⚠️ AI is speaking, skipping start');
      return;
    }

    try {
      setIsListening(true);
      setCurrentTranscript('');
      chunksRef.current = [];
      
      // Use WAV format for best compatibility with OpenAI Whisper
      let mimeType = 'audio/wav';
      
      // Fallback to WebM if WAV isn't supported
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm;codecs=opus';
        console.log('⚠️ WAV not supported, falling back to WebM');
      }
      
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: mimeType,
        audioBitsPerSecond: 128000
      });
      
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          console.log('🎤 Audio chunk captured:', event.data.size, 'bytes');
        }
      };

      mediaRecorder.onstop = async () => {
        console.log('🛑 Recording stopped, processing audio...');
        
        if (chunksRef.current.length > 0) {
          const audioBlob = new Blob(chunksRef.current, { type: mimeType });
          console.log('📦 Created audio blob:', audioBlob.size, 'bytes', audioBlob.type);
          
          // Send to backend for STT processing
          await sendAudioForProcessing(audioBlob);
        }
        
        setIsListening(false);
      };

      mediaRecorder.onerror = (error) => {
        console.error('❌ MediaRecorder error:', error);
        setIsListening(false);
      };

      // Start recording
      mediaRecorder.start();
      console.log('✅ Recording started with format:', mimeType);
      
    } catch (error) {
      console.error('❌ Error starting recording:', error);
      setIsListening(false);
    }
  };

  // Stop listening
  const stopListening = () => {
    console.log('🛑 Stopping recording...');
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  // Send recorded audio to backend for processing
  const sendAudioForProcessing = async (audioBlob) => {
    try {
      console.log('📤 Sending audio to backend for STT and AI processing...');
      
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');
      formData.append('format', audioBlob.type.includes('wav') ? 'wav' : 'webm');

      const response = await fetch('http://localhost:3001/api/speech-to-text', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`STT failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.transcript && data.transcript.trim()) {
        console.log('🗣️ Transcription:', data.transcript);
        setCurrentTranscript(data.transcript);
        
        // Process with AI and get voice response
        await handleVoiceInput(data.transcript.trim());
      } else {
        console.log('🔇 No speech detected');
        setCurrentTranscript('No speech detected');
      }
      
    } catch (error) {
      console.error('❌ Error processing audio:', error);
      setCurrentTranscript('Error processing audio');
    }
  };

  // Handle voice input and get AI response with TTS
  const handleVoiceInput = async (transcript) => {
    try {
      console.log('🗣️ Processing user input:', transcript);
      
      // Stop any current AI audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
        setIsSpeaking(false);
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
      
      console.log('🤖 AI Response:', originalText);
      setAiResponse(originalText);

      // Get audio buffer from response
      const audioBuffer = await response.arrayBuffer();
      console.log('🔊 Received audio buffer:', audioBuffer.byteLength, 'bytes');

      // Play audio response
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
      console.log('🔊 Playing AI audio response...');
      setIsSpeaking(true);

      // Create audio blob and URL
      const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(audioBlob);

      // Create audio element
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;

      // Set up audio event listeners
      audio.onplay = () => {
        console.log('▶️ AI audio playback started');
        setIsSpeaking(true);
      };

      audio.onended = () => {
        console.log('🏁 AI audio playback finished');
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
      console.error('❌ Error playing audio response:', error);
      setIsSpeaking(false);
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

  // Disconnect voice chat
  const disconnectVoiceChat = () => {
    console.log('👋 Disconnecting voice chat...');
    
    // Stop recording if active
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    // Stop AI audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
    }
    
    // Stop microphone stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionStatus('disconnected');
    setIsListening(false);
    setIsSpeaking(false);
    console.log('✅ Voice chat disconnected');
  };

  // Initialize on mount
  useEffect(() => {
    console.log('🎤 Initializing voice chat system...');
    
    // Check voice chat status
    checkVoiceChatStatus();
    
    return () => {
      // Cleanup
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
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
          <div className={`status-indicator ${connectionStatus}`}>
            {connectionStatus === 'connected' && '🟢 Voice Chat Ready'}
            {connectionStatus === 'connecting' && '🟡 Connecting...'}
            {connectionStatus === 'disconnected' && '🔴 Disconnected'}
            {connectionStatus === 'error' && '❌ Connection Error'}
          </div>
          
          {!navigator.onLine && (
            <div className="network-warning">
              <span>⚠️ No internet connection</span>
            </div>
          )}
          
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
                disabled={connectionStatus === 'connecting'}
              >
                {connectionStatus === 'connecting' ? '🔄 Connecting...' : '🎤 Connect Voice Chat'}
              </button>
              {!voiceChatEnabled && (
                <div className="warning-message">
                  <small>⚠️ Voice chat requires OPENAI_API_KEY and CARTESIA_API_KEY configuration</small>
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
              
              {voiceMode === 'push-to-talk' ? (
                <button
                  className={`voice-button ${isListening ? 'listening' : ''}`}
                  onMouseDown={startListening}
                  onMouseUp={stopListening}
                  onTouchStart={startListening}
                  onTouchEnd={stopListening}
                  disabled={isSpeaking}
                >
                  {isListening ? '🎤 Recording...' : '🎤 Hold to Talk'}
                </button>
              ) : (
                <button
                  className={`voice-button ${isListening ? 'listening' : ''}`}
                  onClick={isListening ? stopListening : startListening}
                  disabled={isSpeaking}
                >
                  {isListening ? '🛑 Stop Recording' : '🎤 Start Recording'}
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
            </div>
          )}
        </div>

        {/* Current Transcript */}
        {currentTranscript && (
          <div className="current-transcript">
            <strong>You said:</strong> {currentTranscript}
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