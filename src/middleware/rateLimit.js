const rateLimit = require('express-rate-limit');
const env = require('../config/env');

// Only failed attempts count; a successful login does not consume the budget.
const loginLimiter = rateLimit({
  windowMs: env.LOGIN_RATE_WINDOW_MIN * 60 * 1000,
  limit: env.LOGIN_RATE_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) =>
    res.status(429).json({ error: { message: 'Too many login attempts, try again later', code: 'RATE_LIMITED' } }),
});

module.exports = { loginLimiter };
