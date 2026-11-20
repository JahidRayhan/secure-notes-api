const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true, maxlength: 20000 },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true } // createdAt + updatedAt
);

// Serves: GET /api/notes (find({owner}).sort({createdAt:-1}) + countDocuments({owner})).
// The equality prefix (owner) + sort key (createdAt) means no in-memory sort.
noteSchema.index({ owner: 1, createdAt: -1 });

// Serves: GET /api/admin/notes (find({}).sort({createdAt:-1}), all users' notes, newest first).
noteSchema.index({ createdAt: -1 });

// No index needed for GET/PUT/DELETE /api/notes/:id: all lookups are by _id (built-in index).
// Owner check is applied as an extra filter on the single doc found via _id.

module.exports = mongoose.model('Note', noteSchema);
