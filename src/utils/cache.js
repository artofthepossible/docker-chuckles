import Redis from 'ioredis';

const redis = new Redis();

export async function getCachedJoke() {
  const cached = await redis.get('current_joke');
  if (cached) return JSON.parse(cached);
  return null;
} 