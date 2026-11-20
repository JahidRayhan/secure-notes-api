/**
 * validate({ params, query, body }) with zod schemas.
 * Parsed values land in req.valid.{params,query,body}; req.body is also replaced with the parsed body.
 */
module.exports = (schemas) => (req, res, next) => {
  try {
    req.valid = {};
    for (const key of ['params', 'query', 'body']) {
      if (schemas[key]) req.valid[key] = schemas[key].parse(req[key]);
    }
    if (req.valid.body) req.body = req.valid.body;
    next();
  } catch (err) {
    next(err);
  }
};
