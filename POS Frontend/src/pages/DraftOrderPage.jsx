import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ChefHat, Search, X, Info, Clock3 } from 'lucide-react';

import Header from '../components/Header';
import ConnectionBanner from '../components/ConnectionBanner';
import CategorySidebar from '../components/CategorySidebar';
import MenuItemList from '../components/MenuItemList';
import OrderSummary from '../components/OrderSummary';
import Button from '../components/Button';
import Loader from '../components/Loader';

import { menuApi } from '../api/menu';
import { tablesApi } from '../api/tables';
import { sessionsApi } from '../api/sessions';
import { useDraftOrderStore } from '../store/draftOrderStore';
import { on } from '../services/socket';

/**
 *   DraftOrderPage  (/order/new/:tableId)
 *   -------------------------------------
 *   Opened when the cashier taps a FREE table. Nothing is committed to
 *   the backend until they hit "Send to Kitchen":
 *
 *     - Adding / removing / updating qty mutates a per-table draft
 *       stored in Zustand + localStorage.
 *     - Leaving the page is free — the table stays available.
 *     - On "Send to Kitchen": POST /sessions/commit fires a single
 *       atomic call that opens session + creates order + adds items +
 *       ships the first KOT + marks the table occupied. We then
 *       navigate to /order/:orderId so the user continues in the
 *       normal (persisted) dining flow.
 *
 *   Handles the edge where another device opens the same table mid-draft:
 *   a `session_opened` socket event for this tableId redirects to the
 *   now-active order.
 */
