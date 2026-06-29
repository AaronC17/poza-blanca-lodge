const bcrypt = require('bcryptjs');
const { connectDb, User } = require('../config/database');
const config = require('../config/env');

async function seedAdmin() {
  await connectDb();

  const existing = await User.findOne({ username: config.admin.username }).lean();

  if (existing) {
    console.log(`[seed] El usuario "${config.admin.username}" ya existe. Se omite la creación.`);
    return;
  }

  const hash = bcrypt.hashSync(config.admin.password, 10);
  await User.create({
    username: config.admin.username,
    password_hash: hash,
    name: config.admin.name,
  });

  console.log(`[seed] Usuario administrador "${config.admin.username}" creado correctamente.`);
  console.log(`[seed] Contraseña: la definida en .env (ADMIN_PASSWORD).`);
}

if (require.main === module) {
  seedAdmin()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[seed] Error:', err);
      process.exit(1);
    });
}

module.exports = { seedAdmin };
