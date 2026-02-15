# BullMQ Worker Documentation

This document explains how to use the BullMQ worker for video rendering.

## Overview

The `worker.mjs` file implements a BullMQ worker that:
1. Listens for jobs on the 'render' queue
2. Downloads or prepares video assets
3. Renders videos using Remotion (via `render-utils.mjs`)
4. Uploads rendered videos to AWS S3
5. Notifies a callback URL (e.g., your Vercel app) when complete

## Prerequisites

- Node.js installed
- Redis server running
- AWS S3 bucket configured
- Environment variables set (see below)

## Installation

Dependencies are already installed via npm:
```bash
npm install
```

Key dependencies:
- `bullmq` - Job queue library
- `aws-sdk` - AWS S3 integration (Note: AWS SDK v2 is in maintenance mode. Consider migrating to `@aws-sdk/client-s3` for new features and better performance)
- `node-fetch` - HTTP requests for callbacks

## Environment Variables

Create a `.env` file or set the following environment variables:

```bash
# Redis Configuration
REDIS_HOST=localhost          # Redis server host
REDIS_PORT=6379              # Redis server port

# AWS S3 Configuration
AWS_REGION=us-east-1         # AWS region for S3
S3_BUCKET=your-bucket-name   # S3 bucket for rendered videos

# AWS Credentials (alternatively use AWS CLI config)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Callback Configuration
CALLBACK_URL=https://your-app.vercel.app/api/render-callback
```

## Running the Worker

Start the worker process:

```bash
npm run worker
```

Or directly with Node.js:

```bash
node worker.mjs
```

## Job Data Format

Jobs should be added to the 'render' queue with the following data structure:

```javascript
{
  jobId: "unique-job-id",      // Unique identifier for the job
  assets: {                     // Assets for video rendering
    images: ["url1", "url2"],
    audio: "audio-url",
    // ... other assets
  },
  params: {                     // Rendering parameters
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 60,
    // ... other parameters
  }
}
```

## Adding Jobs to the Queue

Example of adding a job using BullMQ:

```javascript
import { Queue } from 'bullmq';

const queue = new Queue('render', {
  connection: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
  }
});

await queue.add('render-video', {
  jobId: 'video-123',
  assets: {
    images: ['https://example.com/image1.jpg'],
    audio: 'https://example.com/audio.mp3'
  },
  params: {
    width: 1920,
    height: 1080,
    fps: 30
  }
});
```

**Quick Start Example:**

A complete example is provided in `example-add-job.mjs`:

```bash
node example-add-job.mjs
```

This will add a sample job to the render queue (requires Redis to be running).

## Implementing Remotion Rendering

The `render-utils.mjs` file contains a placeholder `renderWithRemotion()` function that needs to be implemented based on your Remotion setup.

### Steps to implement:

1. Install Remotion dependencies:
   ```bash
   npm install remotion @remotion/renderer
   ```

2. Create your Remotion composition(s)

3. Update `render-utils.mjs` to:
   - Import Remotion renderer
   - Bundle your composition
   - Render frames
   - Stitch frames into video

Example implementation structure:

```javascript
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';

export async function renderWithRemotion({ jobId, assets, params, tmpDir }) {
  // Bundle Remotion composition
  const bundled = await bundle({
    entryPoint: './path/to/your/composition.tsx',
    // ... other options
  });

  // Select composition
  const composition = await selectComposition({
    serveUrl: bundled,
    id: 'YourComposition',
    inputProps: { assets, params }
  });

  // Render video
  const outputPath = path.join(tmpDir, `${jobId}.mp4`);
  await renderMedia({
    composition,
    serveUrl: bundled,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps: { assets, params }
  });

  return outputPath;
}
```

## Worker Events

The worker logs the following events:
- `active` - Job has started processing
- `completed` - Job finished successfully
- `failed` - Job failed with error
- `error` - Worker encountered an error

## Graceful Shutdown

The worker handles `SIGTERM` and `SIGINT` signals for graceful shutdown:
- Completes current job
- Closes Redis connection
- Exits cleanly

## Output

Rendered videos are uploaded to S3 with the following structure:
- S3 Key: `renders/${jobId}.mp4`
- URL: `https://${S3_BUCKET}.s3.amazonaws.com/renders/${jobId}.mp4`

## Callback Notification

After successful rendering, the worker sends a POST request to `CALLBACK_URL` with:

```json
{
  "jobId": "video-123",
  "url": "https://bucket.s3.amazonaws.com/renders/video-123.mp4",
  "status": "completed",
  "s3Key": "renders/video-123.mp4",
  "timestamp": "2026-02-15T11:42:00.000Z"
}
```

## Troubleshooting

### Worker doesn't start
- Check Redis connection (`REDIS_HOST` and `REDIS_PORT`)
- Verify Redis server is running

### S3 upload fails
- Verify AWS credentials are configured
- Check S3 bucket exists and has correct permissions
- Ensure `AWS_REGION` matches your bucket region

### Rendering fails
- Implement the `renderWithRemotion()` function in `render-utils.mjs`
- Check that assets are accessible
- Verify Remotion is properly installed and configured

### AWS SDK deprecation warning
- The current implementation uses AWS SDK v2, which is in maintenance mode
- For production use, consider migrating to AWS SDK v3 (`@aws-sdk/client-s3`)
- Migration guide: https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/migrating-to-v3.html

## Production Deployment

For production:
1. Use a process manager (PM2, systemd, Docker)
2. Configure environment variables securely
3. Set up monitoring and logging
4. Consider running multiple worker instances
5. Implement retry logic for failed jobs

Example PM2 configuration:

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'video-worker',
    script: './worker.mjs',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

## Related Files

- `worker.mjs` - Main worker implementation
- `render-utils.mjs` - Remotion rendering utilities
- `example-add-job.mjs` - Example script to add jobs to the queue
- `package.json` - Dependencies and scripts
- `WORKER.md` - This documentation file
