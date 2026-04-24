'use strict';

const billService = require('../services/billService');

async function generate(req, res) {
  const { orderId } = req.params;
  const { discount, taxRate, serviceCharge } = req.body;
  const bill = await billService.generateBill(orderId, {
    discount,
    taxRate,
    serviceCharge,
    createdBy: req.user._id,
  });
  res.status(201).json({ success: true, data: bill });
}

async function settle(req, res) {
  const bill = await billService.settleBill(req.params.id, {
    payments: req.body.payments,
    settledBy: req.user._id,
  });
  res.json({ success: true, data: bill });
}

async function cancel(req, res) {
  const bill = await billService.cancelBill(req.params.id, {
    reason: req.body.reason,
    cancelledBy: req.user._id,
  });
  res.json({ success: true, data: bill });
}

async function reprint(req, res) {
  const bill = await billService.reprintBill(req.params.id);
  res.json({ success: true, data: bill });
}

async function update(req, res) {
  const bill = await billService.updateBill(req.params.id, req.body, {
    updatedBy: req.user?._id,
  });
  res.json({ success: true, data: bill });
}

async function get(req, res) {
  const bill = await billService.getBillById(req.params.id);
  res.json({ success: true, data: bill });
}

async function list(req, res) {
  const result = await billService.listBills({
    from: req.query.from,
    to: req.query.to,
    status: req.query.status,
    orderType: req.query.orderType,
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 50,
  });
  res.json({ success: true, ...result });
}

module.exports = { generate, settle, cancel, reprint, get, list, update };
