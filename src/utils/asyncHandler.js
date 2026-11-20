// Express 4 does not catch rejected promises; wrap every async handler.
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
