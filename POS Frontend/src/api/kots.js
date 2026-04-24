import { api } from './client';

export const kotsApi = {
  today: () => api.get('/kots/today').then((r) => r.data.data),
  pending: () => api.get('/kots/pending').then((r) => r.data.data),
  forOrder: (orderId) => api.get(`/kots/order/${orderId}`).then((r) => r.data.data),
  get: (id) => api.get(`/kots/${id}`).then((r) => r.data.data),
  reprint: (id) => api.post(`/kots/${id}/reprint`).then((r) => r.data.data),
  remove: (id) => api.delete(`/kots/${id}`).then((r) => r.data.data),
};
