import os
import time
import logging
from typing import Optional, Any, Dict, Tuple
import httpx
from fastapi import HTTPException

logger = logging.getLogger("uvicorn.error")

# Simple In-Memory Cache for GET Requests
# Key: (url, token)
# Value: (response_data, response_headers, expiry_time)
_GET_CACHE: Dict[Tuple[str, str], Tuple[Any, Dict[str, str], float]] = {}

class GitHubClient:
    def __init__(self, token: Optional[str] = None):
        self.token = token or os.getenv("GITHUB_TOKEN")
        if not self.token:
            logger.error("GitHubClient instantiation failed: GITHUB_TOKEN environment variable or parameter is missing.")
            raise HTTPException(
                status_code=401,
                detail="GitHub token missing"
            )
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/vnd.github+json",
            "User-Agent": "CodePilot-AI-Engine"
        }
        self.timeout = 30.0

    def _log_rate_limits(self, response: httpx.Response):
        remaining = response.headers.get("X-RateLimit-Remaining")
        reset_time = response.headers.get("X-RateLimit-Reset")
        if remaining is not None:
            try:
                rem_val = int(remaining)
                logger.info(f"GitHub API Rate Limit Remaining: {rem_val}, Reset time: {reset_time}")
                if rem_val < 10:
                    logger.warning(f"GitHub API Rate Limit is running extremely low: {rem_val} remaining!")
            except ValueError:
                pass

    def request(self, method: str, url: str, **kwargs) -> httpx.Response:
        # Merge headers
        headers = {**self.headers, **kwargs.pop("headers", {})}
        
        # Check cache for GET requests
        cache_key = (url, self.token)
        if method.upper() == "GET":
            if cache_key in _GET_CACHE:
                cached_data, cached_headers, expiry = _GET_CACHE[cache_key]
                if time.time() < expiry:
                    logger.info(f"GitHub Client Cache HIT: {url}")
                    # Reconstruct a mock httpx.Response from cache
                    response = httpx.Response(
                        status_code=200,
                        json=cached_data,
                        headers=cached_headers
                    )
                    return response
                else:
                    logger.info(f"GitHub Client Cache Expired: {url}")
                    del _GET_CACHE[cache_key]

        with httpx.Client(timeout=self.timeout) as client:
            try:
                response = client.request(method, url, headers=headers, **kwargs)
                self._log_rate_limits(response)
                
                # Check for standard GitHub error statuses
                if response.status_code == 401:
                    raise HTTPException(status_code=401, detail="GitHub token is invalid or expired.")
                elif response.status_code == 403:
                    remaining = response.headers.get("X-RateLimit-Remaining")
                    if remaining == "0":
                        raise HTTPException(
                            status_code=403, 
                            detail="GitHub API Rate Limit Exceeded. Authenticated request limit reached."
                        )
                    else:
                        raise HTTPException(
                            status_code=403, 
                            detail=f"GitHub API Forbidden: {response.text}"
                        )
                elif response.status_code == 404:
                    raise HTTPException(status_code=404, detail="GitHub Repository or PR Not Found.")
                elif response.status_code == 422:
                    raise HTTPException(status_code=422, detail=f"GitHub API Unprocessable Entity: {response.text}")
                
                # If GET request was successful, save to cache (TTL: 5 minutes / 300 seconds)
                if method.upper() == "GET" and response.status_code == 200:
                    try:
                        res_json = response.json()
                        res_headers = dict(response.headers)
                        _GET_CACHE[cache_key] = (res_json, res_headers, time.time() + 300.0)
                        logger.info(f"GitHub Client Cache SET: {url}")
                    except Exception:
                        pass
                
                return response
            except httpx.RequestError as exc:
                logger.error(f"HTTP request to GitHub failed: {exc}")
                raise HTTPException(status_code=503, detail=f"Failed to connect to GitHub API: {exc}")

    def get(self, url: str, **kwargs) -> httpx.Response:
        return self.request("GET", url, **kwargs)

    def post(self, url: str, **kwargs) -> httpx.Response:
        return self.request("POST", url, **kwargs)

    def put(self, url: str, **kwargs) -> httpx.Response:
        return self.request("PUT", url, **kwargs)

    def patch(self, url: str, **kwargs) -> httpx.Response:
        return self.request("PATCH", url, **kwargs)

    def delete(self, url: str, **kwargs) -> httpx.Response:
        return self.request("DELETE", url, **kwargs)
