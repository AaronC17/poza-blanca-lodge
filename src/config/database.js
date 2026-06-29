const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const config = require('../config/env');

let db = null;

function getDb() {
  if (db) return db;

  const dataDir = path.dirname(config.dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(config.dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  return db;
}

function initSchema() {
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name          TEXT NOT NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS passes (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      cedula            TEXT NOT NULL,
      nombre            TEXT NOT NULL,
      telefono          TEXT,
      correo            TEXT,
      cantidad_personas INTEGER NOT NULL DEFAULT 1,
      placa_vehiculo    TEXT,
      fecha             TEXT NOT NULL,
      hora_entrada      TEXT,
      hora_salida       TEXT,
      monto             REAL NOT NULL DEFAULT 0,
      estado_pago       TEXT NOT NULL DEFAULT 'pagado',
      observaciones     TEXT,
      creado_por        INTEGER,
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
      tipo_pase         TEXT NOT NULL DEFAULT 'rio',
      forma_pago        TEXT NOT NULL DEFAULT 'efectivo',
      adultos           INTEGER NOT NULL DEFAULT 1,
      ninos             INTEGER NOT NULL DEFAULT 0,
      parqueos          INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (creado_por) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_passes_fecha ON passes(fecha);
    CREATE INDEX IF NOT EXISTS idx_passes_cedula ON passes(cedula);
    CREATE INDEX IF NOT EXISTS idx_passes_estado_pago ON passes(estado_pago);
    CREATE INDEX IF NOT EXISTS idx_passes_tipo_pase ON passes(tipo_pase);

    CREATE TABLE IF NOT EXISTS email_logs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      pass_id    INTEGER,
      to_address TEXT NOT NULL,
      subject    TEXT,
      status     TEXT NOT NULL,
      error      TEXT,
      sent_at    TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (pass_id) REFERENCES passes(id) ON DELETE SET NULL
    );
  `);

  // Migración para BDs existentes: agregar columnas nuevas
  const newColumns = [
    { table: 'passes', column: 'tipo_pase', definition: "TEXT NOT NULL DEFAULT 'rio'" },
    { table: 'passes', column: 'forma_pago', definition: "TEXT NOT NULL DEFAULT 'efectivo'" },
    { table: 'passes', column: 'adultos', definition: "INTEGER NOT NULL DEFAULT 1" },
    { table: 'passes', column: 'ninos', definition: "INTEGER NOT NULL DEFAULT 0" },
    { table: 'passes', column: 'parqueos', definition: "INTEGER NOT NULL DEFAULT 0" },
  ];

  for (const { table, column, definition } of newColumns) {
    try {
      database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    } catch (e) {
      // Column already exists, ignore
    }
  }
}

module.exports = { getDb, initSchema };
