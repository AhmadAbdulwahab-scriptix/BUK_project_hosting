const config = require('../config');
const db = require('../config/database');
const createJob = require('./createJob');
const reconciliation = require('../services/reconciliation.service');
const webhooks = require('../services/webhook.service');

const ready = () => db.isReady() && config.paystack.secretKey;

function startJobs() {
  const jobs = [
    createJob({
      name: 'reconcile-orders',
      intervalMs: config.reconcile.intervalMs,
      initialDelayMs: config.reconcile.initialDelayMs,
      run: () => ready() && reconciliation.sweepOrders()
    }),
    createJob({
      name: 'sweep-webhooks',
      intervalMs: config.reconcile.webhookSweepIntervalMs,
      initialDelayMs: config.reconcile.initialDelayMs,
      run: () => ready() && webhooks.sweepWebhooks()
    })
  ];
  jobs.forEach(job => job.start());
  return () => Promise.all(jobs.map(job => job.stop()));
}

module.exports = { startJobs };
