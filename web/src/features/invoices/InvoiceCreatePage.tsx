import { FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import axios from 'axios';
import type { CreateInvoiceBody, CustomerDto, ProductDto } from '../../entities/billing';
import { useAppSelector } from '../../app/hooks';
import { selectWorkplaceSnapshot } from '../../features/auth/authSlice';
import { authApi } from '../../shared/api/axiosClient';
import { roundMoney2 } from './invoiceMoney';

type DraftLine = {
  key: string;
  productId: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
};

function newLine(): DraftLine {
  return {
    key: crypto.randomUUID(),
    productId: null,
    description: '',
    quantity: 1,
    unitPrice: 0,
  };
}

export function InvoiceCreatePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const workplaceOrgId = useAppSelector(selectWorkplaceSnapshot)?.organizationId ?? 0;

  const [customerId, setCustomerId] = useState<number | ''>('');
  const [lines, setLines] = useState<DraftLine[]>(() => [newLine()]);
  const [formError, setFormError] = useState<string | null>(null);

  const customersQ = useQuery({
    queryKey: ['customers-pick', workplaceOrgId],
    queryFn: async () => {
      const { data } = await authApi.get<CustomerDto[]>('/v1/customers?max=300');
      return data;
    },
    retry: 1,
  });

  const productsQ = useQuery({
    queryKey: ['products-pick', workplaceOrgId],
    queryFn: async () => {
      const { data } = await authApi.get<ProductDto[]>('/v1/products?activeOnly=true&max=300');
      return data;
    },
    retry: 1,
  });

  const productsById = useMemo(() => {
    const m = new Map<number, ProductDto>();
    for (const p of productsQ.data ?? []) m.set(p.productId, p);
    return m;
  }, [productsQ.data]);

  const previewTotal = useMemo(() => {
    let t = 0;
    for (const line of lines) {
      t += roundMoney2(line.quantity * line.unitPrice);
    }
    return roundMoney2(t);
  }, [lines]);

  const createMut = useMutation({
    mutationFn: async (body: CreateInvoiceBody) => {
      try {
        const { data } = await authApi.post<{ invoiceId: number }>('/v1/invoices', body);
        return data;
      } catch (e) {
        if (axios.isAxiosError(e)) {
          const status = e.response?.status;
          if (status === 401) throw new Error('Unauthorized — sign in again.');
          const d = e.response?.data;
          const msg =
            typeof d === 'string'
              ? d
              : d && typeof d === 'object' && 'title' in d
                ? String((d as { title?: string }).title)
                : '';
          throw new Error(msg.replace(/^\s+|\s+$/g, '').slice(0, 240) || `Request failed (${status}).`);
        }
        throw e;
      }
    },
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: ['invoices-list'] });
      await qc.invalidateQueries({ queryKey: ['invoices-recent'] });
      await qc.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      navigate(`/invoices/${data.invoiceId}`);
    },
  });

  function setLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function onProductPick(lineKey: string, raw: string) {
    if (raw === '') {
      setLine(lineKey, { productId: null });
      return;
    }
    const pid = Number(raw);
    const p = productsById.get(pid);
    if (!p) return;
    setLine(lineKey, {
      productId: pid,
      description: p.name,
      unitPrice: p.unitPrice,
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (customerId === '') {
      setFormError('Select a customer.');
      return;
    }

    const payloadLines = lines.map((l) => ({
      productId: l.productId,
      description: l.description.trim(),
      quantity: l.quantity,
      unitPrice: l.unitPrice,
    }));

    for (let i = 0; i < payloadLines.length; i++) {
      const line = payloadLines[i];
      if (!line.description) {
        setFormError(`Line ${i + 1}: description is required.`);
        return;
      }
      if (!(line.quantity > 0)) {
        setFormError(`Line ${i + 1}: quantity must be greater than zero.`);
        return;
      }
    }

    if (payloadLines.length === 0) {
      setFormError('Add at least one line.');
      return;
    }

    const body: CreateInvoiceBody = {
      customerId,
      lines: payloadLines.map((l) => ({
        productId: l.productId,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
    };

    createMut.mutate(body);
  }

  const fmtInrPreview = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
  const field =
    'mt-1 w-full rounded-lg border border-white/15 bg-[#1a1f2e] px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/25';

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <Link to="/invoices" className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white">
          <ArrowLeft size={16} aria-hidden />
          Back to invoices
        </Link>
      </div>

      <header>
        <h1 className="text-3xl font-bold tracking-tight text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
          New invoice
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Lines use the same rounding as the API (<span className="font-mono text-xs">decimal × qty → 2dp half-away-from-zero</span>). Invoice is posted
          immediately with generated number.
        </p>
      </header>

      <form onSubmit={(e) => void onSubmit(e)} className="workspace-panel space-y-8 p-6 sm:p-8">
        <div className="grid gap-6 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-sm font-semibold text-slate-300">Customer</span>
            <select
              required
              value={customerId === '' ? '' : String(customerId)}
              onChange={(e) => setCustomerId(e.target.value === '' ? '' : Number(e.target.value))}
              className={`${field} mt-2 max-w-xl`}
              disabled={customersQ.isLoading}
            >
              <option value="">Select customer…</option>
              {(customersQ.data ?? []).map((c) => (
                <option key={c.customerId} value={c.customerId}>
                  {c.name}
                </option>
              ))}
            </select>
            {customersQ.isError && (
              <p className="mt-2 text-xs text-rose-400">Could not load customers (need customers.read).</p>
            )}
          </label>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-white">Lines</h2>
            <button
              type="button"
              onClick={() => setLines((prev) => [...prev, newLine()])}
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-white/10"
            >
              <Plus size={16} aria-hidden />
              Add line
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {lines.map((line, idx) => (
              <div key={line.key} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Line {idx + 1}</span>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                      className="rounded-lg p-2 text-slate-500 hover:bg-rose-500/15 hover:text-rose-300"
                      aria-label="Remove line"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
                <div className="grid gap-4 lg:grid-cols-12">
                  <label className="lg:col-span-4">
                    <span className="text-xs font-medium text-slate-400">Product (optional)</span>
                    <select
                      value={line.productId ?? ''}
                      onChange={(e) => onProductPick(line.key, e.target.value)}
                      className={field}
                      disabled={productsQ.isLoading}
                    >
                      <option value="">Manual description</option>
                      {(productsQ.data ?? []).map((p) => (
                        <option key={p.productId} value={p.productId}>
                          {p.sku ? `${p.sku} · ` : ''}
                          {p.name} ({fmtInrPreview.format(p.unitPrice)})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="lg:col-span-4">
                    <span className="text-xs font-medium text-slate-400">Description</span>
                    <input
                      value={line.description}
                      onChange={(e) => setLine(line.key, { description: e.target.value })}
                      className={field}
                      placeholder="Line description"
                    />
                  </label>
                  <label className="lg:col-span-2">
                    <span className="text-xs font-medium text-slate-400">Qty</span>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      value={line.quantity}
                      onChange={(e) => setLine(line.key, { quantity: Number(e.target.value) })}
                      className={`${field} tabular-nums`}
                    />
                  </label>
                  <label className="lg:col-span-2">
                    <span className="text-xs font-medium text-slate-400">Unit price</span>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      value={line.unitPrice}
                      onChange={(e) => setLine(line.key, { unitPrice: Number(e.target.value) })}
                      className={`${field} tabular-nums`}
                    />
                  </label>
                </div>
                <p className="mt-3 text-right text-xs text-slate-500">
                  Line total:{' '}
                  <span className="font-semibold text-slate-100">{fmtInrPreview.format(roundMoney2(line.quantity * line.unitPrice))}</span>
                </p>
              </div>
            ))}
          </div>

          <p className="mt-6 text-right text-sm text-slate-400">
            Preview total: <span className="text-lg font-bold text-white">{fmtInrPreview.format(previewTotal)}</span>
          </p>
        </div>

        {(formError || createMut.isError) && (
          <div role="alert" className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {formError ?? (createMut.error instanceof Error ? createMut.error.message : 'Could not create invoice.')}
          </div>
        )}

        <div className="flex flex-wrap gap-3 border-t border-white/10 pt-6">
          <button
            type="submit"
            disabled={createMut.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-600/20 transition hover:from-teal-500 hover:to-emerald-500 disabled:opacity-60"
          >
            {createMut.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Creating…
              </>
            ) : (
              'Create invoice'
            )}
          </button>
          <Link to="/invoices" className="rounded-xl border border-white/15 px-6 py-3 text-sm font-medium text-slate-300 hover:bg-white/5">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
