// Alerts service — trigger with Redis NX lock (30s), list/ack/resolve. Email best-effort.
const { getPrisma } = require('../../config/prisma');
const { getRedis } = require('../../config/redis');
const { sendAlertEmail } = require('../../config/mailer');

async function acquireLock(zoneId) {
  try {
    const res = await getRedis().set(`alert:lock:zone:${zoneId}`, '1', 'EX', 30, 'NX');
    return res === 'OK';
  } catch { return true; } // Redis down -> allow (fail-open, dedup best-effort)
}
async function maybeTriggerAlert(zoneId, score, threshold = 7.0) {
  const prisma = getPrisma();
  const existing = await prisma.alert.findFirst({ where: { zoneId, status: 'Active' } });
  if (existing) return existing;
  const got = await acquireLock(zoneId);
  if (!got) return existing || null;
  const recheck = await prisma.alert.findFirst({ where: { zoneId, status: 'Active' } });
  if (recheck) return recheck;
  const alert = await prisma.alert.create({ data: { zoneId, score, threshold, status: 'Active' } });
  sendAlertEmail(null, `Hazard alert: zone ${zoneId} score ${score}`, `Zone ${zoneId} breached threshold ${threshold} with score ${score}.`).catch(() => {});
  return alert;
}
async function listAlerts(status) {
  const where = status ? { status } : {};
  return getPrisma().alert.findMany({ where, include: { zone: { select: { id: true, name: true, currentLevel: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
}
async function ackAlert(id) {
  return getPrisma().alert.update({ where: { id }, data: { status: 'Acknowledged' } });
}
async function resolveAlertsForZone(zoneId) {
  await getPrisma().alert.updateMany({ where: { zoneId, status: { in: ['Active', 'Acknowledged'] } }, data: { status: 'Resolved' } });
}
module.exports = { maybeTriggerAlert, listAlerts, ackAlert, resolveAlertsForZone };
