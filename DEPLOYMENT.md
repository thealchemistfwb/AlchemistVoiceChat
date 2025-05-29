# Vercel Deployment Instructions

## Prerequisites
1. Vercel account (https://vercel.com)
2. All required API keys

## Required Environment Variables in Vercel
Set these in your Vercel dashboard under Project Settings > Environment Variables:

### Required:
- `GOOGLE_AI_API_KEY` - Your Google AI API key for Gemini Live
- `PLAID_CLIENT_ID` - Your Plaid client ID  
- `PLAID_SECRET` - Your Plaid secret key
- `PLAID_ENV` - Set to `sandbox` for testing or `production`

### Optional (for enhanced features):
- `CARTESIA_API_KEY` - For voice synthesis
- `DAILY_API_KEY` - For Daily.co video calls
- `OPENAI_API_KEY` - For Whisper STT backup

### Automatic:
- `NODE_ENV` - Automatically set to `production`
- `VERCEL` - Automatically set to `1`

## Deployment Steps

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Prepare for Vercel deployment"
   git push origin main
   ```

2. **Deploy to Vercel:**
   - Go to https://vercel.com
   - Import your GitHub repository
   - Add environment variables in project settings
   - Deploy!

3. **Test the deployment:**
   - Frontend will be at: `https://your-app.vercel.app`
   - API will be at: `https://your-app.vercel.app/api/health`

## Architecture Changes for Vercel
- ✅ Express app exports for serverless functions
- ✅ All dependencies consolidated in root package.json  
- ✅ API routes work via `/api/*` paths
- ✅ CORS issues resolved by same-origin deployment
- ✅ Conditional server startup (local vs Vercel)

## Testing Checklist
- [ ] Frontend loads correctly
- [ ] `/api/health` endpoint responds
- [ ] Plaid connection works
- [ ] Gemini Live streaming functions
- [ ] Voice chat features work without CORS errors