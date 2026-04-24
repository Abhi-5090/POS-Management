import { api } from './client';

export const authApi = {
  login: (username, password) =>
    api.post('/auth/login', { username, password }).then((r) => r.data.data),
  me: () => api.get('/auth/me').then((r) => r.data.data.user),

  // ── admin user management ──────────────────────────────
  listUsers: () => api.get('/auth/users').then((r) => r.data.data),
  createUser: (payload) =>
    api.post('/auth/users', payload).then((r) => r.data.data.user),
  updateUser: (id, payload) =>
    api.patch(`/auth/users/${id}`, payload).then((r) => r.data.data),
  deactivateUser: (id) =>
    api.delete(`/auth/users/${id}`).then((r) => r.data.data),
};
