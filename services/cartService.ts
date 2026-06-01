import { redisClient } from "../app.js";

// Cart key prefix
const CART_KEY_PREFIX = 'cart:';

// Initialize cart for user
export const initializeCart = async (userId: string) => {
  const cartKey = CART_KEY_PREFIX + userId;
  const existingCart = await redisClient.get(cartKey);
  
  if (existingCart) {
    return JSON.parse(typeof existingCart === 'string' ? existingCart : existingCart.toString());
  }
  
  const newCart = {
    items: [],
    customer: null,
    discount: null,
    subtotal: 0,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 0,
    createdAt: new Date()
  };
  
  await redisClient.set(cartKey, JSON.stringify(newCart), { EX: 86400 }); // 24 hour expiry
  return newCart;
};

// Save cart to Redis
export const saveCart = async (userId: string, cart: any) => {
  const cartKey = CART_KEY_PREFIX + userId;
  await redisClient.set(cartKey, JSON.stringify(cart), { EX: 86400 });
};

// Clear cart from Redis
export const clearCart = async (userId: string) => {
  const cartKey = CART_KEY_PREFIX + userId;
  await redisClient.del(cartKey);
};
