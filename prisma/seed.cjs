// Smoke seed for TASK-000: 20 zones + 15 remediation rules + 3 users.
// Full 500-report historical seed comes in TASK-012. Idempotent via upsert.
try { require('dotenv').config(); } catch {}
try { require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') }); } catch {}
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Surat starter wards (second city — proves multi-city from day one)
const SURAT_ZONES = [
  ['Adajan', 21.21, 72.79, 'residential'], ['Vesu', 21.14, 72.77, 'residential'],
  ['Katargam', 21.22, 72.83, 'market'], ['Varachha', 21.23, 72.84, 'industrial'],
  ['Udhna', 21.17, 72.83, 'industrial'], ['Pal', 21.19, 72.78, 'drainage'],
];
// 20 zones around Vadodara (approx grid) with zone types for cause analysis
const ZONES = [
  ['Nizampura', 22.317, 73.16, 'residential'], ['Fatehgunj', 22.31, 73.18, 'commercial'],
  ['Sayajigunj', 22.305, 73.185, 'commercial'], ['Alkapuri', 22.3, 73.175, 'commercial'],
  ['Makarpura', 22.27, 73.19, 'industrial'], ['Manjalpur', 22.27, 73.21, 'residential'],
  ['Atladara', 22.28, 73.15, 'residential'], ['Gotri', 22.29, 73.14, 'residential'],
  ['Vasna', 22.295, 73.165, 'market'], ['Old City Mandvi', 22.3, 73.2, 'market'],
  ['Panigate', 22.305, 73.21, 'market'], ['Karelibaug', 22.31, 73.195, 'residential'],
  ['Sama', 22.325, 73.19, 'residential'], ['Harni', 22.33, 73.21, 'industrial'],
  ['Bapod', 22.315, 73.225, 'industrial'], ['Waghodia Rd', 22.295, 73.23, 'drainage'],
  ['Tarsali', 22.26, 73.22, 'drainage'], ['Dashrath', 22.25, 73.2, 'construction'],
  ['Chhani', 22.335, 73.17, 'construction'], ['Undera', 22.34, 73.15, 'drainage'],
];

const REMEDIATION = [
  ['organic', 'Low', 'Community composting + daily pickup'],
  ['organic', 'Medium', 'Deploy 2 compactors + wet-market washdown'],
  ['organic', 'High', 'Emergency clearance + anti-larval spray + market audit'],
  ['plastic', 'Low', 'Recycling kiosk + awareness drive'],
  ['plastic', 'Medium', 'MRF linkage + recycler pickup twice weekly'],
  ['plastic', 'High', 'Seize illegal dump + bulk recycler contract + challan'],
  ['construction', 'Low', 'C&D collection point + builder notice'],
  ['construction', 'Medium', 'C&D plant trip + site barricading'],
  ['construction', 'High', 'Stop-work + debris lift + penalty'],
  ['biomedical', 'Low', 'BMW bins + tie-up with CBWTF'],
  ['biomedical', 'Medium', 'CBWTF emergency pickup + ward disinfection'],
  ['biomedical', 'High', 'Seal site + PCB report + biohazard team'],
  ['mixed', 'Low', 'Segregation drive + extra bins'],
  ['mixed', 'Medium', 'Night clearance crew + CCTV at hotspot'],
  ['mixed', 'High', 'Special sanitation drive + magistrate report'],
];

async function main() {
  await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS postgis`;

  const hash = await bcrypt.hash('password123', 10);
  for (const [name, email, role] of [
    ['Citizen Demo', 'citizen@hazard.local', 'citizen'],
    ['Municipal Admin', 'admin@hazard.local', 'municipal_admin'],
    ['System Admin', 'sysadmin@hazard.local', 'system_admin'],
  ]) {
    await prisma.user.upsert({ where: { email }, update: {}, create: { name, email, passwordHash: hash, role } });
  }

  const vadodara = await prisma.city.upsert({
    where: { name: 'Vadodara' },
    update: { state: 'Gujarat', lat: 22.3, lng: 73.18 },
    create: { name: 'Vadodara', state: 'Gujarat', lat: 22.3, lng: 73.18 },
  });
  const surat = await prisma.city.upsert({
    where: { name: 'Surat' },
    update: { state: 'Gujarat', lat: 21.19, lng: 72.83 },
    create: { name: 'Surat', state: 'Gujarat', lat: 21.19, lng: 72.83 },
  });

  for (const [name, lat, lng, zoneType] of ZONES) {
    await prisma.zone.upsert({ where: { name }, update: { lat, lng, zoneType, cityId: vadodara.id }, create: { name, lat, lng, zoneType, cityId: vadodara.id } });
  }

  for (const [name, lat, lng, zoneType] of SURAT_ZONES) {
    await prisma.zone.upsert({ where: { name }, update: { lat, lng, zoneType, cityId: surat.id }, create: { name, lat, lng, zoneType, cityId: surat.id } });
  }

  for (const [wasteType, level, action] of REMEDIATION) {
    await prisma.remediationRule.upsert({
      where: { wasteType_level: { wasteType, level } },
      update: { action },
      create: { wasteType, level, action },
    });
  }

  const zones = await prisma.zone.count();
  const cities = await prisma.city.count();
  const rules = await prisma.remediationRule.count();
  const users = await prisma.user.count();
  console.log(`[seed] users=${users} cities=${cities} zones=${zones} rules=${rules}`);
  if (zones !== 26) throw new Error(`Expected 26 zones, got ${zones}`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
