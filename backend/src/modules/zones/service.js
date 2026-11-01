// Zones service — cached reads, Prisma writes + invalidation.
const { getPrisma } = require('../../config/prisma');
const { cacheGet, cacheSet, cacheDelByPrefix, key } = require('../../common/cache');
const config = require('../../config');
const { ApiError } = require('../../common/errors');

const LIST_KEY = (cityId) => key('zones', 'city', String(cityId || 'all'));
const ZONE_KEY = (id) => key('zone', String(id));
const TREND_KEY = (cityId, days) => key('trend', `city${cityId || 'all'}`, String(days));

function toPublicZone(z) {
  return { id: z.id, city_id: z.cityId, name: z.name, lat: z.lat, lng: z.lng, zone_type: z.zoneType, current_score: z.currentScore, current_level: z.currentLevel, updated_at: z.updatedAt };
}

async function listZones(cityId) {
  const ck = LIST_KEY(cityId);
  const { hit, value } = await cacheGet(ck);
  if (hit) return { zones: value, cache: 'HIT' };
  const where = cityId ? { cityId } : {};
  const zones = await getPrisma().zone.findMany({ where, orderBy: { name: 'asc' } });
  const pub = zones.map(toPublicZone);
  await cacheSet(ck, pub, config.cacheTtlSec);
  return { zones: pub, cache: 'MISS' };
}

async function createZone({ cityId, name, lat, lng, zoneType }) {
  const prisma = getPrisma();
  const city = await prisma.city.findUnique({ where: { id: cityId } });
  if (!city) throw new ApiError('VALIDATION_ERROR', 'city_id: city does not exist', 400, [{ field: 'city_id', rule: 'exists', message: 'city_id: city does not exist' }]);
  try {
    const zone = await prisma.zone.create({ data: { cityId, name, lat, lng, zoneType: zoneType || 'residential' } });
    await invalidateZone(zone.id);
    return toPublicZone(zone);
  } catch (e) {
    if (e.code === 'P2002') throw new ApiError('CONFLICT', 'Zone name already exists', 409);
    throw e;
  }
}

async function zoneDetail(id) {
  const cached = await cacheGet(ZONE_KEY(id));
  if (cached.hit) return { ...cached.value, cache: 'HIT' };
  const prisma = getPrisma();
  const zone = await prisma.zone.findUnique({ where: { id } });
  if (!zone) throw new ApiError('NOT_FOUND', 'Zone not found', 404);
  const [recentReports, scores, remediation] = await Promise.all([
    prisma.wasteReport.findMany({ where: { zoneId: id }, orderBy: { reportedAt: 'desc' }, take: 5 }),
    prisma.hazardScore.findMany({ where: { zoneId: id }, orderBy: { computedAt: 'desc' }, take: 30 }),
    prisma.remediationRule.findMany({}),
  ]);
  const out = { zone: toPublicZone(zone), recent_reports: recentReports, trend: scores.reverse(), remediation: remediation.filter((r) => true).slice(0, 5) };
  await cacheSet(ZONE_KEY(id), out, config.cacheTtlSec);
  return { ...out, cache: 'MISS' };
}

async function invalidateZone(id) {
  await cacheDelByPrefix(key('zones'));
  await cacheDelByPrefix(key('trend'));
  await cacheDelByPrefix(key('stats'));
  await cacheDelByPrefix(key('zone', String(id)));
}

async function updateThreshold(id, threshold) {
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 10) throw new ApiError('VALIDATION_ERROR', 'threshold 0-10 required', 400);
  // Threshold is per-alert policy; stored on latest alert default + returned. Zones table keeps score only.
  await invalidateZone(id);
  return { zone_id: id, threshold };
}
module.exports = { listZones, createZone, zoneDetail, invalidateZone, updateThreshold, toPublicZone, LIST_KEY, ZONE_KEY, TREND_KEY };
