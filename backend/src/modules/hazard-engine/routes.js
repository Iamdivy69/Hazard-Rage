const express = require('express');
const { asyncHandler, ok } = require('../../common/errors');
const { authenticate } = require('../../middleware/authenticate');
const { getPrisma } = require('../../config/prisma');
const { cacheGet, cacheSet, key } = require('../../common/cache');
const config = require('../../config');
const { causeForZone } = require('../remediation/service');

const router = express.Router();

router.get('/scores', authenticate, asyncHandler(async (req, res) => {
  const zoneId = req.query.zone_id ? parseInt(req.query.zone_id, 10) : null;
  const where = zoneId ? { zoneId } : {};
  const scores = await getPrisma().hazardScore.findMany({ where, orderBy: { computedAt: 'desc' }, take: 100 });
  return ok(res, scores);
}));

router.get('/trends', authenticate, asyncHandler(async (req, res) => {
  const days = Math.min(90, Math.max(1, parseInt(req.query.days || '30', 10)));
  const cityId = req.query.city_id ? parseInt(req.query.city_id, 10) : null;
  const ck = key('trend', `city${cityId || 'all'}`, String(days));
  const { hit, value } = await cacheGet(ck);
  if (hit) { res.setHeader('x-cache', 'HIT'); return ok(res, value); }
  const prisma = getPrisma();
  const zones = await prisma.zone.findMany({ where: cityId ? { cityId } : {}, orderBy: { name: 'asc' } });
  const since = new Date(Date.now() - days * 864e5);
  const out = [];
  for (const z of zones) {
    const points = await prisma.hazardScore.findMany({ where: { zoneId: z.id, computedAt: { gte: since } }, orderBy: { computedAt: 'asc' }, take: 90 });
    out.push({ zone_id: z.id, name: z.name, current_score: z.currentScore, current_level: z.currentLevel, points: points.map((p) => ({ score: p.score, at: p.computedAt })) });
  }
  const body = { days, zones: out };
  await cacheSet(ck, body, config.cacheTtlSec);
  res.setHeader('x-cache', 'MISS');
  res.setHeader('Cache-Control', 'public, max-age=60');
  return ok(res, body);
}));

router.get('/cause', authenticate, asyncHandler(async (req, res) => {
  const zoneId = parseInt(req.query.zone_id, 10);
  const cause = await causeForZone(zoneId);
  return ok(res, cause);
}));

module.exports = router;
