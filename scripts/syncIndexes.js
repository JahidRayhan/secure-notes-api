// Makes the DB match the schema.index() definitions exactly (drops any index not declared).
const { connectDB, disconnectDB } = require('../src/config/db');
const models = require('../src/models');

(async () => {
  await connectDB();
  for (const [name, Model] of Object.entries(models)) {
    const dropped = await Model.syncIndexes();
    const idx = await Model.collection.indexes();
    console.log(`${name}: dropped [${dropped.join(', ')}]`);
    idx.forEach((i) => console.log(`   ${i.name}`, JSON.stringify(i.key)));
  }
  await disconnectDB();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
