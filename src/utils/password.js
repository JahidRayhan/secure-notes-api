const bcrypt = require('bcrypt');
const env = require('../config/env');

const hashPassword = (plain) => bcrypt.hash(plain, env.BCRYPT_ROUNDS);
const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

// Compared against when the email is unknown, so login timing doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', env.BCRYPT_ROUNDS);

module.exports = { hashPassword, verifyPassword, DUMMY_HASH };
