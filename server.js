// Entry point only: connect, listen, start background jobs, shut down cleanly.
const config = require('./config');
const db = require('./config/database');
const app = require('./app');
const { startJobs } = require('./jobs');
const logger = require('./utils/logger');

async function start() {
  await db.connect();
  const server = app.listen(config.port, '0.0.0.0', () =>
    logger.info(`Portal listening on port ${config.port}; public base URL: ${config.baseUrl}`));
  const stopJobs = startJobs();

  // Render sends SIGTERM on every deploy: stop taking work, let running jobs finish, then exit.
  let closing = false;
  async function shutdown(signal) {
    if (closing) return;
    closing = true;
    logger.info(`${signal} received, shutting down.`);
    setTimeout(() => process.exit(1), 10000).unref();
    server.close();
    await stopJobs();
    await db.disconnect();
    process.exit(0);
  }
  ['SIGTERM', 'SIGINT'].forEach(signal => process.on(signal, () => shutdown(signal)));
  return server;
}

if (require.main === module) start();
module.exports = { start };
