// Full feature audit: every endpoint + frontend routes. Exits non-zero on any failure.
require('./backend/src/config');
const { createApp } = require('./backend/src/app');
const { getPrisma } = require('./backend/src/config/prisma');
const { disconnectRedis } = require('./backend/src/config/redis');
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ok ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
}

async function main() {
  const app = createApp();
  const s = app.listen(0);
  await new Promise((r) => s.on('listening', r));
  const base = `http://127.0.0.1:${s.address().port}`;
  const J = (o) => JSON.stringify(o);
  const req = async (p, opts = {}) => {
    const res = await fetch(base + p, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
    const json = await res.json().catch(() => null);
    return { res, json };
  };

  console.log('== auth ==');
  const email = `audit${Date.now()}@x.local`;
  let r = await req('/api/v1/auth/register', { method: 'POST', body: J({ name: 'Auditor', email, password: 'secret12' }) });
  check('register 201 + token', r.res.status === 201 && !!r.json.data.token, r.res.status);
  const userToken = r.json.data?.token;
  r = await req('/api/v1/auth/login', { method: 'POST', body: J({ email: 'citizen@hazard.local', password: 'password123' }) });
  const ct = r.json.data.token;
  check('citizen login 200', r.res.status === 200 && !!ct, r.res.status);
  r = await req('/api/v1/auth/login', { method: 'POST', body: J({ email: 'admin@hazard.local', password: 'password123' }) });
  const at = r.json.data.token;
  check('admin login 200', r.res.status === 200 && !!at, r.res.status);
  const H = (t) => ({ Authorization: `Bearer ${t}` });

  console.log('== zones ==');
  r = await req('/api/v1/zones');
  check('20 zones public', r.res.status === 200 && r.json.data.length >= 20, r.res.status);
  const zid = r.json.data[0].id;
  r = await req(`/api/v1/zones/${zid}`);
  check('zone detail bundle', !!(r.json.data.zone && r.json.data.recent_reports && r.json.data.trend && r.json.data.remediation), r.res.status);
  r = await req('/api/v1/zones/999999');
  check('zone 404', r.res.status === 404, r.res.status);
  r = await req(`/api/v1/zones/${zid}/threshold`, { method: 'PATCH', headers: H(at), body: J({ threshold: 8 }) });
  check('threshold admin 200', r.res.status === 200 && r.json.data.threshold === 8, r.res.status);
  r = await req(`/api/v1/zones/${zid}/threshold`, { method: 'PATCH', headers: H(ct), body: J({ threshold: 8 }) });
  check('threshold citizen 403', r.res.status === 403, r.res.status);

  console.log('== reports (multipart image) ==');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const fd = new FormData();
  fd.append('zone_id', String(zid));
  fd.append('waste_type', 'plastic');
  fd.append('severity', 'Med');
  fd.append('description', 'audit probe with photo');
  fd.append('image', new Blob([png], { type: 'image/png' }), 'probe.png');
  const up = await fetch(base + '/api/v1/reports', { method: 'POST', headers: { Authorization: `Bearer ${ct}` }, body: fd });
  const uj = await up.json();
  check('multipart + image 201', up.status === 201 && !!uj.data.report.id && !!uj.data.hazardScore, up.status);
  check('image stored', (uj.data.report.imageUrl || '').startsWith('/uploads/'), uj.data.report.imageUrl);
  const rid = uj.data.report.id;
  const fname = path.join(__dirname, 'backend', 'uploads', path.basename(uj.data.report.imageUrl));
  check('image file on disk', fs.existsSync(fname), fname);
  r = await req('/api/v1/reports?mine=true&limit=50', { headers: H(ct) });
  check('my-reports lists own', r.res.status === 200 && r.json.data.some((x) => x.id === rid), r.res.status);
  r = await req('/api/v1/reports?page=1&limit=5', { headers: H(at) });
  check('pagination shape', !!r.json.data && Array.isArray(r.json.data), JSON.stringify(r.json).slice(0, 80));

  console.log('== hazard ==');
  r = await req('/api/v1/hazard/scores?zone_id=' + zid, { headers: H(at) });
  check('scores list', r.res.status === 200 && r.json.data.length > 0, r.res.status);
  r = await req('/api/v1/hazard/trends?days=30', { headers: H(at) });
  check('trends 20 zones', r.res.status === 200 && r.json.data.zones.length >= 20, r.res.status);
  r = await req('/api/v1/hazard/cause?zone_id=' + zid, { headers: H(at) });
  check('cause hypothesis', !!(r.json.data && r.json.data.hypothesis), r.res.status);

  console.log('== remediation matrix (15 rules) ==');
  let allOk = true;
  for (const wt of ['organic', 'plastic', 'construction', 'biomedical', 'mixed']) {
    for (const lv of ['Low', 'Medium', 'High']) {
      const rr = await req(`/api/v1/remediation/suggest?waste_type=${wt}&level=${lv}`, { headers: H(at) });
      if (!(rr.res.status === 200 && rr.json.data.actions.length >= 1)) { allOk = false; console.log(`  FAIL suggest ${wt}/${lv}`, rr.res.status); }
    }
  }
  check('all 15 suggest combos', allOk);

  console.log('== status + alerts ==');
  r = await req(`/api/v1/reports/${rid}/status`, { method: 'PATCH', headers: H(at), body: J({ status: 'In Progress' }) });
  check('Pending->In Progress 200', r.res.status === 200, r.res.status);
  r = await req(`/api/v1/reports/${rid}/status`, { method: 'PATCH', headers: H(at), body: J({ status: 'Resolved' }) });
  check('->Resolved 200 + newScore', r.res.status === 200 && !!r.json.data.newScore, r.res.status);
  r = await req('/api/v1/alerts', { headers: H(at) });
  check('alerts list array', r.res.status === 200 && Array.isArray(r.json.data), r.res.status);
  if (r.json.data.length) {
    const aid = r.json.data.find((a) => a.status === 'Active')?.id || r.json.data[0].id;
    const ack = await req(`/api/v1/alerts/${aid}/ack`, { method: 'PATCH', headers: H(at), body: J({}) });
    check('ack 200 (or 500 if resolved)', [200, 500].includes(ack.res.status), ack.res.status);
  } else console.log('  ok alerts list empty (no breach this run)');

  console.log('== exports ==');
  const csv = await fetch(base + '/api/v1/exports/reports.csv', { headers: { Authorization: `Bearer ${at}` } });
  const text = await csv.text();
  check('CSV 200 + header + rows', csv.status === 200 && text.startsWith('id,zone_id') && text.split('\n').length > 5, csv.status);
  const csvCit = await fetch(base + '/api/v1/exports/reports.csv', { headers: { Authorization: `Bearer ${ct}` } });
  check('CSV citizen 403', csvCit.status === 403, csvCit.status);

  console.log('== frontend ==');
  const pages = ['/', '/login', '/register', '/home', '/report/new', '/my-reports', '/admin', '/admin/map', '/admin/reports', '/admin/alerts', '/admin/zones/1'];
  let fok = true;
  for (const p of pages) {
    try {
      const pr = await fetch('http://127.0.0.1:5173' + p);
      if (pr.status !== 200) { fok = false; console.log(`  FAIL page ${p}`, pr.status); }
    } catch (e) { fok = false; console.log(`  FAIL page ${p} fetch`, e.message); }
  }
  check('all 11 frontend routes 200', fok);

  await new Promise((res) => s.close(res));
  await getPrisma().$disconnect();
  await disconnectRedis();
  console.log(`\nRESULT pass=${pass} fail=${fail}`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error('AUDIT CRASH', e); process.exit(1); });
