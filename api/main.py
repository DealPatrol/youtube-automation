from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, String, DateTime, Integer, JSON, Enum
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.sql import func
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
import os
from enum import Enum as PyEnum

# ============ CONFIG ============
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost/video_db")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# ============ DATABASE SETUP ============
engine = create_engine(DATABASE_URL, echo=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ============ MODELS ============
class VideoStatusEnum(str, PyEnum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False)
    title = Column(String, nullable=False)
    topic = Column(String, nullable=False)
    description = Column(String)
    video_length_minutes = Column(Integer)
    tone = Column(String)
    platform = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Result(Base):
    __tablename__ = "results"
    
    id = Column(String, primary_key=True)
    project_id = Column(String, nullable=False)
    user_id = Column(String, nullable=False)
    
    # Generated content
    script = Column(JSON)
    scenes = Column(JSON)
    capcut_steps = Column(JSON)
    seo = Column(JSON)
    thumbnail = Column(JSON)
    
    # Processing status
    processing_status = Column(String, default="processing")
    error_message = Column(String)
    
    # Video output
    video_url = Column(String)
    video_status = Column(String, default="pending")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class VideoJob(Base):
    __tablename__ = "video_jobs"
    
    id = Column(String, primary_key=True)
    result_id = Column(String, nullable=False)
    status = Column(String, default="pending")  # pending, processing, completed, failed
    
    # Job metadata
    job_queue_id = Column(String)  # BullMQ job ID
    
    # Progress tracking
    progress = Column(Integer, default=0)
    current_step = Column(String)  # e.g., "fetching_images", "generating_voiceover", "rendering_video"
    
    # Error handling
    error_message = Column(String)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    
    # Timing
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

# ============ SCHEMAS ============
class GenerateVideoRequest(BaseModel):
    topic: str
    description: Optional[str] = None
    video_length_minutes: int
    tone: str
    platform: str

class VideoJobResponse(BaseModel):
    id: str
    result_id: str
    status: str
    progress: int
    current_step: Optional[str]
    error_message: Optional[str]

class ResultResponse(BaseModel):
    id: str
    video_url: Optional[str]
    video_status: str
    script: Optional[dict]
    scenes: Optional[dict]

# ============ DEPENDENCY ============
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ============ FASTAPI APP ============
app = FastAPI(title="Video Generation API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create tables
Base.metadata.create_all(bind=engine)

# ============ ROUTES ============
@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/api/videos/generate")
async def generate_video(request: GenerateVideoRequest, db: Session = Depends(get_db)):
    """Enqueue a new video generation job"""
    # This will be implemented with job queue integration
    return {"message": "Job enqueued", "status": "pending"}

@app.get("/api/videos/{result_id}/status")
async def get_video_status(result_id: str, db: Session = Depends(get_db)):
    """Get video generation status"""
    job = db.query(VideoJob).filter(VideoJob.result_id == result_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return {
        "id": job.id,
        "result_id": job.result_id,
        "status": job.status,
        "progress": job.progress,
        "current_step": job.current_step,
        "error_message": job.error_message,
    }

@app.get("/api/videos/{result_id}")
async def get_result(result_id: str, db: Session = Depends(get_db)):
    """Get result data and video URL"""
    result = db.query(Result).filter(Result.id == result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    
    return {
        "id": result.id,
        "video_url": result.video_url,
        "video_status": result.video_status,
        "script": result.script,
        "scenes": result.scenes,
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
