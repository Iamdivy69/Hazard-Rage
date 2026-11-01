const express = require('express');
const { asyncHandler } = require('../../common/errors');
const { authenticate } = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const { getPrisma } = require('../../config/prisma');

const router = express.Router();
// Streams CSV via Postgres cursor (findMany pages) — works Redis-down (bypass by design).
router.get('/reports.csv', authenticate, authorize('municipal_admin', 'system_admin'), asyncHandler(async (req, res) => {
  const prisma = getPrisma();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="reports.csv"');
  res.write('id,zone_id,user_id,waste_type,severity,status,reported_at,description\n');
  const pageSize = 200;
  let skip = 0;
  for (;;) {
    const rows = await prisma.wasteReport.findMany({ orderBy: { id: 'asc' }, skip, take: pageSize });
    if (!rows.length) break;
    for (const r of rows) {
      const desc = `"${(r.description || '').replace(/"/g, '""')}"`;
      res.write(`${r.id},${r.zoneId},${r.userId},${r.wasteType},${r.severity},${r.status},${r.reportedAt.toISOString()},${desc}\n`);
    }
    skip += rows.length;
    if (rows.length < pageSize) break;
  }
  res.end();
}));
module.exports = router;
