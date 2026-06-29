const { connectDb, User, Pass } = require('../config/database');
const { seedAdmin } = require('./seed');

async function initDatabase() {
  await connectDb();
  console.log('[db] Conexión y esquema MongoDB listos (Mongoose crea índices al primer uso).');

  await seedAdmin();

  const [users, passes] = await Promise.all([
    User.countDocuments(),
    Pass.countDocuments(),
  ]);
  console.log(`[db] Estado: ${users} usuario(s), ${passes} pase(s).`);
}

if (require.main === module) {
  initDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[db] Error en initDatabase:', err);
      process.exit(1);
    });
}

module.exports = { initDatabase };
