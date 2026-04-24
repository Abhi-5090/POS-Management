'use strict';

const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    format.json(),
  ),
  defaultMeta: { service: 'pos-backend' },
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf((info) => {
          const { level, message, timestamp, service, stack, ...meta } = info;
          // Drop the default `service` field but keep every other meta key.
          const keys = Object.keys(meta);
          const metaStr = keys.length ? ` ${JSON.stringify(meta)}` : '';
          const stackStr = stack ? `\n${stack}` : '';
          return `${timestamp} [${level}] ${message}${metaStr}${stackStr}`;
        }),
      ),
    }),
  ],
});

module.exports = logger;
