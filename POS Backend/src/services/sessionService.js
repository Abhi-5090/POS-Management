'use strict';

const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const {
  TableSession,
  Table,
  Order,
  SESSION_STATUS,
  TABLE_STATUS,
  ORDER_TYPE,
} = require('../models');
const orderService = require('./orderService');
const { nextSessionCode } = require('./numberingService');
const { emit } = require('../sockets');
const logger = require('../utils/logger');

const SEAT_LABELS = TableSession.SEAT_LABELS || ['A', 'B', 'C', 'D'];

async function _autoHealOrphan(session, table) {
  logger.warn(
    `Auto-closing orphan active session ${session.sessionCode} on free table ${table.number}`,
  );
  session.status = SESSION_STATUS.CLOSED;
  session.closedAt = new Date();
  session.notes = `${session.notes || ''} [auto-closed: orphan]`.trim();
  await session.save();
  try {
    const oldOrder = await Order.findById(session.order);
    if (oldOrder && !oldOrder.isClosed) {
      oldOrder.isClosed = true;
      oldOrder.closedAt = new Date();
      await oldOrder.save();
    }
  } catch (_e) {
    /* best-effort */
  }
}

function normalizeSeatLabel(seat) {
  if (seat === undefined || seat === null || seat === '') return null;
  const up = String(seat).trim().toUpperCase();
  if (!SEAT_LABELS.includes(up)) {
    throw AppError.badRequest(
      `Invalid seat label '${seat}'. Allowed: ${SEAT_LABELS.join(', ')}`,
    );
  }
  return up;
}

/**
 *   All ACTIVE sessions on a table (can be multiple in split mode).
 */
async function getActiveSessionsForTable(tableId) {
  return TableSession.find({
    table: tableId,
    status: SESSION_STATUS.ACTIVE,
  }).sort({ seatLabel: 1, createdAt: 1 });
}

/**
 *   Active session matching a specific seat (or whole-table if
 *   seatLabel is null/omitted). Returns null if no match.
 */
async function getActiveSessionForTable(tableId, seatLabel) {
  const seat = normalizeSeatLabel(seatLabel);
  return TableSession.findOne({
    table: tableId,
    seatLabel: seat,
    status: SESSION_STATUS.ACTIVE,
  });
}

/**
 * Open a new session on a free/reserved table. Rejects if the table
 * already has an active session (enforced by the unique partial index,
 * but we also check here for a friendlier error).
 */
