// Public aggregate stats for the landing page. Read-only, no PII.
const express = require('express');
const { asyncHandler, ok } = require('../../common/errors');
const { getPrisma } = require('../../config/prisma');
const { cacheGet, cacheSet, key } = require('../../common/cache');
const config = require('../../config');

const router = express.Router();
const STATS_KEY = key('stats', 'public');

router.get('/', asyncHandler(async (req, res) => {
  const { hit, value } = await cacheGet(STATS_KEY);
  if (hit) {
    res.setHeader('x-cache', 'HIT');
    res.setHeader('Cache-Control', 'public, max-age=60');
    return ok(res, value);
  }
  const prisma = getPrisma();
  const [zones, reports, activeAlerts, agg] = await Promise.all([
    prisma.zone.count(),
    prisma.wasteReport.count(),
    prisma.alert.count({ where: { status: 'Active' } }),
    prisma.zone.aggregate({ _avg: { currentScore: true } }),
  ]);
  const highZones = await prisma.zone.count({ where: { currentLevel: 'High' } });
  const body = {
    zones,
    reports,
    activeAlerts,
    highZones,
    avgScore: Math.round((agg._avg.currentScore || 0) * 10) / 10,
  };
  await cacheSet(STATS_KEY, body, config.cacheTtlSec);
  res.setHeader('x-cache', 'MISS');
  res.setHeader('Cache-Control', 'public, max-age=60');
  return ok(res, body);
}));

module.exports = router;
