from fastapi import APIRouter, HTTPException, Depends, Request, status, Header, BackgroundTasks
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Any, Union
import google.generativeai as genai
import os
import time
import json
import logging
from datetime import datetime, timedelta
import asyncio
import hashlib
from utils.auth import verify_token, get_user_id, get_optional_user_id, validate_service_token

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai_router")

# Define router with prefix and tags
router = APIRouter(
    prefix="/ai-chat",
    tags=["AI Chat"],
    responses={404: {"description": "Not found"}},
)

# Model definitions
class ChatMessage(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    system_prompt: Optional[str] = None
    model: Optional[str] = "gemini-pro"
    temperature: Optional[float] = 0.7
    top_k: Optional[int] = 40
    top_p: Optional[float] = 0.95
    max_output_tokens: Optional[int] = 1024

class ChatResponse(BaseModel):
    response: str
    conversation_id: str
    tokens: Dict[str, int] = Field(default_factory=lambda: {"input": 0, "output": 0, "total": 0})
    model: str
    hasError: Optional[bool] = False
    errorType: Optional[str] = None
    timestamp: float = Field(default_factory=time.time)

class TopicsResponse(BaseModel):
    topics: List[str]
    timestamp: float = Field(default_factory=time.time)
    
class ConversationHistory(BaseModel):
    conversation_id: str
    user_id: str
    messages: List[Dict[str, Any]]
    model: str
    system_prompt: Optional[str] = None
    created_at: float
    updated_at: float
    
class AIMetrics(BaseModel):
    total_requests: int
    successful_requests: int
    failed_requests: int
    rate_limited_requests: int
    tokens_processed: int
    average_response_time: float
    uptime_seconds: float

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
conversation_history = {}

# Performance metrics
ai_metrics = {
    "total_requests": 0,
    "successful_requests": 0,
    "failed_requests": 0,
    "rate_limited_requests": 0,
    "tokens_processed": 0,
    "response_times": [],
    "start_time": time.time()
}

# Configure constants from environment variables with defaults
SESSION_TIMEOUT = int(os.getenv("SESSION_TIMEOUT", "3600"))  # 1 hour in seconds
RATE_LIMIT_WINDOW = int(os.getenv("RATE_LIMIT_WINDOW", "60"))  # 1 minute window
MAX_REQUESTS_PER_WINDOW = int(os.getenv("MAX_REQUESTS_PER_WINDOW", "10"))  # 10 requests per minute
DEFAULT_MODEL = os.getenv("DEFAULT_AI_MODEL", "gemini-pro")
DEFAULT_TEMPERATURE = float(os.getenv("DEFAULT_TEMPERATURE", "0.7"))
DEFAULT_MAX_TOKENS = int(os.getenv("DEFAULT_MAX_TOKENS", "1024"))
DEFAULT_SYSTEM_PROMPT = os.getenv("DEFAULT_SYSTEM_PROMPT", "You are a helpful AI assistant for an educational platform.")
MAX_CONVERSATION_HISTORY = int(os.getenv("MAX_CONVERSATION_HISTORY", "20"))
ENABLE_STREAMING = os.getenv("ENABLE_AI_STREAMING", "true").lower() == "true"

# Initialize Gemini API
def initialize_gemini():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.error("Missing Gemini API key in environment variables")
        raise HTTPException(status_code=500, detail="Missing Gemini API key")
    
    try:
        genai.configure(api_key=api_key)
        logger.info("Gemini API initialized successfully")
        
        # Test API connectivity
        models = genai.list_models()
        available_models = [model.name for model in models]
        logger.info(f"Available Gemini models: {available_models}")
        
        return True
    except Exception as e:
        logger.error(f"Failed to initialize Gemini API: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to initialize Gemini API: {str(e)}")

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
            "consecutive_windows": 0,
            "last_request": now
        }
        logger.info(f"New user {user_id} added to rate limiting")
        return rate_limits[user_id]
    
    user_limit = rate_limits[user_id]
    
    # Reset window if it's expired
    if now - user_limit["window_start"] > RATE_LIMIT_WINDOW:
        # Check if this is consecutive rate limiting
        if user_limit["count"] >= MAX_REQUESTS_PER_WINDOW:
            user_limit["consecutive_windows"] += 1
            logger.warning(f"User {user_id} hit rate limit for {user_limit['consecutive_windows']} consecutive windows")
        else:
            user_limit["consecutive_windows"] = 0
        
        user_limit["count"] = 1
        user_limit["window_start"] = now
        user_limit["limited"] = False
        user_limit["remaining_requests"] = MAX_REQUESTS_PER_WINDOW - 1
        user_limit["reset_time"] = now + RATE_LIMIT_WINDOW
        user_limit["last_request"] = now
        return user_limit
    
    # Check if user has exceeded limit
    if user_limit["count"] >= MAX_REQUESTS_PER_WINDOW:
        user_limit["limited"] = True
        user_limit["remaining_requests"] = 0
        
        # Update metrics
        ai_metrics["rate_limited_requests"] += 1
        
        logger.warning(f"User {user_id} rate limited: {user_limit['count']} requests in {now - user_limit['window_start']:.2f} seconds")
        return user_limit
    
    # Check for burst protection (optional, can be disabled)
    min_request_interval = 1.0  # 1 second between requests
    if now - user_limit.get("last_request", 0) < min_request_interval:
        # Too many requests in a very short time
        if user_limit.get("burst_count", 0) > 5:
            user_limit["limited"] = True
            user_limit["remaining_requests"] = 0
            user_limit["burst_limited"] = True
            logger.warning(f"User {user_id} burst rate limited: too many requests in rapid succession")
            return user_limit
        else:
            user_limit["burst_count"] = user_limit.get("burst_count", 0) + 1
    else:
        user_limit["burst_count"] = 0
    
    # Increment counter and update remaining
    user_limit["count"] += 1
    user_limit["remaining_requests"] = MAX_REQUESTS_PER_WINDOW - user_limit["count"]
    user_limit["limited"] = False
    user_limit["last_request"] = now
    return user_limit

