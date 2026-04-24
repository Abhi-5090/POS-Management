import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ShoppingBag, Search, X, ChevronRight, Phone, User } from 'lucide-react';

import Header from '../components/Header';
import ConnectionBanner from '../components/ConnectionBanner';
import CategorySidebar from '../components/CategorySidebar';
import MenuItemList from '../components/MenuItemList';
import OrderSummary from '../components/OrderSummary';
import Button from '../components/Button';
import Loader from '../components/Loader';
import Modal from '../components/Modal';
import PaymentModal from '../components/PaymentModal';

import { menuApi } from '../api/menu';
import { parcelApi } from '../api/parcel';
import { billsApi } from '../api/bills';
import { shortId } from '../utils/format';

/**
 *  Parcel / Takeaway Flow
 *  ----------------------
 *  Simpler than dine-in:
 *   - create parcel order on mount (lazy)
 *   - add items (always stay NEW until Place Order)
 *   - "Place Order" ships a single KOT + generates a bill in one call
 *   - cashier settles on the spot
 *
 *  "Clear" button resets the cart. Any NEW items are removed server-side.
 */
export default function ParcelOrderPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  // `null` === "All Items" — default view on page open.
  const [activeCategory, setActiveCategory] = useState(null);
  const [search, setSearch] = useState('');
  const [order, setOrder] = useState(null);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customer, setCustomer] = useState({ name: '', phone: '' });
  const [payOpen, setPayOpen] = useState(false);
  const [bill, setBill] = useState(null);
  const [submittingPay, setSubmittingPay] = useState(false);
  const [cancellingBill, setCancellingBill] = useState(false);

  const trimmedSearch = search.trim();
  const searching = trimmedSearch.length > 0;
  const effectiveCategory = searching ? null : activeCategory;
  const showCategoryTag = !activeCategory || searching;

  // Create parcel order on mount.
  useEffect(() => {
    (async () => {
      try {
        const o = await parcelApi.create({});
        setOrder(o);
      } catch (e) {
        toast.error(e.message || 'Could not start parcel order');
      }
    })();
  }, []);

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

  const addItem = useMutation({
    mutationFn: (mi) => parcelApi.addItem(order._id, { menuItemId: mi._id, quantity: 1 }),
    onSuccess: (o) => setOrder(o),
    onError: (e) => toast.error(e.message || 'Add failed'),
  });

  const updateQty = useMutation({
    mutationFn: ({ itemId, quantity }) =>
      parcelApi.updateQuantity(order._id, itemId, quantity),
    onSuccess: (o) => setOrder(o),
    onError: (e) => toast.error(e.message || 'Quantity update failed'),
  });

  const removeItem = useMutation({
    mutationFn: (itemId) => parcelApi.removeItem(order._id, itemId),
    onSuccess: (o) => setOrder(o),
    onError: (e) => toast.error(e.message || 'Remove failed'),
  });

  const place = useMutation({
    mutationFn: () => parcelApi.placeAndBill(order._id, {}),
    onSuccess: ({ bill: b, kot }) => {
      setBill(b);
      setPayOpen(true);
      toast.success(`Placed · KOT ${kot?.kotNumber || ''}`);
    },
    onError: (e) => toast.error(e.message || 'Place order failed'),
  });

  /**
   * Takeaway is a continuous flow — after one payment the cashier
   * normally takes the next customer right away. So instead of
   * redirecting away, we just reset the page for the next parcel.
   */
  const resetForNextParcel = async () => {
    try {
      const fresh = await parcelApi.create({});
      setOrder(fresh);
      setCustomer({ name: '', phone: '' });
      setSearch('');
      setActiveCategory(null);
      setBill(null);
    } catch (e) {
      toast.error(e.message || 'Could not start a new parcel order');
    }
  };

  const settle = async ({ payments }) => {
    if (!bill) return;
    setSubmittingPay(true);
    try {
      await billsApi.settle(bill._id, payments);
      toast.success('Payment recorded · ready for next order');
      setPayOpen(false);
      await resetForNextParcel();
    } catch (e) {
      toast.error(e.message || 'Payment failed');
    } finally {
      setSubmittingPay(false);
    }
  };

  /**
   * Void the parcel bill. Cashier hits this when the customer cancels
   * the takeaway at the payment step. Bill is marked CANCELLED in
   * history; the UI resets for the next customer.
   */
  const cancelGeneratedBill = async () => {
    if (!bill) return;
    setCancellingBill(true);
    try {
      await billsApi.cancel(bill._id, 'Cancelled from payment screen');
      toast.success(`Bill ${bill.billNumber} cancelled`);
      setPayOpen(false);
      await resetForNextParcel();
    } catch (e) {
      toast.error(e.message || 'Cancel failed');
    } finally {
      setCancellingBill(false);
    }
  };

  const orderItems = order?.items || [];
  const hasItems = orderItems.length > 0;

  const totals = useMemo(() => {
    let subtotal = 0;
    for (const it of orderItems) subtotal += (it.price || 0) * (it.quantity || 0);
    const taxRate = Number(import.meta.env.VITE_DEFAULT_TAX_RATE || 5);
    const tax = subtotal * (taxRate / 100);
    return {
      subtotal,
      tax,
      discount: 0,
      total: Math.round((subtotal + tax) * 100) / 100,
    };
  }, [orderItems]);

  const clearAll = async () => {
    if (!order || !orderItems.length) return;
    const ids = orderItems.map((i) => i._id);
    for (const id of ids) {
      try {
        await parcelApi.removeItem(order._id, id);
      } catch {
        /* ignore individual failures, continue */
      }
    }
    const fresh = await parcelApi.create({});
    setOrder(fresh);
    toast('Cart cleared', { icon: '🧹' });
  };

  if (!order) {
    return (
      <div className="h-screen w-full bg-navy-grad flex items-center justify-center">
        <Loader label="Starting parcel order…" />
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-navy-grad flex flex-col">
      <ConnectionBanner />
      <Header
        title="New Takeaway Order"
        subtitle={`Order #${shortId(order._id)}  ·  ${order.orderNumber}`}
        onBack={() => navigate('/')}
        right={
          <Button
            variant="ghost"
            size="sm"
            icon={User}
            onClick={() => setCustomerOpen(true)}
          >
            <span className="hidden md:inline">
              {customer.name || 'Customer'}
            </span>
          </Button>
        }
      />

      <main className="flex-1 min-h-0 overflow-hidden flex">
        <CategorySidebar
          categories={categories}
          activeId={activeCategory}
          accent="orange"
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
                  disabled={addItem.isPending}
                  onSelect={(mi) => addItem.mutate(mi)}
                />
              )}
            </div>
          </div>
        </section>

        <section className="w-[22rem] xl:w-[24rem] shrink-0 p-3 bg-navy-950/50">
          <OrderSummary
            title="Order Summary"
            subtitle={customer.name ? `Customer: ${customer.name}` : 'Takeaway'}
            items={orderItems}
            showStatus={false}
            onIncrement={(it) =>
              updateQty.mutate({ itemId: it._id, quantity: it.quantity + 1 })
            }
            onDecrement={(it) => {
              if (it.quantity <= 1) removeItem.mutate(it._id);
              else updateQty.mutate({ itemId: it._id, quantity: it.quantity - 1 });
            }}
            onRemove={(it) => removeItem.mutate(it._id)}
            totals={hasItems ? totals : null}
            actions={
              <>
                <Button
                  variant="orange"
                  size="lg"
                  className="w-full"
                  iconRight={ChevronRight}
                  disabled={!hasItems}
                  loading={place.isPending}
                  onClick={() => place.mutate()}
                >
                  Place Order
                </Button>
                <Button
                  variant="red"
                  size="lg"
                  className="w-full"
                  icon={X}
                  disabled={!hasItems}
                  onClick={clearAll}
                >
                  Clear
                </Button>
              </>
            }
            className="h-full"
          />
        </section>
      </main>

      <Modal
        open={customerOpen}
        onClose={() => setCustomerOpen(false)}
        title="Customer details"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setCustomerOpen(false)}>
              Cancel
            </Button>
            <Button variant="blue" onClick={() => setCustomerOpen(false)}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Name
            </label>
            <div className="relative mt-1">
              <User
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                className="input-dark pl-10"
                value={customer.name}
                onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                placeholder="Optional"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Phone
            </label>
            <div className="relative mt-1">
              <Phone
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                className="input-dark pl-10"
                value={customer.phone}
                onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                placeholder="Optional"
              />
            </div>
          </div>
        </div>
      </Modal>

      <PaymentModal
        open={payOpen}
        onClose={() => {
          // User dismissed the modal without settling. Keep the bill
          // OPEN (admin can settle or cancel it later from Bills), and
          // reset this page so the next customer's order can start.
          setPayOpen(false);
          if (bill && bill.status !== 'PAID') {
            toast(
              `Bill ${bill.billNumber} is still OPEN — settle or cancel it from Admin → Bills.`,
              { icon: 'ℹ️', duration: 4500 },
            );
          }
          resetForNextParcel();
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
