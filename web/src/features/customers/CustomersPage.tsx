import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { FileText, Loader2, Pencil, Plus, Search, Users, X } from 'lucide-react';
import type { AuthUserSummary } from '../../entities/auth-types';
import type { CreateCustomerBody, CustomerDto } from '../../entities/billing';
import { useAppSelector } from '../../app/hooks';
import { selectIsAuthenticated, selectWorkplaceSnapshot } from '../../features/auth/authSlice';
import { apiJsonAuth, authApi } from '../../shared/api/axiosClient';

type EditorMode = 'create' | 'edit';

function CustomerEditorModal(props: {
  open: boolean;
  mode: EditorMode;
  customer: CustomerDto | null;
  onClose: () => void;
}) {
  const { open, mode, customer, onClose } = props;
  const qc = useQueryClient();

  const [name, setName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [localErr, setLocalErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLocalErr(null);
    if (mode === 'edit' && customer) {
      setName(customer.name);
      setTaxId(customer.taxId ?? '');
      setEmail(customer.email ?? '');
      setPhone(customer.phone ?? '');
    } else {
      setName('');
      setTaxId('');
      setEmail('');
      setPhone('');
    }
  }, [open, mode, customer]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const body: CreateCustomerBody = {
        name: name.trim(),
        taxId: taxId.trim() === '' ? null : taxId.trim(),
        email: email.trim() === '' ? null : email.trim(),
        phone: phone.trim() === '' ? null : phone.trim(),
      };
      if (mode === 'create') {
        await authApi.post('/v1/customers', body);
      } else {
        if (!customer) throw new Error('No customer');
        await authApi.patch(`/v1/customers/${customer.customerId}`, body);
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['customers-directory'] });
      await qc.invalidateQueries({ queryKey: ['customers-pick'] });
      await qc.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      onClose();
    },
    onError: (e: unknown) => {
      const msg = axios.isAxiosError(e)
        ? e.response?.status === 403
          ? 'Permission denied for this action.'
          : String(e.response?.data ?? e.response?.status ?? e.message)
        : 'Could not save customer.';
      setLocalErr(msg);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalErr(null);
    if (!name.trim()) {
      setLocalErr('Name is required.');
      return;
    }
    saveMut.mutate();
  }

  if (!open) return null;

  const title = mode === 'create' ? 'New customer' : 'Edit customer';

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/15 bg-[#111827] shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form className="space-y-4 p-5" onSubmit={(ev) => void onSubmit(ev)}>
          <label className="block text-xs font-semibold text-slate-400">
            Display name
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              placeholder="Company or person"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-400">
            Tax ID (GST / PAN / etc.)
            <input
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              placeholder="Optional"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-400">
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              placeholder="Optional"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-400">
            Phone
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              placeholder="Optional"
            />
          </label>
          {localErr && <p className="text-sm text-rose-300">{localErr}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saveMut.isPending}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {saveMut.isPending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : mode === 'create' ? 'Create' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CustomersPage() {
  const authed = useAppSelector(selectIsAuthenticated);
  const workplace = useAppSelector(selectWorkplaceSnapshot);
  const workplaceOrgId = workplace?.organizationId ?? 0;

  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>('create');
  const [editing, setEditing] = useState<CustomerDto | null>(null);

  const authMeQ = useQuery({
    queryKey: ['auth-me-header'],
    enabled: authed,
    queryFn: () => apiJsonAuth<AuthUserSummary>('/v1/auth/me'),
    staleTime: 60_000,
    retry: 1,
  });

  const canCreate = authMeQ.data?.permissions?.includes('customers.create') ?? false;
  const canUpdate = authMeQ.data?.permissions?.includes('customers.update') ?? false;
  const canCreateInvoice = authMeQ.data?.permissions?.includes('invoices.create') ?? false;

  const showRowActions = canUpdate || canCreateInvoice;

  const q = useQuery({
    queryKey: ['customers-directory', workplaceOrgId],
    enabled: authed && workplace != null,
    queryFn: async () => {
      const { data } = await authApi.get<CustomerDto[]>('/v1/customers?max=500');
      return data;
    },
    retry: 1,
  });

  const filtered = useMemo(() => {
    const rows = q.data ?? [];
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((c) => {
      const hay = [c.name, c.taxId ?? '', c.email ?? '', c.phone ?? '', String(c.customerId)].join('\n').toLowerCase();
      return hay.includes(s);
    });
  }, [q.data, search]);

  function openCreate() {
    setEditing(null);
    setEditorMode('create');
    setEditorOpen(true);
  }

  function openEdit(c: CustomerDto) {
    setEditing(c);
    setEditorMode('edit');
    setEditorOpen(true);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-blue-400/90">Masters</p>
          <h2 className="mt-1 flex items-center gap-3 text-2xl font-bold text-white">
            <Users className="h-8 w-8 text-blue-400" aria-hidden />
            Customers
          </h2>
          <p className="mt-2 max-w-xl text-sm text-slate-400">
            Buyers for your active organization — used when creating invoices. Add or edit records here; permissions follow{' '}
            <span className="font-mono text-slate-500">customers.read</span>,{' '}
            <span className="font-mono text-slate-500">customers.create</span>,{' '}
            <span className="font-mono text-slate-500">customers.update</span>. Use{' '}
            <span className="font-mono text-slate-500">invoices.create</span> to open new invoices from a row.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canCreate && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add customer
            </button>
          )}
          <Link
            to="/invoices/new"
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Invoice a customer
          </Link>
        </div>
      </header>

      <div className="workspace-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, tax ID, email, phone…"
              className="w-full rounded-xl border border-slate-700 bg-[#1f2937] py-2.5 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
            />
          </div>
          {q.data && (
            <p className="shrink-0 text-xs text-slate-500">
              Showing <span className="font-semibold text-slate-300">{filtered.length}</span> of{' '}
              <span className="font-semibold text-slate-300">{q.data.length}</span>
            </p>
          )}
        </div>

        {q.isLoading && (
          <div className="flex items-center gap-3 px-6 py-16 text-slate-400">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-blue-400/30 border-t-blue-400" />
            Loading directory…
          </div>
        )}
        {q.isError && (
          <div role="alert" className="border border-rose-500/20 bg-rose-500/10 px-6 py-8 text-sm text-rose-200">
            Unable to load customers — needs <span className="font-mono">customers.read</span>.
          </div>
        )}
        {q.data && q.data.length === 0 && (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-slate-500">No customers yet for this organization.</p>
            {canCreate && (
              <button
                type="button"
                onClick={openCreate}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                <Plus className="h-4 w-4" />
                Add your first customer
              </button>
            )}
          </div>
        )}
        {q.data && q.data.length > 0 && filtered.length === 0 && (
          <p className="px-6 py-12 text-center text-sm text-slate-500">No customers match your search.</p>
        )}
        {filtered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Tax ID</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Phone</th>
                  <th className="px-6 py-4 font-mono text-xs">ID</th>
                  {showRowActions && <th className="px-6 py-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.customerId} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <td className="px-6 py-3 font-medium text-slate-100">{c.name}</td>
                    <td className="px-6 py-3 text-slate-400">{c.taxId ?? '—'}</td>
                    <td className="px-6 py-3 text-slate-400">{c.email ?? '—'}</td>
                    <td className="px-6 py-3 text-slate-400">{c.phone ?? '—'}</td>
                    <td className="px-6 py-3 font-mono text-xs text-slate-500">{c.customerId}</td>
                    {showRowActions && (
                      <td className="px-6 py-3 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {canCreateInvoice && (
                            <Link
                              to={`/invoices/new?customerId=${c.customerId}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-teal-300 hover:bg-white/5"
                            >
                              <FileText className="h-3.5 w-3.5" aria-hidden />
                              Invoice
                            </Link>
                          )}
                          {canUpdate && (
                            <button
                              type="button"
                              onClick={() => openEdit(c)}
                              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs font-semibold text-blue-300 hover:bg-white/5"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden />
                              Edit
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CustomerEditorModal
        open={editorOpen}
        mode={editorMode}
        customer={editing}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
      />
    </div>
  );
}
