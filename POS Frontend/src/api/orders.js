import { api } from './client';

export const ordersApi = {
  listOpen: (params = {}) => api.get('/orders', { params }).then((r) => r.data.data),
  get: (id) => api.get(`/orders/${id}`).then((r) => r.data.data),
  previewPending: (id) =>
    api.get(`/orders/${id}/pending-kot`).then((r) => r.data.data),
  addItem: (orderId, payload) =>
    api.post(`/orders/${orderId}/items`, payload).then((r) => r.data.data),
  updateQuantity: (orderId, itemId, quantity) =>
    api
      .patch(`/orders/${orderId}/items/${itemId}/quantity`, { quantity })
      .then((r) => r.data.data),
  removeItem: (orderId, itemId) =>
    api.delete(`/orders/${orderId}/items/${itemId}`).then((r) => r.data.data),
  cancelItem: (orderId, itemId, reason = '') =>
    api
      .post(`/orders/${orderId}/items/${itemId}/cancel`, { reason })
      .then((r) => r.data.data),
  setItemStatus: (orderId, itemId, status) =>
    api
      .post(`/orders/${orderId}/items/${itemId}/status`, { status })
      .then((r) => r.data.data),
  sendToKitchen: (orderId) =>
    api.post(`/orders/${orderId}/send-to-kitchen`).then((r) => r.data.data),
};
