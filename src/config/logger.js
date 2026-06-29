const pino = require('pino');
const config = require('../config/env');

const logger = pino({
  level: process.env.LOG_LEVEL || (config.isProd ? 'info' : 'debug'),
  base: { app: 'camping-daypass', env: config.env },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(config.isProd
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname,app,env' },
        },
      }),
});

module.exports = logger;
