// Auth service — owns users. Thin, Prisma-backed.
const bcrypt = require('bcryptjs');
const { getPrisma } = require('../../config/prisma');
const { signToken, toPublicUser } = require('../../common/jwt');
const { ApiError } = require('../../common/errors');

async function register({ name, email, password }) {
  const prisma = getPrisma();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ApiError('CONFLICT', 'Email already registered', 409);
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({ data: { name, email, passwordHash, role: 'citizen' } });
  return { user: toPublicUser(user), token: signToken(user) };
}
async function login({ email, password }) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new ApiError('UNAUTHORIZED', 'Invalid credentials', 401);
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new ApiError('UNAUTHORIZED', 'Invalid credentials', 401);
  return { user: toPublicUser(user), token: signToken(user) };
}
async function me(userId) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError('NOT_FOUND', 'User not found', 404);
  return toPublicUser(user);
}
module.exports = { register, login, me };
