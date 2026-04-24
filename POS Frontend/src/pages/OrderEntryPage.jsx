import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ChefHat, Receipt, Mail, Search, UserCircle2, X } from 'lucide-react';

import Header from '../components/Header';
import ConnectionBanner from '../components/ConnectionBanner';
import CategorySidebar from '../components/CategorySidebar';
import MenuItemList from '../components/MenuItemList';
import OrderSummary from '../components/OrderSummary';
import Button from '../components/Button';
import Loader from '../components/Loader';
import PaymentModal from '../components/PaymentModal';
import Modal from '../components/Modal';

import { menuApi } from '../api/menu';
import { ordersApi } from '../api/orders';
import { billsApi } from '../api/bills';
import { sessionsApi } from '../api/sessions';
import { on } from '../services/socket';
import { ORDER_ITEM_STATUS } from '../utils/constants';
import { money, shortId } from '../utils/format';

/**
 *  Order Entry (Dine-In)
 *  ---------------------
 *  Left  : category sidebar
 *  Center: menu items list
 *  Right : order summary + actions (Send to Kitchen, Generate Bill)
 *
 *  Only NEW items are editable. Already-sent items are shown as locked
 *  rows with their kitchen status. Send to Kitchen is disabled unless
 *  at least one NEW item exists. Generate Bill is disabled while any
 *  NEW items are still in the cart — server rejects that anyway, so
 *  we pre-empt the round-trip.
 */
