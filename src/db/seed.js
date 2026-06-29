const bcrypt = require('bcryptjs');
const { getDb, initSchema } = require('../config/database');
const config = require('../config/env');

function seedAdmin() {
  const db = getDb();
  initSchema();

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(config.admin.username);

  if (existing) {
    console.log(`[seed] El usuario "${config.admin.username}" ya existe. Se omite la creación.`);
    return;
  }

  const hash = bcrypt.hashSync(config.admin.password, 10);
  db.prepare(
    'INSERT INTO users (username, password_hash, name) VALUES (?, ?, ?)'
  ).run(config.admin.username, hash, config.admin.name);

  console.log(`[seed] Usuario administrador "${config.admin.username}" creado correctamente.`);
  console.log(`[seed] Contraseña: la definida en .env (ADMIN_PASSWORD).`);
}

if (require.main === module) {
  seedAdmin();
  process.exit(0);
}

module.exports = { seedAdmin };
