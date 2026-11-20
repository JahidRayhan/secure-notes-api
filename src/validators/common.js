const { z } = require('zod');

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');
const idParam = z.object({ id: objectId });

const name = z.string().trim().min(1).max(100);
const email = z.string().trim().toLowerCase().email().max(254);
// bcrypt only uses the first 72 bytes, so cap there.
const password = z.string().min(8, 'Must be at least 8 characters').max(72);
const interests = z
  .array(z.string().trim().toLowerCase().min(1).max(40))
  .max(20)
  .transform((arr) => [...new Set(arr)]);

module.exports = { objectId, idParam, name, email, password, interests };