async function openSession({
  tableId,
  seatLabel = null,
  guests = 1,
  notes = '',
  openedBy = null,
}) {
  if (!mongoose.isValidObjectId(tableId)) throw AppError.badRequest('Invalid table id');
  const table = await Table.findById(tableId);
  if (!table) throw AppError.notFound('Table not found');
  if (!table.isActive) throw AppError.unprocessable('Table is inactive');

  const seat = normalizeSeatLabel(seatLabel);

  // Global rule: a table cannot mix a whole-table session with any
  // seat sessions. Look at every active session on this table and
  // decide.
  const activeOnTable = await getActiveSessionsForTable(tableId);
  const wholeExisting = activeOnTable.find((s) => !s.seatLabel);
  const seatExisting = activeOnTable.find((s) => s.seatLabel === seat && seat !== null);
  const anySeatSession = activeOnTable.some((s) => !!s.seatLabel);

  if (seat === null) {
    // Opening whole-table — block if any seat session exists
    if (anySeatSession) {
      const occupiedSeats = activeOnTable
        .map((s) => s.seatLabel)
        .filter(Boolean)
        .sort();
      throw AppError.conflict(
        `Table ${table.number} has seat sessions open (${occupiedSeats.join(', ')}). Close them before opening the whole table.`,
        { occupiedSeats },
      );
    }
    // Normal whole-table conflict path (the existing auto-heal logic).
    if (wholeExisting) {
      const tableAgrees =
        table.status === TABLE_STATUS.OCCUPIED &&
        String(table.currentSession || '') === String(wholeExisting._id);
      if (tableAgrees) {
        throw AppError.conflict('Table already has an active session', {
          sessionId: wholeExisting._id,
          sessionCode: wholeExisting.sessionCode,
        });
      }
      await _autoHealOrphan(wholeExisting, table);
    }
  } else {
    // Opening a specific seat — block if whole-table session active
    if (wholeExisting) {
      throw AppError.conflict(
        `Table ${table.number} is open as a whole (session ${wholeExisting.sessionCode}). Close it before splitting into seats.`,
        { sessionId: wholeExisting._id, sessionCode: wholeExisting.sessionCode },
      );
    }
    // If this specific seat already has an active session, that's the
    // hard conflict — caller should join that order rather than open a
    // duplicate. No auto-heal path here because the seat-level partial
    // unique index guarantees only one active row per (table, seat).
    if (seatExisting) {
      throw AppError.conflict(
        `Seat ${seat} on table ${table.number} is already open.`,
        { sessionId: seatExisting._id, sessionCode: seatExisting.sessionCode },
      );
    }
  }

  const sessionCode = await nextSessionCode();
  const session = await TableSession.create({
    sessionCode,
    table: table._id,
    tableNumber: table.number,
    seatLabel: seat,
    guests,
    notes,
    openedBy,
  });

  const order = await orderService.createOrder({
    type: ORDER_TYPE.DINING,
    session: session._id,
    table: table._id,
    tableNumber: table.number,
    createdBy: openedBy,
  });
  session.order = order._id;
  await session.save();

  // `currentSession` on the table is the "primary" pointer. In split
  // mode we still set it (to the first session to open) purely as a
  // status hint — the frontend reads the full activeSessions[] list
  // from the tables endpoint for seat-aware rendering.
  table.status = TABLE_STATUS.OCCUPIED;
  if (!table.currentSession) table.currentSession = session._id;
  await table.save();

  emit('session_opened', {
    sessionId: session._id,
    sessionCode: session.sessionCode,
    seatLabel: seat,
    tableId: table._id,
    tableNumber: table.number,
    orderId: order._id,
  });

  return { session, order, table };
}

async function getSessionById(sessionId, { populate = false } = {}) {
  if (!mongoose.isValidObjectId(sessionId)) throw AppError.badRequest('Invalid session id');
  let q = TableSession.findById(sessionId);
  if (populate) q = q.populate('order').populate('table');
  const session = await q;
  if (!session) throw AppError.notFound('Session not found');
  return session;
}

/**
 * Re-open a recently closed session (e.g. cashier mistake). The table must
 * not have a different active session in the meantime.
 */
async function reopenSession(sessionId, { reopenedBy = null } = {}) {
  const session = await getSessionById(sessionId);
  if (session.status === SESSION_STATUS.ACTIVE) return session;

  // In split mode, only a clash on the SAME seat is a blocker.
  const active = await getActiveSessionForTable(session.table, session.seatLabel);
  if (active) {
    throw AppError.conflict('Table already has another active session', {
      sessionId: active._id,
    });
  }

  session.status = SESSION_STATUS.ACTIVE;
  session.closedAt = null;
  session.closedBy = null;
  await session.save();

  // Ensure an open order exists; create a new one if previous was closed.
  let order = await orderService.getActiveOrderForSession(session._id);
  if (!order) {
    order = await orderService.createOrder({
      type: ORDER_TYPE.DINING,
      session: session._id,
      table: session.table,
      tableNumber: session.tableNumber,
      createdBy: reopenedBy,
    });
    session.order = order._id;
    session.bill = null;
    await session.save();
  }

  await Table.updateOne(
    { _id: session.table },
    { $set: { status: TABLE_STATUS.OCCUPIED, currentSession: session._id } },
  );

  emit('session_reopened', {
    sessionId: session._id,
    tableId: session.table,
    tableNumber: session.tableNumber,
    orderId: session.order,
  });

  return session;
}

