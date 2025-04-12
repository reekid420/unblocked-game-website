from fastapi import APIRouter, Request, Response, HTTPException, status, Depends, Header
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.encoders import jsonable_encoder
import httpx
import asyncio
import time
import os
import json
import base64
import hashlib
from typing import Dict, Any, List, Optional, Union
from pydantic import BaseModel, Field
import logging
from utils.auth import get_optional_user_id, validate_service_token

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("proxy_router")

# Define router
router = APIRouter()

# Constants
DEFAULT_TIMEOUT = float(os.getenv('PROXY_TIMEOUT', '30.0'))  # seconds
MAX_REDIRECTS = int(os.getenv('MAX_REDIRECTS', '10'))
MAX_REQUEST_SIZE = int(os.getenv('MAX_REQUEST_SIZE', '31457280'))  # 30MB
ENABLE_CACHING = os.getenv('ENABLE_PROXY_CACHE', 'false').lower() == 'true'
CACHE_TTL = int(os.getenv('PROXY_CACHE_TTL', '300'))  # 5 minutes in seconds

# In-memory caches
active_connections: Dict[str, Any] = {}
response_cache: Dict[str, Dict[str, Any]] = {}

# Performance metrics
request_metrics = {
    "total_requests": 0,
    "successful_requests": 0,
    "failed_requests": 0,
    "cache_hits": 0,
    "start_time": time.time()
}

# Models
class BareRequest(BaseModel):
    url: str
    headers: Optional[Dict[str, str]] = None
    method: str = "GET"
    body: Optional[str] = None
    timeout: Optional[float] = None
    cache: Optional[bool] = None
    follow_redirects: Optional[bool] = True

class BareResponse(BaseModel):
    status: int
    statusText: str
    headers: Dict[str, str]
    body: Optional[str] = None
    cached: Optional[bool] = False
    timestamp: Optional[float] = None
    
class ProxyMetrics(BaseModel):
    total_requests: int
    successful_requests: int
    failed_requests: int
    cache_hits: int
    uptime_seconds: float
    requests_per_second: float
    
class ServiceStatus(BaseModel):
    status: str
    version: str = "1.0.0"
    timestamp: float
    metrics: Optional[ProxyMetrics] = None

# Helper function to convert HTTP headers to dict
async def headers_to_dict(headers) -> Dict[str, str]:
    result = {}
    for name, value in headers.items():
        # Skip hop-by-hop headers
        if name.lower() in [
            "connection", "keep-alive", "proxy-authenticate", 
            "proxy-authorization", "te", "trailers", 
            "transfer-encoding", "upgrade"
        ]:
            continue
        # Convert header values to strings
        if isinstance(value, (list, tuple)):
            result[name] = ", ".join(str(v) for v in value)
        else:
            result[name] = str(value)
    return result

# Helper function to generate cache key
def generate_cache_key(method: str, url: str, headers: Optional[Dict[str, str]] = None, body: Optional[str] = None) -> str:
    # Create a unique cache key based on the request details
    key_parts = [method.upper(), url]
    
    # Add relevant headers that might affect the response
    if headers:
        for header in ['accept', 'accept-language', 'content-type']:
            if header in headers:
                key_parts.append(f"{header}:{headers[header]}")
    
    # Add body hash if present
    if body:
        body_hash = hashlib.md5(body.encode('utf-8')).hexdigest()
        key_parts.append(body_hash)
    
    # Join all parts and create a hash
    key_string = '|'.join(key_parts)
    return hashlib.sha256(key_string.encode('utf-8')).hexdigest()

# Helper to create HTTP client with appropriate settings
async def get_client(timeout: Optional[float] = None, follow_redirects: bool = True):
    return httpx.AsyncClient(
        timeout=httpx.Timeout(timeout or DEFAULT_TIMEOUT),
        follow_redirects=follow_redirects,
        max_redirects=MAX_REDIRECTS,
        http2=True,  # Enable HTTP/2 for better performance
        verify=True   # Verify SSL certificates
    )

