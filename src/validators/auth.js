const { z } = require('zod');
const { name, email, password, interests } = require('./common');

// Unknown keys (e.g. "role") are stripped by zod, so role can never be set at registration.
const register = z.object({ name, email, password, interests: interests.optional() });

const login = z.object({ email, password: z.string().min(1).max(72) });

const updateMe = z
  .object({
    name: name.optional(),
    interests: interests.optional(),
    currentPassword: z.string().min(1).max(72).optional(),
    newPassword: password.optional(),
  })
  .refine((v) => !v.newPassword || v.currentPassword, {
    path: ['currentPassword'],
    message: 'currentPassword is required to set newPassword',
  })
  .refine((v) => v.name !== undefined || v.interests !== undefined || v.newPassword !== undefined, {
    message: 'Provide at least one field to update',
  });

module.exports = { register, login, updateMe };
