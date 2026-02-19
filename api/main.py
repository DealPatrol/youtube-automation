from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, String, DateTime, Integer, JSON, Enum
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.sql import func
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Dict, Any
import logging
import os
import tempfile
import subprocess
import base64
import requests
from enum import Enum as PyEnum

# ============ CONFIG ============
DATABASE_URL = os.getenv("DATABASE_URL")
# Render and some platforms use postgres://; SQLAlchemy/psycopg2 expect postgresql://
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = "postgresql://" + DATABASE_URL[len("postgres://"):]
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_STORAGE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "videos")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

BACKGROUND_MUSIC_URL = os.getenv("BACKGROUND_MUSIC_URL")
BACKGROUND_MUSIC_PATH = os.getenv("BACKGROUND_MUSIC_PATH")
BACKGROUND_MUSIC_VOLUME = float(os.getenv("BACKGROUND_MUSIC_VOLUME", "0.2"))
BRANDING_LOGO_URL = os.getenv("BRANDING_LOGO_URL")
BRANDING_LOGO_PATH = os.getenv("BRANDING_LOGO_PATH")
BRANDING_LOGO_SCALE = float(os.getenv("BRANDING_LOGO_SCALE", "0.12"))
BRANDING_LOGO_OPACITY = float(os.getenv("BRANDING_LOGO_OPACITY", "0.85"))
BRANDING_LOGO_POSITION = os.getenv("BRANDING_LOGO_POSITION", "top-right")
BRANDING_LOGO_PADDING = int(os.getenv("BRANDING_LOGO_PADDING", "24"))

# ============ DATABASE SETUP ============
# Engine and session are created at startup so connection failures don't crash import (e.g. on Render with wrong DATABASE_URL)
engine = None
SessionLocal = None
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

class AssembleVideoRequest(BaseModel):
    resultId: str
    projectId: Optional[str] = None
    scenes: List[Dict[str, Any]]
    script: Optional[Dict[str, Any]] = None
    defaultDuration: int = 5
    options: Optional[Dict[str, Any]] = None

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
    if not SessionLocal:
        raise HTTPException(
            status_code=503,
            detail="Database not configured or unavailable. On Render, set DATABASE_URL to your PostgreSQL Internal Database URL.",
        )
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _parse_timestamp(value: Optional[str]) -> Optional[int]:
    if not value:
        return None
    parts = [int(p) for p in value.split(":") if p.isdigit()]
    if len(parts) == 2:
        return parts[0] * 60 + parts[1]
    if len(parts) == 3:
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
    return None


def _resolve_duration(scene: Dict[str, Any], fallback: int) -> int:
    duration = scene.get("duration")
    if isinstance(duration, (int, float)) and duration > 0:
        return max(1, int(round(duration)))
    start = _parse_timestamp(scene.get("start_time"))
    end = _parse_timestamp(scene.get("end_time"))
    if start is not None and end is not None and end > start:
        return max(1, int(round(end - start)))
    return max(1, int(round(fallback)))


