// Pagination helper per API spec.
function parsePagination(q) {
  let page = parseInt(q.page || '1', 10);
  let limit = parseInt(q.limit || '20', 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(limit) || limit < 1) limit = 20;
  if (limit > 100) limit = 100;
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
function pageMeta(page, limit, total) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { page, limit, total_items: total, total_pages: totalPages, has_next: page < totalPages, has_previous: page > 1 };
}
module.exports = { parsePagination, pageMeta };
