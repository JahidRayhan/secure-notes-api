const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 20000 },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Serves: the $lookup in GET /api/users/:id/posts.
//  - $match { $expr: { $eq: ['$author', '$$uid'] } } -> equality on `author` (prefix)
//  - $sort { createdAt: -1 }                          -> satisfied by the 2nd key
//  - $skip/$limit                                     -> walk the index, no in-memory sort
//  - the count sub-lookup ($match + $count) is answered from the same index.
postSchema.index({ author: 1, createdAt: -1 });

module.exports = mongoose.model('Post', postSchema);
