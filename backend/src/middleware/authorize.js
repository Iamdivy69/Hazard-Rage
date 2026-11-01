// authorize(...roles): 401 if unauthenticated, 403 if role mismatch.
const { ApiError } = require('../common/errors');
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new ApiError('UNAUTHORIZED', 'Authentication required', 401));
    if (roles.length && !roles.includes(req.user.role)) {
      return next(new ApiError('FORBIDDEN', 'Insufficient role', 403));
    }
    return next();
  };
}
module.exports = { authorize };
