const express = require('express');
const { body, query } = require('express-validator');
const { asyncHandler, ok } = require('../../common/errors');
const { authenticate } = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const { validate } = require('../../middleware/validate');
const service = require('./service');

const router = express.Router();
router.get('/', asyncHandler(async (req, res) => {
  const cityId = req.query.city_id ? parseInt(req.query.city_id, 10) : null;
  const { zones, cache } = await service.listZones(cityId);
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.setHeader('x-cache', cache);
  return ok(res, zones);
}));
router.post('/', authenticate, authorize('municipal_admin', 'system_admin'),
  [body('city_id').isInt({ min: 1 }).withMessage('city_id int required'),
   body('name').isString().isLength({ min: 2, max: 120 }).withMessage('name 2-120 chars'),
   body('lat').isFloat({ min: -90, max: 90 }).withMessage('lat -90..90 required'),
   body('lng').isFloat({ min: -180, max: 180 }).withMessage('lng -180..180 required'),
   body('zone_type').optional().isString().isLength({ max: 80 }).withMessage('max 80 chars')],
  validate,
  asyncHandler(async (req, res) => {
    const zone = await service.createZone({
      cityId: parseInt(req.body.city_id, 10),
      name: req.body.name,
      lat: Number(req.body.lat),
      lng: Number(req.body.lng),
      zoneType: req.body.zone_type,
    });
    return ok(res, zone, 201);
  }));
router.get('/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const out = await service.zoneDetail(id);
  res.setHeader('x-cache', out.cache);
  const { cache, ...body } = out;
  return ok(res, body);
}));
router.patch('/:id/threshold', authenticate, authorize('municipal_admin', 'system_admin'), asyncHandler(async (req, res) => {
  const out = await service.updateThreshold(parseInt(req.params.id, 10), Number(req.body.threshold));
  return ok(res, out);
}));
module.exports = router;
