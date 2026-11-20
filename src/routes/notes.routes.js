// Mounted at /api/notes
const express = require('express');
const Note = require('../models/Note');
const { authenticate } = require('../middleware/auth');          
const { getPagination, buildPagination } = require('../utils/pagination');
const AppError = require('../utils/AppError');
const { asyncHandler, parseObjectId, requireString } = require('../utils/routeHelpers');

const router = express.Router();
router.use(authenticate);

// GET /api/notes -- list my notes (paginated)
// INDEX: { owner: 1, createdAt: -1 } serves both the find (filter+sort) and the countDocuments.
router.get('/', asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { owner: req.user.id };
  const [data, total] = await Promise.all([
    Note.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Note.countDocuments(filter),
  ]);
  res.json({ data, pagination: buildPagination({ page, limit }, total) });
}));

// POST /api/notes
// INDEX: none (insert).
router.post('/', asyncHandler(async (req, res) => {
  const title = requireString(req.body.title, 'title', 200);
  const content = requireString(req.body.content, 'content', 20000);
  const note = await Note.create({ title, content, owner: req.user.id });
  res.status(201).json({ data: note });
}));

// GET /api/notes/:id -- own note; admin may read any
// INDEX: built-in _id index (single-document lookup).
router.get('/:id', asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.id);
  const filter = req.user.role === 'admin' ? { _id: id } : { _id: id, owner: req.user.id };
  const note = await Note.findOne(filter).lean();
  // 404 (not 403) for other people's notes so note ids can't be probed.
  if (!note) throw new AppError(404, 'NOT_FOUND', 'Note not found');
  res.json({ data: note });
}));

// PUT /api/notes/:id -- own only (admins cannot edit others' notes; spec grants them view only)
// INDEX: built-in _id index; owner is a residual filter on that one document.
router.put('/:id', asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.id);
  const update = {};
  if (req.body.title !== undefined) update.title = requireString(req.body.title, 'title', 200);
  if (req.body.content !== undefined) update.content = requireString(req.body.content, 'content', 20000);
  if (!Object.keys(update).length) throw new AppError(400, 'VALIDATION_ERROR', 'Provide title and/or content');

  const note = await Note.findOneAndUpdate(
    { _id: id, owner: req.user.id },
    { $set: update },
    { new: true, runValidators: true }
  ).lean();
  if (!note) throw new AppError(404, 'NOT_FOUND', 'Note not found');
  res.json({ data: note });
}));

// DELETE /api/notes/:id -- own only
// INDEX: built-in _id index.
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = parseObjectId(req.params.id);
  const note = await Note.findOneAndDelete({ _id: id, owner: req.user.id }).lean();
  if (!note) throw new AppError(404, 'NOT_FOUND', 'Note not found');
  res.json({ data: { id: note._id } });
}));

module.exports = router;