# Helper function to check cache and return cached response if available
async def check_cache(cache_key: str) -> Optional[Dict[str, Any]]:
    if not ENABLE_CACHING:
        return None
        
    if cache_key in response_cache:
        cached_data = response_cache[cache_key]
        # Check if cache entry is still valid
        if time.time() - cached_data['timestamp'] < CACHE_TTL:
            # Update metrics
            request_metrics['cache_hits'] += 1
            return cached_data
        else:
            # Remove expired cache entry
            del response_cache[cache_key]
    
    return None

# Helper function to store response in cache
async def store_in_cache(cache_key: str, response_data: Dict[str, Any]):
    if not ENABLE_CACHING:
        return
        
    # Only cache successful responses
    if 200 <= response_data['status'] < 300:
        # Add timestamp and mark as cached
        response_data['timestamp'] = time.time()
        response_data['cached'] = True
        response_cache[cache_key] = response_data
        
        # Cleanup old cache entries if cache is too large (simple LRU-like approach)
        if len(response_cache) > 1000:  # Limit cache size
            # Remove oldest 10% of entries
            sorted_keys = sorted(response_cache.keys(), 
                                key=lambda k: response_cache[k]['timestamp'])
            for key in sorted_keys[:len(sorted_keys) // 10]:
                del response_cache[key]

# Main endpoint for bare proxy requests
@router.post("/")
async def bare_proxy(
    request: Request,
    user_id: Optional[str] = Depends(get_optional_user_id),
    x_request_id: Optional[str] = Header(None)
):
    # Update metrics
    request_metrics['total_requests'] += 1
    request_id = x_request_id or f"req_{time.time()}_{id(request)}"
    
    try:
        # Parse request
        request_data = await request.json()
        bare_request = BareRequest(**request_data)
        
        if not bare_request.url:
            request_metrics['failed_requests'] += 1
            return JSONResponse(
                status_code=400,
                content={"error": "Missing URL parameter", "request_id": request_id}
            )
        
        # Log request with user context if available
        if user_id:
            logger.info(f"User {user_id} proxying request to: {bare_request.url} (ID: {request_id})")
        else:
            logger.info(f"Anonymous proxying request to: {bare_request.url} (ID: {request_id})")
        
        # Check if we should use cache
        use_cache = ENABLE_CACHING
        if bare_request.cache is not None:
            use_cache = bare_request.cache
            
        # Generate cache key if caching is enabled
        cache_key = None
        if use_cache and bare_request.method.upper() in ['GET', 'HEAD']:
            cache_key = generate_cache_key(
                bare_request.method, 
                bare_request.url, 
                bare_request.headers
            )
            
            # Check cache for existing response
            cached_response = await check_cache(cache_key)
            if cached_response:
                logger.info(f"Cache hit for {bare_request.url} (ID: {request_id})")
                return cached_response
        
        # Create HTTP client with appropriate settings
        async with await get_client(
            timeout=bare_request.timeout,
            follow_redirects=bare_request.follow_redirects
        ) as client:
            # Prepare request
            request_kwargs = {
                "method": bare_request.method,
                "url": bare_request.url,
                "headers": bare_request.headers or {},
            }
            
            if bare_request.body:
                request_kwargs["content"] = bare_request.body
            
            # Make the request
            start_time = time.time()
            response = await client.request(**request_kwargs)
            request_time = time.time() - start_time
            
            # Process response
            response_headers = await headers_to_dict(response.headers)
            
            # Add custom headers with proxy information
            response_headers['x-proxy-time'] = str(request_time)
            response_headers['x-proxy-id'] = request_id
            
            # Construct response data
            response_data = {
                "status": response.status_code,
                "statusText": httpx.codes.get_reason_phrase(response.status_code),
                "headers": response_headers,
                "body": response.text,
                "timestamp": time.time(),
                "cached": False
            }
            
            # Store in cache if appropriate
            if cache_key and 200 <= response.status_code < 300:
                await store_in_cache(cache_key, response_data)
            
            # Update metrics
            request_metrics['successful_requests'] += 1
            
            # Return the response
            return response_data
    
    except httpx.TimeoutException as e:
        request_metrics['failed_requests'] += 1
        logger.error(f"Request timeout for URL: {bare_request.url} (ID: {request_id})")
        return JSONResponse(
            status_code=504,
            content={
                "error": "Gateway Timeout", 
                "message": "The request timed out",
                "request_id": request_id,
                "url": bare_request.url
            }
        )
    
    except httpx.RequestError as e:
        request_metrics['failed_requests'] += 1
        logger.error(f"Request error for {bare_request.url} (ID: {request_id}): {str(e)}")
        return JSONResponse(
            status_code=502,
            content={
                "error": "Bad Gateway", 
                "message": str(e),
                "request_id": request_id,
                "url": bare_request.url
            }
        )
    
    except Exception as e:
        request_metrics['failed_requests'] += 1
        logger.error(f"Proxy error for {bare_request.url} (ID: {request_id}): {str(e)}")
        return JSONResponse(
            status_code=500,
            content={
                "error": "Internal Server Error", 
                "message": str(e),
                "request_id": request_id,
                "url": getattr(bare_request, 'url', 'unknown')
            }
        )

# Streaming endpoint for larger responses
@router.post("/stream")
async def bare_proxy_stream(request: Request):
    try:
        # Parse request
        request_data = await request.json()
        target_url = request_data.get("url")
        
        if not target_url:
            return JSONResponse(
                status_code=400,
                content={"error": "Missing URL parameter"}
            )
        
        logger.info(f"Streaming proxied request to: {target_url}")
        
        # Extract request details
        method = request_data.get("method", "GET")
        headers = request_data.get("headers", {})
        body = request_data.get("body")
        
        # Generate a unique ID for this connection
        connection_id = f"conn_{time.time()}_{id(request)}"
        
        async def stream_response():
            client = None
            try:
                # Create HTTP client
                client = httpx.AsyncClient(
                    timeout=httpx.Timeout(DEFAULT_TIMEOUT),
                    follow_redirects=True,
                    max_redirects=MAX_REDIRECTS
                )
                
                # Store client in active connections
                active_connections[connection_id] = client
                
                # Prepare request
                request_kwargs = {
                    "method": method,
                    "url": target_url,
                    "headers": headers,
                }
                
                if body:
                    request_kwargs["content"] = body
                
                # Make the request with streaming
                async with client.stream(**request_kwargs) as response:
                    # Send headers first
                    response_headers = await headers_to_dict(response.headers)
                    headers_json = json.dumps({
                        "type": "headers",
                        "status": response.status_code,
                        "statusText": httpx.codes.get_reason_phrase(response.status_code),
                        "headers": response_headers
                    }) + "\n"
                    
                    yield headers_json.encode("utf-8")
                    
                    # Stream the body in chunks
                    async for chunk in response.aiter_bytes():
                        chunk_json = json.dumps({
                            "type": "chunk",
                            "data": chunk.decode("utf-8", errors="replace")
                        }) + "\n"
                        yield chunk_json.encode("utf-8")
                    
                    # End marker
                    end_json = json.dumps({"type": "end"}) + "\n"
                    yield end_json.encode("utf-8")
            
            except Exception as e:
                error_json = json.dumps({
                    "type": "error",
                    "error": str(e)
                }) + "\n"
                yield error_json.encode("utf-8")
            
            finally:
                # Clean up
                if connection_id in active_connections:
                    del active_connections[connection_id]
                if client:
                    await client.aclose()
        
        # Return a streaming response
        return StreamingResponse(
            stream_response(),
            media_type="application/x-ndjson"
        )
    
    except Exception as e:
        logger.error(f"Streaming proxy error: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": "Internal Server Error", "message": str(e)}
        )

