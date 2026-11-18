const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyVerification, applyVerification } = require('../helpers/orderTransitions');

const baseOrder = (overrides = {}) => ({
  reference: 'BUK-1-aaaaaaaaaaaaaaaaaaaaaaaa', currency: 'NGN', amountKobo: 42780000,
  status: 'pending', email: 'a@x.com', activeCheckoutEmail: 'a@x.com', ...overrides
});
const verifiedFor = (order, overrides = {}) => ({
  status: 'success', reference: order.reference, currency: order.currency, amount: order.amountKobo,
  id: 99, channel: 'card', paid_at: '2026-11-03T10:00:00Z', ...overrides
});

test('matching success marks the order paid and releases the email lock', () => {
  const order = baseOrder();
  assert.equal(applyVerification(order, verifiedFor(order)), 'paid');
  assert.equal(order.status, 'paid');
  assert.equal(order.paystackTransactionId, 99);
  assert.equal(order.activeCheckoutEmail, undefined);
});

test('wrong amount, currency or reference goes to review, never paid', () => {
  for (const change of [{ amount: 1 }, { currency: 'USD' }, { reference: 'other' }]) {
    const order = baseOrder();
    assert.equal(applyVerification(order, verifiedFor(order, change)), 'review-required');
    assert.equal(order.status, 'review_required');
  }
});

test('a stale failed result never downgrades a paid or refunded order', () => {
  for (const status of ['paid', 'refunded']) {
    const order = baseOrder({ status });
    applyVerification(order, verifiedFor(order, { status: 'failed' }));
    assert.equal(order.status, status);
  }
});

test('failed and abandoned are recorded and release the email lock', () => {
  for (const s of ['failed', 'abandoned']) {
    const order = baseOrder();
    assert.equal(applyVerification(order, verifiedFor(order, { status: s })), s);
    assert.equal(order.status, s);
    assert.equal(order.activeCheckoutEmail, undefined);
  }
});

test('pending result moves live orders to verification_pending but leaves closed ones alone', () => {
  const live = baseOrder();
  applyVerification(live, verifiedFor(live, { status: 'ongoing' }));
  assert.equal(live.status, 'verification_pending');

  const expired = baseOrder({ status: 'expired', activeCheckoutEmail: undefined });
  applyVerification(expired, verifiedFor(expired, { status: 'ongoing' }));
  assert.equal(expired.status, 'expired');
  assert.equal(expired.activeCheckoutEmail, undefined);
});

test('a late success still pays an expired order', () => {
  const order = baseOrder({ status: 'expired' });
  assert.equal(applyVerification(order, verifiedFor(order)), 'paid');
});

test('reversed transactions need review', () => {
  const order = baseOrder();
  assert.equal(classifyVerification(verifiedFor(order, { status: 'reversed' }), order), 'reversed');
});
