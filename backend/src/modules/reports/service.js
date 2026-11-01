// Reports service — submit + list + status workflow with recompute + alerts.
const path = require('path');
const fs = require('fs');
const { getPrisma } = require('../../config/prisma');
const { zonesChanged } = require('../../common/events');
const { ApiError } = require('../../common/errors');
const { parsePagination, pageMeta } = require('../../common/pagination');
const { recomputeZone } = require('../hazard-engine/service');
const { invalidateZone } = require('../zones/service');
const { maybeTriggerAlert, resolveAlertsForZone } = require('../alerts/service');

const VALID_TRANSITIONS = { Pending: ['In_Progress'], In_Progress: ['Resolved'], Resolved: [] };
function toApiStatus(dbStatus) { return dbStatus === 'In_Progress' ? 'In Progress' : dbStatus; }
function toDbStatus(apiStatus) { return apiStatus === 'In Progress' ? 'In_Progress' : apiStatus; }

function haversineKm(aLat, aLng, bLat, bLng) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

async function createReport({ userId, zoneId, wasteType, severity, description, imageUrl, lat, lng }) {
  const prisma = getPrisma();
  let zone = zoneId ? await prisma.zone.findUnique({ where: { id: zoneId } }) : null;
  if (zoneId && !zone) throw new ApiError('VALIDATION_ERROR', 'zone_id: zone does not exist', 400, [{ field: 'zone_id', rule: 'exists', message: 'zone_id: zone does not exist' }]);
  if (!zone) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new ApiError('VALIDATION_ERROR', 'Provide zone_id or lat+lng', 400, [{ field: 'zone_id', rule: 'required', message: 'zone_id or lat+lng required' }]);
    }
    const zones = await prisma.zone.findMany({});
    let best = null, bestKm = Infinity;
    for (const z of zones) {
      const km = haversineKm(lat, lng, z.lat, z.lng);
      if (km < bestKm) { bestKm = km; best = z; }
    }
    if (!best || bestKm > 25) throw new ApiError('VALIDATION_ERROR', 'No ward within 25km of this location', 400, [{ field: 'lat', rule: 'nearby', message: 'no ward within 25km' }]);
    zone = best;
    zoneId = best.id;
  }
  const report = await prisma.wasteReport.create({ data: { userId, zoneId, wasteType, severity, description: description || null, imageUrl: imageUrl || null, lat: Number.isFinite(lat) ? lat : null, lng: Number.isFinite(lng) ? lng : null, status: 'Pending' } });
  const { score, level } = await recomputeZone(zoneId);
  await invalidateZone(zoneId);
  zonesChanged(zoneId);
  let alert = null;
  if (score >= 7) alert = await maybeTriggerAlert(zoneId, score, 7.0);
  return { report: { ...report, status: toApiStatus(report.status) }, hazardScore: { score, level }, alert };
}

async function listReports(q, currentUser) {
  const { page, limit, skip } = parsePagination(q);
  const where = {};
  if (q.zone_id) where.zoneId = parseInt(q.zone_id, 10);
  if (q.status) where.status = toDbStatus(q.status);
  if (q.waste_type) where.wasteType = q.waste_type;
  if (q.mine === 'true' || q.mine === true) where.userId = currentUser?.id;
  if (currentUser?.role === 'citizen' && !q.mine) {
    // Citizens see own reports by default on /my-reports; admin sees all. Allow citizen filtered by zone too but scoped:
    if (!where.userId) where.userId = currentUser.id;
  }
  const prisma = getPrisma();
  const [total, items] = await prisma.$transaction([
    prisma.wasteReport.count({ where }),
    prisma.wasteReport.findMany({ where, orderBy: { reportedAt: 'desc' }, skip, take: limit }),
  ]);
  return { items: items.map((r) => ({ ...r, status: toApiStatus(r.status) })), pagination: pageMeta(page, limit, total) };
}

async function getReport(id, currentUser) {
  const r = await getPrisma().wasteReport.findUnique({ where: { id } });
  if (!r) throw new ApiError('NOT_FOUND', 'Report not found', 404);
  if (currentUser?.role === 'citizen' && r.userId !== currentUser.id) throw new ApiError('FORBIDDEN', 'Not your report', 403);
  return { ...r, status: toApiStatus(r.status) };
}

async function updateStatus(id, apiStatus, opts = {}) {
  const dbStatus = toDbStatus(apiStatus);
  if (!['Pending', 'In_Progress', 'Resolved'].includes(dbStatus)) throw new ApiError('VALIDATION_ERROR', 'Invalid status', 400);
  const prisma = getPrisma();
  const existing = await prisma.wasteReport.findUnique({ where: { id } });
  if (!existing) throw new ApiError('NOT_FOUND', 'Report not found', 404);
  const allowed = VALID_TRANSITIONS[existing.status] || [];
  if (existing.status !== dbStatus && !allowed.includes(dbStatus)) {
    throw new ApiError('UNPROCESSABLE', `Cannot transition ${toApiStatus(existing.status)} -> ${apiStatus}`, 422);
  }
  const data = { status: dbStatus };
  if (dbStatus === 'Resolved' && opts.resolvedImageUrl) data.resolvedImageUrl = opts.resolvedImageUrl;
  const updated = await prisma.wasteReport.update({ where: { id }, data });
  const { score, level } = await recomputeZone(updated.zoneId);
  await invalidateZone(updated.zoneId);
  zonesChanged(updated.zoneId);
  if (dbStatus === 'Resolved') await resolveAlertsForZone(updated.zoneId);
  else if (score >= 7) await maybeTriggerAlert(updated.zoneId, score, 7.0);
  return { report: { ...updated, status: toApiStatus(updated.status) }, newScore: { score, level } };
}
module.exports = { createReport, listReports, getReport, updateStatus, toApiStatus, toDbStatus };
