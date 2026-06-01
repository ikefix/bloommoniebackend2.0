import { imageSearchQueue } from '../queues/index.js';
import Product from '../models/product.js';
import { publishImageAddedEvent } from '../service/redisPubSub.js';

// Process image search jobs
imageSearchQueue.process('search-images', async (job) => {
  const { productId, productName } = job.data;

  try {
    const product = await Product.findById(productId);
    if (!product) {
      throw new Error('Product not found');
    }

    // Search for images using the product's searchAndSetImages method
    const searchedImages = await Product.searchAndSetImages(productName);
    
    if (searchedImages.length > 0) {
      product.images = searchedImages;
      await product.save();
      
      // Publish event via Redis pub/sub
      await publishImageAddedEvent({
        entityType: 'product',
        entityId: productId,
        images: searchedImages
      });
      
      console.log(`Images updated for product ${productId}: ${productName}`);
      return { success: true, productId, images: searchedImages };
    } else {
      console.log(`No images found for product ${productId}: ${productName}`);
      return { success: false, productId, message: 'No images found' };
    }
  } catch (error) {
    console.error(`Failed to search images for product ${productId}:`, error);
    throw error;
  }
});

console.log('Image search worker started');
