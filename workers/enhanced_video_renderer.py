#!/usr/bin/env python3
"""
Enhanced Video Rendering Worker with AI Services
Integrates TTS, Image Generation, and Subtitles using optimized FFmpeg
"""

import os
import sys
import json
import requests
import time
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin

# Add paths
sys.path.insert(0, '/app/api')
sys.path.insert(0, '/app/ai')

from services.job_queue import VideoJobQueue
from services import TTSService, ImageGenService, SubtitleService
from ffmpeg_renderer import FFmpegRenderer

# ============ CONFIG ============
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
STORAGE_PATH = os.getenv("STORAGE_PATH", "/app/storage")
UNSPLASH_API_KEY = os.getenv("UNSPLASH_API_KEY", "")

VIDEO_SIZE = (1080, 1920)
FPS = 24

Path(STORAGE_PATH).mkdir(parents=True, exist_ok=True)

# Initialize AI services
tts = TTSService(provider="elevenlabs")
image_gen = ImageGenService()
subtitles_service = SubtitleService()
ffmpeg = FFmpegRenderer(fps=FPS)

# ============ ENHANCED VIDEO WORKER ============
class EnhancedVideoWorker:
    def __init__(self):
        self.queue = VideoJobQueue(REDIS_URL)
        self.tts = tts
        self.image_gen = image_gen
        self.subtitles_service = subtitles_service
    
    def fetch_scene_image(self, scene_description: str) -> Optional[str]:
        """Fetch or generate image for scene"""
        # Try to generate with AI first (if API key available)
        if self.image_gen.openai_key:
            image_path = self.image_gen.generate_scene_image(scene_description)
            if image_path:
                return image_path
        
        # Fallback to Unsplash
        if UNSPLASH_API_KEY:
            try:
                params = {
                    "query": scene_description,
                    "count": 1,
                    "client_id": UNSPLASH_API_KEY,
                }
                response = requests.get(
                    "https://api.unsplash.com/photos/random",
                    params=params,
                    timeout=10
                )
                
                if response.status_code == 200:
                    data = response.json()
                    image_url = data.get("urls", {}).get("regular")
                    
                    if image_url:
                        image_path = f"{STORAGE_PATH}/scene_{int(time.time())}.jpg"
                        img_response = requests.get(image_url, timeout=10)
                        if img_response.status_code == 200:
                            with open(image_path, 'wb') as f:
                                f.write(img_response.content)
                            return image_path
            except Exception as e:
                print(f"[Worker] Error fetching from Unsplash: {e}")
        
        # Placeholder
        return self.create_placeholder_image()
    
    def create_placeholder_image(self) -> str:
        """Create placeholder image"""
        img_path = f"{STORAGE_PATH}/placeholder_{int(time.time())}.png"
        img = Image.new('RGB', VIDEO_SIZE, color=(20, 20, 20))
        draw = ImageDraw.Draw(img)
        draw.text((540, 960), "Scene Image", fill=(200, 200, 200), anchor="mm")
        img.save(img_path)
        return img_path
    
    def create_text_clip(self, text: str, duration: float):
        """Create text overlay"""
        return TextClip(
            text,
            fontsize=50,
            color='white',
            font='Arial-Bold',
            size=(900, None),
            method='caption',
            interline=15,
        ).set_position((540, 1800)).set_duration(duration)
    
    def create_image_clip(self, image_path: str, duration: float):
        """Create image clip"""
        try:
            clip = ImageClip(image_path).set_duration(duration)
            if clip.size[0] < VIDEO_SIZE[0] or clip.size[1] < VIDEO_SIZE[1]:
                clip = clip.resize(height=VIDEO_SIZE[1])
            return clip.set_position("center")
        except Exception as e:
            print(f"[Worker] Error loading image: {e}")
            return ColorClip(size=VIDEO_SIZE, color=(10, 10, 10)).set_duration(duration)
    
    def render_video(self, job: dict) -> Optional[str]:
        """Main video rendering pipeline using optimized FFmpeg"""
        job_id = job["job_id"]
        result_id = job["result_id"]
        scenes = job["scenes"]
        script = job["script"]
        
        print(f"[Worker] Starting enhanced render for job {job_id}")
        
        try:
            # ============ STEP 1: GENERATE VOICEOVER ============
            self.queue.update_job_progress(job_id, 5, "generating_voiceover")
            print(f"[Worker] Generating voiceover...")
            
            script_sections = script.get("sections", [])
            voiceover_path = self.tts.generate_voiceover_from_script(script_sections)
            
            if not voiceover_path:
                raise Exception("Failed to generate voiceover")
            
            # ============ STEP 2: FETCH/GENERATE SCENE IMAGES ============
            self.queue.update_job_progress(job_id, 15, "fetching_images")
            print(f"[Worker] Fetching/generating scene images...")
            
            image_paths = []
            
            for i, scene in enumerate(scenes):
                progress = 15 + (i * 40 // max(len(scenes), 1))
                self.queue.update_job_progress(job_id, progress, f"processing_scene_{i+1}")
                
                # Fetch scene image
                image_path = self.fetch_scene_image(scene.get("visual_description", "generic"))
                image_paths.append(image_path)
                print(f"[Worker] Scene {i+1}: {image_path}")
            
            # ============ STEP 3: GENERATE BACKGROUND MUSIC ============
            self.queue.update_job_progress(job_id, 60, "generating_music")
            music_path = self.generate_background_music()
            
            # ============ STEP 4: RENDER VIDEO WITH FFmpeg ============
            self.queue.update_job_progress(job_id, 70, "rendering_video")
            print(f"[Worker] Rendering video with FFmpeg...")
            
            output_path = f"{STORAGE_PATH}/video_{result_id}.mp4"
            
            ffmpeg.render_video(
                images=image_paths,
                voice_path=voiceover_path,
                music_path=music_path,
                output_path=output_path,
                image_duration=2,
                voice_volume=1.0,
                music_volume=0.2,
            )
            
            # ============ STEP 5: GENERATE SUBTITLES ============
            self.queue.update_job_progress(job_id, 85, "generating_subtitles")
            print(f"[Worker] Generating subtitles...")
            
            captions = self.subtitles_service.generate_from_voiceover(voiceover_path)
            
            # Add subtitles to video if needed
            if captions:
                self.queue.update_job_progress(job_id, 90, "adding_subtitles")
                final_path = f"{STORAGE_PATH}/video_{result_id}_subtitled.mp4"
                ffmpeg.render_with_captions(
                    images=image_paths,
                    voice_path=voiceover_path,
                    music_path=music_path,
                    captions=captions,
                    output_path=final_path,
                )
                output_path = final_path
            
            print(f"[Worker] Video rendered: {output_path}")
            
            # ============ STEP 6: GENERATE SUBTITLES (optional) ============
            if voiceover_path:
                self.queue.update_job_progress(job_id, 90, "generating_subtitles")
                print(f"[Worker] Generating subtitles...")
                
                try:
                    subtitles_path = self.subtitles_service.generate_subtitles_from_audio(voiceover_path)
                    print(f"[Worker] Subtitles generated: {subtitles_path}")
                except Exception as e:
                    print(f"[Worker] Warning: Could not generate subtitles: {e}")
            
            return output_path
        
        except Exception as e:
            print(f"[Worker] Error rendering video: {e}")
            raise
    
    def worker_loop(self):
        """Main worker loop"""
        print("[Worker] Starting enhanced video rendering worker...")
        
        while True:
            try:
                job = self.queue.dequeue_job()
                
                if not job:
                    print("[Worker] No jobs available, waiting...")
                    time.sleep(5)
                    continue
                
                job_id = job["job_id"]
                result_id = job["result_id"]
                
                try:
                    # Render video
                    video_path = self.render_video(job)
                    
                    # Mark as complete
                    video_url = f"/videos/{os.path.basename(video_path)}"
                    self.queue.complete_job(job_id, video_url)
                    
                    print(f"[Worker] Job {job_id} completed successfully")
                
                except Exception as e:
                    error_msg = str(e)
                    self.queue.fail_job(job_id, error_msg, retry=True)
                    print(f"[Worker] Job {job_id} failed: {error_msg}")
            
            except KeyboardInterrupt:
                print("[Worker] Shutting down...")
                break
            except Exception as e:
                print(f"[Worker] Unexpected error: {e}")
                time.sleep(10)


if __name__ == "__main__":
    worker = EnhancedVideoWorker()
    worker.worker_loop()
