'use strict';

const kotService = require('../services/kotService');
const { KOT } = require('../models');

async function listForOrder(req, res) {
  const kots = await kotService.listKotsForOrder(req.params.orderId);
  res.json({ success: true, data: kots });
}

async function listToday(_req, res) {
  const kots = await kotService.listTodayKots();
  res.json({ success: true, data: kots });
}

async function listPending(_req, res) {
  const kots = await kotService.listPendingKots({});
  res.json({ success: true, data: kots });
}

async function reprint(req, res) {
  const kot = await kotService.reprintKot(req.params.id, { createdBy: req.user._id });
  res.json({ success: true, data: kot });
}

async function remove(req, res) {
  // Admin can force-delete originals via ?force=1 — normal kitchen /
  // cashier calls omit the flag and the service only deletes REPRINTs.
  const allowOriginal =
    req.query.force === '1' && req.user?.role === 'admin';
  const result = await kotService.deleteKot(req.params.id, { allowOriginal });
  res.json({ success: true, data: result });
}

async function getKot(req, res) {
  const kot = await KOT.findById(req.params.id);
  if (!kot) return res.status(404).json({ success: false, error: { message: 'Not found' } });
  res.json({ success: true, data: kot });
}

module.exports = {
  listForOrder,
  listToday,
  listPending,
  reprint,
  remove,
  getKot,
};
