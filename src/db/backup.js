const path = require('path');
const fs = require('fs');
const { connectDb, User, Pass, EmailLog } = require('../config/database');
const logger = require('../config/logger');

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function backup(dest) {
  await connectDb();
  const backupDir = path.resolve(process.cwd(), 'data', 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const target = dest || path.join(backupDir, `poza-${timestamp()}.json`);

  const [users, passes, emailLogs] = await Promise.all([
    User.find().lean(),
    Pass.find().lean(),
    EmailLog.find().lean(),
  ]);

  const dump = {
    exported_at: new Date().toISOString(),
    counts: { users: users.length, passes: passes.length, email_logs: emailLogs.length },
    users,
    passes,
    email_logs: emailLogs,
  };

  fs.writeFileSync(target, JSON.stringify(dump, null, 2));
  const size = fs.statSync(target).size;
  logger.info({ target, size }, 'Backup completado');
  console.log(`Backup creado: ${target} (${(size / 1024).toFixed(1)} KB)`);
  console.log(`  ${users.length} usuario(s), ${passes.length} pase(s), ${emailLogs.length} log(s) de email.`);
  return target;
}

async function restore(source) {
  if (!source || !fs.existsSync(source)) {
    throw new Error(`Archivo de backup no encontrado: ${source}`);
  }
  await connectDb();

  const dump = JSON.parse(fs.readFileSync(source, 'utf8'));
  if (!dump || !Array.isArray(dump.passes)) {
    throw new Error('El archivo no parece ser un backup válido (falta array "passes").');
  }

  // Restauración destructiva: limpia colecciones y reinserta.
  // Solo _id vendrán del dump; Mongoose respetará los _id existentes.
  await Promise.all([
    User.deleteMany({}),
    Pass.deleteMany({}),
    EmailLog.deleteMany({}),
  ]);

  if (dump.users && dump.users.length) await User.insertMany(dump.users);
  if (dump.passes && dump.passes.length) await Pass.insertMany(dump.passes);
  if (dump.email_logs && dump.email_logs.length) await EmailLog.insertMany(dump.email_logs);

  logger.info({ source }, 'Restore completado');
  console.log(`Restore completado desde: ${source}`);
  console.log(`  ${dump.users?.length || 0} usuario(s), ${dump.passes?.length || 0} pase(s), ${dump.email_logs?.length || 0} log(s).`);
}

module.exports = { backup, restore };

async function main() {
  const cmd = process.argv[2];
  try {
    if (cmd === 'restore') {
      await restore(process.argv[3]);
    } else {
      await backup(process.argv[3]);
    }
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
