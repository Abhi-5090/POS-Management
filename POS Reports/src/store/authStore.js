import { create } from 'zustand';
import { authApi } from '../api/auth';
import {
  getStoredUser,
  getToken,
  setStoredUser,
  setToken,
} from '../api/client';

export const useAuthStore = create((set, get) => ({
  user: getStoredUser(),
  token: getToken(),
  isAuthenticated: !!getToken(),

  async login(username, password) {
    const data = await authApi.login(username, password);
    setToken(data.token);
    setStoredUser(data.user);
    set({ token: data.token, user: data.user, isAuthenticated: true });
    return data.user;
  },

  async refreshMe() {
    const user = await authApi.me();
    setStoredUser(user);
    set({ user });
    return user;
  },

  logout() {
    setToken(null);
    setStoredUser(null);
    set({ token: null, user: null, isAuthenticated: false });
  },

  hasRole(...roles) {
    const u = get().user;
    if (!u) return false;
    const allowed = roles.flat();
    return allowed.includes(u.role);
  },
}));
