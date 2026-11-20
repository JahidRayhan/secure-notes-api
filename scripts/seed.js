// Usage: node src/scripts/seed.js   (needs MONGO_URI; refuses to run in production)
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('../src/models/User');
const Note = require('../src/models/Note');
const Post = require('../src/models/Post');

const INTERESTS = ['chess', 'reading', 'hiking', 'cooking', 'gaming', 'music', 'travel', 'photography'];
const DAY = 24 * 60 * 60 * 1000;
const pick = (i, n) => Array.from({ length: n }, (_, k) => INTERESTS[(i + k * 3) % INTERESTS.length]);

(async () => {
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed in production');
  await mongoose.connect(process.env.MONGODB_URI);
  await Promise.all([User.deleteMany({}), Note.deleteMany({}), Post.deleteMany({})]);
  await Promise.all([User.init(), Note.init(), Post.init()]); // make sure schema.index indexes exist

  const adminHash = await bcrypt.hash('Admin123!', 10);
  const userHash = await bcrypt.hash('Password123!', 10);

  const admin = await User.create({
    name: 'Admin', email: 'admin@example.com', passwordHash: adminHash, role: 'admin', interests: ['chess', 'reading'],
  });

  const users = await User.insertMany(
    Array.from({ length: 10 }, (_, i) => ({
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      passwordHash: userHash,
      role: 'user',
      interests: pick(i, 2 + (i % 3)),
    }))
  );

  const now = Date.now();
  const notes = [];
  const posts = [];
  [admin, ...users].forEach((u, i) => {
    for (let n = 0; n < 3 + (i % 4); n++) {
      const t = new Date(now - (i * 10 + n) * DAY);
      notes.push({ title: `Note ${n + 1} by ${u.name}`, content: `Private content #${n + 1} for ${u.email}`, owner: u._id, createdAt: t, updatedAt: t });
    }
    for (let p = 0; p < 2 + (i % 3); p++) {
      posts.push({ title: `Post ${p + 1} by ${u.name}`, body: `Public post #${p + 1} written by ${u.name}`, author: u._id, createdAt: new Date(now - (i * 7 + p) * DAY) });
    }
  });
  await Note.insertMany(notes);
  await Post.insertMany(posts);

  console.log(`Seeded 1 admin, ${users.length} users, ${notes.length} notes, ${posts.length} posts`);
  console.log('Admin: admin@example.com / Admin123!   Users: userN@example.com / Password123!');
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
