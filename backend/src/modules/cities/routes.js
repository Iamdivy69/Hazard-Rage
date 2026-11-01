const express = require('express');
const { body } = require('express-validator');
const { asyncHandler, ok } = require('../../common/errors');
const { authenticate } = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const { validate } = require('../../middleware/validate');
const service = require('./service');

const router = express.Router();
router.get('/', asyncHandler(async (req, res) => {
  const { cities, cache } = await service.listCities();
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.setHeader('x-cache', cache);
  return ok(res, cities);
}));
router.post('/', authenticate, authorize('municipal_admin', 'system_admin'),
  [body('name').isString().isLength({ min: 2, max: 120 }).withMessage('name 2-120 chars'),
   body('state').optional().isString().isLength({ max: 120 }).withMessage('max 120 chars'),
   body('lat').isFloat({ min: -90, max: 90 }).withMessage('lat -90..90 required'),
   body('lng').isFloat({ min: -180, max: 180 }).withMessage('lng -180..180 required')],
  validate,
  asyncHandler(async (req, res) => {
    const city = await service.createCity({ name: req.body.name, state: req.body.state, lat: Number(req.body.lat), lng: Number(req.body.lng) });
    return ok(res, city, 201);
  }));
module.exports = router;
