import { api } from './client';

export const tablesApi = {
  list: () => api.get('/tables').then((r) => r.data.data),
  create: (payload) => api.post('/tables', payload).then((r) => r.data.data),
  update: (id, payload) =>
    api.patch(`/tables/${id}`, payload).then((r) => r.data.data),
  remove: (id) => api.delete(`/tables/${id}`).then((r) => r.data),
};
