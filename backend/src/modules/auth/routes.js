const { body } = require('express-validator');
const express = require('express');
const { asyncHandler, ok } = require('../../common/errors');
const { validate } = require('../../middleware/validate');
const { authenticate } = require('../../middleware/authenticate');
const { throttle } = require('../../middleware/rateLimit');
const service = require('./service');

const router = express.Router();
const loginThrottle = throttle({ windowSec: 60, max: 10, keyPrefix: 'rl', authRoute: true });

router.post('/register', loginThrottle,
  [body('name').isString().isLength({ min: 2, max: 120 }).withMessage('min 2 chars'),
   body('email').isEmail().withMessage('valid email required').normalizeEmail(),
   body('password').isLength({ min: 6 }).withMessage('min 6 chars')],
  validate,
  asyncHandler(async (req, res) => {
    const out = await service.register(req.body);
    return ok(res, out, 201);
  }));

router.post('/login', loginThrottle,
  [body('email').isEmail().withMessage('valid email required').normalizeEmail(),
   body('password').isString().isLength({ min: 1 }).withMessage('required')],
  validate,
  asyncHandler(async (req, res) => {
    const out = await service.login(req.body);
    return ok(res, out, 200);
  }));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await service.me(req.user.id);
  return ok(res, { user });
}));

module.exports = router;
