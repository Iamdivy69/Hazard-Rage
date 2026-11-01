const assert = require('node:assert/strict');
const { describe, it, after } = require('node:test');
const { createApp } = require('../src/app');
const { getPrisma } = require('../src/config/prisma');
const { disconnectRedis } = require('../src/config/redis');

after(async () => {
  try { await getPrisma().$disconnect(); } catch { /* ignore */ }
  await disconnectRedis();
});

describe('GET /api/v1/health', () => {
  it('returns envelope with postgres/redis/postgis booleans', async () => {
    const app = createApp();
    const server = app.listen(0);
    await new Promise((r) => server.on('listening', r));
    const port = server.address().port;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      assert.equal(json.data.postgres, true);
      assert.equal(json.data.redis, true);
      assert.equal(json.data.postgis, true);
      assert.ok(json.meta.timestamp);
      assert.ok(json.meta.request_id);
    } finally {
      await new Promise((r) => server.close(r));
    }
  });

  it('includes x-request-id header and echoes provided id', async () => {
    const app = createApp();
    const server = app.listen(0);
    await new Promise((r) => server.on('listening', r));
    const port = server.address().port;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/health`, {
        headers: { 'x-request-id': 'test-123' },
      });
      assert.equal(res.headers.get('x-request-id'), 'test-123');
    } finally {
      await new Promise((r) => server.close(r));
    }
  });
});

describe('unknown api route', () => {
  it('returns 404 NOT_FOUND envelope without leaking stack', async () => {
    const app = createApp();
    const server = app.listen(0);
    await new Promise((r) => server.on('listening', r));
    const port = server.address().port;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/nope`);
      assert.equal(res.status, 404);
      const json = await res.json();
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'NOT_FOUND');
      assert.ok(!JSON.stringify(json).includes('at '));
    } finally {
      await new Promise((r) => server.close(r));
    }
  });
});