# Meta endpoint to get bare server information
@router.get("/")
async def bare_server_info():
    # Calculate metrics
    uptime = time.time() - request_metrics['start_time']
    requests_per_second = request_metrics['total_requests'] / max(1, uptime)
    
    metrics = ProxyMetrics(
        total_requests=request_metrics['total_requests'],
        successful_requests=request_metrics['successful_requests'],
        failed_requests=request_metrics['failed_requests'],
        cache_hits=request_metrics['cache_hits'],
        uptime_seconds=uptime,
        requests_per_second=requests_per_second
    )
    
    status = ServiceStatus(
        status="healthy",
        version="1.0.0",
        timestamp=time.time(),
        metrics=metrics
    )
    
    return {
        "versions": ["v1", "v2"],
        "language": "python",
        "maintainer": {
            "email": "admin@example.com",
            "website": "https://example.com"
        },
        "project": {
            "name": "Educational Platform Proxy",
            "description": "Python implementation of proxy functionality",
            "repository": "https://github.com/example/educational-platform",
            "version": "1.0.0"
        },
        "status": jsonable_encoder(status)
    }

# META endpoint to get server specifications
@router.get("/v2/")
async def bare_server_v2_info():
    # Calculate metrics
    uptime = time.time() - request_metrics['start_time']
    requests_per_second = request_metrics['total_requests'] / max(1, uptime)
    
    return {
        "versions": ["v1", "v2"],
        "language": "python",
        "maintainer": {
            "email": "admin@example.com",
            "website": "https://example.com"
        },
        "project": {
            "name": "Educational Platform Proxy",
            "description": "Python implementation of proxy functionality",
            "repository": "https://github.com/example/educational-platform",
            "version": "1.0.0"
        },
        "stats": {
            "uptime": uptime,
            "requests": {
                "total": request_metrics['total_requests'],
                "successful": request_metrics['successful_requests'],
                "failed": request_metrics['failed_requests'],
                "cache_hits": request_metrics['cache_hits'],
                "per_second": round(requests_per_second, 2)
            },
            "cache": {
                "enabled": ENABLE_CACHING,
                "ttl": CACHE_TTL,
                "size": len(response_cache)
            }
        }
    }

