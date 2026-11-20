const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user', required: true },
    interests: { type: [String], default: [] },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform(doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Supports: login lookup findOne({ email }), register duplicate check (uniqueness),
// and any admin lookup by email. Unique index replaces a separate "email" index.
userSchema.index({ email: 1 }, { unique: true });

// Supports: admin user list GET /api/admin/users sorted newest-first with skip/limit pagination.
userSchema.index({ createdAt: -1 });

// Supports: GET /api/admin/users/by-interests?interest=<x>. The pipeline's first stage is
// { $match: { interests: x } }; this multikey index answers it with an IXSCAN, so only users who have
// that interest reach $unwind/$group. (The unfiltered view covers every user and does not use it.)
userSchema.index({ interests: 1 });

// GET /me, GET /api/admin/users/:id, auth middleware lookup: served by the built-in _id index.

module.exports = mongoose.model('User', userSchema);
