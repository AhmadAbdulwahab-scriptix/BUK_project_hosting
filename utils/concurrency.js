// Run fn over items with at most `limit` running at once. Never rejects: each result is
// { ok: true, value } or { ok: false, error }, so one bad item cannot stop the batch.
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      try { results[index] = { ok: true, value: await fn(items[index], index) }; }
      catch (error) { results[index] = { ok: false, error }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// A tiny in-memory queue that runs at most `limit` tasks at the same time.
function createLimiter(limit) {
  let active = 0;
  const waiting = [];
  const runNext = () => {
    if (active >= limit || waiting.length === 0) return;
    active++;
    const { task, resolve, reject } = waiting.shift();
    task().then(resolve, reject).finally(() => { active--; runNext(); });
  };
  return task => new Promise((resolve, reject) => { waiting.push({ task, resolve, reject }); runNext(); });
}

module.exports = { mapWithConcurrency, createLimiter };
