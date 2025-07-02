import { NextRequest, NextResponse } from 'next/server';

// In-memory store for rate limiting (consider Redis for production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Clean up expired entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 1000);

export interface RateLimitConfig {
  windowMs?: number;  // Time window in milliseconds
  max?: number;       // Max requests per window
  message?: string;   // Error message
  keyGenerator?: (req: NextRequest) => string; // Custom key generator
}

const defaultConfig: Required<RateLimitConfig> = {
  windowMs: 60 * 1000, // 1 minute
  max: 60,             // 60 requests per minute
  message: 'Too many requests, please try again later',
  keyGenerator: (req) => {
    // Use IP address as default key
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
    return `${ip}:${req.nextUrl.pathname}`;
  }
};

export function rateLimit(userConfig: RateLimitConfig = {}) {
  const config = { ...defaultConfig, ...userConfig };

  return async function rateLimitMiddleware(req: NextRequest): Promise<NextResponse | null> {
    const key = config.keyGenerator(req);
    const now = Date.now();
    
    // Get or create rate limit entry
    let entry = rateLimitStore.get(key);
    
    if (!entry || entry.resetTime < now) {
      // Create new entry
      entry = {
        count: 1,
        resetTime: now + config.windowMs
      };
      rateLimitStore.set(key, entry);
      return null; // Allow request
    }
    
    // Check if limit exceeded
    if (entry.count >= config.max) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      
      return NextResponse.json(
        { error: config.message },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': config.max.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': entry.resetTime.toString(),
            'Retry-After': retryAfter.toString()
          }
        }
      );
    }
    
    // Increment count
    entry.count++;
    
    // Add rate limit headers to help clients
    const headers = new Headers();
    headers.set('X-RateLimit-Limit', config.max.toString());
    headers.set('X-RateLimit-Remaining', (config.max - entry.count).toString());
    headers.set('X-RateLimit-Reset', entry.resetTime.toString());
    
    return null; // Allow request with headers
  };
}

// Stricter rate limit for sensitive endpoints
export const strictRateLimit = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 10,              // 10 requests per minute
  message: 'Rate limit exceeded for this endpoint'
});

// More lenient rate limit for public endpoints
export const publicRateLimit = rateLimit({
  windowMs: 60 * 1000,  // 1 minute  
  max: 30,              // 30 requests per minute
  message: 'Too many requests, please slow down'
});

// Very strict rate limit for auth endpoints
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,                    // 5 attempts per 15 minutes
  message: 'Too many authentication attempts'
}); 