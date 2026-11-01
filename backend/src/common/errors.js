// Standard response envelope + ApiError per API_ARCHITECTURE.md

class ApiError extends Error {
  constructor(code, message, status = 500, details = []) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function ok(res, data, status = 200, extraHeaders = {}) {
  for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  return res.status(status).json({
    success: true,
    data,
    meta: { timestamp: new Date().toISOString(), request_id: res.locals.requestId || null },
  });
}

function fail(res, err) {
  const status = err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';
  return res.status(status).json({
    success: false,
    error: { code, message: err.message || 'Internal error', details: err.details || [] },
    meta: { timestamp: new Date().toISOString(), request_id: res.locals.requestId || null },
  });
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { ApiError, ok, fail, asyncHandler };
