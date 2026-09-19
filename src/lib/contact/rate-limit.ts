/**
 * Per-IP rate limiting for the contact endpoint.
 *
 * Backed by a Cloudflare KV namespace when the `CONTACT_RATE_LIMIT` binding
 * exists, and by an in-isolate map otherwise. The in-memory fallback is weaker
 * — Cloudflare runs many isolates, so a determined flood gets more through —
 * but it means the endpoint works locally and on a fresh deploy without any
 * setup, and KV can be added later without touching this call site.
 */

/** Only the two KV methods used here, so no generated worker types are needed. */
export interface RateLimitStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export const WINDOW_SECONDS = 60 * 60;
export const MAX_PER_WINDOW = 5;

const memory = new Map<string, { count: number; expiresAt: number }>();

const memoryStore: RateLimitStore = {
  async get(key) {
    const hit = memory.get(key);
    if (!hit) return null;
    if (hit.expiresAt <= Date.now()) {
      memory.delete(key);
      return null;
    }
    return String(hit.count);
  },
  async put(key, value, options) {
    memory.set(key, {
      count: Number(value),
      expiresAt: Date.now() + (options?.expirationTtl ?? WINDOW_SECONDS) * 1000,
    });
  },
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** Seconds until the current window rolls over. */
  retryAfter: number;
};

/**
 * Fixed window, incremented read-then-write. Two requests landing in the same
 * millisecond can both read the same count; that is an acceptable trade for
 * one KV round trip on a low-traffic contact form.
 */
export async function checkRateLimit(
  identifier: string,
  store: RateLimitStore | undefined,
): Promise<RateLimitResult> {
  const backing = store ?? memoryStore;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % WINDOW_SECONDS);
  const key = `contact:${identifier}:${windowStart}`;
  const retryAfter = windowStart + WINDOW_SECONDS - now;

  const count = Number((await backing.get(key)) ?? '0');
  if (count >= MAX_PER_WINDOW) {
    return { allowed: false, remaining: 0, retryAfter };
  }

  await backing.put(key, String(count + 1), { expirationTtl: retryAfter + 60 });
  return { allowed: true, remaining: MAX_PER_WINDOW - count - 1, retryAfter };
}

/**
 * Cloudflare sets `CF-Connecting-IP` and strips any client-supplied copy, so it
 * is safe to trust here. Everything unattributable shares one bucket.
 */
export function clientIdentifier(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'unknown'
  );
}