def _format_timestamp(total_seconds: float) -> str:
    hours = int(total_seconds // 3600)
    minutes = int((total_seconds % 3600) // 60)
    seconds = int(total_seconds % 60)
    milliseconds = int((total_seconds - int(total_seconds)) * 1000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}.{milliseconds:03d}"


def _create_vtt(scenes: List[Dict[str, Any]], default_duration: int) -> Optional[str]:
    cursor = 0
    cues = []
    for scene in scenes:
        duration = _resolve_duration(scene, default_duration)
        text = scene.get("narration") or scene.get("on_screen_text") or scene.get("title") or ""
        if not str(text).strip():
            cursor += duration
            continue
        start = _format_timestamp(cursor)
        end = _format_timestamp(cursor + duration)
        cues.append(f"{start} --> {end}\n{text}".strip())
        cursor += duration
    if not cues:
        return None
    return "WEBVTT\n\n" + "\n\n".join(cues) + "\n"


def _create_whisper_vtt(scenes: List[Dict[str, Any]], default_duration: int, work_dir: str) -> Optional[str]:
    if not OPENAI_API_KEY:
        return None

    cues: List[str] = []
    cursor = 0.0

    for scene in scenes:
        duration = _resolve_duration(scene, default_duration)
        audio_url = scene.get("audio_url")
        if not audio_url:
            cursor += duration
            continue

        audio_path = os.path.join(work_dir, f"audio_{scene.get('id')}.mp3")
        _download_to_file(audio_url, audio_path)

        with open(audio_path, "rb") as f:
            files = {"file": ("audio.mp3", f, "audio/mpeg")}
            data = {
                "model": "whisper-1",
                "response_format": "verbose_json",
                "timestamp_granularities[]": "word",
            }
            headers = {"Authorization": f"Bearer {OPENAI_API_KEY}"}
            response = requests.post("https://api.openai.com/v1/audio/transcriptions", files=files, data=data, headers=headers)
        if response.status_code != 200:
            cursor += duration
            continue

        payload = response.json()
        words = payload.get("words") or []
        buffer: List[str] = []
        cue_start = None
        cue_end = None

        def flush():
            nonlocal buffer, cue_start, cue_end
            if not buffer or cue_start is None or cue_end is None:
                return
            start = _format_timestamp(cursor + cue_start)
            end = _format_timestamp(cursor + cue_end)
            cues.append(f"{start} --> {end}\n{' '.join(buffer)}")
            buffer = []
            cue_start = None
            cue_end = None

        for idx, word in enumerate(words):
            text = str(word.get("word", "")).strip()
            if not text:
                continue
            if cue_start is None:
                cue_start = float(word.get("start", 0))
            cue_end = float(word.get("end", 0))
            buffer.append(text)

            next_word = words[idx + 1] if idx + 1 < len(words) else None
            gap = False
            if next_word and isinstance(next_word.get("start"), (int, float)):
                gap = float(next_word["start"]) - float(word.get("end", 0)) > 0.6
            if len(buffer) >= 7 or gap or idx == len(words) - 1:
                flush()

        flush()
        cursor += duration

    if not cues:
        return None
    return "WEBVTT\n\n" + "\n\n".join(cues) + "\n"


def _download_to_file(url: str, output_path: str):
    if url.startswith("data:"):
        header, b64data = url.split(",", 1)
        data = base64.b64decode(b64data)
        with open(output_path, "wb") as f:
            f.write(data)
        return
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    with open(output_path, "wb") as f:
        f.write(response.content)


def _resolve_optional_asset(url: Optional[str], local_path: Optional[str], work_dir: str, prefix: str, extension: str) -> Optional[str]:
    if url:
        target_path = os.path.join(work_dir, f"{prefix}.{extension}")
        _download_to_file(url, target_path)
        return target_path
    if local_path:
        resolved = local_path if os.path.isabs(local_path) else os.path.join(os.getcwd(), local_path)
        if not os.path.exists(resolved):
            raise FileNotFoundError(f"Asset not found: {resolved}")
        target_path = os.path.join(work_dir, f"{prefix}.{extension}")
        with open(resolved, "rb") as src, open(target_path, "wb") as dst:
            dst.write(src.read())
        return target_path
    return None


def _run_ffmpeg(args: List[str]):
    subprocess.run(["ffmpeg"] + args, check=True, capture_output=True)


def _create_scene_segment(scene: Dict[str, Any], duration: int, output_path: str, work_dir: str):
    has_video = bool(scene.get("video_url"))
    has_image = bool(scene.get("image_url"))
    if not has_video and not has_image:
        raise ValueError(f"Scene {scene.get('id')} has no video or image asset")

    asset_path = os.path.join(work_dir, f"scene_{scene.get('id')}.{'mp4' if has_video else 'jpg'}")
    _download_to_file(scene["video_url"] if has_video else scene["image_url"], asset_path)

    audio_path = None
    if scene.get("audio_url"):
        audio_path = os.path.join(work_dir, f"scene_{scene.get('id')}.mp3")
        _download_to_file(scene["audio_url"], audio_path)

    filters = [
        "scale=1920:1080:force_original_aspect_ratio=decrease",
        "pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
        "format=yuv420p",
    ]

    text = str(scene.get("on_screen_text") or "").strip()
    if text:
        safe_text = text.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'").replace("\n", "\\n")
        filters.append(
            f"drawtext=text='{safe_text}':fontsize=64:fontcolor=white:box=1:boxcolor=black@0.55:x=(w-text_w)/2:y=h-140:line_spacing=8"
        )

    args = ["-y"]
    if has_video:
        args += ["-stream_loop", "-1", "-i", asset_path, "-t", str(duration)]
    else:
        args += ["-loop", "1", "-t", str(duration), "-i", asset_path]

    if audio_path:
        args += ["-i", audio_path]
    else:
        args += ["-f", "lavfi", "-t", str(duration), "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"]

    args += [
        "-vf",
        ",".join(filters),
        "-r",
        "30",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-c:a",
        "aac",
        "-shortest",
        output_path,
    ]

    _run_ffmpeg(args)


def _concat_segments(segment_paths: List[str], output_path: str, work_dir: str):
    concat_path = os.path.join(work_dir, "concat.txt")
    with open(concat_path, "w", encoding="utf-8") as f:
        for seg in segment_paths:
            f.write(f"file '{seg}'\n")
    args = [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concat_path,
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        "-pix_fmt",
        "yuv420p",
        "-r",
        "30",
        output_path,
    ]
    _run_ffmpeg(args)


def _mix_background_music(input_path: str, music_path: str, output_path: str, volume: float):
    safe_volume = max(0.0, min(volume, 1.0))
    args = [
        "-y",
        "-i",
        input_path,
        "-stream_loop",
        "-1",
        "-i",
        music_path,
        "-filter_complex",
        f"[1:a]volume={safe_volume}[music];[0:a][music]amix=inputs=2:duration=first:dropout_transition=3[a]",
        "-map",
        "0:v",
        "-map",
        "[a]",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-shortest",
        output_path,
    ]
    _run_ffmpeg(args)


def _apply_branding_overlay(input_path: str, logo_path: str, output_path: str, opacity: float, scale: float, position: str, padding: int):
    width = int(1920 * min(max(scale, 0.05), 0.5))
    alpha = min(max(opacity, 0.1), 1.0)
    pad = max(0, int(padding))

    x = f"main_w-overlay_w-{pad}"
    y = f"{pad}"
    if position == "top-left":
        x = f"{pad}"
        y = f"{pad}"
    elif position == "bottom-left":
        x = f"{pad}"
        y = f"main_h-overlay_h-{pad}"
    elif position == "bottom-right":
        x = f"main_w-overlay_w-{pad}"
        y = f"main_h-overlay_h-{pad}"

    args = [
        "-y",
        "-i",
        input_path,
        "-i",
        logo_path,
        "-filter_complex",
        f"[1:v]format=rgba,scale={width}:-1,colorchannelmixer=aa={alpha}[logo];[0:v][logo]overlay={x}:{y}",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-c:a",
        "copy",
        output_path,
    ]
    _run_ffmpeg(args)


def _upload_to_supabase_storage(local_path: str, storage_path: str, content_type: str) -> str:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError("Supabase credentials missing for storage upload")
    url = f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/{SUPABASE_STORAGE_BUCKET}/{storage_path}"
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": content_type,
        "x-upsert": "true",
    }
    with open(local_path, "rb") as f:
        response = requests.post(url, headers=headers, data=f)
    if response.status_code not in (200, 201):
        raise RuntimeError(f"Storage upload failed: {response.status_code} {response.text}")
    public_url = f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/public/{SUPABASE_STORAGE_BUCKET}/{storage_path}"
    return public_url

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

@app.on_event("startup")
def startup_db():
    """Connect to DB and create tables at startup. If DATABASE_URL is wrong (e.g. localhost on Render), app still starts and DB routes return 500."""
    global engine, SessionLocal
    if not DATABASE_URL:
        return
    try:
        engine = create_engine(DATABASE_URL, echo=False)
        Base.metadata.create_all(bind=engine)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        logging.getLogger(__name__).info("Database connected and tables ready")
    except OperationalError as e:
        logging.getLogger(__name__).warning(
            "Database unavailable (check DATABASE_URL, e.g. use Render PostgreSQL Internal URL): %s", e
        )
        engine, SessionLocal = None, None

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


@app.post("/api/assemble-video")
async def assemble_video(request: AssembleVideoRequest):
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=500, detail="Supabase storage not configured")

    temp_dir = tempfile.mkdtemp(prefix="video-assembly-")
    try:
        scenes = request.scenes or []
        if not scenes:
            raise HTTPException(status_code=400, detail="No scenes provided")

        default_duration = request.defaultDuration or 5

        segment_paths = []
        for scene in scenes:
            duration = _resolve_duration(scene, default_duration)
            segment_path = os.path.join(temp_dir, f"segment_{scene.get('id')}.mp4")
            _create_scene_segment(scene, duration, segment_path, temp_dir)
            segment_paths.append(segment_path)

        output_path = os.path.join(temp_dir, f"assembled_{request.resultId}.mp4")
        _concat_segments(segment_paths, output_path, temp_dir)

        final_output_path = output_path

        options = request.options or {}
        music_url = options.get("backgroundMusicUrl") or BACKGROUND_MUSIC_URL
        music_volume = options.get("backgroundMusicVolume", BACKGROUND_MUSIC_VOLUME)
        logo_url = options.get("brandingLogoUrl") or BRANDING_LOGO_URL
        logo_position = options.get("brandingLogoPosition") or BRANDING_LOGO_POSITION
        use_whisper_captions = bool(options.get("useWhisperCaptions"))

        music_path = _resolve_optional_asset(music_url, BACKGROUND_MUSIC_PATH, temp_dir, "background_music", "mp3")
        if music_path:
            mixed_path = os.path.join(temp_dir, f"assembled_{request.resultId}_music.mp4")
            _mix_background_music(final_output_path, music_path, mixed_path, float(music_volume))
            final_output_path = mixed_path

        logo_path = _resolve_optional_asset(logo_url, BRANDING_LOGO_PATH, temp_dir, "branding_logo", "png")
        if logo_path:
            branded_path = os.path.join(temp_dir, f"assembled_{request.resultId}_branded.mp4")
            _apply_branding_overlay(
                final_output_path,
                logo_path,
                branded_path,
                BRANDING_LOGO_OPACITY,
                BRANDING_LOGO_SCALE,
                logo_position,
                BRANDING_LOGO_PADDING,
            )
            final_output_path = branded_path

        subtitle_url = None
        vtt = _create_whisper_vtt(scenes, default_duration, temp_dir) if use_whisper_captions else _create_vtt(scenes, default_duration)
        if vtt:
            vtt_path = os.path.join(temp_dir, f"captions_{request.resultId}.vtt")
            with open(vtt_path, "w", encoding="utf-8") as f:
                f.write(vtt)
            storage_path = f"results/{request.resultId}/captions-{int(datetime.utcnow().timestamp())}.vtt"
            subtitle_url = _upload_to_supabase_storage(vtt_path, storage_path, "text/vtt")

        video_storage_path = f"results/{request.resultId}/final-{int(datetime.utcnow().timestamp())}.mp4"
        video_url = _upload_to_supabase_storage(final_output_path, video_storage_path, "video/mp4")

        return {"videoUrl": video_url, "subtitleUrl": subtitle_url}
    finally:
        try:
            for root, dirs, files in os.walk(temp_dir, topdown=False):
                for name in files:
                    os.remove(os.path.join(root, name))
                for name in dirs:
                    os.rmdir(os.path.join(root, name))
            os.rmdir(temp_dir)
        except Exception:
            pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
