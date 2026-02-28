from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import default_router, negotiate_router, save_router
import uvicorn
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="FastAPI Backend", version="1.0.0")
logger.info("FastAPI application initialized")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Include routers
app.include_router(default_router.router)
app.include_router(negotiate_router.router)
app.include_router(save_router.router)

if __name__ == "__main__":
    logger.info("Starting uvicorn server on 0.0.0.0:8080")
    uvicorn.run(app, host="0.0.0.0", port=8080)