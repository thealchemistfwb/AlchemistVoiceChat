import React, { useState, useEffect, useRef } from 'react';
import './VoiceChat.css';

const VoiceChatGeminiLiveStreaming = ({ accessToken, onMessageUpdate }) => {
  const [sessionId, setSessionId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [backendStatus, setBackendStatus] = useState(null);
  const [availableVoices, setAvailableVoices] = useState({});
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  
  // Audio streaming refs
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const workletRef = useRef(null);
  const currentAudioRef = useRef(null);
  const isStreamingRef = useRef(false);

  // Check Gemini Live API status
  const checkBackendStatus = async () => {
    try {
      const response = await fetch('/api/gemini-live/status');
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

      const response = await fetch('/api/gemini-live/start-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceName: selectedVoice,
          systemInstruction: systemPrompt,
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
      
      // Initialize real-time audio streaming
      await initializeRealTimeStreaming();

    } catch (error) {
      console.error('❌ Failed to start Gemini Live session:', error);
      alert('Failed to start voice chat: ' + error.message);
    }
  };

  // Initialize real-time audio streaming (continuous, not chunks)
  const initializeRealTimeStreaming = async () => {
    try {
      console.log('🎤 Initializing real-time audio streaming...');
      
      // Get user media with high-quality settings for streaming
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          latency: 0.01 // Request low latency for real-time
        }
      });

      // Create AudioContext for real-time processing
      audioContextRef.current = new AudioContext({
        sampleRate: 16000,
        latency: 'interactive'
      });

      // Create MediaStreamSource
      const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
      
      // Create ScriptProcessor for real-time audio data
      // Using ScriptProcessor (deprecated but still works) for compatibility
      const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (event) => {
        console.log('🎵 Audio processor called, isStreaming:', isStreamingRef.current);
        
        const inputBuffer = event.inputBuffer;
        const inputData = inputBuffer.getChannelData(0);
        
        // Check if there's actual audio
        let hasAudio = false;
        for (let i = 0; i < inputData.length; i++) {
          if (Math.abs(inputData[i]) > 0.001) {
            hasAudio = true;
            break;
          }
        }
        
        console.log('🎤 Audio data detected:', hasAudio, 'Max level:', Math.max(...inputData.map(Math.abs)));
        
        if (isStreamingRef.current) {
          // Convert float32 to int16 PCM
          const pcmData = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            pcmData[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32767));
          }
          
          // Send audio chunk immediately (real-time streaming)
          console.log('🎤 Sending audio chunk:', pcmData.length, 'samples');
          sendAudioChunk(pcmData.buffer);
        }
      };

      // Connect the audio pipeline
      source.connect(processor);
      processor.connect(audioContextRef.current.destination);
      
      workletRef.current = processor;

      console.log('✅ Real-time audio streaming initialized');
      console.log('🔗 Audio pipeline connected:', {
        source: source,
        processor: processor,
        audioContext: audioContextRef.current,
        stream: streamRef.current,
        streamActive: streamRef.current ? streamRef.current.active : 'no stream',
        streamTracks: streamRef.current ? streamRef.current.getTracks().length : 0
      });
      
      // Test processor with a simple 1-second tone
      console.log('🧪 Testing audio processor with tone...');
      const testOscillator = audioContextRef.current.createOscillator();
      const testGain = audioContextRef.current.createGain();
      testOscillator.frequency.setValueAtTime(440, audioContextRef.current.currentTime);
      testGain.gain.setValueAtTime(0.1, audioContextRef.current.currentTime);
      testOscillator.connect(testGain);
      testGain.connect(processor);
      testOscillator.start(audioContextRef.current.currentTime);
      testOscillator.stop(audioContextRef.current.currentTime + 1);

    } catch (error) {
      console.error('❌ Failed to initialize real-time streaming:', error);
      alert('Failed to access microphone: ' + error.message);
    }
  };

  // Send audio chunk immediately (real-time streaming)
  const sendAudioChunk = async (audioBuffer) => {
    try {
      if (!sessionId) {
        console.debug('⚠️ No session ID, skipping audio chunk');
        return;
      }

      // Create a small audio file from the chunk
      const blob = new Blob([audioBuffer], { type: 'audio/pcm' });
      console.debug('📦 Created audio blob:', blob.size, 'bytes, type:', blob.type);
      
      // Send to Gemini Live API immediately
      const formData = new FormData();
      formData.append('audio', blob, 'chunk.pcm');
      formData.append('sessionId', sessionId);

      // Send without waiting for response (real-time streaming)
      console.log('🚀 Attempting to send audio chunk to:', '/api/gemini-live/send-audio');
      const startTime = Date.now();
      
      fetch('/api/gemini-live/send-audio', {
        method: 'POST',
        body: formData
      }).then(response => {
        const endTime = Date.now();
        console.log(`⏱️ Request took ${endTime - startTime}ms`);
        if (!response.ok) {
          console.error('❌ Backend rejected audio chunk:', response.status, response.statusText);
        } else {
          console.log('✅ Audio chunk sent successfully');
        }
        return response.text();
      }).then(responseText => {
        console.log('📨 Response body:', responseText);
      }).catch(error => {
        const endTime = Date.now();
        console.error(`❌ Streaming chunk network error after ${endTime - startTime}ms:`, error);
        console.error('❌ Error type:', error.name);
        console.error('❌ Error message:', error.message);
      });

    } catch (error) {
      console.debug('Error sending audio chunk:', error);
    }
  };

  // Start real-time streaming
  const startStreaming = async () => {
    console.log('🚀 startStreaming() called');
    console.log('🎯 Current audioContext:', audioContextRef.current);
    console.log('🎯 Current sessionId:', sessionId);
    
    if (!audioContextRef.current) {
      console.log('🔧 No audioContext, initializing...');
      await initializeRealTimeStreaming();
    }

    if (audioContextRef.current.state === 'suspended') {
      console.log('🔧 AudioContext suspended, resuming...');
      await audioContextRef.current.resume();
    }

    setIsStreaming(true);
    isStreamingRef.current = true;
    console.log('🎤 Started real-time audio streaming - isStreaming set to true');
    
    // Test if backend is reachable
    console.log('🧪 Testing backend connectivity...');
    fetch('/api/gemini-live/status')
      .then(response => {
        console.log('✅ Backend connectivity test:', response.status);
        return response.json();
      })
      .then(data => console.log('📊 Backend status:', data))
      .catch(error => console.error('❌ Backend connectivity failed:', error));
  };

  // Stop real-time streaming
  const stopStreaming = () => {
    setIsStreaming(false);
    isStreamingRef.current = false;
    console.log('🛑 Stopped real-time audio streaming');
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
      const response = await fetch('/api/gemini-live/send-text', {
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
      
      // Stop streaming
      setIsStreaming(false);
      
      // Stop audio context
      if (workletRef.current) {
        workletRef.current.disconnect();
        workletRef.current = null;
      }
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        await audioContextRef.current.close();
        audioContextRef.current = null;
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
      
      // End session on backend
      if (sessionId) {
        await fetch('/api/gemini-live/end-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        });
      }
      
      setSessionId(null);
      setIsConnected(false);
      setIsStreaming(false);
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
    console.log('🎤 Initializing Gemini Live streaming voice chat...');
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
            {isConnected ? '🟢 Gemini Live Streaming Active' : '🔴 Disconnected'}
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
                🎤 Start Gemini Live Streaming
              </button>
              {!isBackendReady && (
                <div className="warning-message">
                  <small>⚠️ Requires GOOGLE_AI_API_KEY</small>
                </div>
              )}
            </div>
          )}

          {/* Streaming Controls */}
          {isConnected && (
            <div className="voice-buttons">
              <button
                className="disconnect-button"
                onClick={stopSession}
              >
                🔌 Stop Session
              </button>
              
              <button
                className={`voice-button ${isStreaming ? 'streaming' : ''}`}
                onClick={isStreaming ? stopStreaming : startStreaming}
                disabled={isSpeaking}
              >
                {isStreaming ? '🛑 Stop Streaming' : '🎤 Start Streaming'}
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

        {/* Streaming Status */}
        {isStreaming && (
          <div className="streaming-status">
            <div className="streaming-indicator">
              <span>🎵 Live Streaming... (real-time)</span>
              <div className="streaming-waves">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="wave" style={{ animationDelay: `${i * 0.1}s` }} />
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

export default VoiceChatGeminiLiveStreaming;