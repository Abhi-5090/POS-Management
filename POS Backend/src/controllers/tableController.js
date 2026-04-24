'use strict';

const AppError = require('../utils/AppError');
const { Table, TableSession, TABLE_STATUS, SESSION_STATUS } = require('../models');

async function listTables(_req, res) {
  const tables = await Table.find({ isActive: true })
    .sort({ section: 1, number: 1 })
    .populate({
      path: 'currentSession',
      select: 'sessionCode seatLabel order guests createdAt',
      populate: { path: 'order', select: 'items total orderNumber' },
    })
    .lean();

  // Every active session per table — so the client can render split
  // seating (A/B/C/D) instead of assuming a single session per table.
  const tableIds = tables.map((t) => t._id);
  const sessions = await TableSession.find({
    table: { $in: tableIds },
    status: SESSION_STATUS.ACTIVE,
  })
    .populate({ path: 'order', select: 'items total orderNumber isClosed' })
    .lean();

  const byTable = new Map();
  for (const s of sessions) {
    const key = String(s.table);
    if (!byTable.has(key)) byTable.set(key, []);
    byTable.get(key).push(s);
  }

  const enriched = tables.map((t) => {
    const activeSessions = (byTable.get(String(t._id)) || []).sort((a, b) => {
      // whole-table (null) first, then A/B/C/D
      if (a.seatLabel == null && b.seatLabel != null) return -1;
      if (a.seatLabel != null && b.seatLabel == null) return 1;
      return (a.seatLabel || '').localeCompare(b.seatLabel || '');
    });
    const isSplit = activeSessions.some((s) => !!s.seatLabel);
    return { ...t, activeSessions, isSplit };
  });

  res.json({ success: true, data: enriched });
}

async function createTable(req, res) {
  const { number, displayName, capacity, section } = req.body;
  const trimmed = String(number || '').trim();

  // If an active table already has this number, reject cleanly.
  const activeClash = await Table.findOne({ number: trimmed, isActive: true });
  if (activeClash) {
    throw AppError.conflict(
      `Table "${trimmed}" already exists.`,
      { field: 'number', existingId: activeClash._id },
    );
  }

  // If a soft-deleted row with the same number exists, revive it instead
  // of inserting a duplicate. Preserves history + avoids the E11000
  // "duplicate value" surprise the admin saw when trying to re-add a
  // previously deleted table.
  const stale = await Table.findOne({ number: trimmed, isActive: false });
  if (stale) {
    stale.isActive = true;
    if (displayName !== undefined) stale.displayName = displayName;
    if (capacity !== undefined) stale.capacity = capacity;
    if (section !== undefined) stale.section = section;
    stale.status = TABLE_STATUS.FREE;
    stale.currentSession = null;
    await stale.save();
    return res.status(200).json({ success: true, data: stale, revived: true });
  }

  const table = await Table.create({
    number: trimmed,
    displayName,
    capacity,
    section,
  });
  res.status(201).json({ success: true, data: table });
}

async function updateTable(req, res) {
  const patch = { ...req.body };
  if (patch.number) {
    const trimmed = String(patch.number).trim();
    const clash = await Table.findOne({
      _id: { $ne: req.params.id },
      number: trimmed,
      isActive: true,
    });
    if (clash) {
      throw AppError.conflict(`Another active table already uses number "${trimmed}".`);
    }
    patch.number = trimmed;
  }
  const table = await Table.findByIdAndUpdate(req.params.id, patch, {
    new: true,
    runValidators: true,
  });
  if (!table) throw AppError.notFound('Table not found');
  res.json({ success: true, data: table });
}

async function deleteTable(req, res) {
  const table = await Table.findById(req.params.id);
  if (!table) throw AppError.notFound('Table not found');
  const hasActive = await TableSession.exists({
    table: table._id,
    status: SESSION_STATUS.ACTIVE,
  });
  if (hasActive) throw AppError.conflict('Table has an active session');
  table.isActive = false;
  await table.save();
  res.json({ success: true });
}

module.exports = { listTables, createTable, updateTable, deleteTable };
