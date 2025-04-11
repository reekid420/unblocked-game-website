from fastapi import APIRouter, Request, Response, HTTPException, status
from fastapi.responses import JSONResponse, StreamingResponse
import httpx
import asyncio
import time
import os
import json
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("proxy_router")

# Define router
router = APIRouter()

# Constants
DEFAULT_TIMEOUT = 30.0  # seconds
MAX_REDIRECTS = 10
MAX_REQUEST_SIZE = 30 * 1024 * 1024  # 30MB

# In-memory cache of active connections
active_connections: Dict[str, Any] = {}

# Models
class BareRequest(BaseModel):
    url: str
    headers: Optional[Dict[str, str]] = None
    method: str = "GET"
    body: Optional[str] = None

class BareResponse(BaseModel):
    status: int
    statusText: str
    headers: Dict[str, str]
    body: Optional[str] = None

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
        result[name] = value
    return result

# Helper to create HTTP client with appropriate settings
async def get_client():
    return httpx.AsyncClient(
        timeout=httpx.Timeout(DEFAULT_TIMEOUT),
        follow_redirects=True,
        max_redirects=MAX_REDIRECTS
    )

# Main endpoint for bare proxy requests
@router.post("/")
async def bare_proxy(request: Request):
    try:
        # Parse request
        request_data = await request.json()
        target_url = request_data.get("url")
        
        if not target_url:
            return JSONResponse(
                status_code=400,
                content={"error": "Missing URL parameter"}
            )
        
        logger.info(f"Proxying request to: {target_url}")
        
        # Extract request details
        method = request_data.get("method", "GET")
        headers = request_data.get("headers", {})
        body = request_data.get("body")
        
        # Create HTTP client
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(DEFAULT_TIMEOUT),
            follow_redirects=True,
            max_redirects=MAX_REDIRECTS
        ) as client:
            # Prepare request
            request_kwargs = {
                "method": method,
                "url": target_url,
                "headers": headers,
            }
            
            if body:
                request_kwargs["content"] = body
            
            # Make the request
            response = await client.request(**request_kwargs)
            
            # Process response
            response_headers = await headers_to_dict(response.headers)
            
            # Return the response
            return {
                "status": response.status_code,
                "statusText": httpx.codes.get_reason_phrase(response.status_code),
                "headers": response_headers,
                "body": response.text
            }
    
    except httpx.TimeoutException:
        logger.error(f"Request timeout for URL: {target_url}")
        return JSONResponse(
            status_code=504,
            content={"error": "Gateway Timeout", "message": "The request timed out"}
        )
    
    except httpx.RequestError as e:
        logger.error(f"Request error: {str(e)}")
        return JSONResponse(
            status_code=502,
            content={"error": "Bad Gateway", "message": str(e)}
        )
    
    except Exception as e:
        logger.error(f"Proxy error: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": "Internal Server Error", "message": str(e)}
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
    return {
        "versions": ["v1", "v2"],
        "language": "Python",
        "maintainer": {
            "email": "admin@example.com",
            "website": "https://example.com"
        },
        "project": {
            "name": "Bare Server Python",
            "description": "A Python implementation of the Bare server protocol",
            "repository": "https://github.com/example/bare-server-python",
            "version": "1.0.0"
        }
    }

# META endpoint to get server specifications
@router.get("/v2/")
async def bare_server_v2_info():
    return {
        "versions": ["v2"],
        "language": "Python",
        "maintainer": {
            "email": "admin@example.com",
            "website": "https://example.com"
        },
        "project": {
            "name": "Bare Server Python",
            "description": "A Python implementation of the Bare server protocol",
            "repository": "https://github.com/example/bare-server-python",
            "version": "1.0.0"
        }
    }

# Cleanup background task
@router.on_event("shutdown")
async def shutdown_event():
    # Close any active connections
    for connection_id, client in active_connections.items():
        try:
            await client.aclose()
        except Exception as e:
            logger.error(f"Error closing connection {connection_id}: {str(e)}")
    
    active_connections.clear()
