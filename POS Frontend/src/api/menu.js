import { api } from './client';

export const menuApi = {
  categories: () => api.get('/menu/categories').then((r) => r.data.data),
  items: (params = {}) =>
    api.get('/menu/items', { params }).then((r) => r.data.data),

  createCategory: (payload) =>
    api.post('/menu/categories', payload).then((r) => r.data.data),
  updateCategory: (id, payload) =>
    api.patch(`/menu/categories/${id}`, payload).then((r) => r.data.data),
  deleteCategory: (id) =>
    api.delete(`/menu/categories/${id}`).then((r) => r.data),

  createItem: (payload) =>
    api.post('/menu/items', payload).then((r) => r.data.data),
  updateItem: (id, payload) =>
    api.patch(`/menu/items/${id}`, payload).then((r) => r.data.data),
  deleteItem: (id) => api.delete(`/menu/items/${id}`).then((r) => r.data),
  toggleAvailability: (id) =>
    api
      .post(`/menu/items/${id}/toggle-availability`)
      .then((r) => r.data.data),
};
