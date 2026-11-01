// Redis singleton — ephemeral only (ADR-008). Fail-open reads.
// Offline queue ON so first ping waits for connect; all cache ops have timeouts.

const Redis = require('ioredis');
const config = require('./index');

let redis = null;
let warned = false;

function getRedis() {
  if (redis) return redis;
  redis = new Redis(config.redisUrl, {
    maxRetriesPerRequest: 2,
    retryStrategy: (times) => Math.min(times * 100, 1000),
    enableReadyCheck: true,
    connectTimeout: 5000,
  });
  redis.on('error', (err) => {
    if (!warned) {
      console.warn(`[WARN][redis] ${err.message} — bypassing cache`);
      warned = true;
      setTimeout(() => { warned = false; }, 10000);
    }
  });
  return redis;
}

async function pingRedis(timeoutMs = 4000) {
  try {
    const r = getRedis();
    if (r.status !== 'ready') {
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('redis connect timeout')), timeoutMs);
        r.once('ready', () => { clearTimeout(t); resolve(); });
        r.once('error', (e) => { clearTimeout(t); reject(e); });
      });
    }
    const pong = await r.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

async function disconnectRedis() {
  try { redis?.disconnect(); } catch { /* ignore */ }
  redis = null;
}

module.exports = { getRedis, pingRedis, disconnectRedis };
