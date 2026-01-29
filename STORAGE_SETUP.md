# Storage & CDN Setup Guide

## Overview
This guide covers setting up cloud storage (AWS S3 or Cloudflare R2) and CDN delivery for video files.

## AWS S3 Setup

### 1. Create S3 Bucket

```bash
# Via AWS CLI
aws s3 mb s3://video-engine-videos --region us-east-1

# Or via AWS Console
# Services → S3 → Create bucket
# Name: video-engine-videos
# Region: us-east-1
```

### 2. Create IAM User for API Access

```bash
# Create policy
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::video-engine-videos/*",
        "arn:aws:s3:::video-engine-videos"
      ]
    }
  ]
}

# Create IAM user with this policy
aws iam create-user --user-name video-engine-worker
aws iam put-user-policy --user-name video-engine-worker --policy-name s3-access --policy-document file://policy.json
aws iam create-access-key --user-name video-engine-worker
```

### 3. Configure .env

```env
STORAGE_PROVIDER=s3
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1
AWS_S3_BUCKET=video-engine-videos
CDN_URL=https://cdn.example.com
```

### 4. Setup CloudFront CDN

```bash
# Create CloudFront distribution
# Origin Domain: video-engine-videos.s3.amazonaws.com
# Origin Path: /
# Viewer protocol policy: Redirect HTTP to HTTPS
# Allowed HTTP methods: GET, HEAD
# Cache policy: CachingOptimized (24 hours)
# Compress objects automatically: Yes

# Note the distribution domain
# Example: d123456.cloudfront.net

# Update CDN_URL in .env
CDN_URL=https://d123456.cloudfront.net
```

---

## Cloudflare R2 Setup

### 1. Create R2 Bucket

```bash
# Log into Cloudflare Dashboard
# R2 → Create bucket
# Name: video-engine
# Region: Auto
```

### 2. Generate API Tokens

```bash
# In Cloudflare Dashboard
# R2 → Settings → Create API token
# Permissions: Admin
# Scope: All buckets
# Generate token
```

### 3. Get R2 API Credentials

```bash
# In Cloudflare Dashboard
# R2 → Settings → Download credentials
# Contains:
# - R2 Access Key ID
# - R2 Secret Access Key
# - R2 Endpoint URL (s3.{region}.r2.cloudflarestorage.com)
```

### 4. Configure .env

```env
STORAGE_PROVIDER=r2
R2_ENDPOINT_URL=https://s3.us-east-1.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=video-engine
CDN_URL=https://video.example.com
CLOUDFLARE_ZONE_ID=your_zone_id
CLOUDFLARE_API_TOKEN=your_api_token
```

### 5. Setup R2 Custom Domain

```bash
# Cloudflare Dashboard
# Websites → Select domain
# R2 → Create custom domain
# Domain: video.example.com
# R2 bucket: video-engine
```

### 6. Enable R2 Analytics

```bash
# Monitor bandwidth usage
# Cloudflare Dashboard
# R2 → Settings → Analytics
```

---

## Docker Compose Configuration

Update `docker-compose.yml` to include upload worker:

```yaml
upload-worker:
  build:
    context: ./workers
    dockerfile: Dockerfile
  environment:
    REDIS_URL: "redis://redis:6379"
    STORAGE_PATH: /app/storage/videos
    STORAGE_PROVIDER: ${STORAGE_PROVIDER:-s3}
    AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID}
    AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY}
    AWS_REGION: ${AWS_REGION}
    AWS_S3_BUCKET: ${AWS_S3_BUCKET}
    R2_ENDPOINT_URL: ${R2_ENDPOINT_URL}
    R2_ACCESS_KEY_ID: ${R2_ACCESS_KEY_ID}
    R2_SECRET_ACCESS_KEY: ${R2_SECRET_ACCESS_KEY}
    R2_BUCKET_NAME: ${R2_BUCKET_NAME}
    CDN_URL: ${CDN_URL}
    CLOUDFLARE_ZONE_ID: ${CLOUDFLARE_ZONE_ID}
    CLOUDFLARE_API_TOKEN: ${CLOUDFLARE_API_TOKEN}
    DELETE_LOCAL_AFTER_UPLOAD: "true"
  depends_on:
    - redis
  volumes:
    - ./workers:/app/workers
    - ./api:/app/api
    - ./storage:/app/storage
  command: python /app/workers/upload_worker.py
```

---

## Testing

### 1. Upload a Test File

```python
from storage.storage import StorageService

storage = StorageService(provider="s3")
url = storage.upload_file(
    "/path/to/test.mp4",
    "test/video.mp4",
    content_type="video/mp4"
)
print(f"Uploaded to: {url}")
```

### 2. Test Signed URLs

```python
signed_url = storage.generate_signed_url("videos/result_123/video.mp4", expiration=3600)
print(f"Signed URL: {signed_url}")
```

### 3. Test Cache Invalidation

```python
from storage.storage import CloudflareR2StorageService

r2 = CloudflareR2StorageService()
r2.invalidate_cache("https://video.example.com/videos/result_123/video.mp4")
```

---

## Cost Optimization

### S3
- **Standard Storage**: $0.023/GB/month
- **Data Transfer Out**: $0.09/GB (to internet)
- **CloudFront**: $0.085/GB (cheaper than direct S3)
- **Optimization**: Enable S3 Intelligent-Tiering for videos older than 30 days

### R2
- **Storage**: $0.015/GB/month (always)
- **Data Transfer**: Always free
- **Bandwidth**: No egress charges
- **Recommendation**: Use R2 for high-bandwidth scenarios (better ROI)

---

## Production Checklist

- [ ] S3/R2 bucket created and configured
- [ ] IAM user created with minimal permissions
- [ ] CDN configured with 24-hour cache
- [ ] CORS enabled on bucket (for direct uploads)
- [ ] Versioning disabled (to save costs)
- [ ] Lifecycle policies configured (archive old videos after 90 days)
- [ ] CloudWatch/R2 Analytics configured
- [ ] Upload worker running in production
- [ ] CDN headers configured (Cache-Control, ETag)
- [ ] Signed URLs tested for temporary access
- [ ] Monitoring alerts set up for failed uploads
