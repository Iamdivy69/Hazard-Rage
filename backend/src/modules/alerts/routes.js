const express = require('express');
const { asyncHandler, ok } = require('../../common/errors');
const { authenticate } = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const service = require('./service');

const router = express.Router();
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const alerts = await service.listAlerts(req.query.status);
  return ok(res, alerts);
}));
router.patch('/:id/ack', authenticate, authorize('municipal_admin', 'system_admin'), asyncHandler(async (req, res) => {
  const a = await service.ackAlert(parseInt(req.params.id, 10));
  return ok(res, a);
}));
module.exports = router;
