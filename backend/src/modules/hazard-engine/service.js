// Hazard engine — PURE, no Express/Redis imports (per architecture).
// HS = .30V + .25T + .20S + .15F + .10U, clamp 0-10. Low 0-3, Medium 4-6, High 7-10.
const { getPrisma } = require('../../config/prisma');

const WEIGHTS = { w1: 0.30, w2: 0.25, w3: 0.20, w4: 0.15, w5: 0.10 };
const TYPE_SEVERITY = { biomedical: 10, mixed: 8, plastic: 6, construction: 5, organic: 4 };
const SEVERITY_NUM = { Low: 3, Med: 6, High: 9 };

function clamp01to10(v) {
  if (!Number.isFinite(v)) return 0;
  return Math.min(10, Math.max(0, v));
}
function levelFor(score) {
  if (score >= 7) return 'High';
  if (score >= 4) return 'Medium';
  return 'Low';
}
function computeScore({ volumeIndex, typeSeverity, spreadRadius, frequency, unresolvedDuration }) {
  const v = [volumeIndex, typeSeverity, spreadRadius, frequency, unresolvedDuration].map(clamp01to10);
  const score = WEIGHTS.w1 * v[0] + WEIGHTS.w2 * v[1] + WEIGHTS.w3 * v[2] + WEIGHTS.w4 * v[3] + WEIGHTS.w5 * v[4];
  const clamped = Math.min(10, Math.max(0, score));
  return { score: Math.round(clamped * 100) / 100, level: levelFor(clamped) };
}

// Aggregate a zone's inputs from DB (deterministic, explainable heuristic).
async function zoneInputs(zoneId, prisma) {
  const db = prisma || getPrisma();
  const [total, unresolved, byType, recent] = await Promise.all([
    db.wasteReport.count({ where: { zoneId } }),
    db.wasteReport.findMany({ where: { zoneId, status: { not: 'Resolved' } }, select: { reportedAt: true, severity: true, wasteType: true } }),
    db.wasteReport.groupBy({ by: ['wasteType'], where: { zoneId }, _count: true }),
    db.wasteReport.count({ where: { zoneId, reportedAt: { gte: new Date(Date.now() - 7 * 864e5) } } }),
  ]);
  const volumeIndex = clamp01to10(total / 5); // 50 reports => 10
  const topType = byType.sort((a, b) => b._count - a._count)[0];
  const typeSeverity = topType ? (TYPE_SEVERITY[topType.wasteType] ?? 5) : 0;
  const distinctTypes = new Set((await db.wasteReport.findMany({ where: { zoneId }, select: { wasteType: true }, take: 50 })).map((r) => r.wasteType)).size;
  const spreadRadius = clamp01to10(distinctTypes * 2 + (total > 20 ? 2 : 0));
  const frequency = clamp01to10(recent * 2); // 5/week => 10
  let unresolvedDuration = 0;
  if (unresolved.length) {
    const avgAgeDays = unresolved.reduce((s, r) => s + (Date.now() - new Date(r.reportedAt).getTime()) / 864e5, 0) / unresolved.length;
    unresolvedDuration = clamp01to10(avgAgeDays / 3); // 30 days => 10
  }
  return { volumeIndex, typeSeverity, spreadRadius, frequency, unresolvedDuration };
}

async function recomputeZone(zoneId, prisma) {
  const db = prisma || getPrisma();
  const inputs = await zoneInputs(zoneId, db);
  const { score, level } = computeScore(inputs);
  await db.$transaction([
    db.hazardScore.create({ data: { zoneId, score, level, inputsJson: { ...inputs, weights: WEIGHTS } } }),
    db.zone.update({ where: { id: zoneId }, data: { currentScore: score, currentLevel: level } }),
  ]);
  return { score, level, inputs };
}
module.exports = { computeScore, levelFor, recomputeZone, zoneInputs, WEIGHTS, TYPE_SEVERITY, SEVERITY_NUM };
