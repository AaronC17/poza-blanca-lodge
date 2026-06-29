const path = require('path');
const fs = require('fs');
const os = require('os');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'poza-test-'));
const dbPath = path.join(tmpDir, 'test.db');

process.env.NODE_ENV = 'test';
process.env.DB_PATH = dbPath;
process.env.SESSION_SECRET = 'test-secret';
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'testpass123';
process.env.ADMIN_NAME = 'Admin Test';
process.env.LOG_LEVEL = 'error';
process.env.APP_URL = 'http://localhost:3000';

afterAll(() => {
  try {
    const { getDb } = require('../src/config/database');
    const db = getDb();
    if (db && db.open) db.close();
  } catch (e) {}
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (e) {}
});
