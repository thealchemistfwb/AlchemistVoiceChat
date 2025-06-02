# 🎤 AlchemistVoiceChat

A sophisticated AI-powered voice chat application featuring real-time speech-to-speech conversation with **Google Gemini Live API**, financial insights through **Plaid integration**, and advanced voice synthesis.

## ✨ Features

### 🎯 Core Features
- **🎙️ Real-time Voice Chat** - Powered by Google Gemini Live API for native speech-to-speech communication
- **💰 Financial Assistant** - Integration with Plaid for banking data analysis and insights
- **📊 Interactive Charts** - Visual spending analysis and financial summaries
- **🏠 AI Budget Management** - Smart budgeting with 4 categories: Foundations, Delights, Nest Egg, Wild Cards
- **🧠 "Feels Like" Spending** - Predictive spending analysis based on AI pattern recognition
- **🗣️ High-Quality Voice Synthesis** - Multiple voice options via Cartesia API
- **🎥 Video Chat Support** - Daily.co integration for enhanced communication

### 🔧 Technical Features
- **⚡ Real-time Audio Streaming** - WebRTC-based audio pipeline
- **🌐 Serverless Deployment** - Optimized for Vercel with automatic scaling
- **🔒 Secure API Integration** - Protected environment variables and secure endpoints
- **📱 Responsive Design** - Works seamlessly across desktop and mobile devices

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Google AI API key (for Gemini Live)
- Plaid API credentials
- Optional: Cartesia, Daily.co, OpenAI API keys

### Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/AlchemistVoiceChat.git
   cd AlchemistVoiceChat
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. **Start the development servers:**
   ```bash
   # Terminal 1: Start backend
   cd backend && npm start

   # Terminal 2: Start frontend  
   npm start
   ```

5. **Open your browser:**
   ```
   http://localhost:3000
   ```

## 🌐 Deployment to Vercel

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Deploy to Vercel"
   git push origin main
   ```

2. **Deploy to Vercel:**
   - Import your GitHub repository at [vercel.com](https://vercel.com)
   - Add environment variables in project settings
   - Deploy automatically!

3. **Required Environment Variables:**
   ```
   GOOGLE_AI_API_KEY=your_google_ai_key
   PLAID_CLIENT_ID=your_plaid_client_id  
   PLAID_SECRET=your_plaid_secret
   PLAID_ENV=sandbox
   ```

   **Optional:**
   ```
   CARTESIA_API_KEY=your_cartesia_key
   DAILY_API_KEY=your_daily_key
   OPENAI_API_KEY=your_openai_key
   ```

## 🏗️ Architecture

```
AlchemistVoiceChat/
├── 📁 src/                    # React frontend
│   ├── 📁 components/         # UI components
│   └── 📁 utils/              # Utility functions
├── 📁 backend/                # Express.js API server
│   ├── 📄 server.js           # Main server file
│   ├── 📄 plaidClient.js      # Plaid integration
│   ├── 📄 cartesiaService.js  # Voice synthesis
│   └── 📄 geminiLiveStreamingService.js # Gemini Live API
├── 📁 api/                    # Vercel serverless functions
├── 📄 vercel.json             # Vercel configuration
└── 📄 package.json            # Dependencies and scripts
```

## 🎯 Key Technologies

- **Frontend:** React 19, Chart.js, Web Audio API
- **Backend:** Express.js, WebSocket, Multer
- **AI/Voice:** Google Gemini Live API, Cartesia, OpenAI Whisper
- **Financial:** Plaid API for banking integration
- **Database:** Convex for real-time budget data
- **Deployment:** Vercel serverless functions
- **Real-time:** WebRTC, WebSocket connections

## 🎮 Usage

### Voice Chat
1. Click "Start Gemini Live Streaming"
2. Allow microphone permissions
3. Click "Start Streaming" 
4. Speak naturally - the AI responds in real-time!

### Financial Analysis  
1. Connect your bank account via Plaid
2. Ask questions like "What did I spend on groceries?"
3. View interactive charts and spending insights

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Google** for the incredible Gemini Live API
- **Plaid** for secure financial data integration  
- **Cartesia** for high-quality voice synthesis
- **Vercel** for seamless deployment platform

---

Built with ❤️ for the future of conversational AI
