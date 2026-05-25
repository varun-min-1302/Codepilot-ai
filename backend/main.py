from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from routes import router as api_router
from webhooks import router as webhooks_router

app = FastAPI(
    title="CodePilot AI Review Platform",
    description="Backend review engine and webhook handler for CodePilot AI.",
    version="1.0.0"
)

# Configure CORS
import os
allowed_origins_str = os.getenv("ALLOWED_ORIGINS", "")
if allowed_origins_str:
    allowed_origins = [origin.strip() for origin in allowed_origins_str.split(",") if origin.strip()]
else:
    allowed_origins = ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Routers
app.include_router(api_router)
app.include_router(webhooks_router)

@app.on_event("startup")
def startup_event():
    # Automatically initialize SQLite database tables
    init_db()

@app.get("/")
def read_root():
    return {
        "name": "CodePilot AI Backend API",
        "status": "active",
        "documentation": "/docs"
    }
