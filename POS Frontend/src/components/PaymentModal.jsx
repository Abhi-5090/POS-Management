import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { CreditCard, Smartphone, Wallet, Banknote, Printer, Ban } from 'lucide-react';
import Modal from './Modal';
import Button from './Button';
import { money } from '../utils/format';
import { PAYMENT_METHOD } from '../utils/constants';

const METHODS = [
  { id: PAYMENT_METHOD.CASH, label: 'Cash', icon: Banknote },
  { id: PAYMENT_METHOD.CARD, label: 'Card', icon: CreditCard },
  { id: PAYMENT_METHOD.UPI, label: 'UPI', icon: Smartphone },
  { id: PAYMENT_METHOD.WALLET, label: 'Wallet', icon: Wallet },
];

export default function PaymentModal({
  open,
  onClose,
  bill,
  onSettle,
  onReprint,
  onCancelBill,
  submitting = false,
  cancelling = false,
}) {
  const [method, setMethod] = useState(PAYMENT_METHOD.CASH);
  const [received, setReceived] = useState('');
  const [reference, setReference] = useState('');

  const total = bill?.total || 0;
  const amount = Number(received) || total;
  const change = Math.max(0, amount - total);

  const quickCash = useMemo(() => {
    if (!total) return [];
    const base = Math.ceil(total / 100) * 100;
    return [total, base, base + 100, base + 500];
  }, [total]);

  const submit = () => {
    onSettle?.({
      payments: [
        {
          method,
          amount: Math.min(amount, total),
          reference: reference || undefined,
        },
      ],
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Settle Bill · ${bill?.billNumber || ''}`}
      size="lg"
      footer={
        <>
          {onReprint && (
            <Button
              variant="ghost"
              icon={Printer}
              onClick={onReprint}
              disabled={submitting || cancelling}
            >
              Reprint
            </Button>
          )}
          {/* Void the generated bill. Use when payment won't happen
              (wrong bill, customer walked out, etc.). Preserves the
              bill as CANCELLED in history and frees the table. */}
          {onCancelBill && (
            <Button
              variant="red"
              icon={Ban}
              loading={cancelling}
              disabled={submitting}
              onClick={() => {
                if (
                  window.confirm(
                    `Cancel bill ${bill?.billNumber || ''}? The bill will be voided and the table freed. This is not reversible.`,
                  )
                ) {
                  onCancelBill(bill?._id);
                }
              }}
            >
              Cancel Bill
            </Button>
          )}
          <Button
            variant="outline"
            onClick={onClose}
            disabled={submitting || cancelling}
          >
            Close
          </Button>
          <Button
            variant="green"
            onClick={submit}
            loading={submitting}
            disabled={cancelling}
          >
            Confirm Payment
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="text-slate-400 text-xs uppercase tracking-wide font-semibold">
            Total Payable
          </div>
          <div className="text-4xl font-extrabold text-white tabular-nums mt-1">
            {money(total)}
          </div>

          <div className="mt-5 text-slate-300 text-sm">Payment Method</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {METHODS.map((m) => {
              const active = method === m.id;
              const Icon = m.icon;
              return (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  className={clsx(
                    'flex items-center justify-center gap-2 py-3 rounded-xl border font-semibold text-sm tap-btn',
                    active
                      ? 'bg-brand-500 text-white border-brand-500 shadow-btn-blue'
                      : 'bg-panel-900 border-white/10 text-slate-200 hover:bg-panel-700',
                  )}
                >
                  <Icon size={16} /> {m.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-slate-300 text-sm">Amount Received</div>
          <input
            className="input-dark text-2xl font-bold tabular-nums mt-1"
            inputMode="decimal"
            value={received}
            onChange={(e) => setReceived(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder={money(total)}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {quickCash.map((v) => (
              <button
                key={v}
                onClick={() => setReceived(String(v))}
                className="px-3 py-1.5 rounded-lg bg-panel-900 hover:bg-panel-700 border border-white/10 text-slate-100 text-sm tap-btn"
              >
                {money(v)}
              </button>
            ))}
          </div>

          {method !== PAYMENT_METHOD.CASH && (
            <div className="mt-4">
              <div className="text-slate-300 text-sm">Reference (txn id / last 4)</div>
              <input
                className="input-dark mt-1"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Optional"
              />
            </div>
          )}

          <div className="mt-5 p-3 rounded-xl bg-panel-900 border border-white/5">
            <div className="flex items-center justify-between text-sm">
              <div className="text-slate-400">Change to return</div>
              <div className="text-leaf-500 font-extrabold text-lg tabular-nums">
                {money(change)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
