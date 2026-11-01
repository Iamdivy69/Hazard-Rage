// Entry point — validates config fail-fast, then listens.
const config = require('./config');
const { createApp } = require('./app');

process.on('unhandledRejection', (reason, promise) => {
  console.error('[WARN] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[ERROR] Uncaught Exception:', err);
});

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`[INFO] hazard-rage api listening on :${config.port} env=${config.env}`);
});

process.on('SIGTERM', () => {
  console.log('[INFO] SIGTERM signal received: closing HTTP server');
  server.close(() => console.log('[INFO] HTTP server closed'));
});
