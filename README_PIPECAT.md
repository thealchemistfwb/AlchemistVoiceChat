# Finley Voice AI - Pipecat Edition

A real-time voice AI financial assistant built with **Pipecat** and **Daily.co**, providing natural conversation with interruption capabilities, low-latency responses, and professional-grade voice quality.

## 🌟 What Makes This Special

Unlike traditional voice assistants, this implementation provides:

- **Real-time conversation** with <500ms response times
- **Natural interruption handling** - you can interrupt the AI mid-sentence
- **Professional voice quality** using Cartesia's Sonic model
- **WebRTC-powered** audio transport via Daily.co for enterprise-grade reliability
- **Modular AI services** - mix and match STT, LLM, and TTS providers
- **Financial context awareness** - integrates with your existing Plaid setup

## 🏗️ Architecture

This solution uses the **Pipecat framework** - the industry standard for real-time voice AI:

```
User Microphone → Daily.co WebRTC → Pipecat Pipeline → AI Response → Daily.co → User Speakers
                                        ↓
                                   [STT] → [LLM] → [TTS]
                                 Deepgram   GPT-4  Cartesia
```

### Key Components

1. **Pipecat Server** (`pipecat_server.py`) - Core voice AI pipeline
2. **Server Manager** (`pipecat_server_manager.py`) - FastAPI server for managing bot instances
3. **Web Client** (`pipecat_client.html`) - Simple web interface using Daily.co SDK

## 🚀 Quick Start

### 1. Install Dependencies

```bash
# Install Pipecat with required services
pip install -r pipecat_requirements.txt

# Or install manually:
pip install "pipecat-ai[daily,deepgram,cartesia,openai,silero]>=0.0.68"
```

### 2. Configure Environment

```bash
# Copy environment template
cp pipecat_env_template .env

# Edit .env with your API keys:
# - DAILY_API_KEY (required)
# - CARTESIA_API_KEY (required) 
# - DEEPGRAM_API_KEY or OPENAI_API_KEY (required for STT)
# - OPENAI_API_KEY or GOOGLE_AI_API_KEY (required for LLM)
```

### 3. Start the Server

```bash
# Start the Pipecat server manager
python pipecat_server_manager.py
```

### 4. Test Voice Chat

**Option A: Browser Testing**
```bash
# Navigate to http://localhost:7860/ 
# This will auto-create a room and redirect you to Daily.co
```

**Option B: Custom Client**
```bash
# Open pipecat_client.html in your browser
# Click "Connect Voice Chat" and allow microphone access
```

## 🔧 Configuration Options

### STT (Speech-to-Text) Services

**Deepgram (Recommended)**
- Best accuracy and speed for real-time conversation
- Set `DEEPGRAM_API_KEY` in .env

**OpenAI Whisper**
- Good accuracy, slightly higher latency
- Set `OPENAI_API_KEY` in .env

### LLM Services

**OpenAI GPT-4o-mini (Recommended)**
- Optimized for real-time conversation
- Uses existing `OPENAI_API_KEY`

**Google Gemini**
- Alternative LLM option
- Set `GOOGLE_AI_API_KEY` in .env

### TTS (Text-to-Speech)

**Cartesia Sonic (Required)**
- Ultra-low latency, high-quality voices
- Industry-leading for real-time applications
- Set `CARTESIA_API_KEY` in .env

## 🎛️ API Endpoints

The server manager provides RTVI-compatible endpoints:

### Start Bot Session
```bash
POST /api/v1/bots/start
{
  "room_name": "optional-room-name",
  "access_token": "optional-plaid-token"
}
```

### Stop Bot Session
```bash
POST /api/v1/bots/stop
{
  "bot_id": 12345
}
```

### Health Check
```bash
GET /api/health
```

### List Active Sessions
```bash
GET /api/v1/bots
```

## 🔍 Debugging & Monitoring

### Real-time Logs
```bash
# Watch Pipecat server logs
tail -f pipecat_server.log

# Watch server manager logs
python pipecat_server_manager.py
```

