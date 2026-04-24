'use strict';

const reportService = require('../services/reportService');

async function dailySales(req, res) {
  const date = req.query.date ? new Date(req.query.date) : new Date();
  const report = await reportService.dailySalesReport(date);
  res.json({ success: true, data: report });
}

async function kitchenActivity(req, res) {
  const date = req.query.date ? new Date(req.query.date) : new Date();
  const report = await reportService.kitchenActivityReport(date);
  res.json({ success: true, data: report });
}

async function dashboard(_req, res) {
  const data = await reportService.dashboardSummary();
  res.json({ success: true, data });
}

// ── DailyReport CRUD ────────────────────────────────────────────────

function parseDate(s) {
  if (!s) return new Date();
  // Accept "YYYY-MM-DD" (treated as local midnight) or any ISO string.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(s);
}

async function getDailyReport(req, res) {
  const date = parseDate(req.params.date);
  const report = await reportService.getDailyReport(date);
  res.json({ success: true, data: report });
}

async function regenerateDailyReport(req, res) {
  const date = parseDate(req.params.date);
  const report = await reportService.regenerateDailyReport(date);
  res.json({ success: true, data: report });
}

async function updateDailyReport(req, res) {
  const date = parseDate(req.params.date);
  const report = await reportService.updateDailyReport(date, req.body || {}, {
    updatedBy: req.user?._id,
  });
  res.json({ success: true, data: report });
}

async function listDailyReports(req, res) {
  const result = await reportService.listDailyReports({
    from: req.query.from,
    to: req.query.to,
    page: Number(req.query.page) || 1,
    limit: Number(req.query.limit) || 30,
  });
  res.json({ success: true, ...result });
}

module.exports = {
  dailySales,
  kitchenActivity,
  dashboard,
  getDailyReport,
  regenerateDailyReport,
  updateDailyReport,
  listDailyReports,
};
