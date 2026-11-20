// Mounted at /api/posts
const express = require('express');
const Post = require('../models/Post');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, requireString } = require('../utils/routeHelpers');

const router = express.Router();

// POST /api/posts -- any authenticated user; author always comes from the token
// INDEX: none (insert).
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const title = requireString(req.body.title, 'title', 200);
  const body = requireString(req.body.body, 'body', 20000);
  const post = await Post.create({ title, body, author: req.user.id });
  res.status(201).json({ data: post });
}));

module.exports = router;
