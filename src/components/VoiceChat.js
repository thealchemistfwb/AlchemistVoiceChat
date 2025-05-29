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
  const [retryCount, setRetryCount] = useState(0);
  
  // WebSocket and WebAudio refs
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const workletNodeRef = useRef(null);
  const streamRef = useRef(null);
  const currentAudioRef = useRef(null);
  const retryTimeoutRef = useRef(null);
  const isRecordingRef = useRef(false);

  // Detect browser for better error handling
  const getBrowserInfo = () => {
    const userAgent = navigator.userAgent;
    const isChrome = userAgent.includes('Chrome') && !userAgent.includes('Edg');
    const isEdge = userAgent.includes('Edg');
    const isSafari = userAgent.includes('Safari') && !userAgent.includes('Chrome');
    const isFirefox = userAgent.includes('Firefox');
    
    return { isChrome, isEdge, isSafari, isFirefox };
  };

  // Check if voice chat is enabled on backend
  const checkVoiceChatStatus = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/health');
      const data = await response.json();
      setVoiceChatEnabled(data.voiceChatEnabled);
      console.log('🎤 Voice chat enabled:', data.voiceChatEnabled);
      
      const browserInfo = getBrowserInfo();
      console.log('🌐 Browser info:', browserInfo);
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
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
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

  // Create PCM16 WAV header
  const createWavHeader = (dataLength, sampleRate = 16000, channels = 1) => {
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    view.setUint32(0, 0x46464952, false); // "RIFF"
    view.setUint32(4, dataLength + 36, true); // File size - 8
    view.setUint32(8, 0x45564157, false); // "WAVE"

    // fmt sub-chunk
    view.setUint32(12, 0x20746d66, false); // "fmt "
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
    view.setUint16(22, channels, true); // NumChannels
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate * channels * 2, true); // ByteRate
    view.setUint16(32, channels * 2, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample

    // data sub-chunk
    view.setUint32(36, 0x61746164, false); // "data"
    view.setUint32(40, dataLength, true); // Subchunk2Size

    return new Uint8Array(buffer);
  };

  // Convert Float32Array to Int16Array (PCM16)
  const floatTo16BitPCM = (input) => {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const sample = Math.max(-1, Math.min(1, input[i]));
      output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }
    return output;
  };

  // Create proper WAV blob from audio data
  const createWavBlob = (audioData) => {
    const pcmData = floatTo16BitPCM(audioData);
    const pcmBytes = new Uint8Array(pcmData.buffer);
    const header = createWavHeader(pcmBytes.length);
    
    const wavBlob = new Blob([header, pcmBytes], { type: 'audio/wav' });
    console.log('📦 Created WAV blob:', wavBlob.size, 'bytes');
    return wavBlob;
  };

  // AudioWorklet processor for real-time audio capture
  const audioWorkletCode = `
    class AudioCaptureProcessor extends AudioWorkletProcessor {
      constructor() {
        super();
        this.bufferSize = 4096; // 256ms at 16kHz
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
      }

      process(inputs) {
        const input = inputs[0];
        if (input.length > 0) {
          const channelData = input[0];
          
          for (let i = 0; i < channelData.length; i++) {
            this.buffer[this.bufferIndex] = channelData[i];
            this.bufferIndex++;
            
            if (this.bufferIndex >= this.bufferSize) {
              // Send buffer to main thread
              this.port.postMessage({
                type: 'audioData',
                buffer: this.buffer.slice()
              });
              this.bufferIndex = 0;
            }
          }
        }
        return true;
      }
    }

    registerProcessor('audio-capture-processor', AudioCaptureProcessor);
  `;

  // Initialize WebSocket connection
  const initializeWebSocket = () => {
    return new Promise((resolve, reject) => {
      try {
        wsRef.current = new WebSocket('ws://localhost:3001/ws/audio-stream');
        
        wsRef.current.onopen = () => {
          console.log('🔗 WebSocket connected');
          resolve();
        };

        wsRef.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'transcription' && data.text) {
              console.log('🗣️ Received transcription:', data.text);
              setCurrentTranscript(prev => prev + ' ' + data.text);
              
              // If this looks like a complete sentence, process it
              if (data.text.endsWith('.') || data.text.endsWith('!') || data.text.endsWith('?') || data.text.length > 20) {
                handleVoiceInput(data.text);
                setCurrentTranscript('');
              }
            }
            
            if (data.type === 'audio' && data.audioData) {
              console.log('🔊 Received TTS audio');
              playAudioResponse(data.audioData);
            }
          } catch (error) {
            console.error('❌ Error parsing WebSocket message:', error);
          }
        };

        wsRef.current.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          reject(error);
        };

        wsRef.current.onclose = () => {
          console.log('📡 WebSocket disconnected');
          setIsConnected(false);
        };

      } catch (error) {
        console.error('❌ Failed to initialize WebSocket:', error);
        reject(error);
      }
    });
  };

  // Initialize WebAudio API with AudioWorklet
  const initializeWebAudio = async () => {
    try {
      if (!permissionGranted) {
        const granted = await requestMicrophonePermission();
        if (!granted) {
          throw new Error('Microphone permission required');
        }
      }

      // Get audio stream
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Create AudioContext
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });

      // Create and add AudioWorklet
      const workletBlob = new Blob([audioWorkletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(workletBlob);
      await audioContextRef.current.audioWorklet.addModule(workletUrl);

      // Create AudioWorkletNode
      workletNodeRef.current = new AudioWorkletNode(audioContextRef.current, 'audio-capture-processor');
      
      // Handle audio data from worklet
      workletNodeRef.current.port.onmessage = (event) => {
        if (event.data.type === 'audioData' && wsRef.current?.readyState === WebSocket.OPEN) {
          const wavBlob = createWavBlob(event.data.buffer);
          
          // Convert blob to base64 for WebSocket transmission
          const reader = new FileReader();
          reader.onload = () => {
            const base64Data = reader.result.split(',')[1];
            wsRef.current.send(JSON.stringify({
              type: 'audio',
              data: base64Data
            }));
          };
          reader.readAsDataURL(wavBlob);
        }
      };

      // Connect audio nodes
      const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
      source.connect(workletNodeRef.current);

      console.log('✅ WebAudio initialized with 16kHz PCM16 processing');
      return true;

    } catch (error) {
      console.error('❌ Failed to initialize WebAudio:', error);
      return false;
    }
  };

  // Handle voice input and send to AI backend with TTS
  const handleVoiceInput = async (transcript) => {
    try {
      console.log('🗣️ Processing user input:', transcript);
      
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

      // Create audio blob and URL - use correct MIME type for WAV
      const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
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

  // Start listening with WebAudio
  const startListening = async () => {
    console.log('🎯 Attempting to start listening...');
    
    if (!isConnected) {
      console.error('❌ Voice chat not connected. Please connect first.');
      return;
    }
    
    if (!navigator.onLine) {
      console.error('❌ No internet connection.');
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

    try {
      // Resume AudioContext if suspended (required for some browsers)
      if (audioContextRef.current?.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      console.log('🎤 Starting real-time audio capture...');
      setCurrentTranscript('');
      setIsListening(true);
      isRecordingRef.current = true;
      
    } catch (error) {
      console.error('❌ Failed to start listening:', error);
      setIsListening(false);
      
      if (retryCount < 3) {
        console.log('🔄 Retrying audio capture...');
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          startListening();
        }, 1000 + (retryCount * 1000));
      }
    }
  };

  // Stop listening
  const stopListening = () => {
    if (isListening) {
      console.log('🛑 Stopping audio capture...');
      setIsListening(false);
      isRecordingRef.current = false;
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

  // Connect to voice chat
  const connectVoiceChat = async () => {
    console.log('🎤 Connecting to voice chat...');
    
    // Check if backend supports voice chat
    await checkVoiceChatStatus();
    
    if (!voiceChatEnabled) {
      alert('Voice chat is not available. Please configure OPENAI_API_KEY and CARTESIA_API_KEY on the backend.');
      return;
    }
    
    try {
      // Initialize WebSocket connection
      await initializeWebSocket();
      
      // Initialize WebAudio processing
      const audioInitialized = await initializeWebAudio();
      
      if (audioInitialized) {
        setIsConnected(true);
        setRetryCount(0);
        console.log('✅ Voice chat connected with WebAudio + WebSocket streaming');
      } else {
        console.error('❌ Failed to initialize audio processing');
      }
    } catch (error) {
      console.error('❌ Failed to connect voice chat:', error);
    }
  };

  // Disconnect voice chat
  const disconnectVoiceChat = () => {
    console.log('👋 Disconnecting voice chat...');
    
    // Clear any pending retries
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    
    // Stop WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    // Stop WebAudio
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // Stop audio stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Stop AI audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
    }
    
    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);
    setRetryCount(0);
    isRecordingRef.current = false;
    console.log('✅ Voice chat disconnected');
  };

  // Initialize on mount
  useEffect(() => {
    console.log('🎤 Initializing WebAudio + WebSocket voice chat system...');
    
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
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="voice-chat-container">
      <div className="voice-controls">
        <div className="voice-status">
          <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢 Voice Chat Ready (WebAudio + Whisper)' : '🔴 Disconnected'}
          </div>
          
          {!navigator.onLine && (
            <div className="network-warning">
              <span>⚠️ No internet connection</span>
            </div>
          )}
          
          {retryCount >= 3 && (
            <div className="error-message">
              <span>❌ Voice recognition unavailable.</span>
              <button
                className="reconnect-button"
                onClick={() => {
                  setRetryCount(0);
                  disconnectVoiceChat();
                  setTimeout(() => connectVoiceChat(), 1000);
                }}
              >
                🔄 Reconnect
              </button>
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
              >
                🎤 Connect Voice Chat
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