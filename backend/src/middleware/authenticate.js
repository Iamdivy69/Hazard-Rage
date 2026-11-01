// authenticate: Bearer JWT -> req.user {id, role, email}. 401 on missing/invalid.
const { verifyToken } = require('../common/jwt');
const { ApiError } = require('../common/errors');

function authenticate(req, res, next) {
  const h = req.headers.authorization || '';
  const m = h.match(/^Bearer (.+)$/);
  if (!m) return next(new ApiError('UNAUTHORIZED', 'Missing bearer token', 401));
  try {
    const payload = verifyToken(m[1]);
    req.user = { id: payload.sub, role: payload.role, email: payload.email };
    return next();
  } catch {
    return next(new ApiError('UNAUTHORIZED', 'Invalid or expired token', 401));
  }
}
module.exports = { authenticate };
