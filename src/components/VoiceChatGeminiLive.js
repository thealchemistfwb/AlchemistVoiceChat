import React, { useState, useEffect, useRef } from 'react';
import './VoiceChat.css';

const VoiceChatGeminiLive = ({ accessToken, onMessageUpdate }) => {
  const [sessionId, setSessionId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [backendStatus, setBackendStatus] = useState(null);
  const [availableVoices, setAvailableVoices] = useState({});
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  
  // Audio recording refs
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const currentAudioRef = useRef(null);
  const recordingTimeoutRef = useRef(null);

  // Check Gemini Live API status
  const checkBackendStatus = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/gemini-live/status');
      const data = await response.json();
      setBackendStatus(data);
      setAvailableVoices(data.availableVoices || {});
      console.log('🏥 Gemini Live status:', data);
    } catch (error) {
      console.error('❌ Backend status check failed:', error);
      setBackendStatus({ error: 'Backend not available' });
    }
  };

  // Start Gemini Live session
  const startSession = async () => {
    try {
      console.log('🚀 Starting Gemini Live session...');
      
      const systemPrompt = `You are Finley, a helpful financial assistant. You help users understand their financial situation, analyze transactions, and provide insights about spending patterns and budgeting.

Keep your voice responses conversational and under 3 sentences. Use natural speech patterns and be warm and friendly. When users want to analyze their bank data, guide them through connecting their accounts via Plaid.

${accessToken ? 'The user has already connected their bank account, so you can help analyze their financial data.' : 'The user has not connected their bank account yet. Encourage them to connect it for personalized insights.'}`;

      const response = await fetch('http://localhost:3001/api/gemini-live/start-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceName: selectedVoice,
          systemPrompt: systemPrompt,
          userId: 'user_' + Date.now()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Failed to start session');
      }

      const data = await response.json();
      setSessionId(data.sessionId);
      setIsConnected(true);
      
      console.log('✅ Gemini Live session started:', data);
      
      // Initialize audio recording
      await initializeAudioRecording();

    } catch (error) {
      console.error('❌ Failed to start Gemini Live session:', error);
      alert('Failed to start voice chat: ' + error.message);
    }
  };

  // Initialize audio recording
  const initializeAudioRecording = async () => {
    try {
      console.log('🎤 Initializing audio recording...');
      
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      console.log('✅ Audio recording initialized');
    } catch (error) {
      console.error('❌ Failed to initialize audio recording:', error);
      alert('Failed to access microphone: ' + error.message);
    }
  };

  // Start recording audio
  const startRecording = () => {
    if (!streamRef.current || !sessionId) {
      console.error('❌ No audio stream or session available');
      return;
    }

    try {
      // Clear any existing chunks
      audioChunksRef.current = [];
      
      // Create MediaRecorder with WAV format (better compatibility)
      const mimeType = MediaRecorder.isTypeSupported('audio/wav') ? 'audio/wav' : 
                      MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 
                      'audio/mp4';
      
      mediaRecorderRef.current = new MediaRecorder(streamRef.current, {
        mimeType: mimeType
      });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        try {
          if (audioChunksRef.current.length > 0) {
            console.log('🎵 Processing recorded audio...');
            
            const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
            
            // Create FormData to send audio
            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.' + mimeType.split('/')[1]);
            formData.append('sessionId', sessionId);

            // Send to Gemini Live API
            const response = await fetch('http://localhost:3001/api/gemini-live/send-audio', {
              method: 'POST',
              body: formData
            });

            if (response.ok) {
              const contentType = response.headers.get('content-type');
              
              if (contentType && contentType.startsWith('audio/')) {
                // Response is audio - play it
                const audioBlob = await response.blob();
                await playAudioResponse(audioBlob);
                setCurrentTranscript('');
              } else {
                // Response is JSON
                const data = await response.json();
                if (data.text) {
                  setAiResponse(data.text);
                  setCurrentTranscript('');
                  
                  // Update parent component
                  if (onMessageUpdate) {
                    onMessageUpdate({
                      userMessage: 'Voice input',
                      aiResponse: data.text,
                      charts: []
                    });
                  }
                }
              }
            } else {
              const errorData = await response.json();
              console.error('❌ Audio processing failed:', errorData);
            }
          }
        } catch (error) {
          console.error('❌ Error processing audio:', error);
        }
        
        audioChunksRef.current = [];
      };

      mediaRecorderRef.current.start();
      setIsListening(true);
      
      // Auto-stop recording after 10 seconds (or user can stop manually)
      recordingTimeoutRef.current = setTimeout(() => {
        stopRecording();
      }, 10000);
      
      console.log('🎤 Recording started');
      
    } catch (error) {
      console.error('❌ Failed to start recording:', error);
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsListening(false);
      
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }
      
      console.log('🛑 Recording stopped');
    }
  };

  // Play audio response
  const playAudioResponse = async (audioBlob) => {
    try {
      console.log('🔊 Playing AI audio response...');
      setIsSpeaking(true);

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      currentAudioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        currentAudioRef.current = null;
        URL.revokeObjectURL(audioUrl);
        console.log('🏁 Audio playback finished');
      };

      audio.onerror = (error) => {
        console.error('❌ Audio playback error:', error);
        setIsSpeaking(false);
        currentAudioRef.current = null;
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();

    } catch (error) {
      console.error('❌ Error playing audio response:', error);
      setIsSpeaking(false);
    }
  };

  // Send text message (hybrid mode)
  const sendTextMessage = async (message) => {
    if (!sessionId) return;

    try {
      const response = await fetch('http://localhost:3001/api/gemini-live/send-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId,
          message: message
        })
      });

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.startsWith('audio/')) {
          // Response is audio
          const audioBlob = await response.blob();
          await playAudioResponse(audioBlob);
        } else {
          // Response is JSON
          const data = await response.json();
          if (data.text) {
            setAiResponse(data.text);
            
            if (onMessageUpdate) {
              onMessageUpdate({
                userMessage: message,
                aiResponse: data.text,
                charts: []
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Error sending text message:', error);
    }
  };

  // Stop session
  const stopSession = async () => {
    try {
      console.log('🛑 Stopping Gemini Live session...');
      
      // Stop any ongoing recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      
      // Stop audio stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      // Stop any playing audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      
      // Clear timeout
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }
      
      // End session on backend
      if (sessionId) {
        await fetch('http://localhost:3001/api/gemini-live/end-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        });
      }
      
      setSessionId(null);
      setIsConnected(false);
      setIsListening(false);
      setIsSpeaking(false);
      setCurrentTranscript('');
      
      console.log('✅ Session stopped');
      
    } catch (error) {
      console.error('❌ Error stopping session:', error);
    }
  };

  // Interrupt AI speaking
  const interruptAI = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      setIsSpeaking(false);
      console.log('🛑 AI interrupted');
    }
  };

  // Initialize on mount
  useEffect(() => {
    console.log('🎤 Initializing Gemini Live voice chat...');
    checkBackendStatus();
    
    return () => {
      stopSession();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isBackendReady = backendStatus && !backendStatus.error && backendStatus.isConfigured;

  return (
    <div className="voice-chat-container">
      <div className="voice-controls">
        <div className="voice-status">
          <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢 Gemini Live Voice Chat Active' : '🔴 Disconnected'}
          </div>
          
          {sessionId && (
            <div className="session-info">
              <small>Session: {sessionId}</small>
            </div>
          )}
          
          {!isBackendReady && (
            <div className="warning-message">
              <span>⚠️ Gemini Live not ready</span>
              {backendStatus?.error && <small>{backendStatus.error}</small>}
            </div>
          )}
        </div>

        {/* Voice Selection */}
        {!isConnected && isBackendReady && (
          <div className="voice-selection">
            <label>Choose Voice:</label>
            <select 
              value={selectedVoice} 
              onChange={(e) => setSelectedVoice(e.target.value)}
            >
              {Object.entries(availableVoices).map(([voice, description]) => (
                <option key={voice} value={voice}>
                  {voice} - {description}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="voice-interface">
          {/* Connection Controls */}
          {!isConnected && (
            <div className="connection-controls">
              <button
                className="connect-button"
                onClick={startSession}
                disabled={!isBackendReady}
              >
                🎤 Start Gemini Live Chat
              </button>
              {!isBackendReady && (
                <div className="warning-message">
                  <small>⚠️ Requires GOOGLE_AI_API_KEY</small>
                </div>
              )}
            </div>
          )}

          {/* Voice Controls */}
          {isConnected && (
            <div className="voice-buttons">
              <button
                className="disconnect-button"
                onClick={stopSession}
              >
                🔌 Stop Session
              </button>
              
              <button
                className={`voice-button ${isListening ? 'listening' : ''}`}
                onClick={isListening ? stopRecording : startRecording}
                disabled={isSpeaking}
              >
                {isListening ? '🛑 Stop Recording' : '🎤 Start Recording'}
              </button>
              
              {isSpeaking && (
                <button
                  className="interrupt-button"
                  onClick={interruptAI}
                >
                  ⏹️ Interrupt AI
                </button>
              )}
            </div>
          )}
        </div>

        {/* Recording Status */}
        {isListening && (
          <div className="recording-status">
            <div className="recording-indicator">
              <span>🎤 Recording... (auto-stops in 10s)</span>
              <div className="recording-waves">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="wave" style={{ animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* AI Speaking Status */}
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

      {/* Quick Text Input for Testing */}
      {isConnected && (
        <div className="quick-text-input">
          <input
            type="text"
            placeholder="Type a message (hybrid mode)..."
            onKeyPress={(e) => {
              if (e.key === 'Enter' && e.target.value.trim()) {
                sendTextMessage(e.target.value.trim());
                e.target.value = '';
              }
            }}
          />
        </div>
      )}
    </div>
  );
};

export default VoiceChatGeminiLive;