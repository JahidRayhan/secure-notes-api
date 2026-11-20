// Index audit for the live database. Run with mongosh (NOT node):
//   mongosh "<ATLAS_URI incl. /secure_notes>" --file scripts/audit-indexes.js
// Prints every index and fails loudly if anything differs from the expected 6 custom indexes.
const expected = {
  users: ['_id_', 'email_1', 'createdAt_-1', 'interests_1'],
  notes: ['_id_', 'owner_1_createdAt_-1', 'createdAt_-1'],
  posts: ['_id_', 'author_1_createdAt_-1'],
};

let bad = 0;
const collections = db.getCollectionNames().sort();
print('collections:', collections.join(', '));
if (JSON.stringify(collections) !== JSON.stringify(Object.keys(expected).sort())) {
  print('  !! unexpected collection set'); bad++;
}

let custom = 0;
for (const [coll, names] of Object.entries(expected)) {
  const actual = db[coll].getIndexes();
  print(`\n${coll}`);
  actual.forEach((i) => print(`  ${i.name.padEnd(24)} ${JSON.stringify(i.key)}${i.unique ? '  unique' : ''}`));
  const got = actual.map((i) => i.name).sort();
  if (JSON.stringify(got) !== JSON.stringify([...names].sort())) {
    print(`  !! expected [${names.join(', ')}]`); bad++;
  }
  custom += actual.filter((i) => i.name !== '_id_').length;
}
print(`\ncustom indexes: ${custom} (expected 6; _id_ x3 is built in)`);
if (custom !== 6) bad++;
print(bad ? `\nFAIL (${bad} problem(s))` : '\nPASS: exactly the 6 declared indexes, nothing else');
