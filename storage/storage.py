"""
Cloud Storage Service
Supports AWS S3, Cloudflare R2, and local storage
"""

import os
import boto3
from typing import Optional
from pathlib import Path

class StorageService:
    """Handles file uploads to cloud storage"""
    
    def __init__(self, provider: str = "s3"):
        self.provider = provider
        
        if provider == "s3":
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
                aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
                region_name=os.getenv("AWS_REGION", "us-east-1")
            )
            self.bucket_name = os.getenv("AWS_S3_BUCKET", "video-engine-videos")
        
        elif provider == "r2":
            # Cloudflare R2
            self.s3_client = boto3.client(
                's3',
                endpoint_url=os.getenv("R2_ENDPOINT_URL"),
                aws_access_key_id=os.getenv("R2_ACCESS_KEY_ID"),
                aws_secret_access_key=os.getenv("R2_SECRET_ACCESS_KEY"),
                region_name="auto"
            )
            self.bucket_name = os.getenv("R2_BUCKET_NAME", "video-engine")
        
        self.cdn_url = os.getenv("CDN_URL", "https://cdn.example.com")
    
    def upload_file(self, local_path: str, remote_path: str, content_type: str = "video/mp4") -> Optional[str]:
        """Upload file to cloud storage"""
        try:
            if not os.path.exists(local_path):
                print(f"[Storage] File not found: {local_path}")
                return None
            
            file_size = os.path.getsize(local_path)
            print(f"[Storage] Uploading {remote_path} ({file_size / 1024 / 1024:.1f} MB)...")
            
            # Upload with progress
            with open(local_path, 'rb') as f:
                self.s3_client.upload_fileobj(
                    f,
                    self.bucket_name,
                    remote_path,
                    ExtraArgs={
                        'ContentType': content_type,
                        'CacheControl': 'public, max-age=86400',  # 24 hours
                    }
                )
            
            # Return CDN URL
            cdn_file_url = f"{self.cdn_url}/{remote_path}"
            print(f"[Storage] Uploaded successfully: {cdn_file_url}")
            
            return cdn_file_url
        
        except Exception as e:
            print(f"[Storage] Error uploading file: {e}")
            return None
    
    def upload_video(self, local_path: str, result_id: str) -> Optional[str]:
        """Upload video file"""
        filename = os.path.basename(local_path)
        remote_path = f"videos/{result_id}/{filename}"
        return self.upload_file(local_path, remote_path, content_type="video/mp4")
    
    def upload_subtitle(self, local_path: str, result_id: str) -> Optional[str]:
        """Upload subtitle file"""
        filename = os.path.basename(local_path)
        remote_path = f"subtitles/{result_id}/{filename}"
        return self.upload_file(local_path, remote_path, content_type="text/vtt")
    
    def delete_file(self, remote_path: str) -> bool:
        """Delete file from cloud storage"""
        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=remote_path)
            print(f"[Storage] Deleted: {remote_path}")
            return True
        except Exception as e:
            print(f"[Storage] Error deleting file: {e}")
            return False
    
    def generate_signed_url(self, remote_path: str, expiration: int = 3600) -> Optional[str]:
        """Generate signed URL for temporary access"""
        try:
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket_name, 'Key': remote_path},
                ExpiresIn=expiration
            )
            return url
        except Exception as e:
            print(f"[Storage] Error generating signed URL: {e}")
            return None


class CloudflareR2StorageService(StorageService):
    """Specialized service for Cloudflare R2 with auto-invalidation"""
    
    def __init__(self):
        super().__init__(provider="r2")
        self.cf_zone_id = os.getenv("CLOUDFLARE_ZONE_ID")
        self.cf_token = os.getenv("CLOUDFLARE_API_TOKEN")
    
    def upload_video(self, local_path: str, result_id: str) -> Optional[str]:
        """Upload video and invalidate CDN cache"""
        url = super().upload_video(local_path, result_id)
        
        if url and self.cf_zone_id and self.cf_token:
            # Invalidate Cloudflare cache
            self.invalidate_cache(url)
        
        return url
    
    def invalidate_cache(self, url: str) -> bool:
        """Invalidate Cloudflare cache for URL"""
        try:
            import requests
            
            # Extract path from URL
            path = url.replace(self.cdn_url, "")
            
            headers = {
                "Authorization": f"Bearer {self.cf_token}",
                "Content-Type": "application/json"
            }
            
            payload = {"files": [url]}
            
            response = requests.post(
                f"https://api.cloudflare.com/client/v4/zones/{self.cf_zone_id}/purge_cache",
                json=payload,
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                print(f"[CDN] Cache invalidated for: {url}")
                return True
            else:
                print(f"[CDN] Cache invalidation failed: {response.text}")
                return False
        
        except Exception as e:
            print(f"[CDN] Error invalidating cache: {e}")
            return False


# ============ USAGE EXAMPLE ============
if __name__ == "__main__":
    # AWS S3
    storage = StorageService(provider="s3")
    video_url = storage.upload_video("/path/to/video.mp4", "result_123")
    print(f"Video URL: {video_url}")
    
    # Cloudflare R2
    r2_storage = CloudflareR2StorageService()
    r2_video_url = r2_storage.upload_video("/path/to/video.mp4", "result_456")
    print(f"R2 Video URL: {r2_video_url}")
