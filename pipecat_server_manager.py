#!/usr/bin/env python3

import asyncio
import subprocess
import sys
import os
import logging
from typing import Dict, Optional
from dataclasses import dataclass

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, JSONResponse
import aiohttp
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Finley Voice AI Server", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@dataclass
class BotProcess:
    process: subprocess.Popen
    room_url: str
    access_token: Optional[str] = None

# Store running bot processes
bot_processes: Dict[int, BotProcess] = {}

class DailyRoomManager:
    """Manages Daily.co room creation and tokens"""
    
    def __init__(self):
        self.api_key = os.getenv("DAILY_API_KEY")
        if not self.api_key:
            logger.warning("⚠️ DAILY_API_KEY not set - room creation will fail")
    
    async def create_room(self, room_name: Optional[str] = None) -> Dict:
        """Create a Daily.co room"""
        if not self.api_key:
            raise HTTPException(status_code=500, detail="Daily.co API key not configured")
        
        url = "https://api.daily.co/v1/rooms"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        room_config = {
            "properties": {
                "max_participants": 2,  # User + Bot
                "enable_chat": False,
                "enable_knocking": False,
                "enable_screenshare": False,
                "enable_recording": False,
                "start_video_off": True,  # Audio-first experience
                "start_audio_off": False,
            }
        }
        
        if room_name:
            room_config["name"] = room_name
            
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, json=room_config) as response:
                if response.status == 200:
                    data = await response.json()
                    logger.info(f"🏠 Created room: {data['name']}")
                    return data
                else:
                    error_text = await response.text()
                    logger.error(f"❌ Room creation failed: {response.status} - {error_text}")
                    raise HTTPException(status_code=response.status, detail=f"Room creation failed: {error_text}")
    
    async def create_token(self, room_url: str, user_name: str = "user") -> str:
        """Create a Daily.co access token for a room"""
        if not self.api_key:
            raise HTTPException(status_code=500, detail="Daily.co API key not configured")
        
        url = "https://api.daily.co/v1/meeting-tokens"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        token_config = {
            "properties": {
                "room_name": room_url.split("/")[-1],  # Extract room name from URL
                "user_name": user_name,
                "is_owner": False,
            }
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, headers=headers, json=token_config) as response:
                if response.status == 200:
                    data = await response.json()
                    logger.info(f"🎫 Created token for room")
                    return data["token"]
                else:
                    error_text = await response.text()
                    logger.error(f"❌ Token creation failed: {response.status} - {error_text}")
                    raise HTTPException(status_code=response.status, detail=f"Token creation failed: {error_text}")

# Initialize Daily.co room manager
daily_manager = DailyRoomManager()

@app.get("/")
async def redirect_to_room():
    """Create a room and redirect browser to Daily.co for quick testing"""
    try:
        # Create room and tokens
        room_data = await daily_manager.create_room()
        room_url = room_data["url"]
        
        user_token = await daily_manager.create_token(room_url, "user")
        bot_token = await daily_manager.create_token(room_url, "finley_bot")
        
        # Start bot process
        await start_bot_process(room_url, bot_token)
        
        # Redirect user to Daily.co room
        daily_room_url = f"{room_url}?t={user_token}"
        logger.info(f"🔗 Redirecting to: {daily_room_url}")
        
        return RedirectResponse(url=daily_room_url)
        
    except Exception as e:
        logger.error(f"❌ Room setup failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/bots/start")
async def start_bot_session(
    room_name: Optional[str] = None,
    access_token: Optional[str] = None
):
    """Start a new voice AI bot session (RTVI-compatible endpoint)"""
    try:
        # Create room and tokens
        room_data = await daily_manager.create_room(room_name)
        room_url = room_data["url"]
        
        user_token = await daily_manager.create_token(room_url, "user")
        bot_token = await daily_manager.create_token(room_url, "finley_bot")
        
        # Start bot process
        bot_pid = await start_bot_process(room_url, bot_token, access_token)
        
        return {
            "room_url": room_url,
            "token": user_token,
            "bot_id": bot_pid,
            "config": {
                "audio_in_enabled": True,
                "audio_out_enabled": True,
                "video_out_enabled": False,
            }
        }
        
    except Exception as e:
        logger.error(f"❌ Bot session start failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/bots/stop")
async def stop_bot_session(bot_id: int):
    """Stop a running bot session"""
    try:
        if bot_id not in bot_processes:
            raise HTTPException(status_code=404, detail="Bot session not found")
        
        bot_process = bot_processes[bot_id]
        bot_process.process.terminate()
        
        try:
            bot_process.process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            bot_process.process.kill()
        
        del bot_processes[bot_id]
        logger.info(f"🛑 Stopped bot session {bot_id}")
        
        return {"status": "stopped", "bot_id": bot_id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Failed to stop bot {bot_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": str(asyncio.get_event_loop().time()),
        "services": {
            "daily_configured": bool(os.getenv("DAILY_API_KEY")),
            "openai_configured": bool(os.getenv("OPENAI_API_KEY")),
            "cartesia_configured": bool(os.getenv("CARTESIA_API_KEY")),
            "deepgram_configured": bool(os.getenv("DEEPGRAM_API_KEY")),
            "google_ai_configured": bool(os.getenv("GOOGLE_AI_API_KEY")),
        },
        "active_bots": len(bot_processes)
    }

@app.get("/api/v1/bots")
async def list_bot_sessions():
    """List all active bot sessions"""
    sessions = []
    for pid, bot_process in bot_processes.items():
        sessions.append({
            "bot_id": pid,
            "room_url": bot_process.room_url,
            "has_access_token": bool(bot_process.access_token),
            "status": "running" if bot_process.process.poll() is None else "stopped"
        })
    
    return {"sessions": sessions}

async def start_bot_process(room_url: str, token: str, access_token: Optional[str] = None) -> int:
    """Start a new Pipecat bot process"""
    
    # Command to run the bot
    cmd = [
        sys.executable, 
        "pipecat_server.py",
        "--url", room_url,
        "--token", token
    ]
    
    if access_token:
        cmd.extend(["--access-token", access_token])
    
    # Start the process
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=os.environ.copy()
    )
    
    # Store process info
    bot_processes[process.pid] = BotProcess(
        process=process,
        room_url=room_url,
        access_token=access_token
    )
    
    logger.info(f"🚀 Started bot process {process.pid} for room {room_url}")
    return process.pid

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up bot processes on shutdown"""
    logger.info("🛑 Shutting down server, stopping all bots...")
    
    for pid, bot_process in bot_processes.items():
        try:
            bot_process.process.terminate()
            bot_process.process.wait(timeout=3)
        except:
            bot_process.process.kill()
    
    bot_processes.clear()

if __name__ == "__main__":
    import uvicorn
    
    # Validate required environment variables
    required_vars = ["DAILY_API_KEY", "CARTESIA_API_KEY"]
    optional_vars = ["OPENAI_API_KEY", "DEEPGRAM_API_KEY", "GOOGLE_AI_API_KEY"]
    
    missing_required = [var for var in required_vars if not os.getenv(var)]
    if missing_required:
        logger.error(f"❌ Missing required environment variables: {missing_required}")
        sys.exit(1)
    
    available_optional = [var for var in optional_vars if os.getenv(var)]
    if not available_optional:
        logger.error(f"❌ At least one of these environment variables is required: {optional_vars}")
        sys.exit(1)
    
    logger.info("🌟 Starting Finley Voice AI Server")
    logger.info(f"📋 Available services: {', '.join(available_optional)}")
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=7860,  # Standard Pipecat port
        log_level="info"
    ) 