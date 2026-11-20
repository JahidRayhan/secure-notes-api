const express = require('express');

const router = express.Router();

// ---- Foundation (this account) ----
router.use('/auth', require('./auth.routes'));

// ---- Notes/posts/aggregations account: each file exports an express.Router and applies
// ---- its own authenticate / requireRole. ORDER MATTERS: by-interests must be mounted
// ---- BEFORE /admin/users so '/:id' never swallows 'by-interests'.
router.use('/notes', require('./notes.routes'));
router.use('/admin/notes', require('./admin.notes.routes'));
router.use('/admin/users/by-interests', require('./admin.interests.routes')); // BEFORE /admin/users
router.use('/posts', require('./posts.routes'));
router.use('/users', require('./userPosts.routes'));

// ---- Foundation (this account) ----
router.use('/admin/users', require('./admin.users.routes'));

module.exports = router;