async function closeSession(sessionId, { closedBy = null, billId = null } = {}) {
  const session = await getSessionById(sessionId);
  if (session.status === SESSION_STATUS.CLOSED) return session;

  session.status = SESSION_STATUS.CLOSED;
  session.closedAt = new Date();
  session.closedBy = closedBy;
  if (billId) session.bill = billId;
  await session.save();

  // Close the order first so the "remaining active seats" query is clean.
  if (session.order) {
    const order = await Order.findById(session.order);
    if (order && !order.isClosed) {
      order.isClosed = true;
      order.closedAt = new Date();
      if (billId) order.bill = billId;
      await order.save();
    }
  }

  // Only free the table if NO other active sessions remain. In split
  // mode with multiple seats occupied, closing one seat keeps the
  // table occupied.
  const otherActive = await TableSession.findOne({
    _id: { $ne: session._id },
    table: session.table,
    status: SESSION_STATUS.ACTIVE,
  });
  if (!otherActive) {
    await Table.updateOne(
      { _id: session.table },
      { $set: { status: TABLE_STATUS.FREE, currentSession: null } },
    );
  } else {
    // Table stays occupied; if currentSession pointed at us, pick another
    // active seat as the pointer.
    await Table.updateOne(
      { _id: session.table, currentSession: session._id },
      { $set: { currentSession: otherActive._id } },
    );
  }

  emit('session_closed', {
    sessionId: session._id,
    seatLabel: session.seatLabel,
    tableId: session.table,
    tableNumber: session.tableNumber,
    tableFreed: !otherActive,
    billId: billId || session.bill || null,
  });

  return session;
}

/**
 *   openAndDispatch({ tableId, guests, notes, items, createdBy })
 *
 * Commits a dining order in a single call:
 *   1. open session + create order + mark table occupied
 *   2. add all items to the order
 *   3. dispatch the first KOT to the kitchen
 *
 * Used by the new workflow where tapping a free table only opens a
 * *local* draft on the tablet — the backend only ever hears about the
 * order when the cashier hits "Send to Kitchen" for the first time.
 *
 * If anything past step (1) fails, we roll back the session + table so
 * the user isn't left with a half-open, occupied table.
 */
async function openAndDispatch({
  tableId,
  seatLabel = null,
  guests = 1,
  notes = '',
  items,
  createdBy = null,
}) {
  if (!Array.isArray(items) || items.length === 0) {
    throw AppError.badRequest('At least one item is required');
  }

  // Lazy require to avoid a cycle at load time.
  const kotService = require('./kotService');

  const opened = await openSession({
    tableId,
    seatLabel,
    guests,
    notes,
    openedBy: createdBy,
  });
  try {
    for (const it of items) {
      await orderService.addItem(opened.order._id, {
        menuItemId: it.menuItemId,
        quantity: it.quantity,
        notes: it.notes,
        addedBy: createdBy,
      });
    }
    const { order, kot } = await kotService.sendToKitchen(opened.order._id, { createdBy });
    return { session: opened.session, order, kot, table: opened.table };
  } catch (err) {
    // Best-effort rollback: close the session + free the table so the
    // user can retry cleanly rather than being stuck on an "occupied"
    // empty table.
    try {
      await closeSession(opened.session._id, { closedBy: createdBy });
    } catch (_e) {
      /* swallow */
    }
    throw err;
  }
}

async function listActiveSessions() {
  return TableSession.find({ status: SESSION_STATUS.ACTIVE })
    .populate('table', 'number displayName section')
    .populate('order')
    .sort({ createdAt: 1 });
}

/**
 *   One-shot table ↔ session consistency reconciliation.
 *
 *   Sweeps both directions of the inconsistency:
 *
 *     1. Tables marked `occupied` whose `currentSession` doesn't point
 *        at an active TableSession  →  flip the table to `free`.
 *     2. Active TableSessions whose linked Table is not `occupied` or
 *        whose `currentSession` points elsewhere:
 *          - If the session's order has non-cancelled items, re-attach
 *            the table (mark it occupied with this session) so the
 *            cashier can continue billing. Non-destructive.
 *          - If the order is empty / closed, close the session as
 *            an orphan.
 *
 *   Run at boot and on-demand via `POST /sessions/reconcile`.
 */
