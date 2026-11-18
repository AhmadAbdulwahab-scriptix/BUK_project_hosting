// Fixed-window counter per key (e.g. per IP). In memory, so it resets on restart and is per instance.
function createRateCounter({ windowMs, max }) {
  const hits = new Map();
  return {
    hit(key, now = Date.now()) {
      let entry = hits.get(key);
      if (!entry || entry.resetAt <= now) { entry = { count: 0, resetAt: now + windowMs }; hits.set(key, entry); }
      entry.count++;
      return { allowed: entry.count <= max, retryAfterMs: Math.max(0, entry.resetAt - now) };
    },
    // Drops expired keys so the Map cannot grow without bound.
    cleanup(now = Date.now()) { for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key); },
    get size() { return hits.size; }
  };
}
module.exports = { createRateCounter };
