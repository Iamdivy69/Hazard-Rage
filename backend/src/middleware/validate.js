// validate: express-validator wrapper returning 400 VALIDATION_ERROR with all errors.
const { validationResult } = require('express-validator');
const { ApiError } = require('../common/errors');
function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  const details = errors.array().map((e) => ({ field: e.path || e.param, rule: e.msg, message: `${e.path || e.param}: ${e.msg}` }));
  return next(new ApiError('VALIDATION_ERROR', 'Validation failed', 400, details));
}
module.exports = { validate };