async function reconcileTables({ logger: log } = {}) {
  const report = { occupiedScanned: 0, orphanSessionsScanned: 0, fixed: 0 };

  // Direction 1: occupied table with no active session
  const occupied = await Table.find({ status: TABLE_STATUS.OCCUPIED });
  report.occupiedScanned = occupied.length;
  for (const t of occupied) {
    const active = t.currentSession
      ? await TableSession.findOne({
          _id: t.currentSession,
          status: SESSION_STATUS.ACTIVE,
        })
      : null;
    if (!active) {
      await Table.updateOne(
        { _id: t._id },
        { $set: { status: TABLE_STATUS.FREE, currentSession: null } },
      );
      report.fixed += 1;
      (log || logger).info(
        `reconciled table ${t.number}: occupied → free (no active session)`,
      );
    }
  }

  // Direction 2 & 3: active sessions that are actually dead
  const activeSessions = await TableSession.find({
    status: SESSION_STATUS.ACTIVE,
  }).populate('order');
  report.orphanSessionsScanned = activeSessions.length;

  const { Bill, BILL_STATUS } = require('../models');

  for (const s of activeSessions) {
    const table = s.table ? await Table.findById(s.table) : null;
    const tableOk =
      table &&
      table.status === TABLE_STATUS.OCCUPIED &&
      String(table.currentSession || '') === String(s._id);

    // ── Direction 3 ─────────────────────────────────────────
    // Session looks consistent with the table, BUT the order
    // behind it is closed AND its bill is cancelled/refunded.
    // The session is a zombie — cashier can't add items, can't
    // bill. Close it and free the table.
    if (tableOk && s.order && s.order.isClosed) {
      const bill = s.order.bill
        ? await Bill.findById(s.order.bill, { status: 1 })
        : null;
      const terminalBill =
        bill &&
        (bill.status === BILL_STATUS.CANCELLED ||
          bill.status === BILL_STATUS.REFUNDED);
      // No bill at all + closed order also qualifies as dead.
      const noBillButClosed = !s.order.bill && s.order.isClosed;

      if (terminalBill || noBillButClosed) {
        s.status = SESSION_STATUS.CLOSED;
        s.closedAt = new Date();
        s.notes = `${s.notes || ''} [auto-closed: order closed, bill ${
          bill ? bill.status.toLowerCase() : 'missing'
        }]`.trim();
        await s.save();
        if (table) {
          await Table.updateOne(
            { _id: table._id, currentSession: s._id },
            { $set: { status: TABLE_STATUS.FREE, currentSession: null } },
          );
        }
        report.fixed += 1;
        (log || logger).info(
          `reconciled session ${s.sessionCode}: closed zombie (order closed, bill ${
            bill ? bill.status : 'missing'
          }); freed table ${table?.number || '?'}`,
        );
        continue;
      }
    }
    if (tableOk) continue;

    // ── Direction 2 (orphan session, table disagrees) ───────
    const hasItems =
      s.order &&
      Array.isArray(s.order.items) &&
      s.order.items.some((i) => i.status !== 'CANCELLED');

    if (table && hasItems) {
      // Re-attach — the session has live items, let the cashier finish it.
      await Table.updateOne(
        { _id: table._id },
        {
          $set: {
            status: TABLE_STATUS.OCCUPIED,
            currentSession: s._id,
          },
        },
      );
      report.fixed += 1;
      (log || logger).info(
        `reconciled session ${s.sessionCode}: re-attached table ${table.number} (session has items)`,
      );
    } else {
      // Orphan — close it.
      s.status = SESSION_STATUS.CLOSED;
      s.closedAt = new Date();
      s.notes = `${s.notes || ''} [auto-closed: orphan]`.trim();
      await s.save();
      if (s.order) {
        try {
          const ord = await Order.findById(s.order);
          if (ord && !ord.isClosed) {
            ord.isClosed = true;
            ord.closedAt = new Date();
            await ord.save();
          }
        } catch (_e) {
          /* best-effort */
        }
      }
      report.fixed += 1;
      (log || logger).info(
        `reconciled session ${s.sessionCode}: closed orphan (table state mismatch${
          hasItems ? ', no table' : ', no items'
        })`,
      );
    }
  }

  return {
    scanned: report.occupiedScanned + report.orphanSessionsScanned,
    fixed: report.fixed,
    ...report,
  };
}

module.exports = {
  openSession,
  openAndDispatch,
  reopenSession,
  closeSession,
  getSessionById,
  getActiveSessionForTable,
  getActiveSessionsForTable,
  listActiveSessions,
  reconcileTables,
  SEAT_LABELS,
};
