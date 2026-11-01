// Hazard Rage config — validates env fail-fast per architecture.
// No business logic here. Only env parsing + clients.

require('dotenv').config();
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '..', '.env') });

function required(name, fallback) {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') {
    throw new Error(`Missing required env: ${name}. See .env.example`);
  }
  return v;
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  databaseUrl: required('DATABASE_URL'),
  redisUrl: required('REDIS_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  cacheTtlSec: parseInt(process.env.CACHE_TTL || '60', 10),
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.ALERT_FROM_EMAIL || 'Hazard Rage <alerts@example.com>',
  },
};

module.exports = config;
