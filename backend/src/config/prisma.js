// Prisma singleton — single source of truth for Postgres.
const { PrismaClient } = require('@prisma/client');

let prisma;
function getPrisma() {
  if (!prisma) {
    prisma = new PrismaClient({ log: ['warn', 'error'] });
  }
  return prisma;
}

module.exports = { getPrisma };
