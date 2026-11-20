const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const app = require('./app');

async function main() {
  await connectDB();
  const server = app.listen(env.PORT, () => console.log(`API listening on :${env.PORT}`));

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
