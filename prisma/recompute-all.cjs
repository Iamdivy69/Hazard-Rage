// Recompute every zone's hazard score from current reports (run after data cleanup).
try { require('dotenv').config(); } catch {}
try { require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') }); } catch {}
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const { recomputeZone } = require('../backend/src/modules/hazard-engine/service');
  const zones = await prisma.zone.findMany({ orderBy: { id: 'asc' } });
  for (const z of zones) {
    const r = await recomputeZone(z.id);
    console.log(`zone ${z.id} ${z.name}: ${r.score} ${r.level}`);
  }
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
