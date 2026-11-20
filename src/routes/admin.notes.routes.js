// Mounted at /api/admin/notes
const express = require('express');
const Note = require('../models/Note');
const { authenticate, requireRole } = require('../middleware/auth');
const { getPagination, buildPagination } = require('../utils/pagination');
const { asyncHandler } = require('../utils/routeHelpers');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

// GET /api/admin/notes -- everyone's notes, newest first, owner name/email populated
// INDEX: { createdAt: -1 } serves the sort/skip/limit.
//        estimatedDocumentCount() reads collection metadata, no index needed.
//        populate() does a User.find({_id: {$in: [...]}}) -> built-in _id index.
router.get('/', asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const [data, total] = await Promise.all([
    Note.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit)
      .populate('owner', 'name email').lean(),
    Note.estimatedDocumentCount(),
  ]);
  res.json({ data, pagination: buildPagination({ page, limit }, total) });
}));

module.exports = router;
