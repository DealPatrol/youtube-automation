"""
Storage upload worker - handles file uploads to S3/R2
"""

import os
import sys
import time
from pathlib import Path

sys.path.insert(0, '/app/api')
sys.path.insert(0, '/app/storage')

from services.job_queue import VideoJobQueue
from storage import StorageService, CloudflareR2StorageService

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
STORAGE_PATH = os.getenv("STORAGE_PATH", "/app/storage")
STORAGE_PROVIDER = os.getenv("STORAGE_PROVIDER", "s3")

def upload_worker_loop():
    """Monitor for completed videos and upload to cloud storage"""
    
    if STORAGE_PROVIDER == "r2":
        storage = CloudflareR2StorageService()
    else:
        storage = StorageService(provider="s3")
    
    queue = VideoJobQueue(REDIS_URL)
    
    print(f"[Upload Worker] Starting with provider: {STORAGE_PROVIDER}")
    
    while True:
        try:
            # Check for completed jobs
            completed_key = "video:completed"
            
            # Get all completed jobs
            while True:
                job_id = queue.redis.rpop(completed_key)
                if not job_id:
                    break
                
                # Get job details
                job_data = queue.redis.hgetall(f"job:{job_id}")
                result_url = job_data.get("result_url")
                
                if not result_url:
                    print(f"[Upload Worker] No result URL for job {job_id}")
                    continue
                
                # Check if file exists locally
                local_path = os.path.join(STORAGE_PATH, result_url.strip("/"))
                
                if not os.path.exists(local_path):
                    print(f"[Upload Worker] File not found: {local_path}")
                    continue
                
                try:
                    # Extract result_id from path
                    result_id = result_url.split("/")[-1].split(".")[0]
                    
                    print(f"[Upload Worker] Uploading video for job {job_id}...")
                    
                    # Upload to cloud storage
                    cloud_url = storage.upload_video(local_path, result_id)
                    
                    if cloud_url:
                        # Update job with cloud URL
                        queue.redis.hset(f"job:{job_id}", mapping={
                            "cloud_url": cloud_url,
                            "uploaded_at": time.time(),
                        })
                        
                        # Optionally delete local file
                        if os.getenv("DELETE_LOCAL_AFTER_UPLOAD") == "true":
                            os.remove(local_path)
                            print(f"[Upload Worker] Deleted local file: {local_path}")
                        
                        print(f"[Upload Worker] Uploaded successfully: {cloud_url}")
                    else:
                        print(f"[Upload Worker] Upload failed for job {job_id}")
                
                except Exception as e:
                    print(f"[Upload Worker] Error uploading job {job_id}: {e}")
            
            # Sleep before checking again
            time.sleep(10)
        
        except KeyboardInterrupt:
            print("[Upload Worker] Shutting down...")
            break
        except Exception as e:
            print(f"[Upload Worker] Unexpected error: {e}")
            time.sleep(10)

if __name__ == "__main__":
    upload_worker_loop()
