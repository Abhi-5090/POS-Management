import { api } from './client';

export const parcelApi = {
  create: (customer = {}) =>
    api.post('/parcel', { customer }).then((r) => r.data.data),
  addItem: (id, payload) =>
    api.post(`/parcel/${id}/items`, payload).then((r) => r.data.data),
  updateQuantity: (id, itemId, quantity) =>
    api
      .patch(`/parcel/${id}/items/${itemId}/quantity`, { quantity })
      .then((r) => r.data.data),
  removeItem: (id, itemId) =>
    api.delete(`/parcel/${id}/items/${itemId}`).then((r) => r.data.data),
  placeAndBill: (id, payload = {}) =>
    api.post(`/parcel/${id}/place-and-bill`, payload).then((r) => r.data.data),
};