# Helper: Generate a unique conversation ID
def generate_conversation_id(user_id: str) -> str:
    timestamp = int(time.time() * 1000)
    random_component = os.urandom(8).hex()
    conversation_id = f"{user_id}_{timestamp}_{random_component}"
    return hashlib.sha256(conversation_id.encode()).hexdigest()[:24]

# Helper: Get fallback response based on error type
def get_fallback_response(error_type: str, user_id: Optional[str] = None) -> Dict[str, Any]:
    responses = {
        ERROR_TYPES["RATE_LIMITED"]: {
            "response": "I'm sorry, you've sent too many messages in a short period. Please wait a moment before trying again.",
            "status_code": status.HTTP_429_TOO_MANY_REQUESTS
        },
        ERROR_TYPES["API_UNAVAILABLE"]: {
            "response": "I'm currently experiencing connectivity issues. Please try again in a few minutes.",
            "status_code": status.HTTP_503_SERVICE_UNAVAILABLE
        },
        ERROR_TYPES["CONTENT_FILTERED"]: {
            "response": "I'm unable to respond to that message due to content restrictions. Please try a different question.",
            "status_code": status.HTTP_400_BAD_REQUEST
        },
        ERROR_TYPES["TOKEN_LIMIT"]: {
            "response": "Your conversation has become too long. Try starting a new conversation or simplifying your question.",
            "status_code": status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
        },
        ERROR_TYPES["INVALID_REQUEST"]: {
            "response": "I couldn't process your request. Please check your message and try again.",
            "status_code": status.HTTP_400_BAD_REQUEST
        }
    }
    
    fallback = responses.get(error_type, {
        "response": "I'm sorry, I encountered an error while processing your request. Please try again later.",
        "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR
    })
    
    # Create a new conversation ID if needed
    conversation_id = generate_conversation_id(user_id or "anonymous")
    
    return {
        "response": fallback["response"],
        "conversation_id": conversation_id,
        "tokens": {"input": 0, "output": 0, "total": 0},
        "model": DEFAULT_MODEL,
        "hasError": True,
        "errorType": error_type,
        "timestamp": time.time(),
        "status_code": fallback["status_code"]
    }

