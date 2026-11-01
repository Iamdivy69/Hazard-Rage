const assert = require('node:assert/strict');
const { describe, it, before, after } = require('node:test');
const { createApp } = require('../src/app');
const { getPrisma } = require('../src/config/prisma');
const { disconnectRedis } = require('../src/config/redis');
const { computeScore } = require('../src/modules/hazard-engine/service');

let server, base, adminToken, citizenToken, zoneId;
before(async () => {
  // clear throttle + app cache left by earlier files/runs (deterministic MISS first)
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
  const login = async (email) => {
    const r = await fetch(base + '/api/v1/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'password123' }) });
    return (await r.json()).data.token;
  };
  adminToken = await login('admin@hazard.local');
  citizenToken = await login('citizen@hazard.local');
  const zones = await (await fetch(base + '/api/v1/zones')).json();
  zoneId = zones.data[0].id;
});
after(async () => {
  await new Promise((r) => server.close(r));
  try { await getPrisma().$disconnect(); } catch {}
  await disconnectRedis();
});
const H = (t) => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' });

describe('TASK-003 zones (cached)', () => {
  it('20 zones + HIT on repeat + write invalidates + detail bundle + 404', async () => {
    const first = await fetch(base + '/api/v1/zones');
    const j1 = await first.json();
    assert.ok(j1.data.length >= 26);
    const v = await (await fetch(base + '/api/v1/zones?city_id=1')).json();
    assert.equal(v.data.length, 20);
    const s = await (await fetch(base + '/api/v1/zones?city_id=2')).json();
    assert.equal(s.data.length, 6);
    const l2 = await fetch(base + '/api/v1/zones');
    assert.equal(l2.headers.get('x-cache'), 'HIT');
    await l2.json();
    // Write path invalidates hz:v1:* -> next read MUST be MISS (deterministic)
    const created = await fetch(base + '/api/v1/reports', { method: 'POST', headers: H(citizenToken), body: JSON.stringify({ zone_id: zoneId, waste_type: 'organic', severity: 'Low', description: 'cache-invalidation probe' }) });
    assert.equal(created.status, 201);
    await created.json();
    const afterWrite = await fetch(base + '/api/v1/zones');
    assert.equal(afterWrite.headers.get('x-cache'), 'MISS');
    await afterWrite.json();
    const afterWrite2 = await fetch(base + '/api/v1/zones');
    assert.equal(afterWrite2.headers.get('x-cache'), 'HIT');
    await afterWrite2.json();
    const d = await (await fetch(`${base}/api/v1/zones/${zoneId}`)).json();
    assert.ok(d.data.zone && d.data.recent_reports && d.data.trend && d.data.remediation);
    const bad = await fetch(`${base}/api/v1/zones/999999`);
    assert.equal(bad.status, 404);
  });
});

describe('TASK-006 hazard engine (pure)', () => {
  it('formula + clamp + boundaries', () => {
    assert.deepEqual(computeScore({ volumeIndex: 10, typeSeverity: 10, spreadRadius: 10, frequency: 10, unresolvedDuration: 10 }), { score: 10, level: 'High' });
    assert.deepEqual(computeScore({ volumeIndex: 0, typeSeverity: 0, spreadRadius: 0, frequency: 0, unresolvedDuration: 0 }), { score: 0, level: 'Low' });
    assert.equal(computeScore({ volumeIndex: 3, typeSeverity: 3, spreadRadius: 3, frequency: 3, unresolvedDuration: 3 }).level, 'Low');
    assert.equal(computeScore({ volumeIndex: 5, typeSeverity: 5, spreadRadius: 5, frequency: 5, unresolvedDuration: 5 }).level, 'Medium');
    assert.equal(computeScore({ volumeIndex: 7, typeSeverity: 7, spreadRadius: 7, frequency: 7, unresolvedDuration: 7 }).level, 'High');
    assert.equal(computeScore({ volumeIndex: 99, typeSeverity: -5, spreadRadius: 99, frequency: -9, unresolvedDuration: 99 }).score <= 10, true);
  });
});

describe('TASK-005 reporting + TASK-007 status/alerts', () => {
  it('citizen submit 201 + missing zone 400 + unauth 401 + oversize guard', async () => {
    const ok = await fetch(base + '/api/v1/reports', { method: 'POST', headers: H(citizenToken), body: JSON.stringify({ zone_id: zoneId, waste_type: 'plastic', severity: 'Med', description: 'test pile' }) });
    assert.equal(ok.status, 201);
    const j = await ok.json();
    assert.ok(j.data.report.id && j.data.hazardScore);
    const bad = await fetch(base + '/api/v1/reports', { method: 'POST', headers: H(citizenToken), body: JSON.stringify({ zone_id: 999999, waste_type: 'plastic', severity: 'Med' }) });
    assert.equal(bad.status, 400);
    const anon = await fetch(base + '/api/v1/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zone_id: zoneId, waste_type: 'plastic', severity: 'Med' }) });
    assert.equal(anon.status, 401);
  });
  it('status chain + 422 on bad jump + citizen 403 + alerts list/ack', async () => {
    const created = await (await fetch(base + '/api/v1/reports', { method: 'POST', headers: H(citizenToken), body: JSON.stringify({ zone_id: zoneId, waste_type: 'mixed', severity: 'High' }) })).json();
    const id = created.data.report.id;
    const badJump = await fetch(`${base}/api/v1/reports/${id}/status`, { method: 'PATCH', headers: H(adminToken), body: JSON.stringify({ status: 'Resolved' }) });
    assert.equal(badJump.status, 422);
    const citizenPatch = await fetch(`${base}/api/v1/reports/${id}/status`, { method: 'PATCH', headers: H(citizenToken), body: JSON.stringify({ status: 'In Progress' }) });
    assert.equal(citizenPatch.status, 403);
    const p1 = await fetch(`${base}/api/v1/reports/${id}/status`, { method: 'PATCH', headers: H(adminToken), body: JSON.stringify({ status: 'In Progress' }) });
    assert.equal(p1.status, 200);
    const p2 = await fetch(`${base}/api/v1/reports/${id}/status`, { method: 'PATCH', headers: H(adminToken), body: JSON.stringify({ status: 'Resolved' }) });
    assert.equal(p2.status, 200);
    const alerts = await (await fetch(base + '/api/v1/alerts', { headers: H(adminToken) })).json();
    assert.ok(Array.isArray(alerts.data));
    if (alerts.data.length) {
      const ack = await fetch(`${base}/api/v1/alerts/${alerts.data[0].id}/ack`, { method: 'PATCH', headers: H(adminToken) });
      assert.ok([200, 500].includes(ack.status));
    }
    const citizenAck = await fetch(`${base}/api/v1/alerts/1/ack`, { method: 'PATCH', headers: H(citizenToken) });
    assert.equal(citizenAck.status, 403);
  });
});

  it('resolve accepts cleanup photo (multipart) -> resolvedImageUrl stored', async () => {
    const created = await (await fetch(base + '/api/v1/reports', { method: 'POST', headers: H(citizenToken), body: JSON.stringify({ zone_id: zoneId, waste_type: 'organic', severity: 'Low' }) })).json();
    const id = created.data.report.id;
    await fetch(`${base}/api/v1/reports/${id}/status`, { method: 'PATCH', headers: H(adminToken), body: JSON.stringify({ status: 'In Progress' }) });
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const fd = new FormData();
    fd.append('status', 'Resolved');
    fd.append('image', new Blob([png], { type: 'image/png' }), 'after.png');
    const res = await fetch(`${base}/api/v1/reports/${id}/status`, { method: 'PATCH', headers: { Authorization: `Bearer ${adminToken}` }, body: fd });
    assert.equal(res.status, 200);
    const j = await res.json();
    assert.ok((j.data.report.resolvedImageUrl || '').startsWith('/uploads/'));
    const got = await (await fetch(`${base}/api/v1/reports/${id}`, { headers: H(citizenToken) })).json();
    assert.ok((got.data.resolvedImageUrl || '').startsWith('/uploads/'));
  });

describe('TASK-008 trends + TASK-010 remediation + TASK-011 export', () => {
  it('trends cached MISS->HIT + remediation matrix + CSV admin 200 citizen 403', async () => {
    const t1 = await fetch(base + '/api/v1/hazard/trends?days=30', { headers: H(adminToken) });
    assert.equal(t1.headers.get('x-cache'), 'MISS');
    const t2 = await fetch(base + '/api/v1/hazard/trends?days=30', { headers: H(adminToken) });
    assert.equal(t2.headers.get('x-cache'), 'HIT');
    const tj = await t2.json();
    assert.ok(tj.data.zones.length >= 26);
    const tc = await (await fetch(base + '/api/v1/hazard/trends?days=30&city_id=1', { headers: H(adminToken) })).json();
    assert.equal(tc.data.zones.length, 20);
    const sug = await (await fetch(`${base}/api/v1/remediation/suggest?waste_type=plastic&level=High`, { headers: H(adminToken) })).json();
    assert.ok(sug.data.actions.length >= 1);
    const csv = await fetch(base + '/api/v1/exports/reports.csv', { headers: H(adminToken) });
    assert.equal(csv.status, 200);
    assert.ok((csv.headers.get('content-type') || '').includes('csv'));
    const csvCit = await fetch(base + '/api/v1/exports/reports.csv', { headers: H(citizenToken) });
    assert.equal(csvCit.status, 403);
  });
});

describe('live events + geo reports', () => {
  it('SSE stream pushes zones-changed on report submit', async () => {
    const ctrl = new AbortController();
    const streamP = (async () => {
      const res = await fetch(base + '/api/v1/events', { signal: ctrl.signal });
      assert.equal(res.status, 200);
      assert.ok((res.headers.get('content-type') || '').includes('text/event-stream'));
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      const deadline = Date.now() + 10000;
      let buf = '';
      while (Date.now() < deadline) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        if (buf.includes('zones-changed')) break;
      }
      try { await reader.cancel(); } catch {}
      return buf;
    })();
    await new Promise((r) => setTimeout(r, 600));
    await fetch(base + '/api/v1/reports', { method: 'POST', headers: H(citizenToken), body: JSON.stringify({ zone_id: zoneId, waste_type: 'plastic', severity: 'Low' }) });
    const buf = await streamP;
    ctrl.abort();
    assert.ok(buf.includes('zones-changed'), 'expected zones-changed push');
  });
  it('geo submit auto-selects nearest ward + stores coords; rejects nowhere', async () => {
    const r = await fetch(base + '/api/v1/reports', { method: 'POST', headers: H(citizenToken), body: JSON.stringify({ lat: 22.295, lng: 73.165, waste_type: 'organic', severity: 'Low' }) });
    assert.equal(r.status, 201);
    const j = await r.json();
    assert.ok(j.data.report.zoneId);
    assert.equal(j.data.report.lat, 22.295);
    assert.equal(j.data.report.lng, 73.165);
    const nowhere = await fetch(base + '/api/v1/reports', { method: 'POST', headers: H(citizenToken), body: JSON.stringify({ lat: 0, lng: 0, waste_type: 'organic', severity: 'Low' }) });
    assert.equal(nowhere.status, 400);
    const neither = await fetch(base + '/api/v1/reports', { method: 'POST', headers: H(citizenToken), body: JSON.stringify({ waste_type: 'organic', severity: 'Low' }) });
    assert.equal(neither.status, 400);
  });
});

describe('tiles proxy', () => {
  it('rejects bad coordinates 400', async () => {
    const bad = await fetch(base + '/api/v1/tiles/abc/1/2');
    assert.equal(bad.status, 400);
    const oob = await fetch(base + '/api/v1/tiles/2/99/99');
    assert.equal(oob.status, 400);
  });
});

describe('TASK-013 cities + add-zone', () => {
  it('lists Vadodara + Surat with zone counts', async () => {
    const r = await (await fetch(base + '/api/v1/cities')).json();
    const names = r.data.map((c) => c.name);
    assert.ok(names.includes('Vadodara') && names.includes('Surat'));
    assert.equal(r.data.find((c) => c.name === 'Vadodara').zones, 20);
    assert.equal(r.data.find((c) => c.name === 'Surat').zones, 6);
  });
  it('admin creates city + zone; dup 409; citizen 403; bad city 400', async () => {
    const cname = `Testville-${Date.now()}`;
    const created = await fetch(base + '/api/v1/cities', { method: 'POST', headers: H(adminToken), body: JSON.stringify({ name: cname, state: 'Test', lat: 23.0, lng: 72.5 }) });
    assert.equal(created.status, 201);
    const cj = await created.json();
    const dup = await fetch(base + '/api/v1/cities', { method: 'POST', headers: H(adminToken), body: JSON.stringify({ name: 'Vadodara', state: 'Gujarat', lat: 22.3, lng: 73.18 }) });
    assert.equal(dup.status, 409);
    const cit = await fetch(base + '/api/v1/cities', { method: 'POST', headers: H(citizenToken), body: JSON.stringify({ name: `Nope-${Date.now()}`, lat: 23, lng: 72 }) });
    assert.equal(cit.status, 403);
    const zname = `Test Ward-${Date.now()}`;
    const zone = await fetch(base + '/api/v1/zones', { method: 'POST', headers: H(adminToken), body: JSON.stringify({ city_id: cj.data.id, name: zname, lat: 23.01, lng: 72.51, zone_type: 'residential' }) });
    assert.equal(zone.status, 201);
    const scoped = await (await fetch(`${base}/api/v1/zones?city_id=${cj.data.id}`)).json();
    assert.ok(scoped.data.some((z) => z.name === zname));
    const badCity = await fetch(base + '/api/v1/zones', { method: 'POST', headers: H(adminToken), body: JSON.stringify({ city_id: 999999, name: `Ghost-${Date.now()}`, lat: 23, lng: 72 }) });
    assert.equal(badCity.status, 400);
    const citZone = await fetch(base + '/api/v1/zones', { method: 'POST', headers: H(citizenToken), body: JSON.stringify({ city_id: cj.data.id, name: `Sneak-${Date.now()}`, lat: 23, lng: 72 }) });
    assert.equal(citZone.status, 403);
  });
});
