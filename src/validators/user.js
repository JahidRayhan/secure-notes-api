const { z } = require('zod');
const { name, email, password, interests } = require('./common');

const role = z.enum(['user', 'admin']);

const create = z.object({
  name,
  email,
  password,
  role: role.default('user'),
  interests: interests.default([]),
});

const update = z
  .object({
    name: name.optional(),
    email: email.optional(),
    password: password.optional(),
    role: role.optional(),
    interests: interests.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update' });

module.exports = { create, update };
