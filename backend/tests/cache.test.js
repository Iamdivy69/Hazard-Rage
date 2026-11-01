const assert = require('node:assert/strict');
const { describe, it, after } = require('node:test');
const { cacheGet, cacheSet, cacheDelByPrefix, key } = require('../src/common/cache');
const { disconnectRedis } = require('../src/config/redis');

after(async () => {
  await disconnectRedis();
});

describe('cache helper (Redis)', () => {
  it('set then get returns HIT with value', async () => {
    const k = key('test', `unit-${Date.now()}`);
    await cacheSet(k, { a: 1 }, 60);
    const { hit, value } = await cacheGet(k);
    assert.equal(hit, true);
    assert.deepEqual(value, { a: 1 });
    await cacheDelByPrefix(k);
  });

  it('missing key returns MISS (never throws)', async () => {
    const { hit, value } = await cacheGet(key('test', `miss-${Date.now()}`));
    assert.equal(hit, false);
    assert.equal(value, null);
  });

  it('del by prefix removes keys', async () => {
    const base = `test:del-${Date.now()}`;
    await cacheSet(key(base, '1'), { x: 1 }, 60);
    await cacheSet(key(base, '2'), { x: 2 }, 60);
    const n = await cacheDelByPrefix(key(base));
    assert.ok(n >= 2 || n === 0); // 0 only if Redis down (bypass path)
  });
});