export default function OrderEntryPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();

  // `null` === "All Items" — the default when the cashier opens the order.
  const [activeCategory, setActiveCategory] = useState(null);
  const [search, setSearch] = useState('');
  const [payOpen, setPayOpen] = useState(false);
  const [bill, setBill] = useState(null);
  const [submittingPay, setSubmittingPay] = useState(false);
  const [cancellingBill, setCancellingBill] = useState(false);

  const trimmedSearch = search.trim();
  const searching = trimmedSearch.length > 0;
  // Search is always global — ignore the category tab while a term is
  // active so the cashier can't "miss" an item just because they were
  // on the wrong tab.
  const effectiveCategory = searching ? null : activeCategory;
  const showCategoryTag = !activeCategory || searching;

  // ── Queries ───────────────────────────────────────────────────────
  const { data: order, isLoading: orderLoading, refetch: refetchOrder } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => ordersApi.get(orderId),
    refetchOnMount: 'always',
    enabled: !!orderId,
  });

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

  // ── Realtime sync: refetch order when the server broadcasts changes.
  useEffect(() => {
    const offs = [
      on('order_updated', (p) => {
        if (p?.order?._id === orderId) qc.setQueryData(['order', orderId], p.order);
      }),
      on('new_kot', (p) => {
        if (p?.order?._id === orderId) qc.setQueryData(['order', orderId], p.order);
      }),
      on('bill_generated', (p) => {
        if (p?.orderId === orderId) {
          toast.success(`Bill ${p.bill.billNumber} generated`);
        }
      }),
    ];
    return () => offs.forEach((off) => off && off());
  }, [orderId, qc]);

  // ── Mutations ─────────────────────────────────────────────────────
  const addItem = useMutation({
    mutationFn: (menuItem) =>
      ordersApi.addItem(orderId, { menuItemId: menuItem._id, quantity: 1 }),
    onSuccess: (data) => qc.setQueryData(['order', orderId], data),
    onError: (e) => toast.error(e.message || 'Could not add item'),
  });

  const updateQty = useMutation({
    mutationFn: ({ itemId, quantity }) =>
      ordersApi.updateQuantity(orderId, itemId, quantity),
    onSuccess: (data) => qc.setQueryData(['order', orderId], data),
    onError: (e) => toast.error(e.message || 'Quantity update failed'),
  });

  const removeItem = useMutation({
    mutationFn: (itemId) => ordersApi.removeItem(orderId, itemId),
    onSuccess: (data) => qc.setQueryData(['order', orderId], data),
    onError: (e) => toast.error(e.message || 'Remove failed'),
  });

  const sendToKitchen = useMutation({
    mutationFn: () => ordersApi.sendToKitchen(orderId),
    onSuccess: ({ order: updated, kot }) => {
      qc.setQueryData(['order', orderId], updated);
      toast.success(`Sent to kitchen · KOT ${kot.kotNumber}`);
    },
    onError: (e) => toast.error(e.message || 'Send to kitchen failed'),
  });

  const generateBill = useMutation({
    mutationFn: () => billsApi.generate(orderId, {}),
    onSuccess: (b) => {
      setBill(b);
      setPayOpen(true);
      toast.success(`Bill ${b.billNumber} created`);
    },
    onError: (e) => toast.error(e.message || 'Bill generation failed'),
  });

  const settle = async ({ payments }) => {
    if (!bill) return;
    setSubmittingPay(true);
    try {
      await billsApi.settle(bill._id, payments);
      toast.success('Payment recorded');
      setPayOpen(false);
      navigate('/tables', { replace: true });
    } catch (e) {
      toast.error(e.message || 'Payment failed');
    } finally {
      setSubmittingPay(false);
    }
  };

  /**
   * Void the generated bill.
   *   1. Cancel the bill → backend marks it CANCELLED and auto-spawns a
   *      fresh order on the session (so nothing's half-broken).
   *   2. Close the session → frees the table for the next guest.
   *   3. Back to /tables.
   */
  const cancelGeneratedBill = async () => {
    if (!bill) return;
    setCancellingBill(true);
    try {
      await billsApi.cancel(bill._id, 'Cancelled from payment screen');
      if (order?.session) {
        try {
          await sessionsApi.close(order.session);
        } catch {
          /* session may already be closed — safe to ignore */
        }
      }
      toast.success(`Bill ${bill.billNumber} cancelled · table freed`);
      setPayOpen(false);
      setBill(null);
      navigate('/tables', { replace: true });
    } catch (e) {
      toast.error(e.message || 'Cancel failed');
    } finally {
      setCancellingBill(false);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────
  const orderItems = order?.items || [];
  const visibleItems = orderItems.filter((it) => it.status !== ORDER_ITEM_STATUS.CANCELLED);

  const totals = useMemo(() => {
    let subtotal = 0;
    for (const it of visibleItems) subtotal += (it.price || 0) * (it.quantity || 0);
    const taxRate = Number(import.meta.env.VITE_DEFAULT_TAX_RATE || 5);
    const tax = subtotal * (taxRate / 100);
    return {
      subtotal,
      tax,
      discount: 0,
      total: Math.round((subtotal + tax) * 100) / 100,
    };
  }, [visibleItems]);

  const newCount = visibleItems.filter((i) => i.status === ORDER_ITEM_STATUS.NEW).length;
  const tableNumber = order?.tableNumber || location.state?.tableNumber;
  const orderLabel = order ? `#${shortId(order._id)}` : '';

  if (orderLoading) {
    return (
      <div className="h-screen w-full bg-navy-grad flex items-center justify-center">
        <Loader label="Loading order…" />
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-navy-grad flex flex-col">
      <ConnectionBanner />
      <Header
        title={`Table ${tableNumber || '—'}${order?.session?.seatLabel ? `-${order.session.seatLabel}` : ''}`}
        subtitle={`Order ${orderLabel}  ·  ${order?.orderNumber || ''}`}
        onBack={() => navigate('/tables')}
        right={
          <>
            <IconBadge icon={UserCircle2} label="Waiter" count={1} />
            <IconBadge icon={ChefHat} label="KOT" count={order?.kotSequence || 0} tone="orange" />
            <IconBadge icon={Mail} label="Notes" count={0} />
          </>
        }
      />

      <main className="flex-1 min-h-0 overflow-hidden flex">
        {/* Left: category sidebar */}
        <CategorySidebar
          categories={categories}
          activeId={activeCategory}
          onSelect={(c) => {
            setSearch('');
            setActiveCategory(c?._id ?? null);
          }}
        />

        {/* Center: menu list */}
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
          <div className="flex-1 overflow-y-auto bg-navy-950">
            <div className="mx-3 mt-3 mb-6 rounded-2xl bg-panel-grad border border-white/5 overflow-hidden">
              {menuLoading ? (
                <Loader label="Loading menu…" />
              ) : (
                <MenuItemList
                  items={items}
                  search={search}
                  showCategory={showCategoryTag}
                  disabled={addItem.isPending}
                  onSelect={(mi) => addItem.mutate(mi)}
                />
              )}
            </div>
          </div>
        </section>

        {/* Right: order summary */}
        <section className="w-[22rem] xl:w-[24rem] shrink-0 p-3 bg-navy-950/50">
          <OrderSummary
            title="Order Summary"
            subtitle={
              order ? `Table ${tableNumber || '—'} · ${order.orderNumber}` : ''
            }
            items={visibleItems}
            onIncrement={(it) =>
              updateQty.mutate({ itemId: it._id, quantity: it.quantity + 1 })
            }
            onDecrement={(it) => {
              if (it.quantity <= 1) removeItem.mutate(it._id);
              else updateQty.mutate({ itemId: it._id, quantity: it.quantity - 1 });
            }}
            onRemove={(it) => removeItem.mutate(it._id)}
            totals={visibleItems.length ? totals : null}
            actions={
              <>
                <Button
                  variant="orange"
                  size="lg"
                  className="w-full"
                  icon={ChefHat}
                  iconRight={ArrowRight}
                  disabled={newCount === 0}
                  loading={sendToKitchen.isPending}
                  onClick={() => sendToKitchen.mutate()}
                >
                  Send to Kitchen{newCount ? ` (${newCount})` : ''}
                </Button>
                <Button
                  variant="green"
                  size="lg"
                  className="w-full"
                  icon={Receipt}
                  iconRight={ArrowRight}
                  disabled={!visibleItems.length || newCount > 0}
                  loading={generateBill.isPending}
                  onClick={() => generateBill.mutate()}
                >
                  Generate Bill
                </Button>
                {newCount > 0 && (
                  <p className="text-center text-xs text-flame-500 font-medium">
                    Send all new items to the kitchen before billing
                  </p>
                )}
              </>
            }
            className="h-full"
          />
        </section>
      </main>

      <PaymentModal
        open={payOpen}
        onClose={() => {
          setPayOpen(false);
          navigate('/tables', { replace: true });
        }}
        bill={bill}
        submitting={submittingPay}
        cancelling={cancellingBill}
        onSettle={settle}
        onCancelBill={cancelGeneratedBill}
        onReprint={async () => {
          try {
            await billsApi.reprint(bill._id);
            toast.success('Sent to printer');
          } catch (e) {
            toast.error(e.message || 'Reprint failed');
          }
        }}
      />
    </div>
  );
}

function ArrowRight({ size = 18, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <path d="M5 12h14" />
      <path d="M13 5l7 7-7 7" />
    </svg>
  );
}

function IconBadge({ icon: Icon, count = 0, tone = 'blue' }) {
  const bg =
    tone === 'orange' ? 'bg-flame-500/15 text-flame-400 border-flame-500/30' :
    tone === 'green' ? 'bg-leaf-500/15 text-leaf-500 border-leaf-500/30' :
    'bg-brand-500/15 text-brand-100 border-brand-500/30';
  return (
    <div
      className={`relative h-10 w-10 flex items-center justify-center rounded-xl border ${bg}`}
    >
      <Icon size={18} />
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-ember-500 text-white text-[10px] font-bold flex items-center justify-center border border-panel-900">
          {count}
        </span>
      )}
    </div>
  );
}
