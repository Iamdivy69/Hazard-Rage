// TASK-012 deterministic 500-report history seed (6 months).
try { require('dotenv').config(); } catch {}
try { require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') }); } catch {}
// Market/drain zones skew High; intervention zones (Sama, Atladara, Gotri) decline last 6 weeks.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rnd = mulberry32(42);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
async function main() {
  const users = await prisma.user.findMany();
  const zones = await prisma.zone.findMany({ orderBy: { id: 'asc' } });
  if (!zones.length) throw new Error('seed zones first');
  const citizen = users.find((u) => u.role === 'citizen') || users[0];
  const HOT = ['Vasna', 'Old City Mandvi', 'Panigate', 'Waghodia Rd', 'Tarsali', 'Undera'];
  const COOL = ['Sama', 'Atladara', 'Gotri'];
  const now = Date.now();
  const rows = [];
  for (let i = 0; i < 500; i++) {
    const hotBias = rnd();
    const zone = hotBias < 0.55 ? zones.find((z) => HOT.includes(z.name)) || pick(zones) : pick(zones);
    const daysAgo = Math.floor(rnd() * 180);
    const isCoolRecent = COOL.includes(zone.name) && daysAgo < 42 && rnd() < 0.8;
    const wasteType = isCoolRecent ? pick(['organic', 'plastic']) : HOT.includes(zone.name) ? pick(['mixed', 'mixed', 'biomedical', 'plastic', 'organic']) : pick(['organic', 'plastic', 'plastic', 'construction', 'mixed']);
    const severity = isCoolRecent ? pick(['Low', 'Low', 'Med']) : HOT.includes(zone.name) ? pick(['Med', 'High', 'High', 'Med']) : pick(['Low', 'Med', 'Med', 'High']);
    const status = daysAgo > 42 ? pick(['Resolved', 'Resolved', 'In_Progress']) : pick(['Pending', 'In_Progress', 'Pending', 'Resolved']);
    rows.push({ userId: citizen.id, zoneId: zone.id, wasteType, severity, status: status === 'In_Progress' ? 'In_Progress' : status, description: `seeded report ${i + 1} (${zone.name})`, reportedAt: new Date(now - daysAgo * 864e5 - Math.floor(rnd() * 864e5)) });
  }
  await prisma.wasteReport.deleteMany({});
  await prisma.hazardScore.deleteMany({});
  await prisma.alert.deleteMany({});
  const CHUNK = 100;
  for (let i = 0; i < rows.length; i += CHUNK) await prisma.wasteReport.createMany({ data: rows.slice(i, i + CHUNK) });
  // Recompute every zone via engine aggregation (import without Express/Redis)
  const { recomputeZone } = require('../backend/src/modules/hazard-engine/service');
  for (const z of zones) await recomputeZone(z.id);
  const top = await prisma.zone.findMany({ orderBy: { currentScore: 'desc' }, take: 5 });
  console.log('[seed500] reports=500 zones=' + zones.length);
  console.log('[seed500] top:', top.map((z) => `${z.name}:${z.currentScore.toFixed(1)}`).join(', '));
}
main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
