const { getDb, initSchema } = require('../config/database');
const { seedAdmin } = require('./seed');

function initDatabase() {
  const db = getDb();
  initSchema();
  console.log('[db] Esquema inicializado correctamente.');

  seedAdmin();

  const counts = {
    users: db.prepare('SELECT COUNT(*) as c FROM users').get().c,
    passes: db.prepare('SELECT COUNT(*) as c FROM passes').get().c,
  };
  console.log(`[db] Estado: ${counts.users} usuario(s), ${counts.passes} pase(s).`);
}

if (require.main === module) {
  initDatabase();
  process.exit(0);
}

module.exports = { initDatabase };
