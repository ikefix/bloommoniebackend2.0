import { imageSearchQueue } from '../queues/index.js';
import Category from '../models/category.js';
import { publishImageAddedEvent } from '../service/redisPubSub.js';

// Process image search jobs for categories
imageSearchQueue.process('search-category-images', async (job) => {
  const { categoryId, categoryName } = job.data;

  try {
    const category = await Category.findById(categoryId);
    if (!category) {
      throw new Error('Category not found');
    }

    // Search for image using the category's searchAndSetImage method
    const searchedImage = await Category.searchAndSetImage(categoryName);
    
    if (searchedImage) {
      category.image = searchedImage;
      await category.save();
      
      // Publish event via Redis pub/sub
      await publishImageAddedEvent({
        entityType: 'category',
        entityId: categoryId,
        images: [searchedImage]
      });
      
      console.log(`Image updated for category ${categoryId}: ${categoryName}`);
      return { success: true, categoryId, image: searchedImage };
    } else {
      console.log(`No image found for category ${categoryId}: ${categoryName}`);
      return { success: false, categoryId, message: 'No image found' };
    }
  } catch (error) {
    console.error(`Failed to search image for category ${categoryId}:`, error);
    throw error;
  }
});

console.log('Category image search worker started');
