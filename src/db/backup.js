const path = require('path');
const fs = require('fs');
const { getDb } = require('../config/database');
const config = require('../config/env');
const logger = require('../config/logger');

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function backup(dest) {
  const db = getDb();
  const backupDir = path.resolve(process.cwd(), 'data', 'backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const target = dest || path.join(backupDir, `camping-${timestamp()}.db`);
  await db.backup(target);

  const size = fs.statSync(target).size;
  logger.info({ target, size }, 'Backup completado');
  console.log(`Backup creado: ${target} (${(size / 1024).toFixed(1)} KB)`);
  return target;
}

function restore(source) {
  if (!source || !fs.existsSync(source)) {
    throw new Error(`Archivo de backup no encontrado: ${source}`);
  }

  const dbPath = config.dbPath;
  const dir = path.dirname(dbPath);
  const safetyBackup = path.join(dir, `pre-restore-${timestamp()}.db`);

  const db = getDb();
  if (db.open) db.close();

  if (fs.existsSync(dbPath)) {
    fs.copyFileSync(dbPath, safetyBackup);
    fs.unlinkSync(dbPath);
  }

  ['-wal', '-shm'].forEach((ext) => {
    if (fs.existsSync(dbPath + ext)) fs.unlinkSync(dbPath + ext);
  });

  fs.copyFileSync(source, dbPath);

  logger.info({ source, safetyBackup }, 'Restore completado');
  console.log(`Restore completado desde: ${source}`);
  console.log(`Backup de seguridad previo: ${safetyBackup}`);
  return safetyBackup;
}

module.exports = { backup, restore };

async function main() {
  const cmd = process.argv[2];
  try {
    if (cmd === 'restore') {
      restore(process.argv[3]);
    } else {
      await backup(process.argv[3]);
    }
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
