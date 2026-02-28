from fastapi import APIRouter
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/")
async def root():
    logger.info("Root endpoint accessed")
    return {"message": "Hello World", "status": "running"}


@router.get("/health")
async def health_check():
    logger.info("Health check endpoint accessed")
    return {"status": "healthy"}

