// Boots the real Express app with NO database to check routing, validation and safe failure modes.
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.PAYSTACK_SECRET_KEY = 'sk_test_x';
process.env.ADMIN_API_TOKEN = 'a'.repeat(40);
const app = require('../app');

let server, base;
test.before(async () => { await new Promise(r => { server = app.listen(0, r); }); base = `http://127.0.0.1:${server.address().port}`; });
test.after(() => server.close());

test('/api/config serves server-side prices', async () => {
  const body = await (await fetch(`${base}/api/config`)).json();
  assert.equal(body.rate, 1380);
  assert.equal(body.pricesUsd.hosting, 200);
});

test('health check reports the database as down', async () => {
  assert.deepEqual(await (await fetch(`${base}/healthz`)).json(), { ok: true, database: false });
});

test('initialize returns 503 when the database is down (no false success)', async () => {
  const res = await fetch(`${base}/api/paystack/initialize`, { method: 'POST' });
  assert.equal(res.status, 503);
});

test('webhook rejects bad signatures only once the database is up; otherwise 503', async () => {
  const res = await fetch(`${base}/api/paystack/webhook`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-paystack-signature': 'x' }, body: '{}'
  });
  assert.equal(res.status, 503);
});

test('admin routes reject a wrong token', async () => {
  const res = await fetch(`${base}/api/admin/orders`, { headers: { 'x-admin-token': 'wrong' } });
  assert.equal(res.status, 401);
});

test('unknown API paths return JSON 404', async () => {
  const res = await fetch(`${base}/api/nope`);
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { message: 'Not found.' });
});

test('callback with a malformed reference redirects without touching anything', async () => {
  const res = await fetch(`${base}/payment/callback?reference=bad`, { redirect: 'manual' });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/?payment=unverified');
});