### Performance Metrics
- Enable metrics in the pipeline configuration
- Monitor response times, audio quality, and API usage
- Access via `/api/health` endpoint

### Common Issues

**"Daily.co connection failed"**
- Verify `DAILY_API_KEY` is set correctly
- Check internet connection and firewall settings

**"Audio format not supported"** 
- Ensure browser supports WebRTC (Chrome, Firefox recommended)
- Allow microphone permissions when prompted

**"High latency responses"**
- Use Deepgram for STT instead of OpenAI Whisper
- Ensure good internet connection
- Check API rate limits

## 🏢 Production Deployment

### Environment Variables for Production
```bash
DAILY_API_KEY=prod_daily_key
CARTESIA_API_KEY=prod_cartesia_key
DEEPGRAM_API_KEY=prod_deepgram_key
OPENAI_API_KEY=prod_openai_key

# Scale configuration
PIPECAT_MAX_CONCURRENT_BOTS=10
PIPECAT_LOG_LEVEL=WARNING
```

### Deployment Options

**Pipecat Cloud (Recommended)**
- Official hosting platform from Daily/Pipecat team
- Auto-scaling, monitoring, and optimization
- Deploy with: `pipecat deploy`

**Self-hosted**
- Docker container deployment
- Kubernetes for auto-scaling
- Monitor resource usage (CPU, memory, network)

## 🔗 Integration with Existing App

### Embed in React App
```javascript
// Use Daily.co React SDK
import { useDaily } from '@daily-co/daily-react';

// Connect to Pipecat bot
const connectToFinley = async () => {
  const response = await fetch('/api/v1/bots/start', {
    method: 'POST',
    body: JSON.stringify({ access_token: plaidToken })
  });
  const { room_url, token } = await response.json();
  
  // Join with Daily SDK
  await callFrame.join({ url: room_url, token });
};
```

### Pass Financial Context
```python
# In pipecat_server.py, enhance the FinancialAssistantProcessor
async def _create_enhanced_prompt(self, user_text: str) -> str:
    if self.access_token:
        # Fetch real financial data
        financial_data = await get_financial_summary(self.access_token)
        
        enhanced = f"""User question: {user_text}

Financial Context:
- Total Balance: ${financial_data.total_balance}
- Recent Spending: ${financial_data.monthly_spending}
- Top Categories: {financial_data.top_categories}
"""
        return enhanced
    return user_text
```

## 🆚 Comparison with Previous Approach

| Feature | Previous (WebSocket + Manual) | Pipecat + Daily.co |
|---------|-------------------------------|---------------------|
| **Interruption Handling** | ❌ Not supported | ✅ Natural interruptions |
| **Response Time** | ~2-3 seconds | ⚡ <500ms |
| **Audio Quality** | Variable | 🎵 Professional grade |
| **Reliability** | Basic error handling | 🛡️ Enterprise-grade |
| **Scalability** | Single instance | 📈 Auto-scaling |
| **Maintenance** | Custom debugging | 🔍 Built-in monitoring |

## 🎯 Next Steps

1. **Test the Implementation**: Start with the basic setup and verify voice quality
2. **Integrate Financial Data**: Connect your existing Plaid integration
3. **Customize Voice & Personality**: Modify the system prompt and voice settings
4. **Add Visual Elements**: Implement avatar animations using RTVI
5. **Deploy to Production**: Use Pipecat Cloud or your preferred hosting

## 💡 Advanced Features

- **Function Calling**: Let Finley execute actions (transfer money, pay bills)
- **Multi-modal**: Add vision capabilities for document analysis
- **Memory**: Implement conversation memory across sessions
- **Analytics**: Track user interactions and optimize responses

## 📚 Learn More

- [Pipecat Documentation](https://docs.pipecat.ai/)
- [Daily.co WebRTC Platform](https://daily.co/)
- [RTVI Standard](https://docs.rtvi.ai/)
- [Cartesia Voice Models](https://cartesia.ai/)

---

**Built with ❤️ using Pipecat - The Open Source Framework for Voice & Multimodal AI** 