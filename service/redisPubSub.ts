import { createClient } from 'redis';

// Redis publisher for events
const publisher = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Redis subscriber for events
const subscriber = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

let publisherConnected = false;
let subscriberConnected = false;

async function ensureConnected() {
  if (!publisherConnected) {
    await publisher.connect();
    publisherConnected = true;
    console.log('Redis publisher connected');
  }
  if (!subscriberConnected) {
    await subscriber.connect();
    subscriberConnected = true;
    console.log('Redis subscriber connected');
  }
}

// Publish event when images are added
export async function publishImageAddedEvent(data: {
  entityType: 'product' | 'category';
  entityId: string;
  images: string[];
}) {
  await ensureConnected();
  await publisher.publish('image-events', JSON.stringify({
    type: 'images-added',
    ...data
  }));
  console.log(`Published image added event for ${data.entityType}:${data.entityId}`);
}

// Subscribe to image events and callback
export async function subscribeToImageEvents(callback: (event: any) => void) {
  await ensureConnected();
  await subscriber.subscribe('image-events', (message) => {
    try {
      const event = JSON.parse(message);
      callback(event);
    } catch (error) {
      console.error('Error parsing event:', error);
    }
  });
  console.log('Subscribed to image events');
}

// Cleanup function
export async function cleanupPubSub() {
  if (publisherConnected) {
    await publisher.quit();
    publisherConnected = false;
  }
  if (subscriberConnected) {
    await subscriber.quit();
    subscriberConnected = false;
  }
}
