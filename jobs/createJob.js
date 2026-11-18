const logger = require('../utils/logger');

// A repeating job that waits for one run to FINISH before scheduling the next, so runs never overlap
// (setInterval would start a new run even while the previous one is still busy).
function createJob({ name, intervalMs, initialDelayMs = intervalMs, run }) {
  let timer = null;
  let current = null;
  let stopped = true;

  const schedule = delay => { timer = setTimeout(tick, delay); timer.unref(); };

  function tick() {
    const started = Date.now();
    current = Promise.resolve()
      .then(run)
      .catch(error => logger.error(`Job "${name}" failed:`, error.message))
      .finally(() => {
        current = null;
        if (Date.now() - started > intervalMs) logger.warn(`Job "${name}" took longer than its ${intervalMs}ms interval.`);
        if (!stopped) schedule(intervalMs);
      });
  }

  return {
    start() { stopped = false; schedule(initialDelayMs); },
    async stop() { stopped = true; clearTimeout(timer); if (current) await current; }
  };
}
module.exports = createJob;
