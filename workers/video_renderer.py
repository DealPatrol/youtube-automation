#!/usr/bin/env python3
"""
Video Rendering Worker
Pulls jobs from Redis queue and renders videos using MoviePy + FFmpeg
"""

import os
import sys
import json
import requests
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin

# MoviePy imports
from moviepy.editor import (
    ImageClip, TextClip, CompositeVideoClip, 
    concatenate_videoclips, ColorClip, AudioFileClip, CompositeAudioClip
)
from PIL import Image, ImageDraw

# Job queue
sys.path.insert(0, '/app/api')
from services.job_queue import VideoJobQueue

# ============ CONFIG ============
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
STORAGE_PATH = os.getenv("STORAGE_PATH", "/app/storage/videos")
UNSPLASH_API_KEY = os.getenv("UNSPLASH_API_KEY", "")

VIDEO_SIZE = (1080, 1920)  # Vertical format (Reels/TikTok)
FPS = 24

# Create storage directory
Path(STORAGE_PATH).mkdir(parents=True, exist_ok=True)

# ============ HELPERS ============
def download_image(url: str, output_path: str) -> bool:
    """Download image from URL"""
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            with open(output_path, 'wb') as f:
                f.write(response.content)
            return True
    except Exception as e:
        print(f"[Worker] Error downloading image: {e}")
    return False

def fetch_scene_image(scene_description: str) -> Optional[str]:
    """Fetch image from Unsplash based on scene description"""
    if not UNSPLASH_API_KEY:
        # Return placeholder if no API key
        return create_placeholder_image()
    
    try:
        params = {
            "query": scene_description,
            "count": 1,
            "client_id": UNSPLASH_API_KEY,
        }
        response = requests.get("https://api.unsplash.com/photos/random", params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            image_url = data.get("urls", {}).get("regular")
            
            if image_url:
                image_path = f"{STORAGE_PATH}/scene_{uuid.uuid4().hex}.jpg"
                if download_image(image_url, image_path):
                    return image_path
    except Exception as e:
        print(f"[Worker] Error fetching from Unsplash: {e}")
    
    return create_placeholder_image()

def create_placeholder_image() -> str:
    """Create a simple placeholder image"""
    import uuid
    img_path = f"{STORAGE_PATH}/placeholder_{uuid.uuid4().hex}.png"
    
    img = Image.new('RGB', VIDEO_SIZE, color=(20, 20, 20))
    draw = ImageDraw.Draw(img)
    draw.text((540, 960), "Scene Image", fill=(200, 200, 200), anchor="mm")
    
    img.save(img_path)
    return img_path

def create_text_clip(text: str, duration: float, position: str = "bottom"):
    """Create a text overlay clip"""
    return TextClip(
        text,
        fontsize=50,
        color='white',
        font='Arial-Bold',
        size=(900, None),
        method='caption',
        interline=15,
    ).set_position((540, 1800) if position == "bottom" else (540, 200)).set_duration(duration)

def create_image_clip(image_path: str, duration: float):
    """Create an image clip with proper sizing"""
    try:
        clip = ImageClip(image_path).set_duration(duration)
        # Resize to fit video size
        if clip.size[0] < VIDEO_SIZE[0] or clip.size[1] < VIDEO_SIZE[1]:
            clip = clip.resize(height=VIDEO_SIZE[1])
        return clip.set_position("center")
    except Exception as e:
        print(f"[Worker] Error loading image {image_path}: {e}")
        return ColorClip(size=VIDEO_SIZE, color=(10, 10, 10)).set_duration(duration)

# ============ VIDEO RENDERING ============
def render_video(job: dict) -> Optional[str]:
    """Render video from scenes"""
    job_id = job["job_id"]
    result_id = job["result_id"]
    scenes = job["scenes"]
    script = job["script"]
    
    print(f"[Worker] Starting render for job {job_id}")
    
    try:
        queue = VideoJobQueue(REDIS_URL)
        
        # Update progress
        queue.update_job_progress(job_id, 10, "fetching_images")
        
        video_clips = []
        
        for i, scene in enumerate(scenes):
            # Parse timings
            start_time = scene.get("start_time", "0:00")
            end_time = scene.get("end_time", "1:00")
            
            start_seconds = int(start_time.split(":")[0]) * 60 + int(start_time.split(":")[1])
            end_seconds = int(end_time.split(":")[0]) * 60 + int(end_time.split(":")[1])
            duration = max(1, end_seconds - start_seconds)
            
            # Fetch scene image
            image_path = fetch_scene_image(scene.get("visual_description", "generic"))
            queue.update_job_progress(job_id, 10 + (i * 50 // len(scenes)), f"loading_scene_{i+1}")
            
            # Create image clip
            img_clip = create_image_clip(image_path, duration)
            
            # Create text overlay
            text_clip = create_text_clip(scene.get("on_screen_text", ""), duration)
            
            # Composite scene
            scene_clip = CompositeVideoClip([img_clip, text_clip], size=VIDEO_SIZE)
            video_clips.append(scene_clip)
        
        # Concatenate all scenes
        print(f"[Worker] Compositing {len(video_clips)} scenes...")
        queue.update_job_progress(job_id, 60, "compositing_video")
        
        final_video = concatenate_videoclips(video_clips, method="compose")
        
        # Save video
        output_path = f"{STORAGE_PATH}/video_{result_id}.mp4"
        print(f"[Worker] Rendering to {output_path}...")
        queue.update_job_progress(job_id, 80, "encoding_video")
        
        final_video.write_videofile(
            output_path,
            fps=FPS,
            codec="libx264",
            audio_codec="aac",
            verbose=False,
            logger=None,
        )
        
        print(f"[Worker] Video rendered: {output_path}")
        return output_path
        
    except Exception as e:
        print(f"[Worker] Error rendering video: {e}")
        raise

# ============ WORKER LOOP ============
def worker_loop():
    """Main worker loop - pulls jobs and renders videos"""
    queue = VideoJobQueue(REDIS_URL)
    
    print("[Worker] Starting video rendering worker...")
    
    while True:
        try:
            job = queue.dequeue_job()
            
            if not job:
                print("[Worker] No jobs available, waiting...")
                import time
                time.sleep(5)
                continue
            
            job_id = job["job_id"]
            result_id = job["result_id"]
            
            try:
                # Render video
                video_path = render_video(job)
                
                # Mark as complete
                video_url = f"/videos/{os.path.basename(video_path)}"
                queue.complete_job(job_id, video_url)
                
                print(f"[Worker] Job {job_id} completed successfully")
                
            except Exception as e:
                error_msg = str(e)
                queue.fail_job(job_id, error_msg, retry=True)
                print(f"[Worker] Job {job_id} failed: {error_msg}")
        
        except KeyboardInterrupt:
            print("[Worker] Shutting down...")
            break
        except Exception as e:
            print(f"[Worker] Unexpected error: {e}")
            import time
            time.sleep(10)

if __name__ == "__main__":
    worker_loop()
