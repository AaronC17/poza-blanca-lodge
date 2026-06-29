const bcrypt = require('bcryptjs');
const { getDb } = require('../config/database');

function authenticate(username, password) {
  const db = getDb();
  const user = db.prepare('SELECT id, username, password_hash, name FROM users WHERE username = ?').get(username);

  if (!user) return null;
  if (!bcrypt.compareSync(password, user.password_hash)) return null;

  return { id: user.id, username: user.username, name: user.name };
}

function getCurrentUser(userId) {
  const db = getDb();
  const user = db
    .prepare('SELECT id, username, name FROM users WHERE id = ?')
    .get(userId);
  return user || null;
}

module.exports = { authenticate, getCurrentUser };
