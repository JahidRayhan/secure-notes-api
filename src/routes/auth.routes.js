const express = require('express');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { hashPassword, verifyPassword, DUMMY_HASH } = require('../utils/password');
const { signToken } = require('../utils/jwt');
const validate = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimit');
const v = require('../validators/auth');

const router = express.Router();

// POST /api/auth/register — role is ALWAYS 'user'. Returns { data: { token, user } } like login.
router.post(
  '/register',
  validate({ body: v.register }),
  asyncHandler(async (req, res) => {
    const { name, email, password, interests } = req.valid.body;
    const passwordHash = await hashPassword(password);
    // Duplicate email is enforced by the unique index (race-safe); errorHandler maps E11000 -> 409.
    const user = await User.create({ name, email, passwordHash, role: 'user', interests });
    res.status(201).json({ data: { token: signToken(user), user } });
  })
);

// POST /api/auth/login -> { data: { token, user } }
router.post(
  '/login',
  loginLimiter,
  validate({ body: v.login }),
  asyncHandler(async (req, res) => {
    const { email, password } = req.valid.body;
    const user = await User.findOne({ email }).select('+passwordHash'); // email unique index
    const ok = await verifyPassword(password, user ? user.passwordHash : DUMMY_HASH);
    if (!user || !ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    res.json({ data: { token: signToken(user), user } });
  })
);

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ data: req.user });
});

// PUT /api/auth/me — name, interests, or password change (needs currentPassword).
// Email and role are intentionally not self-editable.
router.put(
  '/me',
  authenticate,
  validate({ body: v.updateMe }),
  asyncHandler(async (req, res) => {
    const { name, interests, currentPassword, newPassword } = req.valid.body;
    const user = await User.findById(req.user._id).select('+passwordHash');

    if (newPassword) {
      if (!(await verifyPassword(currentPassword, user.passwordHash))) {
        throw new AppError(400, 'INVALID_CURRENT_PASSWORD', 'Current password is incorrect');
      }
      user.passwordHash = await hashPassword(newPassword);
    }
    if (name !== undefined) user.name = name;
    if (interests !== undefined) user.interests = interests;

    await user.save();
    res.json({ data: user });
  })
);

module.exports = router;
