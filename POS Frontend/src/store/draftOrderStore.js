import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 *   Per-(table + seat) local cart used BEFORE the dining order is
 *   committed to the backend. Tapping an empty table (or seat) only
 *   opens this store — the backend doesn't know anything until
 *   "Send to Kitchen" fires the atomic commit call.
 *
 *   Key is `${tableId}:${seatLabel || ''}` so T05 whole-table, T05-A,
 *   T05-B each keep independent drafts.
 *
 *   Persisted to localStorage so accidentally refreshing the tablet
 *   doesn't nuke the cashier's work-in-progress.
 */
const newTmpId = () =>
  `tmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const keyFor = (tableId, seatLabel) =>
  `${tableId}:${(seatLabel || '').toUpperCase()}`;

export const useDraftOrderStore = create(
  persist(
    (set, get) => ({
      drafts: {}, // { [`${tableId}:${seatLabel||''}`]: item[] }

      getDraft(tableId, seatLabel) {
        return get().drafts[keyFor(tableId, seatLabel)] || [];
      },

      countForTable(tableId) {
        // Aggregate draft counts across every seat of a table, used by
        // the Tables grid to show a "N items in draft" badge.
        const all = get().drafts;
        const prefix = `${tableId}:`;
        let n = 0;
        for (const [k, items] of Object.entries(all)) {
          if (k.startsWith(prefix)) n += (items || []).length;
        }
        return n;
      },

      /**
       * Add a menu item to the draft. Merges quantity onto an existing
       * line if the same menuItemId + notes are already in the cart
       * (mirrors backend's addItem merge rule).
       */
      addItem(tableId, menuItem, { quantity = 1, notes = '', seatLabel = null } = {}) {
        set((state) => {
          const k = keyFor(tableId, seatLabel);
          const cur = state.drafts[k] ? [...state.drafts[k]] : [];
          const trimmed = (notes || '').trim();
          const idx = cur.findIndex(
            (it) => it.menuItemId === menuItem._id && (it.notes || '') === trimmed,
          );
          if (idx >= 0) {
            cur[idx] = { ...cur[idx], quantity: cur[idx].quantity + quantity };
          } else {
            cur.push({
              _tmpId: newTmpId(),
              menuItemId: menuItem._id,
              name: menuItem.name,
              price: menuItem.price,
              quantity,
              notes: trimmed,
              type: menuItem.type || 'veg',
            });
          }
          return { drafts: { ...state.drafts, [k]: cur } };
        });
      },

      setQuantity(tableId, tmpId, quantity, seatLabel = null) {
        set((state) => {
          const k = keyFor(tableId, seatLabel);
          const cur = (state.drafts[k] || []).map((it) =>
            it._tmpId === tmpId ? { ...it, quantity: Math.max(1, quantity) } : it,
          );
          return { drafts: { ...state.drafts, [k]: cur } };
        });
      },

      removeItem(tableId, tmpId, seatLabel = null) {
        set((state) => {
          const k = keyFor(tableId, seatLabel);
          const cur = (state.drafts[k] || []).filter((it) => it._tmpId !== tmpId);
          return { drafts: { ...state.drafts, [k]: cur } };
        });
      },

      clearDraft(tableId, seatLabel = null) {
        set((state) => {
          const next = { ...state.drafts };
          delete next[keyFor(tableId, seatLabel)];
          return { drafts: next };
        });
      },

      clearAll() {
        set({ drafts: {} });
      },
    }),
    {
      name: 'pos.draftOrders',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ drafts: s.drafts }),
      version: 1,
    },
  ),
);
