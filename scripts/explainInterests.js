// Proves the interests index is used.
// Usage: node scripts/explainInterests.js [interest] [--full]
// Exits 1 if the filtered pipeline does not use an IXSCAN on interests_1.
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const { buildPipeline } = require('../src/routes/admin.interests.routes');

const interest = (process.argv.slice(2).find((a) => !a.startsWith('--')) || 'chess').trim().toLowerCase();
const full = process.argv.includes('--full');

// Walk the explain output and collect every value stored under `key`.
function collect(node, key, out = []) {
  if (Array.isArray(node)) node.forEach((n) => collect(n, key, out));
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === key) out.push(v);
      collect(v, key, out);
    }
  }
  return out;
}

async function run(label, opts) {
  const explain = await User.aggregate(buildPipeline({ ...opts, skip: 0, limit: 12 })).explain('executionStats');
  const stages = collect(explain, 'stage').filter((s) => typeof s === 'string');
  const indexes = [...new Set(collect(explain, 'indexName'))];
  console.log(`\n=== ${label} ===`);
  console.log('plan stages  :', [...new Set(stages)].join(', '));
  console.log('indexes used :', indexes.join(', ') || '(none)');
  console.log('keysExamined :', Math.max(0, ...collect(explain, 'totalKeysExamined')));
  console.log('docsExamined :', Math.max(0, ...collect(explain, 'totalDocsExamined')));
  if (full) console.log(JSON.stringify(explain, null, 2));
  return { stages, indexes };
}

(async () => {
  await connectDB();
  const filtered = await run(`FILTERED  ?interest=${interest}`, { interest });
  await run('UNFILTERED (expected COLLSCAN: it must read every user)', {});
  await disconnectDB();
  const ok = filtered.stages.includes('IXSCAN') && filtered.indexes.includes('interests_1');
  console.log(ok ? '\nPASS: IXSCAN on interests_1' : '\nFAIL: filtered query does not use interests_1');
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
