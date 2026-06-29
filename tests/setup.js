process.env.NODE_ENV = 'test';
process.env.MONGODB_DB_NAME = process.env.MONGODB_DB_NAME_TEST || 'poza_blanca_test';
process.env.SESSION_SECRET = 'test-secret';
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'testpass123';
process.env.ADMIN_NAME = 'Admin Test';
process.env.LOG_LEVEL = 'error';
process.env.APP_URL = 'http://localhost:3000';

const { connectDb, Pass, User, EmailLog } = require('../src/config/database');

async function clearAll() {
  await Promise.all([
    Pass.deleteMany({}),
    User.deleteMany({}),
    EmailLog.deleteMany({}),
  ]);
}

beforeAll(async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI debe estar definida en .env para correr los tests (usa Atlas o local).');
  }
  await connectDb();
  await clearAll();
});

afterAll(async () => {
  const mongoose = require('mongoose');
  try {
    await clearAll();
    await mongoose.connection.close();
  } catch (e) {}
});

module.exports = { clearAll };
