import axios from 'axios';

interface ImageSearchResult {
  url: string;
  thumbnail?: string;
  title?: string;
}

class ImageSearchService {
  private UNSPLASH_ACCESS_KEY: string;
  
  constructor() {
    this.UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || '';
  }

  /**
   * Search for images using Unsplash API
   * @param query - Search query (product name)
   * @param count - Number of images to return
   * @returns Array of image URLs
   */
  async searchImages(query: string, count: number = 3): Promise<string[]> {
    try {
      // If Unsplash API key is available, use it
      if (this.UNSPLASH_ACCESS_KEY) {
        return await this.searchUnsplash(query, count);
      }
      
      // Fallback to a free image search (using a placeholder service or similar)
      return await this.searchFallback(query, count);
    } catch (error) {
      console.error('Image search error:', error);
      return [];
    }
  }

  /**
   * Search using Unsplash API
   */
  private async searchUnsplash(query: string, count: number): Promise<string[]> {
    try {
      const response = await axios.get('https://api.unsplash.com/search/photos', {
        params: {
          query: query,
          per_page: count,
          orientation: 'squarish'
        },
        headers: {
          Authorization: `Client-ID ${this.UNSPLASH_ACCESS_KEY}`
        }
      });

      return response.data.results.map((result: any) => result.urls.regular);
    } catch (error) {
      console.error('Unsplash search error:', error);
      throw error;
    }
  }

  /**
   * Fallback image search using free services
   * This uses placeholder images or a simple approach
   */
  private async searchFallback(query: string, count: number): Promise<string[]> {
    // Using a placeholder image service as fallback
    // In production, you might want to use other free APIs or services
    const images: string[] = [];
    
    for (let i = 0; i < count; i++) {
      // Using Lorem Picsum as a fallback placeholder service
      const randomId = Math.floor(Math.random() * 1000);
      images.push(`https://picsum.photos/seed/${query.replace(/\s/g, '')}${i}/400/400`);
    }
    
    return images;
  }

  /**
   * Search for a single best matching image
   */
  async searchSingleImage(query: string): Promise<string | null> {
    const images = await this.searchImages(query, 1);
    return images.length > 0 ? images[0] : null;
  }
}

export default new ImageSearchService();
