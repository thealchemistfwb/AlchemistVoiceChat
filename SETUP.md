# Financial Insights Chatbot with Plaid & Qwen3

A modern React chatbot application that provides financial insights by connecting to your bank accounts via Plaid API and analyzing your spending patterns with Qwen3 AI.

## Features

- Real-time chat interface with Qwen3
- Plaid API integration for secure bank account access
- Automatic analysis of spending patterns and transactions
- Financial insights without giving financial advice
- Modern React frontend with responsive design
- Node.js/Express backend API
- Conversation history tracking
- Loading states and typing indicators
- Error handling and recovery

## Prerequisites

- Node.js 18 or higher
- Google AI Studio API key
- Plaid developer account and API keys

## Setup Instructions

### 1. Get Google AI Studio API Key

1. Visit [Google AI Studio](https://ai.google.dev/)
2. Create an account or sign in
3. Generate an API key
4. Keep this key secure - you'll need it for the backend

### 2. Get Plaid API Keys

1. Visit [Plaid Dashboard](https://dashboard.plaid.com/overview/development)
2. Create a developer account or sign in
3. Create a new application
4. Get your Client ID and Secret key from the Keys section
5. Start with Sandbox environment for testing

### 3. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env file and add your API keys
# GOOGLE_AI_API_KEY=your_actual_api_key_here
# PLAID_CLIENT_ID=your_plaid_client_id
# PLAID_SECRET=your_plaid_secret_key
# PLAID_ENV=sandbox
# PORT=3001
```

### 4. Frontend Setup

```bash
# Navigate back to root directory
cd ..

# Install frontend dependencies (if not already done)
npm install
```

### 5. Running the Application

You'll need to run both the backend and frontend:

#### Terminal 1 - Backend Server
```bash
cd backend
npm run dev
```

#### Terminal 2 - Frontend Development Server
```bash
npm start
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## Project Structure

```
chatbot-app/
├── src/
│   ├── components/
│   │   ├── ChatBot.js          # Main chat component
│   │   └── ChatBot.css         # Chat styling
│   ├── App.js                  # Main app component
│   └── ...
├── backend/
│   ├── server.js               # Express server with Gemini integration
│   ├── package.json            # Backend dependencies
│   ├── .env.example            # Environment variables template
│   └── .env                    # Your environment variables (create this)
└── SETUP.md
```

## Using the Application

1. **Start both servers** (backend and frontend)
2. **Open the application** in your browser at http://localhost:3000
3. **Connect your bank account** using the "Connect Your Bank" button
   - This uses Plaid Link for secure authentication
   - In sandbox mode, you can use test credentials (username: `user_good`, password: `pass_good`)
   - The connection is handled securely through Plaid's infrastructure
4. **Start chatting** with questions like:
   - "What are my recent spending patterns?"
   - "Which merchants do I spend the most at?"
   - "How much did I spend on food this month?"
   - "Show me my largest transactions recently"
5. **Disconnect** your bank account anytime using the disconnect button

## API Endpoints

- `POST /api/chat` - Send message to chatbot with optional financial context
- `POST /api/plaid/create-link-token` - Create Plaid Link token for frontend
- `POST /api/plaid/exchange-public-token` - Exchange public token for access token
- `POST /api/plaid/financial-summary` - Get financial summary for access token
- `GET /api/health` - Health check endpoint

## Environment Variables

### Backend (.env)
- `GOOGLE_AI_API_KEY` - Your Google AI Studio API key
- `PLAID_CLIENT_ID` - Your Plaid client ID
- `PLAID_SECRET` - Your Plaid secret key
- `PLAID_ENV` - Plaid environment (sandbox, development, production)
- `PORT` - Server port (default: 3001)

## Troubleshooting

1. **"GOOGLE_AI_API_KEY is required" error**
   - Make sure you've created the `.env` file in the backend directory
   - Ensure your API key is correctly set in the `.env` file

2. **Plaid API errors**
   - Verify your Plaid credentials are correct in the `.env` file
   - Ensure you're using the correct environment (sandbox for testing)
   - Check that your access token is valid and not expired

3. **Connection refused errors**
   - Ensure the backend server is running on port 3001
   - Check that both servers are running simultaneously

4. **CORS errors**
   - The backend includes CORS middleware for development
   - Ensure you're accessing the frontend through http://localhost:3000

5. **No financial data in responses**
   - Make sure you've entered a valid Plaid access token
   - Check the browser console for any API errors
   - Verify your Plaid environment matches your access token

## Development

- Backend uses nodemon for auto-restart during development
- Frontend uses React's development server with hot reloading
- Both servers support hot reloading for faster development

## License

MIT