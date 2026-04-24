import { io } from 'socket.io-client';
import { getToken } from '../api/client';

const URL = import.meta.env.VITE_API_URL || '';

let socket = null;
const listeners = new Map();

export function connectSocket(options = {}) {
  if (socket && socket.connected) return socket;
  const token = getToken();
  if (!token) return null;

  socket = io(URL || '/', {
    auth: { token, stations: options.stations || [] },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => {
    listeners.get('__status')?.forEach((cb) => cb({ connected: true }));
  });
  socket.on('disconnect', (reason) => {
    listeners.get('__status')?.forEach((cb) => cb({ connected: false, reason }));
  });
  socket.on('connect_error', (err) => {
    listeners.get('__error')?.forEach((cb) => cb(err));
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

export function getSocket() {
  return socket;
}

/** Subscribe to a socket event; returns an unsubscribe function. */
export function on(event, cb) {
  if (!socket) connectSocket();
  if (!socket) return () => {};
  socket.on(event, cb);
  return () => socket?.off(event, cb);
}

/** Status helper for connection banner. */
export function onStatus(cb) {
  const key = '__status';
  const arr = listeners.get(key) || [];
  arr.push(cb);
  listeners.set(key, arr);
  return () => {
    listeners.set(
      key,
      (listeners.get(key) || []).filter((fn) => fn !== cb),
    );
  };
}

export function emit(event, payload, ack) {
  if (!socket) return;
  if (ack) socket.emit(event, payload, ack);
  else socket.emit(event, payload);
}
