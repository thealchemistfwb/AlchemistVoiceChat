#!/usr/bin/env python3

import asyncio
import os
import argparse
import logging
from typing import Optional

from pipecat.frames.frames import (
    Frame,
    AudioRawFrame,
    TranscriptionFrame,
    TextFrame,
    LLMMessagesFrame,
    TTSStartedFrame,
    TTSStoppedFrame
)
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.openai_llm_context import OpenAILLMContext
from pipecat.services.openai import OpenAILLMService
from pipecat.services.cartesia import CartesiaTTSService  
from pipecat.services.deepgram import DeepgramSTTService
from pipecat.transports.services.daily import DailyParams, DailyTransport
from pipecat.vad.silero import SileroVADAnalyzer
from pipecat.processors.aggregators.vision_image_frame import VisionImageFrameAggregator
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class FinancialAssistantProcessor(FrameProcessor):
    """Custom processor to handle financial context and conversation logic"""
    
    def __init__(self, access_token: Optional[str] = None):
        super().__init__()
        self.access_token = access_token
        self.conversation_context = []
        
    async def process_frame(self, frame: Frame, direction: FrameDirection):
        # Handle transcription frames from user
        if isinstance(frame, TranscriptionFrame):
            user_text = frame.text
            logger.info(f"👤 User said: {user_text}")
            
            # Add to conversation context
            self.conversation_context.append({
                "role": "user",
                "content": user_text
            })
            
            # Create enhanced prompt with financial context
            enhanced_prompt = await self._create_enhanced_prompt(user_text)
            
            # Send enhanced prompt downstream
            await self.push_frame(
                LLMMessagesFrame([
                    {"role": "system", "content": self._get_system_prompt()},
                    *self.conversation_context[-10:],  # Keep last 10 exchanges
                    {"role": "user", "content": enhanced_prompt}
                ]),
                direction
            )
            return
            
        # Handle LLM response frames
        if isinstance(frame, TextFrame):
            response_text = frame.text
            logger.info(f"🤖 Finley responds: {response_text}")
            
            # Add to conversation context
            self.conversation_context.append({
                "role": "assistant", 
                "content": response_text
            })
        
        # Pass frame downstream
        await self.push_frame(frame, direction)
    
    def _get_system_prompt(self) -> str:
        return """You are Finley, a warm and friendly financial AI assistant. 

Key guidelines:
- Keep responses conversational and under 3 sentences for voice interaction
- Be empathetic and supportive about financial topics
- Use natural speech patterns, avoid bullet points in voice responses
- If asked about specific financial data, acknowledge you need account connection
- Stay focused on helpful financial guidance and education
- Speak clearly and naturally as this will be converted to speech

Remember: You're having a real-time voice conversation, so be concise and engaging."""

    async def _create_enhanced_prompt(self, user_text: str) -> str:
        """Enhance user input with financial context if access token available"""
        
        if not self.access_token:
            return user_text
            
        # In a real implementation, you'd fetch financial data here
        # For now, we'll just add context about account connectivity
        enhanced = f"""User question: {user_text}

Context: User has connected their bank account, so you can reference general financial guidance and suggest they explore their spending patterns, account balances, or financial goals."""
        
        return enhanced

