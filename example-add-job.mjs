#!/usr/bin/env node
/**
 * Example usage of the BullMQ worker
 * This demonstrates how to add a job to the render queue
 */

import { Queue } from 'bullmq';

// Configure Redis connection
const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10)
};

// Create a queue instance
const queue = new Queue('render', { connection: redisConnection });

// Example job data
const jobData = {
  jobId: 'example-video-123',
  assets: {
    images: [
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg'
    ],
    audio: 'https://example.com/audio.mp3',
    logo: 'https://example.com/logo.png'
  },
  params: {
    width: 1920,
    height: 1080,
    fps: 30,
    duration: 60,
    title: 'Example Video',
    backgroundColor: '#000000'
  }
};

async function addJob() {
  try {
    console.log('Adding job to render queue...');
    const job = await queue.add('render-video', jobData);
    console.log(`✓ Job added successfully!`);
    console.log(`  Job ID: ${job.id}`);
    console.log(`  Queue: render`);
    console.log(`  Data:`, JSON.stringify(jobData, null, 2));
    
    // Close the queue
    await queue.close();
    process.exit(0);
  } catch (error) {
    console.error('✗ Failed to add job:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\nRedis connection refused. Make sure Redis is running:');
      console.error('  docker run -d -p 6379:6379 redis');
      console.error('  or');
      console.error('  redis-server');
    }
    
    process.exit(1);
  }
}

// Run the example
addJob();
