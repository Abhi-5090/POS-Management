'use strict';

const { Server } = require('socket.io');
const { verifyToken } = require('../middleware/auth');
const { User } = require('../models');
const logger = require('../utils/logger');
const { ROOMS, EVENTS } = require('./events');

let io = null;

/**
 * Rooms model:
 *   counter      – cashiers / managers (all billing + order updates)
 *   kitchen      – kitchen display(s)  (all KOT events)
 *   kitchen:<station> – per-station kitchen screens
 *   waiter       – waiter tablets
 *   admin        – admin dashboards
 *
 * Every authenticated client joins the room(s) that match its role, plus
 * the station rooms supplied in handshake.auth.stations (kitchen only).
 */
function init(server, { corsOrigin = '*' } = {}) {
  io = new Server(server, {
    cors: { origin: corsOrigin, credentials: true },
    transports: ['websocket', 'polling'],
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('AUTH_REQUIRED'));

      const payload = verifyToken(token);
      const user = await User.findById(payload.sub);
      if (!user || !user.isActive) return next(new Error('AUTH_INVALID'));

      socket.user = { id: user._id.toString(), role: user.role, name: user.name };
      next();
    } catch (err) {
      next(new Error('AUTH_FAILED'));
    }
  });

  io.on('connection', (socket) => {
    const role = socket.user.role;
    socket.join(`user:${socket.user.id}`);
    socket.join(`role:${role}`);

    if (role === 'cashier' || role === 'admin') socket.join(ROOMS.COUNTER);
    if (role === 'kitchen' || role === 'admin') socket.join(ROOMS.KITCHEN);
    if (role === 'waiter' || role === 'admin') socket.join(ROOMS.WAITER);
    if (role === 'admin') socket.join(ROOMS.ADMIN);

    const stations = socket.handshake.auth?.stations || [];
    if (Array.isArray(stations)) {
      for (const s of stations) socket.join(`${ROOMS.KITCHEN}:${String(s).toLowerCase()}`);
    }

    logger.info(`Socket connected: ${socket.id} user=${socket.user.name} role=${role}`);

    // ── Kitchen-side client actions ────────────────────────────────
    socket.on(EVENTS.KOT_ACK, ({ kotId }) => {
      socket.to(ROOMS.COUNTER).emit(EVENTS.KOT_ACK, {
        kotId,
        at: new Date(),
        by: socket.user,
      });
    });

    // Client-initiated heartbeat for low-latency monitoring.
    socket.on('ping:pos', (_payload, ack) => ack?.({ ok: true, at: Date.now() }));

    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

/**
 * Route events to the correct room(s) based on event type. If Socket.IO
 * isn't initialized yet (e.g. during unit tests) this is a no-op.
 */
function emit(event, payload = {}) {
  if (!io) return;

  switch (event) {
    case EVENTS.NEW_KOT: {
      io.to(ROOMS.KITCHEN).emit(EVENTS.NEW_KOT, payload);
      io.to(ROOMS.COUNTER).emit(EVENTS.NEW_KOT, payload);
      const stations = payload?.kot?.stations || [];
      for (const s of stations) {
        io.to(`${ROOMS.KITCHEN}:${String(s).toLowerCase()}`).emit(EVENTS.NEW_KOT, payload);
      }
      break;
    }
    case EVENTS.ORDER_UPDATED:
      io.to(ROOMS.COUNTER).emit(event, payload);
      io.to(ROOMS.WAITER).emit(event, payload);
      io.to(ROOMS.KITCHEN).emit(event, payload);
      break;

    case EVENTS.BILL_GENERATED:
    case EVENTS.BILL_SETTLED:
    case EVENTS.BILL_CANCELLED:
    case EVENTS.BILL_PRINT_FAILED:
      io.to(ROOMS.COUNTER).emit(event, payload);
      io.to(ROOMS.ADMIN).emit(event, payload);
      break;

    case EVENTS.SESSION_OPENED:
    case EVENTS.SESSION_CLOSED:
    case EVENTS.SESSION_REOPENED:
      io.to(ROOMS.COUNTER).emit(event, payload);
      io.to(ROOMS.WAITER).emit(event, payload);
      break;

    case EVENTS.KOT_PRINT_FAILED:
    case EVENTS.KOT_DELETED:
      io.to(ROOMS.COUNTER).emit(event, payload);
      io.to(ROOMS.KITCHEN).emit(event, payload);
      break;

    default:
      io.emit(event, payload);
  }
}

module.exports = { init, getIO, emit, EVENTS, ROOMS };
