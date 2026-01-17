/**
 * Simple in-memory rate limiter for Edge Functions.
 *
 * Note: This is per-instance rate limiting. For distributed rate limiting,
 * consider using Supabase KV, Upstash Redis, or similar.
 *
 * For Edge Functions that run as isolated instances, this provides
 * basic protection against rapid-fire requests from the same IP.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (per-function instance)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically (every 60 seconds)
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60 * 1000;

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Key prefix for namespacing (e.g., function name) */
  keyPrefix?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check if a request should be rate limited.
 *
 * @param identifier - Unique identifier (typically IP address)
 * @param config - Rate limit configuration
 * @returns Rate limit result with remaining count and reset time
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanup();

  const { maxRequests, windowMs, keyPrefix = '' } = config;
  const key = `${keyPrefix}:${identifier}`;
  const now = Date.now();

  let entry = rateLimitStore.get(key);

  // Create new entry if none exists or window has expired
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 1,
      resetAt: now + windowMs,
    };
    rateLimitStore.set(key, entry);

    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetAt: entry.resetAt,
    };
  }

  // Increment count
  entry.count += 1;

  const allowed = entry.count <= maxRequests;
  const remaining = Math.max(0, maxRequests - entry.count);

  return {
    allowed,
    remaining,
    resetAt: entry.resetAt,
  };
}

/**
 * Extract client IP from request headers.
 * Handles common proxy headers.
 */
export function getClientIp(req: Request): string {
  // Supabase Edge Functions typically pass real IP in these headers
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    // Take the first IP if there are multiple
    return forwarded.split(',')[0].trim();
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  // Fallback - use a hash of available identifiers
  return 'unknown';
}

/**
 * Create a rate limit response (429 Too Many Requests)
 */
export function rateLimitResponse(result: RateLimitResult): Response {
  const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);

  return new Response(
    JSON.stringify({
      error: 'Too many requests',
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(result.resetAt),
      },
    }
  );
}

/**
 * Middleware-style rate limiter that returns Response or null.
 * Returns Response if rate limited, null if allowed.
 */
export function rateLimit(
  req: Request,
  config: RateLimitConfig
): Response | null {
  const clientIp = getClientIp(req);
  const result = checkRateLimit(clientIp, config);

  if (!result.allowed) {
    return rateLimitResponse(result);
  }

  return null;
}

/**
 * Timing-safe string comparison to prevent timing attacks.
 * Compares two strings in constant time.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do comparison to maintain constant time
    // Use longer string length to prevent length leakage
    const maxLen = Math.max(a.length, b.length);
    a = a.padEnd(maxLen, '\0');
    b = b.padEnd(maxLen, '\0');
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
