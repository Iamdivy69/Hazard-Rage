// Remediation: 15-rule matrix lookup + cause hypothesis (zone_type + top waste_type).
const { getPrisma } = require('../../config/prisma');

const CAUSE_BY_ZONE_TYPE = {
  market: 'Proximity to wet markets/commercial footfall with irregular lifting',
  drainage: 'Open drains/choked stormwater carrying floating waste',
  construction: 'Nearby construction debris + uncovered transport',
  industrial: 'Industrial dumping + heavy-vehicle spillage',
  residential: 'Household segregation gaps + missed door-to-door pickup',
};

async function suggest(wasteType, level) {
  const prisma = getPrisma();
  const rule = await prisma.remediationRule.findUnique({ where: { wasteType_level: { wasteType, level } } });
  if (rule) return { actions: [rule.action] };
  const fallback = await prisma.remediationRule.findMany({ where: { wasteType } });
  if (fallback.length) return { actions: fallback.map((r) => r.action) };
  return { actions: ['Schedule special sanitation drive and re-survey in 48h'] };
}

async function causeForZone(zoneId) {
  const prisma = getPrisma();
  const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
  const top = await prisma.wasteReport.groupBy({ by: ['wasteType'], where: { zoneId }, _count: true, orderBy: { _count: { wasteType: 'desc' } }, take: 1 });
  const zt = zone?.zoneType || 'residential';
  const base = CAUSE_BY_ZONE_TYPE[zt] || CAUSE_BY_ZONE_TYPE.residential;
  const wt = top[0] ? `Dominant waste: ${top[0].wasteType} (${top[0]._count} reports). ` : '';
  return { zone_type: zt, hypothesis: wt + base, confidence: top[0] ? 'medium' : 'low' };
}
module.exports = { suggest, causeForZone };