# Helper: Determine error type from exception
def determine_error_type(error) -> str:
    error_msg = str(error).lower()
    
    if any(term in error_msg for term in ["rate limit", "quota", "too many requests", "429"]):
        logger.warning(f"Rate limit error detected: {error_msg}")
        return ERROR_TYPES["RATE_LIMITED"]
    elif any(term in error_msg for term in ["content filtered", "safety", "harmful", "inappropriate"]):
        logger.warning(f"Content filtered error detected: {error_msg}")
        return ERROR_TYPES["CONTENT_FILTERED"]
    elif any(term in error_msg for term in ["token limit", "too long", "maximum context", "context length"]):
        logger.warning(f"Token limit error detected: {error_msg}")
        return ERROR_TYPES["TOKEN_LIMIT"]
    elif any(term in error_msg for term in ["invalid request", "bad request", "400", "malformed"]):
        logger.warning(f"Invalid request error detected: {error_msg}")
        return ERROR_TYPES["INVALID_REQUEST"]
    elif any(term in error_msg for term in ["unavailable", "timeout", "network", "connection", "503", "502"]):
        logger.warning(f"API unavailable error detected: {error_msg}")
        return ERROR_TYPES["API_UNAVAILABLE"]
    
    logger.error(f"Unknown error type: {error_msg}")
    return ERROR_TYPES["UNKNOWN"]

# Helper: Store conversation history
def store_conversation(user_id: str, conversation_id: str, message: str, response: str, model: str, system_prompt: Optional[str] = None) -> None:
    if conversation_id not in conversation_history:
        # Create new conversation
        conversation_history[conversation_id] = {
            "conversation_id": conversation_id,
            "user_id": user_id,
            "messages": [],
            "model": model,
            "system_prompt": system_prompt,
            "created_at": time.time(),
            "updated_at": time.time()
        }
    
    # Add message and response to history
    conversation_history[conversation_id]["messages"].append({
        "role": "user",
        "content": message,
        "timestamp": time.time()
    })
    
    conversation_history[conversation_id]["messages"].append({
        "role": "assistant",
        "content": response,
        "timestamp": time.time()
    })
    
    # Update timestamp
    conversation_history[conversation_id]["updated_at"] = time.time()
    
    # Limit conversation history size
    if len(conversation_history[conversation_id]["messages"]) > MAX_CONVERSATION_HISTORY * 2:
        # Remove oldest messages but keep system prompt if present
        conversation_history[conversation_id]["messages"] = \
            conversation_history[conversation_id]["messages"][-MAX_CONVERSATION_HISTORY * 2:]

# Helper: Get conversation history
def get_conversation(conversation_id: str) -> Optional[Dict[str, Any]]:
    return conversation_history.get(conversation_id)

# Helper: Clean up old sessions
async def cleanup_old_sessions():
    now = time.time()
    expired_keys = []
    
    for user_id, session in chat_sessions.items():
        if now - session["last_access"] > SESSION_TIMEOUT:
            expired_keys.append(user_id)
    
    for key in expired_keys:
        del chat_sessions[key]
    
    logger.info(f"Cleaned up {len(expired_keys)} expired chat sessions")

# Helper: Clean up old rate limits
async def cleanup_rate_limits():
    now = time.time()
    expired_keys = []
    
    for user_id, rate_data in rate_limits.items():
        if now - rate_data["window_start"] > RATE_LIMIT_WINDOW * 10:
            expired_keys.append(user_id)
    
    for key in expired_keys:
        del rate_limits[key]
    
    logger.info(f"Cleaned up {len(expired_keys)} expired rate limits")

