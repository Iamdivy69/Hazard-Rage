// Full Express app — thin wiring only. Business logic lives in services.
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const crypto = require('crypto');
const path = require('path');
const config = require('./config');
const { getPrisma } = require('./config/prisma');
const { pingRedis } = require('./config/redis');
const { ok, fail } = require('./common/errors');

function createApp() {
  const app = express();
  app.set('trust proxy', 1); // Render terminates TLS upstream; correct req.ip for throttling
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: config.frontendUrl }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
  app.use('/uploads', express.static(path.join(__dirname, '..', '..', 'uploads')));
  app.use(morgan('tiny'));

  app.use((req, res, next) => {
    res.locals.requestId = req.headers['x-request-id'] || crypto.randomUUID();
    res.setHeader('x-request-id', res.locals.requestId);
    next();
  });

  app.get('/api/v1/health', async (req, res) => {
    let postgres = false, postgis = false;
    try {
      await getPrisma().$queryRaw`SELECT 1`;
      postgres = true;
      try {
        const rows = await getPrisma().$queryRaw`SELECT extname FROM pg_extension WHERE extname='postgis'`;
        postgis = Array.isArray(rows) && rows.length > 0;
      } catch { postgis = false; }
    } catch { postgres = false; }
    const redis = await pingRedis();
    return ok(res, { ok: postgres, postgres, postgis, redis });
  });

  app.use('/api/v1/auth', require('./modules/auth/routes'));
  app.use('/api/v1/events', require('./modules/events/routes'));
  app.use('/api/v1/tiles', require('./modules/tiles/routes'));
  app.use('/api/v1/map', require('./modules/tiles/routes'));
  app.use('/api/v1/cities', require('./modules/cities/routes'));
  app.use('/api/v1/stats', require('./modules/stats/routes'));
  app.use('/api/v1/zones', require('./modules/zones/routes'));
  app.use('/api/v1/reports', require('./modules/reports/routes'));
  app.use('/api/v1/alerts', require('./modules/alerts/routes'));
  app.use('/api/v1/remediation', require('./modules/remediation/routes'));
  app.use('/api/v1/hazard', require('./modules/hazard-engine/routes'));
  app.use('/api/v1/exports', require('./modules/exports/routes'));

  app.use('/api', (req, res) => fail(res, Object.assign(new Error('Not found'), { status: 404, code: 'NOT_FOUND' })));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (!err.status) console.error(`[ERROR][${res.locals.requestId}]`, err);
    return fail(res, err);
  });
  return app;
}
module.exports = { createApp };
