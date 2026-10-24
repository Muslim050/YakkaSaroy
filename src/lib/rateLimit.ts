import "server-only";

/** Tiny in-memory limiter for login attempts: `limit` failures per `windowMs` per key. */
const hits = new Map<string, { n: number; until: number }>();

export function tooManyAttempts(key: string, limit = 5) {
  const h = hits.get(key);
  return !!h && h.until > Date.now() && h.n >= limit;
}

export function recordFailure(key: string, windowMs = 15 * 60_000) {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || h.until < now) hits.set(key, { n: 1, until: now + windowMs });
  else h.n++;
}

export function clearFailures(key: string) {
  hits.delete(key);
}