# Helper: Clean up old conversations
async def cleanup_old_conversations():
    now = time.time()
    expired_keys = []
    
    # Keep conversations for 7 days
    conversation_timeout = 7 * 24 * 60 * 60  # 7 days in seconds
    
    for conversation_id, conversation in conversation_history.items():
        if now - conversation["updated_at"] > conversation_timeout:
            expired_keys.append(conversation_id)
    
    for key in expired_keys:
        del conversation_history[key]
    
    logger.info(f"Cleaned up {len(expired_keys)} expired conversations")

# Helper: Calculate average response time
def calculate_average_response_time() -> float:
    if not ai_metrics["response_times"]:
        return 0.0
    
    # Only consider the last 100 response times to avoid skew from old data
    recent_times = ai_metrics["response_times"][-100:]
    return sum(recent_times) / len(recent_times)

# AI chat endpoint
@router.post("/chat", response_model=ChatResponse)
async def generate_chat_response(
    message_data: ChatMessage,
    user_id: str = Depends(get_user_id),
    x_request_id: Optional[str] = Header(None),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    # Generate request ID if not provided
    request_id = x_request_id or f"req_{time.time()}_{id(message_data)}"
    logger.info(f"Generating chat response for user {user_id} (ID: {request_id})")
    
    # Update metrics
    ai_metrics["total_requests"] += 1
    start_time = time.time()
    
    # Check rate limiting
    rate_status = is_rate_limited(user_id)
    if rate_status["limited"]:
        logger.warning(f"Rate limit exceeded for user: {user_id}, consecutive windows: {rate_status['consecutive_windows']}")
        
        # Calculate time until reset
        reset_in_seconds = max(1, int(rate_status["reset_time"] - time.time()))
        
        # Different message for persistent abusers
        if rate_status["consecutive_windows"] > 3:
            error_message = "I'm sorry, but you've been sending too many messages. Please try again later."
        else:
            error_message = f"I'm sorry, you've reached the limit of {MAX_REQUESTS_PER_WINDOW} messages per minute. Please try again in {reset_in_seconds} seconds."
        
        # Update metrics
        ai_metrics["rate_limited_requests"] += 1
        
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "error": "Rate limit exceeded",
                "message": error_message,
                "retryAfter": reset_in_seconds,
                "request_id": request_id
            }
        )
    
    try:
        # Initialize Gemini if needed
        initialize_gemini()
        
        # Get existing conversation or create new one
        conversation_id = message_data.conversation_id
        existing_conversation = None
        
        if conversation_id:
            existing_conversation = get_conversation(conversation_id)
            if existing_conversation and existing_conversation["user_id"] != user_id:
                # Conversation exists but belongs to another user
                logger.warning(f"User {user_id} attempted to access conversation {conversation_id} belonging to user {existing_conversation['user_id']}")
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={
                        "error": "Forbidden",
                        "message": "You do not have access to this conversation",
                        "request_id": request_id
                    }
                )
        
        # If no conversation ID or conversation not found, create a new one
        if not conversation_id or not existing_conversation:
            conversation_id = generate_conversation_id(user_id)
            logger.info(f"Creating new conversation {conversation_id} for user {user_id}")
        
        # Set up model parameters
        model_name = message_data.model or DEFAULT_MODEL
        temperature = message_data.temperature or DEFAULT_TEMPERATURE
        max_output_tokens = message_data.max_output_tokens or DEFAULT_MAX_TOKENS
        system_prompt = message_data.system_prompt or DEFAULT_SYSTEM_PROMPT
        
        # Create Gemini model with parameters
        generation_config = {
            "temperature": temperature,
            "top_p": message_data.top_p,
            "top_k": message_data.top_k,
            "max_output_tokens": max_output_tokens,
        }
        
        model = genai.GenerativeModel(
            model_name=model_name,
            generation_config=generation_config
        )
        
        # Prepare chat history
        history = []
        
        # Add system prompt if provided
        if system_prompt:
            history.append({"role": "user", "parts": [system_prompt]})
            history.append({"role": "model", "parts": ["I understand and will act accordingly."]})
        
        # Add conversation history if it exists
        if existing_conversation:
            for msg in existing_conversation["messages"]:
                role = "user" if msg["role"] == "user" else "model"
                history.append({"role": role, "parts": [msg["content"]]})
        
        # Create chat session
        chat = model.start_chat(history=history)
        
        # Send message and get response
        response = await asyncio.to_thread(
            chat.send_message,
            message_data.message
        )
        
        # Extract response text
        response_text = response.text
        
        # Store conversation in history
        store_conversation(
            user_id=user_id,
            conversation_id=conversation_id,
            message=message_data.message,
            response=response_text,
            model=model_name,
            system_prompt=system_prompt
        )
        
        # Calculate response time
        response_time = time.time() - start_time
        ai_metrics["response_times"].append(response_time)
        if len(ai_metrics["response_times"]) > 1000:  # Limit size
            ai_metrics["response_times"] = ai_metrics["response_times"][-1000:]
        
        # Update metrics
        ai_metrics["successful_requests"] += 1
        
        # Estimate token count (rough approximation)
        input_tokens = len(message_data.message.split()) * 1.3  # Rough estimate
        output_tokens = len(response_text.split()) * 1.3  # Rough estimate
        total_tokens = input_tokens + output_tokens
        ai_metrics["tokens_processed"] += int(total_tokens)
        
        # Schedule background cleanup
        background_tasks.add_task(cleanup_old_sessions)
        background_tasks.add_task(cleanup_old_conversations)
        
        # Return response
        return ChatResponse(
            response=response_text,
            conversation_id=conversation_id,
            tokens={
                "input": int(input_tokens),
                "output": int(output_tokens),
                "total": int(total_tokens)
            },
            model=model_name,
            hasError=False,
            timestamp=time.time()
        )
        
    except Exception as e:
        logger.error(f"Error generating response: {str(e)}")
        ai_metrics["failed_requests"] += 1
        
        # Determine error type
        error_type = determine_error_type(e)
        
        # Get fallback response
        fallback = get_fallback_response(error_type, user_id)
        
        # Return error response with appropriate status code
        return JSONResponse(
            status_code=fallback["status_code"],
            content={
                "response": fallback["response"],
                "conversation_id": fallback["conversation_id"],
                "tokens": fallback["tokens"],
                "model": fallback["model"],
                "hasError": True,
                "errorType": error_type,
                "timestamp": time.time(),
                "request_id": request_id
            }
        )

