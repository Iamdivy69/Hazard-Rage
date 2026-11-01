// Redis-backed fixed-window throttle. Fail-closed on auth routes when Redis down.
const { ApiError } = require('../common/errors');
const { getRedis } = require('../config/redis');

function throttle({ windowSec = 60, max = 10, keyPrefix = 'rl', authRoute = false } = {}) {
  return async (req, res, next) => {
    const ip = (req.headers['x-forwarded-for'] || req.ip || 'unknown').toString().split(',')[0].trim();
    const route = req.path;
    const k = `${keyPrefix}:${route}:${ip}`;
    try {
      const r = getRedis();
      const count = await r.incr(k);
      if (count === 1) await r.expire(k, windowSec);
      const ttl = await r.ttl(k);
      res.setHeader('X-RateLimit-Limit', String(max));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - count)));
      if (count > max) {
        res.setHeader('Retry-After', String(ttl > 0 ? ttl : windowSec));
        return next(new ApiError('RATE_LIMITED', `Too many requests. Retry in ${ttl > 0 ? ttl : windowSec}s`, 429));
      }
      return next();
    } catch (e) {
      if (authRoute) return next(new ApiError('RATE_LIMITED', 'Rate limiter unavailable — try again', 429));
      console.warn(`[WARN][throttle] bypass: ${e.message}`);
      return next();
    }
  };
}
module.exports = { throttle };
