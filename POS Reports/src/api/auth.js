import { api } from './client';

export const authApi = {
  login: (username, password) =>
    api.post('/auth/login', { username, password }).then((r) => r.data.data),
  me: () => api.get('/auth/me').then((r) => r.data.data.user),
};