# Get suggested topics endpoint
@router.get("/topics", response_model=TopicsResponse)
async def get_suggested_topics(
    user_id: Optional[str] = Depends(get_optional_user_id),
    x_request_id: Optional[str] = Header(None)
):
    # Generate request ID if not provided
    request_id = x_request_id or f"req_{time.time()}_topics"
    logger.info(f"Generating suggested topics for user {user_id or 'anonymous'} (ID: {request_id})")
    
    try:
        # Initialize Gemini
        initialize_gemini()
        
        # Create model with lower temperature for more focused results
        model = genai.GenerativeModel(
            model_name='gemini-pro',
            generation_config={
                "temperature": 0.2,
                "max_output_tokens": 200
            }
        )
        
        # Generate suggested topics based on user context if available
        if user_id and user_id in conversation_history:
            # Get recent user conversations to personalize topics
            recent_messages = []
            for conv_id, conv in conversation_history.items():
                if conv["user_id"] == user_id:
                    for msg in conv["messages"][-10:]:  # Get last 10 messages
                        if msg["role"] == "user":
                            recent_messages.append(msg["content"])
            
            if recent_messages:
                # Create a personalized prompt
                context = "\n".join(recent_messages[-3:])  # Use last 3 messages
                prompt = f"Based on these recent conversations:\n{context}\n\nGenerate 5 educational topics that might interest this student. Return them as a comma-separated list without numbering or additional text."
            else:
                prompt = "Generate 5 educational topics for students. Focus on engaging and current topics. Return them as a comma-separated list without numbering or additional text."
        else:
            prompt = "Generate 5 educational topics for students. Focus on engaging and current topics. Return them as a comma-separated list without numbering or additional text."
        
        response = await asyncio.to_thread(
            model.generate_content,
            prompt
        )
        
        # Parse response
        topics_text = response.text.strip()
        topics = [topic.strip() for topic in topics_text.split(',')]
        
        # Limit to 5 topics
        topics = topics[:5]
        
        return TopicsResponse(topics=topics, timestamp=time.time())
    
    except Exception as e:
        logger.error(f"Error generating topics: {str(e)}")
        # Fallback topics
        return TopicsResponse(
            topics=[
                "Mathematics and Problem Solving",
                "Science and Technology Innovations",
                "Historical Events and Their Impact",
                "Literature and Creative Writing",
                "Computer Science and Programming"
            ],
            timestamp=time.time()
        )

