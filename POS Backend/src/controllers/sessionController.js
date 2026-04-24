'use strict';

const sessionService = require('../services/sessionService');

async function openSession(req, res) {
  const { tableId, seatLabel, guests, notes } = req.body;
  const result = await sessionService.openSession({
    tableId,
    seatLabel,
    guests,
    notes,
    openedBy: req.user._id,
  });
  res.status(201).json({ success: true, data: result });
}

/**
 *   POST /sessions/commit
 *
 * Atomic "start dining order" — opens a session on a free table AND
 * ships the first KOT in one call. Used by the tablet UI when the
 * cashier hits "Send to Kitchen" on a table they've only been browsing
 * in draft mode (the table stays marked free until this call lands).
 */
async function openAndDispatch(req, res) {
  const { tableId, seatLabel, guests, notes, items } = req.body;
  const result = await sessionService.openAndDispatch({
    tableId,
    seatLabel,
    guests,
    notes,
    items,
    createdBy: req.user._id,
  });
  res.status(201).json({ success: true, data: result });
}

async function reopenSession(req, res) {
  const session = await sessionService.reopenSession(req.params.id, {
    reopenedBy: req.user._id,
  });
  res.json({ success: true, data: session });
}

async function closeSession(req, res) {
  const session = await sessionService.closeSession(req.params.id, {
    closedBy: req.user._id,
  });
  res.json({ success: true, data: session });
}

async function getSession(req, res) {
  const session = await sessionService.getSessionById(req.params.id, { populate: true });
  res.json({ success: true, data: session });
}

async function listActiveSessions(_req, res) {
  const sessions = await sessionService.listActiveSessions();
  res.json({ success: true, data: sessions });
}

async function reconcileTables(_req, res) {
  const result = await sessionService.reconcileTables();
  res.json({ success: true, data: result });
}

module.exports = {
  openSession,
  openAndDispatch,
  reopenSession,
  closeSession,
  getSession,
  listActiveSessions,
  reconcileTables,
};
