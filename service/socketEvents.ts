import { Server as SocketIOServer } from 'socket.io';
import { subscribeToImageEvents } from './redisPubSub.js';

export function setupSocketEventHandlers(io: SocketIOServer) {
  // Subscribe to Redis events for image updates and broadcast via Socket.io
  subscribeToImageEvents((event) => {
    if (event.type === 'images-added') {
      const { entityType, entityId, images } = event;
      const room = entityType === 'product' ? `product-${entityId}` : `category-${entityId}`;
      
      io.to(room).emit('images-updated', {
        entityType,
        entityId,
        images,
        timestamp: new Date().toISOString()
      });
      
      console.log(`Broadcasted images update to room: ${room}`);
    }
  });

  console.log('Socket event handlers initialized');
}
