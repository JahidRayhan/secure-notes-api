const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const MAX_PAGE = 1_000_000;

/** Parse ?page=&limit= from req.query. Bad values fall back to defaults; limit is capped at 50. */
function getPagination(query = {}) {
  const rawPage = parseInt(query.page, 10);
  const rawLimit = parseInt(query.limit, 10);
  const page = Math.min(Math.max(Number.isNaN(rawPage) ? 1 : rawPage, 1), MAX_PAGE);
  const limit = Math.min(Math.max(Number.isNaN(rawLimit) ? DEFAULT_LIMIT : rawLimit, 1), MAX_LIMIT);
  return { page, limit, skip: (page - 1) * limit };
}

/** Build the `pagination` object of the list contract. */
function buildPagination({ page, limit }, total) {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

/** Full list response body: { data: [...], pagination } */
function listResponse(data, pg, total) {
  return { data, pagination: buildPagination(pg, total) };
}

module.exports = { getPagination, buildPagination, listResponse, DEFAULT_LIMIT, MAX_LIMIT };
