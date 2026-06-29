const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const env = process.env.NODE_ENV || 'development';

const config = {
  env,
  isProd: env === 'production',
  port: parseInt(process.env.PORT, 10) || 3000,
  sessionSecret: process.env.SESSION_SECRET || 'cambia-esto-por-una-clave-secreta',

  mongodbUri: process.env.MONGODB_URI || '',
  mongodbDbName: process.env.MONGODB_DB_NAME || 'poza_blanca',

  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
    name: process.env.ADMIN_NAME || 'Administrador',
  },

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT, 10) || 465,
    secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    fromName: process.env.SMTP_FROM_NAME || 'Camping Hotel - Recepción',
    fromAddress: process.env.SMTP_FROM_ADDRESS || process.env.SMTP_USER || '',
  },

  appUrl: process.env.APP_URL || 'http://localhost:3000',

  timezone: process.env.APP_TIMEZONE || 'America/Costa_Rica',
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX, 10) || 300,
};

module.exports = config;
