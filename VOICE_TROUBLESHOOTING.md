# 🔧 Voice Chat Troubleshooting Guide

## Quick Fix for "Immediately Stops" Issue

### Step-by-Step Debugging:

1. **Open Browser Console** (F12 → Console tab)
2. **Switch to Voice Chat Mode** (click "🎤 Voice Chat")
3. **Look for these specific log messages:**

```
🎤 Initializing voice chat...
✅ Voice chat initialized
🎤 Speech recognition initialized
🎙️ Microphone permission status: [granted/denied/prompt]
```

4. **Click "🎙️ Grant Microphone Access"** (if shown)
5. **Watch for these messages when starting:**

```
🎯 Attempting to start listening...
State check - isListening: false isSpeaking: false recognitionRef exists: true permissionGranted: true
🎤 Starting speech recognition...
✅ Speech recognition started successfully
🎵 Starting audio visualization...
✅ Microphone access granted for visualization
```

## Common Issues & Solutions:

### Issue 1: Permission Denied
**Symptoms:** Red microphone icon in address bar, permission button doesn't work
**Solution:**
1. Click the 🔒 or 🎤 icon in browser address bar
2. Set microphone to "Allow"
3. Refresh the page
4. Try again

### Issue 2: Speech Recognition Immediately Stops
**Console shows:** `🛑 Speech recognition ended` right after `✅ Speech recognition started successfully`

**Solutions:**
1. **Check Browser Compatibility:**
   - ✅ Chrome (recommended)
   - ✅ Edge
   - ⚠️ Safari (limited support)
   - ❌ Firefox (no Web Speech API)

2. **Try Different Audio Quality:**
   - Click "🔊 Standard" to disable Daily.co
   - Or click "🌐 HD Audio" to enable enhanced streaming

3. **Clear Browser Data:**
   - Go to browser settings
   - Clear cookies and site data for localhost:3000
   - Refresh and try again

### Issue 3: No Audio Visualization
**Symptoms:** No rings around microphone, no audio level bars
**Console shows:** `❌ Error accessing microphone for visualization`

**Solution:** This is not critical - speech recognition can work without visualization. But to fix:
1. Make sure microphone permission is granted
2. Check that no other app is using the microphone
3. Try a different browser

### Issue 4: Speech Not Recognized
**Symptoms:** Audio visualization works, but no transcript appears
**Solutions:**
1. Speak clearly and at normal volume
2. Check internet connection (speech processing may use cloud services)
3. Try shorter phrases first
4. Ensure you're speaking in English

## Browser-Specific Instructions:

### Chrome (Recommended)
1. Go to Settings → Privacy and Security → Site Settings
2. Click "Microphone"
3. Add `http://localhost:3000` to "Allowed" list
4. Refresh the page

### Safari
1. Go to Safari → Preferences → Websites
2. Click "Microphone" 
3. Set localhost to "Allow"
4. Note: Safari has limited Web Speech API support

### Edge
1. Click the 🔒 icon in address bar
2. Set microphone to "Allow"
3. Refresh the page

## Testing Commands:

Try these simple phrases to test recognition:
- "Hello"
- "What is my balance?"
- "Show me my debt"
- "What did I spend on restaurants?"

## Console Commands for Advanced Debugging:

Open browser console and run:

```javascript
// Check Web Speech API support
console.log('Speech Recognition:', 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window);

// Check microphone access
navigator.mediaDevices.getUserMedia({audio: true})
  .then(() => console.log('✅ Microphone access OK'))
  .catch(e => console.log('❌ Microphone access failed:', e));

// Check permissions
navigator.permissions.query({name: 'microphone'})
  .then(result => console.log('Permission state:', result.state));
```

## Expected Console Output (Working):

```
🎤 Initializing voice chat...
✅ Voice chat initialized
🎤 Speech recognition initialized
🎙️ Microphone permission status: granted
🎯 Attempting to start listening...
State check - isListening: false isSpeaking: false recognitionRef exists: true permissionGranted: true
🎤 Starting speech recognition...
✅ Speech recognition started successfully
🎵 Starting audio visualization...
✅ Microphone access granted for visualization
📝 Speech recognition result received
🗣️ Transcript: hello there
📤 Sending final transcript to AI: hello there
```

## If Nothing Works:

1. **Restart browser completely**
2. **Try Chrome incognito mode**
3. **Check if antivirus is blocking microphone access**
4. **Try on a different device/browser**
5. **Fall back to text chat mode** (works independently)

---

*The voice features use cutting-edge Web APIs that may have browser compatibility limitations. Text chat provides full functionality as a reliable alternative.*