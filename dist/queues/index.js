import Queue from 'bull';
// Email Queue
export const emailQueue = new Queue('email', {
    redis: process.env.REDIS_URL || 'redis://localhost:6379',
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000
        },
        removeOnComplete: 10,
        removeOnFail: 50
    }
});
// Image Search Queue
export const imageSearchQueue = new Queue('image-search', {
    redis: process.env.REDIS_URL || 'redis://localhost:6379',
    defaultJobOptions: {
        attempts: 2,
        backoff: {
            type: 'exponential',
            delay: 1000
        },
        removeOnComplete: 20,
        removeOnFail: 100
    }
});
// Payment Queue
export const paymentQueue = new Queue('payments', {
    redis: process.env.REDIS_URL || 'redis://localhost:6379',
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000
        },
        removeOnComplete: 10,
        removeOnFail: 50
    }
});
// Error handling
emailQueue.on('error', (err) => console.error('Email Queue Error:', err));
imageSearchQueue.on('error', (err) => console.error('Image Search Queue Error:', err));
paymentQueue.on('error', (err) => console.error('Payment Queue Error:', err));
console.log('Job queues initialized');
