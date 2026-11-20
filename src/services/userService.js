const User = require('../models/User');
const Note = require('../models/Note');
const Post = require('../models/Post');

/**
 * Deletes a user and everything they own. The user document goes LAST so that if a step
 * fails midway the request can simply be retried (no orphans, no transaction/replica set needed).
 * Note.deleteMany({owner}) and Post.deleteMany({author}) are served by the compound-index prefixes.
 */
async function deleteUserCascade(userId) {
  const [notes, posts] = await Promise.all([
    Note.deleteMany({ owner: userId }),
    Post.deleteMany({ author: userId }),
  ]);
  await User.deleteOne({ _id: userId });
  return { notesDeleted: notes.deletedCount, postsDeleted: posts.deletedCount };
}

module.exports = { deleteUserCascade };
