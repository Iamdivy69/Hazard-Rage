// JWT helpers — no business logic.
const jwt = require('jsonwebtoken');
const config = require('../config');

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}
function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}
function toPublicUser(u) {
  if (!u) return null;
  return { id: u.id, name: u.name, email: u.email, role: u.role, created_at: u.createdAt };
}
module.exports = { signToken, verifyToken, toPublicUser };
