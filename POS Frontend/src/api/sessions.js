import { api } from './client';

export const sessionsApi = {
  listActive: () => api.get('/sessions').then((r) => r.data.data),
  get: (id) => api.get(`/sessions/${id}`).then((r) => r.data.data),
  open: (payload) => api.post('/sessions', payload).then((r) => r.data.data),
  /**
   * Atomic commit used by the draft-order workflow. The backend opens
   * the session + order, adds every item, ships the first KOT, and
   * marks the table occupied — all in one round-trip. If anything
   * fails past step (1) the backend rolls back, so the user never
   * ends up stuck on a half-open table.
   */
  commit: (payload) => api.post('/sessions/commit', payload).then((r) => r.data.data),
  close: (id) => api.post(`/sessions/${id}/close`).then((r) => r.data.data),
  reopen: (id) => api.post(`/sessions/${id}/reopen`).then((r) => r.data.data),
  reconcile: () => api.post('/sessions/reconcile').then((r) => r.data.data),
};
