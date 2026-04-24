import { create } from 'zustand';
import { connectSocket, disconnectSocket, onStatus } from '../services/socket';

let statusUnsub = null;

export const useSocketStore = create((set) => ({
  connected: false,

  start(options = {}) {
    const s = connectSocket(options);
    if (!s) return;
    if (statusUnsub) statusUnsub();
    statusUnsub = onStatus(({ connected }) => set({ connected }));
  },
  stop() {
    if (statusUnsub) {
      statusUnsub();
      statusUnsub = null;
    }
    disconnectSocket();
    set({ connected: false });
  },
}));
