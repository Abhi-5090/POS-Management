import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '';
const API_PREFIX = import.meta.env.VITE_API_PREFIX || '/api/v1';

export const baseURL = `${API_URL}${API_PREFIX}`;

export const api = axios.create({
  baseURL,
  timeout: 15_000,
});

// Distinct storage keys so opening both the main POS app and this
// Reports site on the same origin doesn't let them clobber each other.
const TOKEN_KEY = 'pos-reports.token';
const USER_KEY = 'pos-reports.user';

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setStoredUser(user) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}
export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

api.interceptors.request.use((config) => {
  const t = getToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err?.response?.status;
    const payload = err?.response?.data;
    const message = payload?.error?.message || err.message || 'Request failed';
    const shaped = new Error(message);
    shaped.status = status;
    shaped.code = payload?.error?.code;
    shaped.details = payload?.error?.details;
    if (status === 401) {
      setToken(null);
      setStoredUser(null);
      if (!window.location.pathname.endsWith('/login')) {
        window.location.replace('/login');
      }
    }
    return Promise.reject(shaped);
  },
);
