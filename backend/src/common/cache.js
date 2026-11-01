// Cache helper — namespace hz:v1:*, TTL 60s. Never throws; returns null on miss/error.
// Why: fail-open reads per ADR-008. Callers must handle null as miss.

const config = require('../config');
const { getRedis } = require('../config/redis');

const PREFIX = 'hz:v1:';

function key(...parts) {
  return PREFIX + parts.join(':');
}

async function cacheGet(fullKey) {
  try {
    const raw = await getRedis().get(fullKey);
    if (!raw) return { hit: false, value: null };
    return { hit: true, value: JSON.parse(raw) };
  } catch (err) {
    console.warn(`[WARN][cache] GET ${fullKey} bypass: ${err.message}`);
    return { hit: false, value: null };
  }
}

async function cacheSet(fullKey, value, ttlSec = config.cacheTtlSec) {
  try {
    await getRedis().set(fullKey, JSON.stringify(value), 'EX', ttlSec);
  } catch (err) {
    console.warn(`[WARN][cache] SET ${fullKey} bypass: ${err.message}`);
  }
}

async function cacheDelByPrefix(prefix) {
  try {
    const r = getRedis();
    const stream = r.scanStream({ match: `${prefix}*`, count: 100 });
    const keys = [];
    for await (const chunk of stream) keys.push(...chunk);
    if (keys.length) await r.del(...keys);
    return keys.length;
  } catch (err) {
    console.warn(`[WARN][cache] DEL ${prefix}* bypass: ${err.message}`);
    return 0;
  }
}

module.exports = { key, cacheGet, cacheSet, cacheDelByPrefix, PREFIX };
