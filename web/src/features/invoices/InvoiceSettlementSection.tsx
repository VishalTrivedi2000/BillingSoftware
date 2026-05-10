import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Banknote, Loader2, Plus, Wallet } from 'lucide-react';
import type { InvoiceDetailDto } from '../../entities/billing';
import { authApi } from '../../shared/api/axiosClient';

const CHANNELS: { value: string; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
];

function fmtInr(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);
}

function fmtReceived(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function channelLabel(raw: string | null): string {
  if (!raw) return '—';
  const f = CHANNELS.find((c) => c.value === raw);
  return f?.label ?? raw;
}

type Props = {
  invoice: InvoiceDetailDto;
  invoiceId: number;
  workplaceOrgId: number;
  canRecord: boolean;
};

export function InvoiceSettlementSection(props: Props) {
  const { invoice: inv, invoiceId, workplaceOrgId, canRecord } = props;
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [channel, setChannel] = useState('bank_transfer');
  const [referenceNote, setReferenceNote] = useState('');
  const [receivedLocal, setReceivedLocal] = useState('');
  const [localErr, setLocalErr] = useState<string | null>(null);

  useEffect(() => {
    if (!modalOpen) return;
    setLocalErr(null);
    const bal = Math.max(0, inv.balanceDue);
    setAmount(bal > 0 ? String(bal) : '');
    setChannel('bank_transfer');
    setReferenceNote('');
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    setReceivedLocal(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
  }, [modalOpen, inv.balanceDue]);

  useEffect(() => {
    if (!modalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setModalOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  const recordMut = useMutation({
    mutationFn: async () => {
      const n = Number(amount);
      if (!Number.isFinite(n) || n <= 0) throw new Error('Enter a valid amount.');
      let receivedUtc: string | undefined;
      if (receivedLocal.trim()) {
        const dt = new Date(receivedLocal);
        if (!Number.isFinite(dt.getTime())) throw new Error('Invalid date/time.');
        receivedUtc = dt.toISOString();
      }
      await authApi.post(`/v1/invoices/${invoiceId}/payments`, {
        amount: n,
        receivedUtc: receivedUtc ?? null,
        channel: channel || null,
        referenceNote: referenceNote.trim() || null,
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['invoice-detail', invoiceId, workplaceOrgId] });
      await qc.invalidateQueries({ queryKey: ['invoices-list', workplaceOrgId] });
      await qc.invalidateQueries({ queryKey: ['invoices-recent', workplaceOrgId] });
      await qc.invalidateQueries({ queryKey: ['dashboard-metrics', workplaceOrgId] });
      setModalOpen(false);
    },
    onError: (e: unknown) => {
      const msg = axios.isAxiosError(e)
        ? e.response?.status === 403
          ? 'You do not have permission to record settlements.'
          : e.response?.status === 409
            ? String(e.response?.data ?? 'Cannot record this receipt.')
            : String(e.response?.data ?? e.message)
        : e instanceof Error
          ? e.message
          : 'Could not record receipt.';
      setLocalErr(msg);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalErr(null);
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setLocalErr('Amount must be greater than zero.');
      return;
    }
    if (n > inv.balanceDue + 0.009) {
      setLocalErr(`Amount cannot exceed balance due (${fmtInr(inv.balanceDue)}).`);
      return;
    }
    recordMut.mutate();
  }

  const settled = inv.status.toLowerCase() === 'paid' || inv.balanceDue <= 0.009;

  return (
    <section className="no-print workspace-panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300">
            <Wallet className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Settlement</h2>
            <p className="mt-1 max-w-xl text-sm text-slate-400">
              Track what the customer has paid against this invoice. Totals stay aligned with your workspace rounding rules.
            </p>
          </div>
        </div>
        {canRecord && !settled && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-500"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Record receipt
          </button>
        )}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Invoice total</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-white">{fmtInr(inv.totalAmount)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Received</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-teal-300">{fmtInr(inv.amountPaid)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Balance due</p>
          <p className={`mt-1 font-mono text-lg font-semibold tabular-nums ${settled ? 'text-emerald-300' : 'text-amber-200'}`}>
            {fmtInr(Math.max(0, inv.balanceDue))}
          </p>
        </div>
      </div>

      {inv.payments.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Received</th>
                <th className="py-2 pr-4">Channel</th>
                <th className="py-2 pr-4">Reference</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {inv.payments.map((p) => (
                <tr key={p.invoicePaymentId} className="border-b border-white/5">
                  <td className="py-3 pr-4 text-slate-300">{fmtReceived(p.receivedUtc)}</td>
                  <td className="py-3 pr-4 text-slate-400">{channelLabel(p.channel)}</td>
                  <td className="py-3 pr-4 font-mono text-xs text-slate-500">{p.referenceNote ?? '—'}</td>
                  <td className="py-3 text-right font-medium tabular-nums text-slate-100">{fmtInr(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {inv.payments.length === 0 && (
        <p className="mt-6 text-sm text-slate-500">No receipts recorded yet for this invoice.</p>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) setModalOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/15 bg-[#111827] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-white/10 px-5 py-4">
              <h3 className="flex items-center gap-2 text-lg font-bold text-white">
                <Banknote className="h-5 w-5 text-teal-400" aria-hidden />
                Record receipt
              </h3>
              <p className="mt-1 text-xs text-slate-500">Balance due {fmtInr(inv.balanceDue)}</p>
            </div>
            <form className="space-y-4 p-5" onSubmit={(e) => void onSubmit(e)}>
              <label className="block text-xs font-semibold text-slate-400">
                Amount (INR)
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min={0.01}
                  max={inv.balanceDue}
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm text-white outline-none focus:border-teal-500"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-400">
                Received at (local)
                <input
                  type="datetime-local"
                  value={receivedLocal}
                  onChange={(e) => setReceivedLocal(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm text-white outline-none focus:border-teal-500"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-400">
                Channel
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm text-white outline-none focus:border-teal-500"
                >
                  {CHANNELS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-slate-400">
                Reference / UTR (optional)
                <input
                  value={referenceNote}
                  onChange={(e) => setReferenceNote(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm text-white outline-none focus:border-teal-500"
                  placeholder="e.g. bank reference"
                />
              </label>
              {localErr && <p className="text-sm text-rose-300">{localErr}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordMut.isPending}
                  className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
                >
                  {recordMut.isPending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Save receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
