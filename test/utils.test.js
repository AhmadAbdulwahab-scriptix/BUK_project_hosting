const test = require('node:test');
const assert = require('node:assert/strict');
const { mapWithConcurrency, createLimiter } = require('../utils/concurrency');
const { createRateCounter } = require('../utils/rateCounter');

const sleep = ms => new Promise(r => setTimeout(r, ms));

test('mapWithConcurrency respects the cap and survives failures', async () => {
  let active = 0, peak = 0;
  const results = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async n => {
    active++; peak = Math.max(peak, active);
    await sleep(10);
    active--;
    if (n === 3) throw new Error('boom');
    return n * 2;
  });
  assert.equal(peak, 2);
  assert.deepEqual(results.map(r => r.ok), [true, true, false, true, true, true]);
  assert.equal(results[5].value, 12);
});

test('createLimiter runs queued tasks without exceeding the limit', async () => {
  const limit = createLimiter(2);
  let active = 0, peak = 0;
  await Promise.all(Array.from({ length: 6 }, () => limit(async () => {
    active++; peak = Math.max(peak, active); await sleep(5); active--;
  })));
  assert.equal(peak, 2);
});

test('rate counter blocks after max and resets after the window', () => {
  const counter = createRateCounter({ windowMs: 1000, max: 2 });
  assert.equal(counter.hit('ip', 0).allowed, true);
  assert.equal(counter.hit('ip', 10).allowed, true);
  assert.equal(counter.hit('ip', 20).allowed, false);
  assert.equal(counter.hit('other', 20).allowed, true);
  assert.equal(counter.hit('ip', 1001).allowed, true);
  counter.cleanup(5000);
  assert.equal(counter.size, 0);
});
