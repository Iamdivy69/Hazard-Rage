const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');
const { createApp } = require('../src/app');
const { getPrisma } = require('../src/config/prisma');
const { disconnectRedis, getRedis } = require('../src/config/redis');

let server, base;
before(async () => {
  try {
    const { getRedis } = require('../src/config/redis');
    const r = getRedis();
    for (const pattern of ['rl:*', 'hz:v1:*']) {
      const stream = r.scanStream({ match: pattern, count: 100 });
      const keys = [];
      for await (const chunk of stream) keys.push(...chunk);
      if (keys.length) await r.del(...keys);
    }
  } catch {}
  const app = createApp();
  server = app.listen(0);
  await new Promise((r) => server.on('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((r) => server.close(r));
  try { await getPrisma().$disconnect(); } catch {}
  await disconnectRedis();
});
async function req(path, opts = {}) {
  const res = await fetch(base + path, { headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }, ...opts });
  const json = await res.json().catch(() => null);
  return { res, json };
}
const uniq = () => `t${Date.now()}${Math.floor(Math.random() * 1e6)}`;

describe('TASK-002 auth + RBAC', () => {
  it('register 201 + duplicate 409 + bad login 401 + me 200 + no token 401', async () => {
    const email = `${uniq()}@x.local`;
    let r = await req('/api/v1/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Test', email, password: 'secret12' }) });
    assert.equal(r.res.status, 201);
    assert.ok(r.json.data.token);
    const dup = await req('/api/v1/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Test', email, password: 'secret12' }) });
    assert.equal(dup.res.status, 409);
    const bad = await req('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password: 'wrongpw' }) });
    assert.equal(bad.res.status, 401);
    const login = await req('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password: 'secret12' }) });
    assert.equal(login.res.status, 200);
    const me = await req('/api/v1/auth/me', { headers: { Authorization: `Bearer ${login.json.data.token}` } });
    assert.equal(me.res.status, 200);
    const anon = await req('/api/v1/auth/me');
    assert.equal(anon.res.status, 401);
    // hash not plaintext
    const row = await getPrisma().user.findUnique({ where: { email } });
    assert.ok(row.passwordHash !== 'secret12');
  });
  it('citizen blocked from admin route 403 + throttle 429 on 11th login', async () => {
    const email = `${uniq()}@x.local`;
    await req('/api/v1/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Citizen Two', email, password: 'secret12' }) });
    const login = await req('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password: 'secret12' }) });
    const token = login.json.data.token;
    const forbidden = await req('/api/v1/exports/reports.csv', { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(forbidden.res.status, 403);
    // throttle: hammer login 11x (may already have 2 hits this minute for this IP+route; loop until 429 or 12 tries)
    let got429 = false;
    for (let i = 0; i < 12; i++) {
      const r = await req('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email: 'nobody@x.local', password: 'x' }) });
      if (r.res.status === 429) { got429 = true; assert.ok(r.res.headers.get('retry-after') !== null); break; }
    }
    assert.equal(got429, true);
    try {
      const r = getRedis();
      const stream = r.scanStream({ match: 'rl:*', count: 100 });
      const keys = [];
      for await (const chunk of stream) keys.push(...chunk);
      if (keys.length) await r.del(...keys);
    } catch {}
  });
});
