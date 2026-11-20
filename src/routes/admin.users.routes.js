const express = require('express');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { hashPassword } = require('../utils/password');
const { getPagination, listResponse } = require('../utils/pagination');
const { deleteUserCascade } = require('../services/userService');
const validate = require('../middleware/validate');
const { authenticate, requireRole } = require('../middleware/auth');
const { idParam } = require('../validators/common');
const v = require('../validators/user');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

// GET /api/admin/users?page&limit — newest first (createdAt index)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const pg = getPagination(req.query);
    const [users, total] = await Promise.all([
      User.find().sort({ createdAt: -1 }).skip(pg.skip).limit(pg.limit),
      User.estimatedDocumentCount(),
    ]);
    res.json(listResponse(users, pg, total));
  })
);

// POST /api/admin/users
router.post(
  '/',
  validate({ body: v.create }),
  asyncHandler(async (req, res) => {
    const { password, ...rest } = req.valid.body;
    const user = await User.create({ ...rest, passwordHash: await hashPassword(password) });
    res.status(201).json({ data: user });
  })
);

// GET /api/admin/users/:id (_id index)
router.get(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.valid.params.id);
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    res.json({ data: user });
  })
);

// PUT /api/admin/users/:id
router.put(
  '/:id',
  validate({ params: idParam, body: v.update }),
  asyncHandler(async (req, res) => {
    const { id } = req.valid.params;
    const { password, ...updates } = req.valid.body;

    // Prevent an admin from demoting themselves (avoids ending up with zero admins).
    if (updates.role && id === String(req.user._id) && updates.role !== req.user.role) {
      throw new AppError(403, 'CANNOT_CHANGE_OWN_ROLE', 'You cannot change your own role');
    }
    if (password) updates.passwordHash = await hashPassword(password);

    const user = await User.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true });
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    res.json({ data: user });
  })
);

// DELETE /api/admin/users/:id — cascades to the user's notes and posts
router.delete(
  '/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const { id } = req.valid.params;
    if (id === String(req.user._id)) {
      throw new AppError(400, 'CANNOT_DELETE_SELF', 'You cannot delete your own account');
    }
    const exists = await User.exists({ _id: id });
    if (!exists) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');

    const counts = await deleteUserCascade(id);
    res.json({ data: { id, deleted: true, ...counts } });
  })
);

module.exports = router;
