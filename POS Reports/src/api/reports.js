import { api } from './client';

/**
 *   Reports API — talks to the POS backend's DailyReport endpoints.
 *
 *   GET    /reports/daily-sales            — computed summary (same as admin panel)
 *   GET    /reports/kitchen-activity       — KOT counts for a day
 *   GET    /reports/daily                  — list paginated
 *   GET    /reports/daily/:YYYY-MM-DD      — get / create-on-demand
 *   PATCH  /reports/daily/:YYYY-MM-DD      — admin edit (auto-locks income fields)
 *   POST   /reports/daily/:date/regenerate — unlock + recompute from bills
 */
export const reportsApi = {
  dailySales: (date) =>
    api
      .get('/reports/daily-sales', { params: date ? { date } : {} })
      .then((r) => r.data.data),
  kitchenActivity: (date) =>
    api
      .get('/reports/kitchen-activity', { params: date ? { date } : {} })
      .then((r) => r.data.data),

  getDaily: (dateKey) =>
    api.get(`/reports/daily/${dateKey}`).then((r) => r.data.data),
  regenerateDaily: (dateKey) =>
    api.post(`/reports/daily/${dateKey}/regenerate`).then((r) => r.data.data),
  updateDaily: (dateKey, patch) =>
    api.patch(`/reports/daily/${dateKey}`, patch).then((r) => r.data.data),
  listDaily: (params = {}) =>
    api.get('/reports/daily', { params }).then((r) => r.data),
};
