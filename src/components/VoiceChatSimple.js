import React, { useState, useEffect, useRef } from 'react';
import ChartRenderer from './ChartRenderer';
import './VoiceChat.css';

const VoiceChat = ({ accessToken, onMessageUpdate }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [currentCharts, setCurrentCharts] = useState([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [voiceMode, setVoiceMode] = useState('push-to-talk');
  const [permissionGranted, setPermissionGranted] = useState(false);
  
  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyzerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const currentUtteranceRef = useRef(null);

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
        console.log('📤 Sending final transcript to AI:', finalTranscript.trim());
        handleVoiceInput(finalTranscript.trim());
      }
    };

    recognitionRef.current.onerror = (event) => {
      console.error('❌ Speech recognition error:', event.error);
      setIsListening(false);
      
      if (event.error === 'not-allowed') {
        console.error('🚫 Microphone access denied. Please grant permission.');
        setPermissionGranted(false);
      } else if (event.error === 'network') {
        console.error('🌐 Network error. Check internet connection.');
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

  // Handle voice input and send to AI
  const handleVoiceInput = async (transcript) => {
    try {
      console.log('🗣️ User said:', transcript);
      
      // Stop any current AI speech
      if (currentUtteranceRef.current) {
        speechSynthesis.cancel();
        setIsSpeaking(false);
      }

      // Send to AI backend
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: transcript,
          accessToken: accessToken,
          conversationHistory: []
        }),
      });

      const data = await response.json();
      
      setAiResponse(data.message);
      if (data.charts) {
        setCurrentCharts(data.charts);
      }

      // Convert AI response to speech
      speakResponse(data.message);
      
      // Update parent component
      if (onMessageUpdate) {
        onMessageUpdate({
          userMessage: transcript,
          aiResponse: data.message,
          charts: data.charts || []
        });
      }

    } catch (error) {
      console.error('Error processing voice input:', error);
    }
  };

  // Convert text to speech
  const speakResponse = (text) => {
    if (!text) return;

    // Clean HTML tags from response for speech
    const cleanText = text.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 0.8;

    // Choose a pleasant voice
    const voices = speechSynthesis.getVoices();
    const preferredVoice = voices.find(voice => 
      voice.name.includes('Alex') || 
      voice.name.includes('Samantha') ||
      voice.name.includes('Karen') ||
      voice.lang.includes('en-US')
    );
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => {
      console.log('🔊 AI started speaking');
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      console.log('🔊 AI finished speaking');
      setIsSpeaking(false);
      currentUtteranceRef.current = null;
      
      // Resume listening if in always-on mode
      if (voiceMode === 'always-on' && isConnected) {
        setTimeout(() => startListening(), 500);
      }
    };

    currentUtteranceRef.current = utterance;
    speechSynthesis.speak(utterance);
  };

  // Start listening
  const startListening = async () => {
    console.log('🎯 Attempting to start listening...');
    console.log('State check - isListening:', isListening, 'isSpeaking:', isSpeaking, 'recognitionRef exists:', !!recognitionRef.current, 'permissionGranted:', permissionGranted);
    
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
      
      // Start audio visualization
      startAudioVisualization();
    } catch (error) {
      console.error('❌ Failed to start speech recognition:', error);
      setIsListening(false);
    }
  };

  // Stop listening
  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      stopAudioVisualization();
    }
  };

  // Audio visualization
  const startAudioVisualization = () => {
    console.log('🎵 Starting audio visualization...');
    
    if (!audioContextRef.current || !analyzerRef.current) {
      console.log('⚠️ Audio context not ready for visualization');
      return;
    }

    navigator.mediaDevices.getUserMedia({ 
      audio: { 
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      } 
    })
      .then(stream => {
        console.log('✅ Microphone access granted for visualization');
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyzerRef.current);

        const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount);
        
        const updateVisualization = () => {
          if (!isListening) {
            console.log('🛑 Stopping visualization (not listening)');
            return;
          }
          
          analyzerRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(average / 255);
          
          animationFrameRef.current = requestAnimationFrame(updateVisualization);
        };
        
        updateVisualization();
      })
      .catch(error => {
        console.error('❌ Error accessing microphone for visualization:', error);
        console.log('🔇 Continuing without audio visualization');
      });
  };

  const stopAudioVisualization = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setAudioLevel(0);
  };

  // Interrupt AI speech
  const interruptAI = () => {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
      console.log('🛑 AI speech interrupted');
    }
  };

  // Initialize on mount
  useEffect(() => {
    console.log('🎤 Initializing voice chat...');
    
    // Initialize Web Audio API for visualization
    try {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyzerRef.current = audioContextRef.current.createAnalyser();
      analyzerRef.current.fftSize = 256;
      setIsConnected(true);
      console.log('✅ Voice chat initialized');
    } catch (error) {
      console.error('❌ Error initializing audio context:', error);
    }
    
    // Initialize speech recognition
    initializeSpeechRecognition();
    
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
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <div className="voice-chat-container">
      <div className="voice-controls">
        <div className="voice-status">
          <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢 Voice Ready' : '🔴 Connecting...'}
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
          {/* Audio Visualizer */}
          <div className="audio-visualizer">
            <div 
              className="audio-level-bar"
              style={{ 
                height: `${Math.max(audioLevel * 100, 2)}%`,
                backgroundColor: isListening ? '#10B981' : isSpeaking ? '#3B82F6' : '#6B7280'
              }}
            />
            <div className="visualizer-rings">
              {[...Array(3)].map((_, i) => (
                <div 
                  key={i}
                  className={`ring ${isListening || isSpeaking ? 'active' : ''}`}
                  style={{ 
                    animationDelay: `${i * 0.2}s`,
                    borderColor: isListening ? '#10B981' : isSpeaking ? '#3B82F6' : '#6B7280'
                  }}
                />
              ))}
            </div>
          </div>

          {/* Voice Controls */}
          <div className="voice-buttons">
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
                    disabled={!isConnected || isSpeaking}
                  >
                    {isListening ? '🎤 Listening...' : '🎤 Hold to Talk'}
                  </button>
                ) : (
                  <button
                    className={`voice-button ${isListening ? 'listening' : ''}`}
                    onClick={isListening ? stopListening : startListening}
                    disabled={!isConnected}
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

      {/* Charts Display - Synced with Voice */}
      {currentCharts.length > 0 && (
        <div className="voice-charts-display">
          <h3>📊 Visual Analysis</h3>
          {currentCharts.map((chart, index) => (
            <div key={index} className="voice-chart-item">
              <ChartRenderer chartData={chart} />
            </div>
          ))}
        </div>
      )}

      {/* AI Response Display */}
      {aiResponse && (
        <div className="ai-response-display">
          <div className="response-content" dangerouslySetInnerHTML={{ __html: aiResponse }} />
        </div>
      )}
    </div>
  );
};

export default VoiceChat;