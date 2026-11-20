const mongoose = require('mongoose');
const env = require('./env');

mongoose.set('strictQuery', true);

async function connectDB() {
  // Indexes are declared with schema.index(). Auto-build them outside production;
  // in production run `npm run db:sync-indexes` as a deploy step.
  await mongoose.connect(env.MONGODB_URI, { autoIndex: !env.isProd });
  console.log('MongoDB connected');
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };
