const { createRateCounter } = require('../utils/rateCounter');

function rateLimit({ windowMs, max }) {
  const counter = createRateCounter({ windowMs, max });
  setInterval(() => counter.cleanup(), windowMs).unref();
  return (req, res, next) => {
    const { allowed, retryAfterMs } = counter.hit(req.ip);
    if (allowed) return next();
    res.set('Retry-After', String(Math.ceil(retryAfterMs / 1000)));
    return res.status(429).json({ message: 'Too many requests. Please wait a moment and try again.' });
  };
}
module.exports = rateLimit;
