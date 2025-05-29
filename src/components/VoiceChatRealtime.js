import React, { useState, useEffect, useRef } from 'react';
import './VoiceChat.css';

const VoiceChatRealtime = ({ accessToken, onMessageUpdate }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [backendStatus, setBackendStatus] = useState(null);
  const [dailyRoom, setDailyRoom] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  
  // Real-time audio and WebSocket refs
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const workletNodeRef = useRef(null);
  const currentAudioRef = useRef(null);
  const isRecordingRef = useRef(false);

  // Check backend real-time voice capabilities
  const checkBackendStatus = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/health');
      const data = await response.json();
      setBackendStatus(data);
      console.log('🏥 Backend status:', data);
    } catch (error) {
      console.error('❌ Backend status check failed:', error);
      setBackendStatus({ error: 'Backend not available' });
    }
  };

  // Start real-time voice session
  const startVoiceSession = async () => {
    try {
      console.log('🚀 Starting real-time voice session...');
      
      const response = await fetch('http://localhost:3001/api/voice/realtime/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'user',
          accessToken: accessToken
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to start voice session: ${response.status}`);
      }

      const data = await response.json();
      setSessionId(data.sessionId);
      setDailyRoom(data.dailyRoom);
      setSessionData(data); // Store the complete session data
      
      console.log('✅ Voice session started:', data);
      
      // Connect WebSocket to session
      await connectWebSocket(data.sessionId);
      
      // Initialize audio processing
      await initializeAudioProcessing();
      
      setIsConnected(true);

    } catch (error) {
      console.error('❌ Failed to start voice session:', error);
    }
  };

  // Connect WebSocket for real-time communication
  const connectWebSocket = async (sessionId) => {
    try {
      wsRef.current = new WebSocket('ws://localhost:3001/ws/audio-stream');
      
      wsRef.current.onopen = () => {
        console.log('🔗 WebSocket connected');
        
        // Join voice session
        wsRef.current.send(JSON.stringify({
          type: 'join_session',
          sessionId: sessionId
        }));
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'session_joined') {
            console.log('✅ Joined voice session via WebSocket');
          } else if (data.type === 'realtime_transcript') {
            console.log('🗣️ Real-time transcript:', data.transcript);
            setCurrentTranscript(data.transcript);
          } else if (data.type === 'voice_response') {
            console.log('🤖 AI response received:', data.aiResponse);
            setAiResponse(data.aiResponse);
            setCurrentTranscript('');
            
            // Play audio response
            if (data.audioData) {
              playAudioResponse(data.audioData);
            }
            
            // Update parent component
            if (onMessageUpdate) {
              onMessageUpdate({
                userMessage: data.userInput,
                aiResponse: data.aiResponse,
                charts: []
              });
            }
          } else if (data.type === 'interrupt_confirmed') {
            console.log('🛑 Interruption confirmed');
            setIsSpeaking(false);
          } else if (data.type === 'error') {
            console.error('❌ WebSocket error:', data.message);
          }
        } catch (error) {
          console.error('❌ WebSocket message error:', error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
      };

      wsRef.current.onclose = () => {
        console.log('📡 WebSocket disconnected');
        setIsConnected(false);
      };

    } catch (error) {
      console.error('❌ WebSocket connection failed:', error);
    }
  };

  // Initialize real-time audio processing with complete WebM files
  const initializeAudioProcessing = async () => {
    try {
      // Get user media with parameters optimized for speech recognition
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      console.log('🎤 Initializing audio with complete WebM file approach...');

      // Check WebM support
      const mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        throw new Error('WebM recording not supported in this browser');
      }

      // Store MediaRecorder state
      let mediaRecorder = null;
      let audioChunks = [];
      let recordingTimer = null;
      let isProcessing = false;

      // Function to create a new MediaRecorder instance
      const createMediaRecorder = () => {
        const recorder = new MediaRecorder(streamRef.current, {
          mimeType: mimeType,
          audioBitsPerSecond: 32000
        });

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunks.push(event.data);
            console.log(`📦 Received chunk, size: ${event.data.size} bytes`);
          }
        };

        recorder.onstop = async () => {
          console.log('🛑 MediaRecorder stopped, creating complete WebM file...');
          
          if (audioChunks.length > 0 && !isProcessing) {
            isProcessing = true;
            
            try {
              // Create a complete WebM file from all chunks
              const blob = new Blob(audioChunks, { type: mimeType });
              audioChunks = []; // Clear chunks
              
              // Read as ArrayBuffer
              const arrayBuffer = await blob.arrayBuffer();
              const uint8Array = new Uint8Array(arrayBuffer);
              
              // Verify WebM header
              const header = uint8Array.slice(0, 4);
              const isValidWebM = header[0] === 0x1a && header[1] === 0x45 && 
                                 header[2] === 0xdf && header[3] === 0xa3;
              
              if (!isValidWebM) {
                console.error('❌ Invalid WebM header:', Array.from(header).map(b => b.toString(16)).join(' '));
                
                // Try to fix with fix-webm-duration
                try {
                  const fixWebmDuration = (await import('fix-webm-duration')).default;
                  const fixedBlob = await fixWebmDuration(blob);
                  const fixedArrayBuffer = await fixedBlob.arrayBuffer();
                  const fixedUint8Array = new Uint8Array(fixedArrayBuffer);
                  
                  const base64Data = btoa(String.fromCharCode(...fixedUint8Array));
                  console.log(`🔧 Fixed WebM file: ${fixedArrayBuffer.byteLength} bytes`);
                  
                  if (wsRef.current?.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                      type: 'audio_chunk',
                      audioData: base64Data,
                      format: 'webm',
                      mimeType: mimeType,
                      isCompleteFile: true,
                      timestamp: Date.now()
                    }));
                  }
                } catch (fixError) {
                  console.error('❌ Failed to fix WebM:', fixError);
                }
              } else {
                console.log(`✅ Valid WebM file created: ${arrayBuffer.byteLength} bytes`);
                
                // Convert to base64 and send
                const base64Data = btoa(String.fromCharCode(...uint8Array));
                
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({
                    type: 'audio_chunk',
                    audioData: base64Data,
                    format: 'webm',
                    mimeType: mimeType,
                    isCompleteFile: true,
                    timestamp: Date.now()
                  }));
                }
              }
            } catch (error) {
              console.error('❌ Error processing audio:', error);
            } finally {
              isProcessing = false;
              
              // If still recording, start a new recording cycle
              if (isRecordingRef.current) {
                startNewRecordingCycle();
              }
            }
          } else {
            isProcessing = false;
            audioChunks = [];
          }
        };

        recorder.onerror = (event) => {
          console.error('❌ MediaRecorder error:', event.error);
          isProcessing = false;
        };

        return recorder;
      };

      // Function to start a new recording cycle
      const startNewRecordingCycle = () => {
        if (!isRecordingRef.current) return;
        
        console.log('🔄 Starting new recording cycle...');
        
        // Create new MediaRecorder
        mediaRecorder = createMediaRecorder();
        audioChunks = [];
        
        // Start recording
        mediaRecorder.start();
        
        // Stop after 3 seconds to create a complete file
        recordingTimer = setTimeout(() => {
          if (mediaRecorder && mediaRecorder.state === 'recording') {
            console.log('⏱️ 3-second recording complete, stopping to create file...');
            mediaRecorder.stop();
            // onstop handler will process the audio and restart if needed
          }
        }, 3000);
      };

      // Store references and functions
      workletNodeRef.current = { 
        createMediaRecorder,
        startNewRecordingCycle,
        getCurrentRecorder: () => mediaRecorder,
        clearTimer: () => {
          if (recordingTimer) {
            clearTimeout(recordingTimer);
            recordingTimer = null;
          }
        }
      };

      // Global functions for starting/stopping recording
      window.startRealTimeRecording = () => {
        isRecordingRef.current = true;
        audioChunks = [];
        startNewRecordingCycle();
        console.log('🎤 Started cyclic recording (3s segments)');
      };

      window.stopRealTimeRecording = async () => {
        isRecordingRef.current = false;
        
        // Clear any pending timer
        if (recordingTimer) {
          clearTimeout(recordingTimer);
          recordingTimer = null;
        }
        
        // Stop current recording if active
        if (mediaRecorder && mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
          console.log('🛑 Stopping current recording...');
        }
      };

      console.log('✅ Audio processing initialized with complete WebM file approach');
      return true;

    } catch (error) {
      console.error('❌ Failed to initialize audio processing:', error);
      return false;
    }
  };

  // Play audio response from base64 data
  const playAudioResponse = async (base64Audio) => {
    try {
      console.log('🔊 Playing AI audio response...');
      setIsSpeaking(true);

      // Convert base64 to audio blob
      const audioData = atob(base64Audio);
      const audioBytes = new Uint8Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        audioBytes[i] = audioData.charCodeAt(i);
      }

      const audioBlob = new Blob([audioBytes], { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(audioBlob);

      // Create and play audio
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

  // Start listening
  const startListening = () => {
    if (!isRecordingRef.current && workletNodeRef.current) {
      setIsListening(true);
      isRecordingRef.current = true;
      
      // Start MediaRecorder
      if (window.startRealTimeRecording) {
        window.startRealTimeRecording();
      }
      
      console.log('🎤 Started real-time listening with MediaRecorder');
    }
  };

  // Stop listening
  const stopListening = () => {
    if (isRecordingRef.current) {
      setIsListening(false);
      isRecordingRef.current = false;
      
      // Stop MediaRecorder
      if (window.stopRealTimeRecording) {
        window.stopRealTimeRecording();
      }
      
      console.log('🛑 Stopped real-time listening');
    }
  };

  // Interrupt AI
  const interruptAI = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
      setIsSpeaking(false);
    }
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'interrupt' }));
    }
    
    console.log('🛑 AI interrupted');
  };

  // Stop voice session
  const stopVoiceSession = async () => {
    try {
      console.log('🛑 Stopping voice session...');
      
      // Stop MediaRecorder
      if (window.stopRealTimeRecording) {
        await window.stopRealTimeRecording();
      }
      
      // Clean up MediaRecorder reference
      if (workletNodeRef.current?.mediaRecorder) {
        const mediaRecorder = workletNodeRef.current.mediaRecorder;
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
          // Wait a bit for final chunks to process
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        workletNodeRef.current = null;
      }
      
      // Close AudioContext if it exists
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      // Stop audio stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      // Close WebSocket
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      
      // Stop any playing audio
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      
      // Call backend to stop session
      if (sessionData?.sessionId) {
        try {
          const response = await fetch('http://localhost:3001/api/voice/realtime/stop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: sessionData.sessionId })
          });
          
          if (response.ok) {
            console.log('✅ Backend session stopped');
          }
        } catch (error) {
          console.error('❌ Error stopping backend session:', error);
        }
      }
      
      setIsConnected(false);
      setIsListening(false);
      setIsSpeaking(false);
      setSessionId(null);
      setDailyRoom(null);
      setSessionData(null);
      isRecordingRef.current = false;
      
      console.log('✅ Voice session stopped');
      
    } catch (error) {
      console.error('❌ Error stopping voice session:', error);
    }
  };

  // Initialize on mount
  useEffect(() => {
    console.log('🎤 Initializing real-time voice chat...');
    checkBackendStatus();
    
    return () => {
      // Cleanup on unmount
      stopVoiceSession();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const isBackendReady = backendStatus && !backendStatus.error && 
    backendStatus.voiceChatEnabled && backendStatus.sttEnabled;

  return (
    <div className="voice-chat-container">
      <div className="voice-controls">
        <div className="voice-status">
          <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢 Real-time Voice Chat Active' : '🔴 Disconnected'}
          </div>
          
          {sessionId && (
            <div className="session-info">
              <small>Session: {sessionId}</small>
              {dailyRoom && <small> | Daily.co: {dailyRoom.name}</small>}
            </div>
          )}
          
          {!isBackendReady && (
            <div className="warning-message">
              <span>⚠️ Backend not ready for real-time voice chat</span>
              {backendStatus?.error && <small>{backendStatus.error}</small>}
            </div>
          )}
        </div>

        <div className="voice-interface">
          {/* Connection Controls */}
          {!isConnected && (
            <div className="connection-controls">
              <button
                className="connect-button"
                onClick={startVoiceSession}
                disabled={!isBackendReady}
              >
                🎤 Start Real-time Voice Chat
              </button>
              {!isBackendReady && (
                <div className="warning-message">
                  <small>⚠️ Requires OPENAI_API_KEY and CARTESIA_API_KEY</small>
                </div>
              )}
            </div>
          )}

          {/* Voice Controls */}
          {isConnected && (
            <div className="voice-buttons">
              <button
                className="disconnect-button"
                onClick={stopVoiceSession}
              >
                🔌 Stop Session
              </button>
              
              <button
                className={`voice-button ${isListening ? 'listening' : ''}`}
                onClick={isListening ? stopListening : startListening}
                disabled={isSpeaking}
              >
                {isListening ? '🛑 Stop Listening' : '🎤 Start Listening'}
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

        {/* Current Transcript */}
        {currentTranscript && (
          <div className="current-transcript">
            <strong>You:</strong> {currentTranscript}
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
    </div>
  );
};

export default VoiceChatRealtime; 