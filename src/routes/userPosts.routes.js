// Mounted at /api/users  ->  GET /api/users/:id/posts  (public)
const express = require('express');
const User = require('../models/User');
const Post = require('../models/Post');
const { getPagination, buildPagination } = require('../utils/pagination');
const AppError = require('../utils/AppError');
const { asyncHandler, parseObjectId } = require('../utils/routeHelpers');

const router = express.Router();

// Scenario 2: ONE User.aggregate() with $lookup into posts.
//
// INDEXES:
//  - $match { _id }                     -> built-in User _id index (also gives us the 404 check).
//  - 1st $lookup pipeline:
//      $match $expr $eq author          -> Post { author: 1, createdAt: -1 } (equality prefix)
//      $sort createdAt:-1               -> same index, 2nd key (no in-memory sort)
//      $skip/$limit                     -> stop early after one page
//  - 2nd $lookup pipeline ($match + $count) -> same Post index (index-only count).
// The count is a second $lookup (rather than $facet) so that $limit is pushed down and we
// never buffer all of an author's posts.
router.get('/:id/posts', asyncHandler(async (req, res) => {
  const userId = parseObjectId(req.params.id);
  const { page, limit, skip } = getPagination(req.query);
  const postsColl = Post.collection.name;
  const byAuthor = { $match: { $expr: { $eq: ['$author', '$$uid'] } } };

  const [result] = await User.aggregate([
    { $match: { _id: userId } },
    {
      $lookup: {
        from: postsColl,
        let: { uid: '$_id' },
        pipeline: [
          byAuthor,
          { $sort: { createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          { $project: { title: 1, body: 1, author: 1, createdAt: 1 } },
        ],
        as: 'posts',
      },
    },
    {
      $lookup: {
        from: postsColl,
        let: { uid: '$_id' },
        pipeline: [byAuthor, { $count: 'n' }],
        as: 'totalArr',
      },
    },
    {
      $project: {
        _id: 0,
        posts: 1,
        total: { $ifNull: [{ $arrayElemAt: ['$totalArr.n', 0] }, 0] },
      },
    },
  ]);

  if (!result) throw new AppError(404, 'NOT_FOUND', 'User not found');
  res.json({ data: result.posts, pagination: buildPagination({ page, limit }, result.total) });
}));

module.exports = router;
