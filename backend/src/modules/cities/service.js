// Cities service — the city switcher backbone. Cached list, admin create.
const { getPrisma } = require('../../config/prisma');
const { cacheGet, cacheSet, cacheDelByPrefix, key } = require('../../common/cache');
const config = require('../../config');
const { ApiError } = require('../../common/errors');

const CITIES_KEY = key('cities', 'list');

function toPublicCity(c, zoneCount) {
  return { id: c.id, name: c.name, state: c.state, lat: c.lat, lng: c.lng, zones: zoneCount ?? 0 };
}

async function listCities() {
  const { hit, value } = await cacheGet(CITIES_KEY);
  if (hit) return { cities: value, cache: 'HIT' };
  const prisma = getPrisma();
  const cities = await prisma.city.findMany({ orderBy: { name: 'asc' } });
  const out = [];
  for (const c of cities) {
    out.push(toPublicCity(c, await prisma.zone.count({ where: { cityId: c.id } })));
  }
  await cacheSet(CITIES_KEY, out, config.cacheTtlSec);
  return { cities: out, cache: 'MISS' };
}

async function createCity({ name, state, lat, lng }) {
  try {
    const city = await getPrisma().city.create({ data: { name, state: state || null, lat, lng } });
    await cacheDelByPrefix(key('cities'));
    return toPublicCity(city, 0);
  } catch (e) {
    if (e.code === 'P2002') throw new ApiError('CONFLICT', 'City already exists', 409);
    throw e;
  }
}

async function invalidateCities() {
  await cacheDelByPrefix(key('cities'));
}

module.exports = { listCities, createCity, invalidateCities };
