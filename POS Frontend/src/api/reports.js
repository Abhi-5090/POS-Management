import { api } from './client';

export const reportsApi = {
  dashboard: () => api.get('/reports/dashboard').then((r) => r.data.data),
  dailySales: (date) =>
    api
      .get('/reports/daily-sales', { params: date ? { date } : {} })
      .then((r) => r.data.data),
  kitchenActivity: (date) =>
    api
      .get('/reports/kitchen-activity', { params: date ? { date } : {} })
      .then((r) => r.data.data),

  // ── DailyReport (editable document) ─────────────────────────
  getDaily: (dateKey) =>
    api.get(`/reports/daily/${dateKey}`).then((r) => r.data.data),
  regenerateDaily: (dateKey) =>
    api.post(`/reports/daily/${dateKey}/regenerate`).then((r) => r.data.data),
  updateDaily: (dateKey, patch) =>
    api.patch(`/reports/daily/${dateKey}`, patch).then((r) => r.data.data),
  listDaily: (params = {}) =>
    api.get('/reports/daily', { params }).then((r) => r.data),
};
