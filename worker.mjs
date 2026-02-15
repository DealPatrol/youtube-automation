// worker.mjs - BullMQ Worker for Video Rendering
import { Worker } from 'bullmq';
import AWS from 'aws-sdk';
import fs from 'fs';
import fetch from 'node-fetch';
import { renderWithRemotion } from './render-utils.mjs';

// Configure AWS S3
const s3 = new AWS.S3({ region: process.env.AWS_REGION });

// Configure Redis connection for BullMQ
const redisConnection = { 
  host: process.env.REDIS_HOST || 'localhost', 
  port: parseInt(process.env.REDIS_PORT || '6379', 10)
};

// Create BullMQ Worker for 'render' queue
const worker = new Worker('render', async job => {
  const { jobId, assets, params } = job.data;
  
  console.log(`[Worker] Processing job ${jobId}`);
  console.log('[Worker] Job data:', JSON.stringify(job.data, null, 2));

  try {
    // Step 1: Download assets (or use S3 URLs directly)
    console.log('[Worker] Step 1: Preparing assets...');
    // Assets can be used directly or downloaded to local filesystem
    // depending on your Remotion setup requirements
    
    // Step 2: Call Remotion render function
    console.log('[Worker] Step 2: Rendering video with Remotion...');
    const outputPath = await renderWithRemotion({ 
      jobId, 
      assets, 
      params, 
      tmpDir: '/tmp' 
    });
    
    console.log(`[Worker] Video rendered successfully: ${outputPath}`);

    // Step 3: Upload to S3
    console.log('[Worker] Step 3: Uploading to S3...');
    const s3Key = `renders/${jobId}.mp4`;
    const s3Bucket = process.env.S3_BUCKET;
    
    if (!s3Bucket) {
      throw new Error('S3_BUCKET environment variable is not set');
    }

    const uploadParams = {
      Bucket: s3Bucket,
      Key: s3Key,
      Body: fs.createReadStream(outputPath),
      ContentType: 'video/mp4'
    };

    const s3Result = await s3.upload(uploadParams).promise();
    console.log(`[Worker] Uploaded to S3: ${s3Result.Location}`);

    // Step 4: Notify Vercel app via callback
    console.log('[Worker] Step 4: Notifying callback URL...');
    const callbackUrl = process.env.CALLBACK_URL;
    
    if (callbackUrl) {
      // Use the S3 Location URL from the upload result for correct bucket configuration
      const videoUrl = s3Result.Location;
      
      const response = await fetch(callbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          jobId, 
          url: videoUrl,
          status: 'completed',
          s3Key,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        console.warn(`[Worker] Callback failed with status ${response.status}`);
      } else {
        console.log('[Worker] Callback notification sent successfully');
      }
    } else {
      console.warn('[Worker] No CALLBACK_URL configured, skipping notification');
    }

    // Cleanup: Remove temporary file
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
      console.log('[Worker] Cleaned up temporary file');
    }

    console.log(`[Worker] Job ${jobId} completed successfully`);
    return { success: true, jobId, s3Key };

  } catch (error) {
    console.error(`[Worker] Job ${jobId} failed:`, error);
    throw error;
  }
}, { connection: redisConnection });

// Worker event handlers
worker.on('completed', (job) => {
  console.log(`[Worker] Job ${job.id} has completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id || 'unknown'} failed:`, err.message);
  console.error('[Worker] Error details:', err);
});

worker.on('error', (err) => {
  console.error('[Worker] Worker error:', err);
});

worker.on('active', (job) => {
  console.log(`[Worker] Job ${job.id} is now active`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Worker] SIGTERM received, shutting down gracefully...');
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Worker] SIGINT received, shutting down gracefully...');
  await worker.close();
  process.exit(0);
});

console.log('[Worker] Video rendering worker started');
console.log('[Worker] Listening for jobs on "render" queue');
console.log(`[Worker] Redis: ${redisConnection.host}:${redisConnection.port}`);
