const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { calculatePrice, verifyPaystackSignature, makeReference } = require('../helpers/payments');

test('calculates the .com package in whole kobo', () => {
  assert.deepEqual(calculatePrice('com'), { totalUsd: 310, amountNaira: 427800, amountKobo: 42780000 });
});

test('calculates the .ng package in whole kobo', () => {
  assert.deepEqual(calculatePrice('ng'), { totalUsd: 300, amountNaira: 414000, amountKobo: 41400000 });
});

test('rejects unknown domain selections', () => {
  assert.throws(() => calculatePrice('org'), /Unsupported domain/);
});

test('validates the exact raw-body Paystack HMAC signature', () => {
  const secret = 'test-secret';
  const body = Buffer.from('{"event":"charge.success","data":{"reference":"abc"}}');
  const signature = crypto.createHmac('sha512', secret).update(body).digest('hex');
  assert.equal(verifyPaystackSignature(body, signature, secret), true);
  assert.equal(verifyPaystackSignature(Buffer.from('{}'), signature, secret), false);
  assert.equal(verifyPaystackSignature(body, 'bad-signature', secret), false);
});

test('generates distinct, high-entropy order references', () => {
  const first = makeReference();
  const second = makeReference();
  assert.match(first, /^BUK-\d+-[a-f0-9]{24}$/);
  assert.notEqual(first, second);
});

test('fingerprint ignores email case but not other details', () => {
  const { fingerprint } = require('../helpers/payments');
  const a = fingerprint({ domain: 'com', email: 'A@x.com', fullName: 'Ada' });
  assert.equal(a, fingerprint({ domain: 'com', email: 'a@x.com', fullName: 'Ada' }));
  assert.notEqual(a, fingerprint({ domain: 'ng', email: 'a@x.com', fullName: 'Ada' }));
});

test('backoffDelay grows, is capped, and is jittered between 50% and 100%', () => {
  const { backoffDelay } = require('../helpers/payments');
  const policy = { baseMs: 1000, maxMs: 8000 };
  assert.equal(backoffDelay(0, policy, () => 1), 1000);
  assert.equal(backoffDelay(2, policy, () => 1), 4000);
  assert.equal(backoffDelay(10, policy, () => 1), 8000);
  assert.equal(backoffDelay(2, policy, () => 0), 2000);
});
