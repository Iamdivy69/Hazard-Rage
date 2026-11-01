const express = require('express');
const { asyncHandler, ok, ApiError } = require('../../common/errors');
const service = require('./service');

const router = express.Router();
router.get('/suggest', asyncHandler(async (req, res) => {
  const { waste_type, level } = req.query;
  if (!['organic', 'plastic', 'construction', 'biomedical', 'mixed'].includes(waste_type)) {
    throw new ApiError('VALIDATION_ERROR', 'waste_type invalid', 400);
  }
  if (!['Low', 'Medium', 'High'].includes(level)) throw new ApiError('VALIDATION_ERROR', 'level invalid', 400);
  const out = await service.suggest(waste_type, level);
  return ok(res, out);
}));
module.exports = router;