# Endpoint to clear cache
@router.post("/cache/clear")
async def clear_cache(
    request: Request,
    is_valid_service: bool = Depends(validate_service_token)
):
    if not is_valid_service:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"error": "Forbidden", "message": "Invalid service token"}
        )
    
    # Clear the cache
    cache_size = len(response_cache)
    response_cache.clear()
    
    return {
        "success": True,
        "message": f"Cache cleared successfully. {cache_size} entries removed.",
        "timestamp": time.time()
    }

# Endpoint to get cache stats
@router.get("/cache/stats")
async def cache_stats(
    request: Request,
    is_valid_service: bool = Depends(validate_service_token)
):
    if not is_valid_service:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"error": "Forbidden", "message": "Invalid service token"}
        )
    
    # Calculate cache stats
    cache_size = len(response_cache)
    cache_keys = list(response_cache.keys())
    cache_age = [time.time() - response_cache[k]['timestamp'] for k in cache_keys[:100]]
    
    return {
        "enabled": ENABLE_CACHING,
        "ttl": CACHE_TTL,
        "size": cache_size,
        "hits": request_metrics['cache_hits'],
        "hit_ratio": request_metrics['cache_hits'] / max(1, request_metrics['total_requests']),
        "avg_age": sum(cache_age) / max(1, len(cache_age)) if cache_age else 0,
        "oldest": max(cache_age) if cache_age else 0,
        "newest": min(cache_age) if cache_age else 0
    }

# Cleanup background task
@router.on_event("shutdown")
async def shutdown_event():
    # Close any active connections
    for conn_id, client in active_connections.items():
        try:
            await client.aclose()
        except Exception as e:
            logger.error(f"Error closing connection {conn_id}: {str(e)}")
    
    # Clear the connections dictionary
    active_connections.clear()
    
    # Log final stats
    logger.info(f"Proxy server shutting down. Final stats: {request_metrics}")
