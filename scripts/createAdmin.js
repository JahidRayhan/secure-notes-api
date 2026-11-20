// Registration always creates role 'user', so bootstrap the first admin here.
// Usage: ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run seed:admin
const env = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const { hashPassword } = require('../src/utils/password');

(async () => {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const name = process.env.ADMIN_NAME || 'Admin';
  if (!email || password.length < 8) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (min 8 chars)');
    process.exit(1);
  }
  await connectDB();
  const passwordHash = await hashPassword(password);
  const user = await User.findOneAndUpdate(
    { email },
    { $set: { role: 'admin', passwordHash }, $setOnInsert: { name, email, interests: [] } },
    { upsert: true, new: true, runValidators: true }
  );
  console.log(`Admin ready: ${user.email} (${user._id})`);
  await disconnectDB();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
