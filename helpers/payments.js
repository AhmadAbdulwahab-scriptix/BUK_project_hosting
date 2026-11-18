const crypto = require('crypto');

// Hardcoded Naira values for transparent pricing
const PRICES_Naira = Object.freeze({
  hosting: 308000,    // Hosting package
  database: 77000,    // Database service
  domainCom: 92400,   // .com domain
  domainNg: 77000,    // .ng domain
  totalCom: 477400,   // Total for .com domain (200+50+60 USD * 1540)
  totalNg: 462000     // Total for .ng domain (200+50+50 USD * 1540)
});

const REFERENCE_PATTERN = /^BUK-\d+-[a-f0-9]{24}$/;

function calculatePrice(domain) {
  if (!['com', 'ng'].includes(domain)) throw new Error('Unsupported domain selection.');
  if (domain === 'com') {
    return {
      totalUsd: 310,        // 200+50+60
      amountNaira: PRICES_Naira.totalCom,
      amountKobo: PRICES_Naira.totalCom * 100
    };
  }
  return {
    totalUsd: 300,        // 200+50+50
    amountNaira: PRICES_Naira.totalNg,
    amountKobo: PRICES_Naira.totalNg * 100
  };
}

function verifyPaystackSignature(rawBody, signature, secret) {
  if (!Buffer.isBuffer(rawBody) || typeof signature !== 'string' || !secret) return false;
  if (!/^[a-f0-9]{128}$/i.test(signature)) return false;
  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest();
  const received = Buffer.from(signature, 'hex');
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

function makeReference() {
  return `BUK-${Date.now()}-${crypto.randomBytes(12).toString('hex')}`;
}

// Binds an idempotency key to the exact form details it was first used with.
function fingerprint({ domain, email, fullName }) {
  return crypto.createHash('sha256').update(`${domain}|${email.toLowerCase()}|${fullName}`).digest('hex');
}

function hashBody(rawBody) {
  return crypto.createHash('sha256').update(rawBody).digest('hex');
}

// Exponential backoff with jitter: base * 2^attempt, capped, then scaled to 50-100%
// so many orders do not all become due at the same instant.
function backoffDelay(attempt, { baseMs, maxMs }, rng = Math.random) {
  const exp = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt));
  return Math.round(exp * (0.5 + rng() * 0.5));
}

module.exports = {
  PRICES_Naira, REFERENCE_PATTERN,
  calculatePrice, verifyPaystackSignature, makeReference, fingerprint, hashBody, backoffDelay
};