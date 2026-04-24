import { api } from './client';

export const billsApi = {
  list: (params = {}) => api.get('/bills', { params }).then((r) => r.data),
  get: (id) => api.get(`/bills/${id}`).then((r) => r.data.data),
  generate: (orderId, payload = {}) =>
    api.post(`/bills/from-order/${orderId}`, payload).then((r) => r.data.data),
  settle: (id, payments) =>
    api.post(`/bills/${id}/settle`, { payments }).then((r) => r.data.data),
  cancel: (id, reason = '') =>
    api.post(`/bills/${id}/cancel`, { reason }).then((r) => r.data.data),
  reprint: (id) => api.post(`/bills/${id}/reprint`).then((r) => r.data.data),
  update: (id, patch) =>
    api.patch(`/bills/${id}`, patch).then((r) => r.data.data),
};
