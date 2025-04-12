from fastapi import Depends, HTTPException, status, Request, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from passlib.context import CryptContext
import os
from typing import Optional, Dict, Union
from dotenv import load_dotenv
import time
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("auth")

# Load environment variables
load_dotenv()

# Get JWT secret from environment
JWT_SECRET = os.getenv("JWT_SECRET", "fallback_secret_for_development_only")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Security scheme for JWT
security = HTTPBearer(auto_error=False)

# Helper function to create JWT tokens
def create_access_token(data: dict, expires_delta: Optional[int] = None) -> str:
    """
    Create a new JWT token with the provided data and expiration
    """
    to_encode = data.copy()
    expire = time.time() + (expires_delta or ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

# Verify password
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify that a plain password matches a hashed password
    """
    return pwd_context.verify(plain_password, hashed_password)

# Hash password
def get_password_hash(password: str) -> str:
    """
    Hash a password for storage
    """
    return pwd_context.hash(password)

# Check if token is valid
async def verify_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Dict:
    """
    Verify JWT token and return payload if valid
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        
        # Check if token has expired
        if "exp" in payload and payload["exp"] < time.time():
            logger.warning(f"Token expired for user: {payload.get('sub', 'unknown')}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Verify token type
        if payload.get("type") != "access":
            logger.warning(f"Invalid token type: {payload.get('type')}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        return payload
    except JWTError as e:
        logger.error(f"JWT verification error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

# Extract user ID from token for dependency injection
async def get_user_id(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    x_api_key: Optional[str] = Header(None)
) -> str:
    """
    Extract user ID from JWT token
    """
    try:
        # First try to get from Authorization header
        if credentials:
            try:
                token_payload = await verify_token(credentials)
                if "sub" in token_payload:
                    logger.info(f"Authenticated user from JWT: {token_payload['sub']}")
                    return token_payload["sub"]
            except HTTPException as e:
                logger.warning(f"JWT authentication failed: {str(e)}")
                pass
        
        # Then try API key authentication
        if x_api_key:
            # In a real implementation, you would validate this against a database
            # For now, we'll use a simple environment variable for demo purposes
            valid_api_key = os.getenv("API_KEY")
            if valid_api_key and x_api_key == valid_api_key:
                # Extract user ID from API key or use a default
                # In production, you would look up the API key in a database
                logger.info("Authenticated user from API key")
                return "api_user"
        
        # If that fails, try to get from query parameters
        token = request.query_params.get("token")
        if token:
            try:
                payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
                if "sub" in payload:
                    logger.info(f"Authenticated user from query token: {payload['sub']}")
                    return payload["sub"]
            except JWTError as e:
                logger.warning(f"Query token authentication failed: {str(e)}")
                pass
        
        # If all else fails, raise an exception
        logger.error("Authentication failed - no valid credentials provided")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.PyJWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

# Optional authentication for endpoints that work with or without auth
async def get_optional_user_id(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    x_api_key: Optional[str] = Header(None)
) -> Optional[str]:
    """
    Extract user ID from JWT token if present, otherwise return None
    """
    # First try to get from Authorization header via credentials
    if credentials:
        try:
            token = credentials.credentials
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            if "sub" in payload:
                logger.info(f"Optional auth: Found user from JWT: {payload['sub']}")
                return payload["sub"]
        except Exception as e:
            logger.debug(f"Optional auth: JWT decode failed: {str(e)}")
            pass
    
    # Then try API key authentication
    if x_api_key:
        valid_api_key = os.getenv("API_KEY")
        if valid_api_key and x_api_key == valid_api_key:
            logger.info("Optional auth: Found user from API key")
            return "api_user"
    
    # If that fails, try to get from query parameters
    token = request.query_params.get("token")
    if token:
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            if "sub" in payload:
                logger.info(f"Optional auth: Found user from query token: {payload['sub']}")
                return payload["sub"]
        except Exception as e:
            logger.debug(f"Optional auth: Query token decode failed: {str(e)}")
            pass
    
    # Try to get from cookies
    token = request.cookies.get("token")
    if token:
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            if "sub" in payload:
                logger.info(f"Optional auth: Found user from cookie: {payload['sub']}")
                return payload["sub"]
        except Exception as e:
            logger.debug(f"Optional auth: Cookie token decode failed: {str(e)}")
            pass
    
    # If all authentication methods fail, return None
    logger.debug("Optional auth: No valid authentication found, returning None")
    return None

# Validate shared secret for internal service communication
async def validate_service_token(
    request: Request,
    x_service_token: Optional[str] = Header(None)
) -> bool:
    """
    Validate a service token for internal service-to-service communication
    """
    if not x_service_token:
        return False
        
    valid_service_token = os.getenv("SERVICE_TOKEN")
    if not valid_service_token:
        logger.warning("SERVICE_TOKEN environment variable not set")
        return False
        
    return x_service_token == valid_service_token
