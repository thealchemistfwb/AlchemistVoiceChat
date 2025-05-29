# Daily.co Voice Chat Setup Guide

## Overview

Your voice chat has been successfully upgraded to use **Daily.co** instead of the Web Speech API. This eliminates the "network" errors you were experiencing and provides a more reliable voice chat experience.

## What Changed

✅ **Switched from Web Speech API to Daily.co**
- No more Chrome network errors
- Better audio quality and reliability
- Professional voice chat infrastructure

✅ **Backend Integration**
- Added Daily.co room creation API
- Secure API key management
- Fallback support when API key not configured

✅ **Frontend Updates**
- Updated to use `VoiceChatDaily` component
- Integrated with backend room creation
- Better error handling and status indicators

## Environment Variables Setup

### 1. Backend Configuration (Required)

Create or update `backend/.env` with:

```bash
# Daily.co Configuration
DAILY_API_KEY=your-daily-api-key-here
DAILY_DOMAIN=cloud-561d579d44574015b0db01160f789539.daily.co

# Existing variables (keep these)
GOOGLE_AI_API_KEY=your-google-ai-key
CARTESIA_API_KEY=your-cartesia-key
PLAID_CLIENT_ID=your-plaid-client-id
PLAID_SECRET=your-plaid-secret
```

### 2. Frontend Configuration (Optional)

Create or update `.env` in the project root with:

```bash
# Daily.co Configuration (optional - backend handles room creation)
REACT_APP_DAILY_DOMAIN=cloud-561d579d44574015b0db01160f789539.daily.co
REACT_APP_DAILY_API_KEY=your-daily-api-key-here
```

## Getting Your Daily.co API Key

1. **Sign up for Daily.co**: Go to [daily.co](https://www.daily.co) and create an account
2. **Get your API key**: 
   - Go to the Daily.co dashboard
   - Navigate to the "Developers" section
   - Copy your API key
3. **Add to environment**: Paste the key into your `backend/.env` file

## Testing the Setup

### 1. Check Backend Status
```bash
curl http://localhost:3001/api/health
```

Should return:
```json
{
  "status": "healthy",
  "dailyConfigured": true,
  "voiceChatEnabled": true
}
```

### 2. Test Room Creation
```bash
curl -X POST http://localhost:3001/api/daily/create-room \
  -H "Content-Type: application/json" \
  -d '{"roomName": "test-room"}'
```

### 3. Test Voice Chat
1. Start both backend and frontend
2. Click "Voice Chat" mode in the app
3. Click "Connect Voice Chat"
4. Should show "🟢 Daily.co Connected"

## Fallback Mode

**Good news**: Even without a Daily.co API key, the system will work in fallback mode:
- Creates room URLs using the public Daily.co domain
- May have some limitations but should still function
- Perfect for development and testing

## Troubleshooting

### "Connection Error" in Voice Chat
- Check that backend is running on port 3001
- Verify `DAILY_API_KEY` is set in `backend/.env`
- Check browser console for detailed error messages

### "Room creation failed"
- Verify your Daily.co API key is valid
- Check that you have sufficient Daily.co credits/quota
- Try the fallback mode (remove API key temporarily)

### Audio Issues
- Grant microphone permissions when prompted
- Check browser audio settings
- Try refreshing the page

## Benefits of Daily.co

✅ **No more network errors** - Eliminates Chrome Web Speech API issues
✅ **Better audio quality** - Professional WebRTC infrastructure  
✅ **Global reliability** - Daily.co's worldwide network
✅ **Scalable** - Can handle multiple participants if needed
✅ **Secure** - Enterprise-grade security and privacy

## Next Steps

1. **Get your Daily.co API key** and add it to `backend/.env`
2. **Restart the backend** to pick up the new environment variable
3. **Test the voice chat** - it should now work reliably!
4. **Optional**: Customize room settings in `backend/dailyService.js`

The voice chat should now work much more reliably without the network errors you were experiencing! 