async def create_financial_assistant_bot(room_url: str, token: str, access_token: Optional[str] = None):
    """Create and run the Pipecat financial assistant bot"""
    
    # Transport setup - Daily.co WebRTC for real-time audio/video
    transport = DailyTransport(
        room_url,
        token,
        "Finley Financial Assistant",
        DailyParams(
            audio_out_enabled=True,
            audio_in_enabled=True,
            video_out_enabled=False,  # Audio-only for now
            vad_enabled=True,
            vad_analyzer=SileroVADAnalyzer(),
            vad_audio_passthrough=True,
        ),
    )

    # Speech-to-Text with Deepgram (or fallback to OpenAI Whisper)
    stt = None
    if os.getenv("DEEPGRAM_API_KEY"):
        logger.info("🎤 Using Deepgram for speech-to-text")
        stt = DeepgramSTTService(
            api_key=os.getenv("DEEPGRAM_API_KEY"),
            model="nova-2-general",
            language="en",
        )
    elif os.getenv("OPENAI_API_KEY"):
        logger.info("🎤 Using OpenAI Whisper for speech-to-text") 
        from pipecat.services.openai import OpenAISTTService
        stt = OpenAISTTService(
            api_key=os.getenv("OPENAI_API_KEY"),
            model="whisper-1"
        )
    else:
        raise ValueError("Either DEEPGRAM_API_KEY or OPENAI_API_KEY required for STT")

    # Language Model - OpenAI or compatible
    if not os.getenv("OPENAI_API_KEY") and not os.getenv("GOOGLE_AI_API_KEY"):
        raise ValueError("OPENAI_API_KEY or GOOGLE_AI_API_KEY required for LLM")
        
    if os.getenv("OPENAI_API_KEY"):
        logger.info("🧠 Using OpenAI for language model")
        llm = OpenAILLMService(
            api_key=os.getenv("OPENAI_API_KEY"),
            model="gpt-4o-mini",  # Fast model for real-time conversation
        )
    else:
        # Use Google AI as fallback (would need to implement custom service)
        logger.info("🧠 Using Google AI for language model")  
        from pipecat.services.openai import OpenAILLMService
        llm = OpenAILLMService(
            api_key=os.getenv("GOOGLE_AI_API_KEY"),
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
            model="gemini-2.0-flash-exp",
        )

    # Text-to-Speech with Cartesia (high-quality, low-latency)
    if not os.getenv("CARTESIA_API_KEY"):
        raise ValueError("CARTESIA_API_KEY required for TTS")
        
    logger.info("🔊 Using Cartesia for text-to-speech")
    tts = CartesiaTTSService(
        api_key=os.getenv("CARTESIA_API_KEY"),
        voice_id="a0e99841-438c-4a64-b679-ae501e7d6091",  # Professional female voice
        model_id="sonic-multilingual",
        sample_rate=24000,
    )

    # Context management
    context = OpenAILLMContext()
    context_aggregator = llm.create_context_aggregator(context)

    # Custom financial assistant processor
    financial_processor = FinancialAssistantProcessor(access_token)

    # Create the pipeline - order is crucial for proper data flow
    pipeline = Pipeline([
        transport.input(),           # Receive audio from user
        stt,                        # Convert speech to text
        financial_processor,        # Process with financial context
        llm,                        # Generate AI response
        tts,                        # Convert response to speech
        transport.output(),         # Send audio to user
        context_aggregator.assistant()  # Store context
    ])

    # Pipeline configuration
    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            allow_interruptions=True,    # Enable interruption handling
            enable_metrics=True,         # Enable performance metrics
            enable_usage_metrics=True,   # Enable usage tracking
        ),
    )

    # Initialize transport
    await transport.start(task)

    # Run the pipeline
    runner = PipelineRunner()
    await runner.run(task)

async def main():
    parser = argparse.ArgumentParser(description="Finley Financial Assistant Voice AI Bot")
    parser.add_argument("-u", "--url", type=str, required=True, help="Daily.co room URL")
    parser.add_argument("-t", "--token", type=str, required=True, help="Daily.co access token")
    parser.add_argument("-a", "--access-token", type=str, help="Plaid access token for financial data")
    
    args = parser.parse_args()

    # Validate required environment variables
    required_vars = ["CARTESIA_API_KEY"]
    stt_vars = ["DEEPGRAM_API_KEY", "OPENAI_API_KEY"]
    llm_vars = ["OPENAI_API_KEY", "GOOGLE_AI_API_KEY"]
    
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    if missing_vars:
        logger.error(f"❌ Missing required environment variables: {missing_vars}")
        return
        
    if not any(os.getenv(var) for var in stt_vars):
        logger.error(f"❌ At least one STT service required: {stt_vars}")
        return
        
    if not any(os.getenv(var) for var in llm_vars):
        logger.error(f"❌ At least one LLM service required: {llm_vars}")
        return

    logger.info("🚀 Starting Finley Financial Assistant Bot")
    logger.info(f"🏠 Room: {args.url}")
    
    try:
        await create_financial_assistant_bot(args.url, args.token, args.access_token)
    except KeyboardInterrupt:
        logger.info("👋 Shutting down bot")
    except Exception as e:
        logger.error(f"❌ Bot error: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(main()) 