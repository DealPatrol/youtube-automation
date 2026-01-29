from redis import Redis
from typing import Optional, Dict, Any
import json
import uuid
from datetime import datetime

class VideoJobQueue:
    """Manages video rendering jobs with Redis"""
    
    def __init__(self, redis_url: str = "redis://localhost:6379"):
        self.redis = Redis.from_url(redis_url, decode_responses=True)
        self.queue_key = "video:queue"
        self.processing_key = "video:processing"
        self.completed_key = "video:completed"
        self.failed_key = "video:failed"
    
    def enqueue_job(self, result_id: str, scenes: list, script: dict, seo: dict) -> str:
        """Add a new video rendering job to the queue"""
        job_id = str(uuid.uuid4())
        
        job_data = {
            "job_id": job_id,
            "result_id": result_id,
            "status": "pending",
            "progress": 0,
            "current_step": "queued",
            "scenes": json.dumps(scenes),
            "script": json.dumps(script),
            "seo": json.dumps(seo),
            "created_at": datetime.utcnow().isoformat(),
        }
        
        # Add to queue
        self.redis.lpush(self.queue_key, json.dumps(job_data))
        print(f"[Queue] Job {job_id} enqueued for result {result_id}")
        
        return job_id
    
    def dequeue_job(self) -> Optional[Dict[str, Any]]:
        """Get the next job from the queue"""
        job_json = self.redis.rpop(self.queue_key)
        
        if not job_json:
            return None
        
        job = json.loads(job_json)
        
        # Parse JSON fields
        job["scenes"] = json.loads(job["scenes"])
        job["script"] = json.loads(job["script"])
        job["seo"] = json.loads(job["seo"])
        
        # Mark as processing
        job["status"] = "processing"
        self.redis.hset(f"job:{job['job_id']}", mapping={
            "status": "processing",
            "started_at": datetime.utcnow().isoformat(),
        })
        
        print(f"[Queue] Job {job['job_id']} dequeued and processing")
        
        return job
    
    def update_job_progress(self, job_id: str, progress: int, current_step: str):
        """Update job progress"""
        self.redis.hset(f"job:{job_id}", mapping={
            "progress": progress,
            "current_step": current_step,
            "updated_at": datetime.utcnow().isoformat(),
        })
        print(f"[Queue] Job {job_id}: {current_step} ({progress}%)")
    
    def complete_job(self, job_id: str, result_url: str):
        """Mark job as completed"""
        self.redis.hset(f"job:{job_id}", mapping={
            "status": "completed",
            "result_url": result_url,
            "completed_at": datetime.utcnow().isoformat(),
        })
        self.redis.lpush(self.completed_key, job_id)
        print(f"[Queue] Job {job_id} completed: {result_url}")
    
    def fail_job(self, job_id: str, error_message: str, retry: bool = True):
        """Mark job as failed"""
        self.redis.hset(f"job:{job_id}", mapping={
            "status": "failed",
            "error_message": error_message,
            "failed_at": datetime.utcnow().isoformat(),
        })
        
        if retry:
            # Re-queue for retry
            self.redis.lpush(self.queue_key, json.dumps({
                "job_id": job_id,
                "retry": True,
            }))
            print(f"[Queue] Job {job_id} queued for retry: {error_message}")
        else:
            self.redis.lpush(self.failed_key, job_id)
            print(f"[Queue] Job {job_id} permanently failed: {error_message}")
    
    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get job status from Redis"""
        job_data = self.redis.hgetall(f"job:{job_id}")
        return job_data if job_data else None
    
    def queue_size(self) -> int:
        """Get number of pending jobs"""
        return self.redis.llen(self.queue_key)
    
    def processing_jobs(self) -> int:
        """Get number of processing jobs"""
        return self.redis.llen(self.processing_key)
