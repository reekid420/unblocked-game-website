from fastapi import APIRouter, HTTPException, Depends, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, List, Any
import google.generativeai as genai
import os
import time
from datetime import datetime
import asyncio
from utils.auth import verify_token, get_user_id

# Define router
router = APIRouter()

# Model definitions
class ChatMessage(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str
    hasError: Optional[bool] = False
    errorType: Optional[str] = None

class TopicsResponse(BaseModel):
    topics: List[str]

# Constants for error handling
ERROR_TYPES = {
    "RATE_LIMITED": "RATE_LIMITED",
    "API_UNAVAILABLE": "API_UNAVAILABLE",
    "CONTENT_FILTERED": "CONTENT_FILTERED",
    "TOKEN_LIMIT": "TOKEN_LIMIT",
    "INVALID_REQUEST": "INVALID_REQUEST",
    "UNKNOWN": "UNKNOWN"
}

# Session and rate limiting in-memory stores
# In production, use a proper database
chat_sessions = {}
rate_limits = {}

# Configure constants
SESSION_TIMEOUT = 3600  # 1 hour in seconds
RATE_LIMIT_WINDOW = 60  # 1 minute window
MAX_REQUESTS_PER_WINDOW = 10  # 10 requests per minute

# Initialize Gemini API
def initialize_gemini():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Missing Gemini API key")
    
    genai.configure(api_key=api_key)

# Helper: Check rate limiting
def is_rate_limited(user_id: str) -> Dict[str, Any]:
    now = time.time()
    
    # Initialize rate limiting for new users
    if user_id not in rate_limits:
        rate_limits[user_id] = {
            "count": 1,
            "window_start": now,
            "limited": False,
            "remaining_requests": MAX_REQUESTS_PER_WINDOW - 1,
            "reset_time": now + RATE_LIMIT_WINDOW,
            "consecutive_windows": 0
        }
        return rate_limits[user_id]
    
    user_limit = rate_limits[user_id]
    
    # Reset window if it's expired
    if now - user_limit["window_start"] > RATE_LIMIT_WINDOW:
        # Check if this is consecutive rate limiting
        if user_limit["count"] >= MAX_REQUESTS_PER_WINDOW:
            user_limit["consecutive_windows"] += 1
        else:
            user_limit["consecutive_windows"] = 0
        
        user_limit["count"] = 1
        user_limit["window_start"] = now
        user_limit["limited"] = False
        user_limit["remaining_requests"] = MAX_REQUESTS_PER_WINDOW - 1
        user_limit["reset_time"] = now + RATE_LIMIT_WINDOW
        return user_limit
    
    # Check if user has exceeded limit
    if user_limit["count"] >= MAX_REQUESTS_PER_WINDOW:
        user_limit["limited"] = True
        user_limit["remaining_requests"] = 0
        return user_limit
    
    # Increment counter and update remaining
    user_limit["count"] += 1
    user_limit["remaining_requests"] = MAX_REQUESTS_PER_WINDOW - user_limit["count"]
    user_limit["limited"] = False
    return user_limit

# Helper: Get fallback response based on error type
def get_fallback_response(error_type: str) -> str:
    responses = {
        ERROR_TYPES["RATE_LIMITED"]: "I'm sorry, you've sent too many messages in a short period. Please wait a moment before trying again.",
        ERROR_TYPES["API_UNAVAILABLE"]: "I'm currently experiencing connectivity issues. Please try again in a few minutes.",
        ERROR_TYPES["CONTENT_FILTERED"]: "I'm unable to respond to that message due to content restrictions. Please try a different question.",
        ERROR_TYPES["TOKEN_LIMIT"]: "Your conversation has become too long. Try starting a new conversation or simplifying your question.",
        ERROR_TYPES["INVALID_REQUEST"]: "I couldn't process your request. Please check your message and try again."
    }
    
    return responses.get(error_type, "I'm sorry, I encountered an error while processing your request. Please try again later.")

# Helper: Determine error type from exception
def determine_error_type(error) -> str:
    error_msg = str(error).lower()
    
    if any(term in error_msg for term in ["rate limit", "quota"]):
        return ERROR_TYPES["RATE_LIMITED"]
    elif any(term in error_msg for term in ["content filtered", "safety"]):
        return ERROR_TYPES["CONTENT_FILTERED"]
    elif all(term in error_msg for term in ["token", "limit"]):
        return ERROR_TYPES["TOKEN_LIMIT"]
    elif any(term in error_msg for term in ["invalid request", "bad request"]):
        return ERROR_TYPES["INVALID_REQUEST"]
    elif any(term in error_msg for term in ["unavailable", "timeout", "network"]):
        return ERROR_TYPES["API_UNAVAILABLE"]
    
    return ERROR_TYPES["UNKNOWN"]

# Helper: Clean up old sessions
async def cleanup_old_sessions():
    now = time.time()
    expired_keys = []
    
    for user_id, session in chat_sessions.items():
        if now - session["last_access"] > SESSION_TIMEOUT:
            expired_keys.append(user_id)
    
    for key in expired_keys:
        del chat_sessions[key]
    
    print(f"Cleaned up {len(expired_keys)} expired chat sessions")

# Helper: Clean up old rate limits
async def cleanup_rate_limits():
    now = time.time()
    expired_keys = []
    
    for user_id, rate_data in rate_limits.items():
        if now - rate_data["window_start"] > RATE_LIMIT_WINDOW * 10:
            expired_keys.append(user_id)
    
    for key in expired_keys:
        del rate_limits[key]
    
    print(f"Cleaned up {len(expired_keys)} expired rate limits")

# AI chat endpoint
@router.post("/ai-chat/chat", response_model=ChatResponse)
async def generate_chat_response(
    message_data: ChatMessage,
    user_id: str = Depends(get_user_id)
):
    print(f"Generating chat response for user {user_id}")
    
    # Check rate limiting
    rate_status = is_rate_limited(user_id)
    if rate_status["limited"]:
        print(f"Rate limit exceeded for user: {user_id}, consecutive windows: {rate_status['consecutive_windows']}")
        
        # Calculate time until reset
        reset_in_seconds = max(1, int(rate_status["reset_time"] - time.time()))
        
        # Different message for persistent abusers
        if rate_status["consecutive_windows"] > 3:
            error_message = "I'm sorry, but you've been sending too many messages. Please try again later."
        else:
            error_message = f"I'm sorry, you've reached the limit of {MAX_REQUESTS_PER_WINDOW} messages per minute. Please try again in {reset_in_seconds} seconds."
        
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "error": "Rate limit exceeded",
                "message": error_message,
                "retryAfter": reset_in_seconds
            }
        )
    
    try:
        # Initialize Gemini if needed
        initialize_gemini()
        
        # Get or create session
        if user_id not in chat_sessions:
            chat_sessions[user_id] = {
                "history": [],
                "last_access": time.time()
            }
        
        session = chat_sessions[user_id]
        session["last_access"] = time.time()
        
        # Try to use the latest model with fallbacks
        model_name = "gemini-1.5-pro"
        try:
            print(f"Attempting to use primary Gemini model: {model_name}")
            model = genai.GenerativeModel(model_name)
        except Exception as model_init_error:
            # First fallback
            print(f"Failed to initialize {model_name}, falling back to gemini-1.5-flash")
            model_name = "gemini-1.5-flash"
            try:
                model = genai.GenerativeModel(model_name)
            except Exception as fallback1_error:
                # Second fallback
                print(f"Failed to initialize {model_name}, falling back to gemini-pro")
                model_name = "gemini-pro"
                try:
                    model = genai.GenerativeModel(model_name)
                except Exception as fallback2_error:
                    # Last fallback
                    error_type = determine_error_type(fallback2_error)
                    fallback_message = get_fallback_response(error_type)
                    return {"response": fallback_message, "hasError": True, "errorType": error_type}
        
        # Configure chat parameters
        generation_config = {
            "temperature": 0.7,
            "top_p": 0.8,
            "top_k": 40,
            "max_output_tokens": 2048,
        }
        
        safety_settings = [
            {
                "category": "HARM_CATEGORY_HARASSMENT",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                "category": "HARM_CATEGORY_HATE_SPEECH",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE"
            }
        ]
        
        # Set up the conversation
        chat = model.start_chat(
            history=session["history"],
            generation_config=generation_config,
            safety_settings=safety_settings
        )
        
        # Send the message and get response
        response = chat.send_message(message_data.message)
        
        # Store the updated history
        session["history"] = chat.history
        
        # Return the response
        return {"response": response.text}
    
    except Exception as e:
        error_type = determine_error_type(e)
        fallback_message = get_fallback_response(error_type)
        print(f"AI chat error: {str(e)}")
        
        # For rate limiting errors, return specific status code
        if error_type == ERROR_TYPES["RATE_LIMITED"]:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "error": "Rate limit exceeded",
                    "message": fallback_message,
                    "retryAfter": 60
                }
            )
        
        # For other errors, return 200 with error info (same behavior as the JS version)
        return {
            "response": fallback_message,
            "hasError": True,
            "errorType": error_type
        }

# Get suggested topics endpoint
@router.get("/ai-chat/topics", response_model=TopicsResponse)
async def get_suggested_topics():
    try:
        # These would come from a database in a real app
        topics = [
            "Math homework help",
            "Science concepts explained",
            "History essay research",
            "Language learning tips",
            "Coding tutorials",
            "Literature analysis",
            "Study techniques"
        ]
        
        return {"topics": topics}
    except Exception as e:
        print(f"Error fetching topics: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch suggested topics")

# Start background tasks
@router.on_event("startup")
async def startup_event():
    # Set up the cleanup tasks to run periodically
    asyncio.create_task(periodic_cleanup())

async def periodic_cleanup():
    while True:
        await cleanup_old_sessions()
        await cleanup_rate_limits()
        await asyncio.sleep(SESSION_TIMEOUT / 2)
