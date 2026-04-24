'use strict';

const http = require('http');
const config = require('./src/config/env');
const { connectDatabase, disconnectDatabase } = require('./src/config/database');
const buildApp = require('./src/app');
const sockets = require('./src/sockets');
const sessionService = require('./src/services/sessionService');
const { Table, TableSession } = require('./src/models');
const logger = require('./src/utils/logger');

async function main() {
  await connectDatabase();

  // Sync Table indexes — make sure the live DB matches the current
  // schema. The old non-partial `number_1` unique index (created by
  // an earlier schema definition) conflicts with the new partial-unique
  // one, so we drop it by name before syncing if it exists.
  try {
    const existing = await Table.collection
      .indexes()
      .catch(() => []);
    const legacy = existing.find(
      (i) =>
        i.name === 'number_1' && !i.partialFilterExpression,
    );
    if (legacy) {
      await Table.collection.dropIndex('number_1');
      logger.info('Dropped legacy Table index: number_1');
    }
    await Table.syncIndexes();
  } catch (err) {
    logger.warn('Table.syncIndexes failed', { err: err.message });
  }

  // Sync TableSession indexes — the old "one active session per table"
  // index (key `{table: 1, status: 1}`) must be dropped in favour of
  // the new seat-aware one (`{table: 1, seatLabel: 1, status: 1}`) so
  // split-table mode can have multiple active sessions per table.
  try {
    const existing = await TableSession.collection.indexes().catch(() => []);
    const legacy = existing.find(
      (i) =>
        !i.partialFilterExpression?.seatLabel && // the new one has seatLabel
        JSON.stringify(i.key) === JSON.stringify({ table: 1, status: 1 }),
    );
    if (legacy) {
      await TableSession.collection.dropIndex(legacy.name);
      logger.info(`Dropped legacy TableSession index: ${legacy.name}`);
    }
    await TableSession.syncIndexes();
  } catch (err) {
    logger.warn('TableSession.syncIndexes failed', { err: err.message });
  }

  // Unstick any tables left marked `occupied` without an active session
  // (from crashes or pre-fix DB state). Always safe to run.
  try {
    const r = await sessionService.reconcileTables({ logger });
    if (r.fixed > 0) {
      logger.info(`table reconcile: scanned=${r.scanned} fixed=${r.fixed}`);
    }
  } catch (err) {
    logger.warn('table reconcile skipped', { err: err.message });
  }

  const app = buildApp();
  const server = http.createServer(app);
  sockets.init(server, { corsOrigin: config.corsOrigin });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(
        `Port ${config.port} is already in use. ` +
        `On macOS, :5000 is reserved by AirPlay Receiver (System Settings → General → AirDrop & Handoff). ` +
        `Set a different PORT in .env, or stop the other process (lsof -i:${config.port}).`,
      );
    } else {
      logger.error('HTTP server error', { err: err.stack || err.message });
    }
    process.exit(1);
  });

  server.listen(config.port, () => {
    logger.info(`POS backend listening on :${config.port} (env=${config.env})`);
    logger.info(`API base: ${config.apiPrefix}`);
    logger.info(`Printer mode: ${config.printer.mode}`);
  });

  // Graceful shutdown — critical for nodemon's restart cycle: without
  // this the new `node server.js` hits `EADDRINUSE` because the old
  // process's socket is still bound.
  //
  //   1. Stop accepting new connections (server.close).
  //   2. Tear down Socket.IO — its long-lived websocket clients are
  //      the main reason HTTP close hangs.
  //   3. Cap the whole thing with a hard 2.5s deadline so a stuck
  //      socket can never block restart.
  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Received ${signal}, shutting down…`);

    const forceExit = setTimeout(() => {
      logger.warn('Force-exit: close timed out');
      process.exit(0);
    }, 2500);
    forceExit.unref();

    try {
      const io = sockets.getIO();
      if (io) {
        io.disconnectSockets(true);
        io.close();
      }
    } catch {
      /* socket.io not initialized — fine */
    }

    await Promise.race([
      new Promise((resolve) => server.close(resolve)),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);
    logger.info('HTTP server closed');

    try {
      await disconnectDatabase();
    } catch (err) {
      logger.error('Error closing DB', { err: err.message });
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGHUP', () => shutdown('SIGHUP'));
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection', { reason: reason?.stack || String(reason) });
  });
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception', { err: err.stack || err.message });
    process.exit(1);
  });
}

main().catch((err) => {
  logger.error('Startup failed', { err: err.stack || err.message });
  process.exit(1);
});
