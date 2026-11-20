const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');

/**
 * Verifies the Bearer token and loads the user from the DB (so deleted users and role
 * changes take effect immediately). Sets req.user (a User document: req.user._id, req.user.role).
 */
const authenticate = asyncHandler(async (req, res, next) => {
  const match = /^Bearer (.+)$/i.exec(req.headers.authorization || '');
  if (!match) throw new AppError(401, 'UNAUTHENTICATED', 'Missing or malformed Authorization header');

  let payload;
  try {
    payload = verifyToken(match[1]);
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw new AppError(401, 'TOKEN_EXPIRED', 'Token has expired');
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid token');
  }

  const user = await User.findById(payload.sub); // _id index
  if (!user) throw new AppError(401, 'UNAUTHENTICATED', 'User no longer exists');

  req.user = user;
  next();
});

/** Use after authenticate: requireRole('admin') */
const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) return next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required'));
    if (!roles.includes(req.user.role)) {
      return next(new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action'));
    }
    next();
  };

module.exports = { authenticate, requireRole };
