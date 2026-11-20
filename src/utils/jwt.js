const jwt = require('jsonwebtoken');
const env = require('../config/env');

const ALG = 'HS256';

function signToken(user) {
  return jwt.sign({ role: user.role }, env.JWT_SECRET, {
    subject: String(user._id),
    expiresIn: env.JWT_EXPIRES_IN,
    algorithm: ALG,
  });
}

function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: [ALG] });
}

module.exports = { signToken, verifyToken };