export default function DraftOrderPage() {
  const { tableId, seatLabel: seatParam } = useParams();
  const navigate = useNavigate();

  // Normalize seat label to uppercase A/B/C/D or null (whole-table).
  const seatLabel = useMemo(() => {
    if (!seatParam) return null;
    const up = seatParam.toUpperCase();
    return ['A', 'B', 'C', 'D'].includes(up) ? up : null;
  }, [seatParam]);

  const draftKey = `${tableId}:${seatLabel || ''}`;
  const draft = useDraftOrderStore((s) => s.drafts[draftKey] || []);
  const addItem = useDraftOrderStore((s) => s.addItem);
  const setQuantity = useDraftOrderStore((s) => s.setQuantity);
  const removeItem = useDraftOrderStore((s) => s.removeItem);
  const clearDraft = useDraftOrderStore((s) => s.clearDraft);

  // `null` === "All Items" — default on page open, so the cashier
  // immediately sees the whole menu.
  const [activeCategory, setActiveCategory] = useState(null);
  const [search, setSearch] = useState('');
  const [committing, setCommitting] = useState(false);

  const trimmedSearch = search.trim();
  const searching = trimmedSearch.length > 0;
  // Search is always global — when a search term is active we ignore
  // the category tab so the cashier never misses a match for being on
  // the wrong tab.
  const effectiveCategory = searching ? null : activeCategory;
  const showCategoryTag = !activeCategory || searching;

  // ── queries ──────────────────────────────────────────────────────
  const { data: tables = [] } = useQuery({
    queryKey: ['tables'],
    queryFn: tablesApi.list,
    staleTime: 5_000,
  });
  const table = useMemo(
    () => tables.find((t) => t._id === tableId) || null,
    [tables, tableId],
  );

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: menuApi.categories,
    staleTime: 5 * 60 * 1000,
  });

  const { data: items = [], isLoading: menuLoading } = useQuery({
    queryKey: ['menu-items', effectiveCategory, trimmedSearch],
    queryFn: () =>
      menuApi.items({
        ...(effectiveCategory ? { category: effectiveCategory } : {}),
        ...(trimmedSearch ? { search: trimmedSearch } : {}),
      }),
    keepPreviousData: true,
  });

  // ── redirect if the table gets occupied elsewhere mid-draft ─────
  useEffect(() => {
    const offs = [
      on('session_opened', (p) => {
        if (String(p?.tableId) !== String(tableId)) return;
        // Only redirect when the event is for the same seat we're
        // editing — otherwise a colleague opening seat B on the same
        // table shouldn't kick seat A out of their draft.
        const eventSeat = p?.seatLabel || null;
        if (eventSeat !== seatLabel) return;
        if (committing) return; // we are the ones opening it
        toast(
          'This seat was just opened on another device — switching to the active order.',
          { icon: 'ℹ️' },
        );
        clearDraft(tableId, seatLabel);
        if (p.orderId) navigate(`/order/${p.orderId}`, { replace: true });
        else navigate('/tables', { replace: true });
      }),
    ];
    return () => offs.forEach((off) => off && off());
  }, [tableId, committing, clearDraft, navigate]);

  // ── totals ───────────────────────────────────────────────────────
  const totals = useMemo(() => {
    let subtotal = 0;
    for (const it of draft) subtotal += (it.price || 0) * (it.quantity || 0);
    const taxRate = Number(import.meta.env.VITE_DEFAULT_TAX_RATE || 5);
    const tax = subtotal * (taxRate / 100);
    return {
      subtotal,
      tax,
      discount: 0,
      total: Math.round((subtotal + tax) * 100) / 100,
    };
  }, [draft]);

  const hasItems = draft.length > 0;

  // ── actions ──────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!hasItems || committing) return;
    setCommitting(true);
    try {
      const { order } = await sessionsApi.commit({
        tableId,
        seatLabel,
        items: draft.map((it) => ({
          menuItemId: it.menuItemId,
          quantity: it.quantity,
          notes: it.notes,
        })),
      });
      clearDraft(tableId);
      toast.success('Sent to kitchen');
      navigate(`/order/${order._id}`, {
        replace: true,
        state: { tableNumber: table?.number },
      });
    } catch (e) {
      toast.error(e.message || 'Send to kitchen failed');
    } finally {
      setCommitting(false);
    }
  };

  // Draft summary adapter — OrderSummary expects items with _id, status etc.
  const draftAsItems = useMemo(
    () =>
      draft.map((it) => ({
        _id: it._tmpId,
        name: it.name,
        price: it.price,
        quantity: it.quantity,
        notes: it.notes,
        status: 'NEW',
      })),
    [draft],
  );

  // If table is occupied by someone else by the time we land here,
  // bounce the user back. (Also covered by the socket redirect above.)
  useEffect(() => {
    if (table && table.status === 'occupied' && !committing) {
      // In split mode, our seat can still be free even if the table is
      // "occupied" because another seat is busy. Only bounce out if
      // THIS seat actually has an active session.
      const activeForSeat = (table.activeSessions || []).find(
        (s) => (s.seatLabel || null) === seatLabel,
      );
      // Whole-table session blocks any seat draft, and vice-versa.
      const wholeTableActive = (table.activeSessions || []).some(
        (s) => !s.seatLabel,
      );
      const anySeatActive = (table.activeSessions || []).some(
        (s) => !!s.seatLabel,
      );
      const conflict =
        activeForSeat ||
        (seatLabel && wholeTableActive) ||
        (!seatLabel && anySeatActive);
      if (!conflict) return;

      toast(
        seatLabel
          ? `Seat ${seatLabel} is already occupied — opening the active order.`
          : 'That table is already occupied — opening the active order.',
        { icon: 'ℹ️' },
      );
      const orderId = activeForSeat?.order?._id || activeForSeat?.order;
      if (orderId) navigate(`/order/${orderId}`, { replace: true });
      else navigate('/tables', { replace: true });
    }
  }, [table, committing, navigate, seatLabel]);

  return (
    <div className="h-screen w-full bg-navy-grad flex flex-col">
      <ConnectionBanner />
      <Header
        title={
          table
            ? seatLabel
              ? `Table ${table.number}-${seatLabel}`
              : `Table ${table.number}`
            : 'New order'
        }
        subtitle={
          hasItems
            ? `Draft · ${draft.length} item${draft.length === 1 ? '' : 's'} · Not yet sent`
            : 'Browse menu · nothing is committed until you send to kitchen'
        }
        onBack={() => navigate('/tables')}
      />

      {/* Draft banner — explains the "this is a draft" state visibly */}
      <div className="px-4 md:px-6 py-2 bg-flame-500/10 border-b border-flame-500/30 text-flame-400 text-xs font-semibold flex items-center justify-center gap-2">
        <Info size={14} />
        <span>
          Draft mode ·{' '}
          {seatLabel ? (
            <>
              Seat {seatLabel} on Table {table?.number || '—'} stays{' '}
              <b>Available</b>
            </>
          ) : (
            <>
              Table {table?.number || '—'} stays <b>Available</b>
            </>
          )}{' '}
          until you tap <b>Send to Kitchen</b>.
        </span>
      </div>

      <main className="flex-1 min-h-0 overflow-hidden flex">
        <CategorySidebar
          categories={categories}
          activeId={activeCategory}
          onSelect={(c) => {
            setSearch('');
            setActiveCategory(c?._id ?? null);
          }}
        />

        <section className="flex-1 min-w-0 flex flex-col bg-navy-950">
          <div className="px-4 py-3 bg-panel-900/70 border-b border-white/5 flex items-center gap-2">
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search menu…"
                className="input-dark pl-9 py-2.5 h-11 text-sm"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <div className="hidden md:block text-xs text-slate-400">
              {searching ? (
                <>
                  {items.length} result{items.length === 1 ? '' : 's'}
                  <span className="text-slate-500"> · searching all categories</span>
                </>
              ) : (
                <>{items.length} item{items.length === 1 ? '' : 's'}</>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="mx-3 mt-3 mb-6 rounded-2xl bg-panel-grad border border-white/5 overflow-hidden">
              {menuLoading ? (
                <Loader label="Loading menu…" />
              ) : (
                <MenuItemList
                  items={items}
                  search={search}
                  showCategory={showCategoryTag}
                  disabled={committing}
                  onSelect={(mi) => addItem(tableId, mi, { quantity: 1, seatLabel })}
                />
              )}
            </div>
          </div>
        </section>

        <section className="w-[22rem] xl:w-[24rem] shrink-0 p-3 bg-navy-950/50">
          <OrderSummary
            title="Order Summary"
            subtitle={
              <span className="inline-flex items-center gap-1 text-flame-600">
                <Clock3 size={12} /> Draft · awaiting Send to Kitchen
              </span>
            }
            items={draftAsItems}
            showStatus={false}
            onIncrement={(it) =>
              setQuantity(tableId, it._id, (findDraft(draft, it._id)?.quantity || 1) + 1, seatLabel)
            }
            onDecrement={(it) => {
              const cur = findDraft(draft, it._id);
              if (!cur) return;
              if (cur.quantity <= 1) removeItem(tableId, it._id, seatLabel);
              else setQuantity(tableId, it._id, cur.quantity - 1, seatLabel);
            }}
            onRemove={(it) => removeItem(tableId, it._id, seatLabel)}
            totals={hasItems ? totals : null}
            actions={
              <>
                <Button
                  variant="orange"
                  size="lg"
                  className="w-full"
                  icon={ChefHat}
                  disabled={!hasItems}
                  loading={committing}
                  onClick={handleSend}
                >
                  Send to Kitchen
                  {hasItems ? ` (${draft.length})` : ''}
                </Button>
                <Button
                  variant="red"
                  size="lg"
                  className="w-full"
                  icon={X}
                  disabled={!hasItems || committing}
                  onClick={() => {
                    if (window.confirm('Clear this draft order?')) {
                      clearDraft(tableId, seatLabel);
                    }
                  }}
                >
                  Clear
                </Button>
                <p className="text-center text-[11px] text-slate-400 font-medium">
                  Table stays <b>Available</b> until you send.
                </p>
              </>
            }
            className="h-full"
          />
        </section>
      </main>
    </div>
  );
}

function findDraft(draft, tmpId) {
  return draft.find((d) => d._tmpId === tmpId) || null;
}