# Get AI metrics endpoint
@router.get("/metrics")
async def get_ai_metrics(
    request: Request,
    is_valid_service: bool = Depends(validate_service_token)
):
    if not is_valid_service:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"error": "Forbidden", "message": "Invalid service token"}
        )
    
    # Calculate metrics
    uptime = time.time() - ai_metrics["start_time"]
    avg_response_time = calculate_average_response_time()
    
    return {
        "total_requests": ai_metrics["total_requests"],
        "successful_requests": ai_metrics["successful_requests"],
        "failed_requests": ai_metrics["failed_requests"],
        "rate_limited_requests": ai_metrics["rate_limited_requests"],
        "tokens_processed": ai_metrics["tokens_processed"],
        "average_response_time": avg_response_time,
        "uptime_seconds": uptime,
        "requests_per_minute": (ai_metrics["total_requests"] / (uptime / 60)) if uptime > 0 else 0,
        "success_rate": (ai_metrics["successful_requests"] / max(1, ai_metrics["total_requests"])) * 100,
        "conversation_count": len(conversation_history),
        "timestamp": time.time()
    }

# Get conversation history endpoint
@router.get("/conversations/{conversation_id}")
async def get_conversation_history(
    conversation_id: str,
    user_id: str = Depends(get_user_id)
):
    # Get conversation
    conversation = get_conversation(conversation_id)
    
    # Check if conversation exists
    if not conversation:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"error": "Not found", "message": "Conversation not found"}
        )
    
    # Check if user has access to this conversation
    if conversation["user_id"] != user_id:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"error": "Forbidden", "message": "You do not have access to this conversation"}
        )
    
    # Return conversation history
    return conversation

# Clear conversation history endpoint
@router.delete("/conversations/{conversation_id}")
async def clear_conversation_history(
    conversation_id: str,
    user_id: str = Depends(get_user_id)
):
    # Get conversation
    conversation = get_conversation(conversation_id)
    
    # Check if conversation exists
    if not conversation:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"error": "Not found", "message": "Conversation not found"}
        )
    
    # Check if user has access to this conversation
    if conversation["user_id"] != user_id:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"error": "Forbidden", "message": "You do not have access to this conversation"}
        )
    
    # Delete conversation
    del conversation_history[conversation_id]
    
    return {"success": True, "message": "Conversation deleted successfully"}

# Health check endpoint
@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "version": "1.0.0",
        "gemini_available": True
    }

# Start background tasks
@router.on_event("startup")
async def startup_event():
    # Initialize Gemini API
    try:
        initialize_gemini()
        logger.info("AI Router started successfully")
    except Exception as e:
        logger.error(f"Failed to initialize AI Router: {str(e)}")
    
    # Start periodic cleanup
    asyncio.create_task(periodic_cleanup())

async def periodic_cleanup():
    while True:
        try:
            await asyncio.sleep(3600)  # Run every hour
            await cleanup_old_sessions()
            await cleanup_rate_limits()
            await cleanup_old_conversations()
            logger.info("Periodic cleanup completed successfully")
        except Exception as e:
            logger.error(f"Error during periodic cleanup: {str(e)}")
            await asyncio.sleep(300)  # Wait 5 minutes before retrying
        await asyncio.sleep(SESSION_TIMEOUT / 2)
