import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Loader2, Plus } from 'lucide-react';
import axios from 'axios';
import type { PartyDto, CreatePartyBody, UpdatePartyBody } from '../../entities/billing';
import { useAppSelector } from '../../app/hooks';
import { selectIsAuthenticated, selectWorkplaceSnapshot } from '../../features/auth/authSlice';
import { authApi } from '../../shared/api/axiosClient';

const KIND_OPTIONS = ['Customer', 'Vendor', 'Other'] as const;

export function PartiesPage() {
  const authed = useAppSelector(selectIsAuthenticated);
  const workplace = useAppSelector(selectWorkplaceSnapshot);
  const workplaceOrgId = workplace?.organizationId ?? 0;
  const qc = useQueryClient();

  const [kind, setKind] = useState<string>('Customer');
  const [displayName, setDisplayName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const listQ = useQuery({
    queryKey: ['parties-directory', workplaceOrgId],
    enabled: authed && workplace != null,
    queryFn: async () => {
      const { data } = await authApi.get<PartyDto[]>('/v1/parties?max=400');
      return data;
    },
    retry: 1,
  });

  const createMut = useMutation({
    mutationFn: async (body: CreatePartyBody) => {
      const { data } = await authApi.post<{ partyId: number }>('/v1/parties', body);
      return data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['parties-directory'] });
      setDisplayName('');
      setLegalName('');
      setTaxId('');
      setEmail('');
      setPhone('');
      setNotes('');
      setKind('Customer');
      setFormError(null);
    },
    onError: (e: unknown) => {
      const msg =
        axios.isAxiosError(e) && e.response?.status === 403
          ? 'You need parties.manage (organization administrators / billing staff with onboarding rights).'
          : axios.isAxiosError(e)
            ? `Could not create party (${e.response?.status ?? 'network'}).`
            : 'Could not create party.';
      setFormError(msg);
    },
  });

  const [patchBanner, setPatchBanner] = useState<string | null>(null);

  const patchMut = useMutation({
    mutationFn: async ({ partyId, body }: { partyId: number; body: UpdatePartyBody }) => {
      await authApi.patch(`/v1/parties/${partyId}`, body);
    },
    onSuccess: async () => {
      setPatchBanner(null);
      await qc.invalidateQueries({ queryKey: ['parties-directory'] });
    },
    onError: (e: unknown) => {
      const msg =
        axios.isAxiosError(e) && e.response?.status === 403
          ? 'Cannot update party — requires parties.manage.'
          : axios.isAxiosError(e)
            ? `Update failed (${e.response?.status ?? 'network'}).`
            : 'Update failed.';
      setPatchBanner(msg);
    },
  });

  function onCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const dn = displayName.trim();
    if (!dn) {
      setFormError('Display name is required.');
      return;
    }
    const body: CreatePartyBody = {
      kind,
      displayName: dn,
      legalName: legalName.trim() || null,
      taxId: taxId.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      notes: notes.trim() || null,
    };
    createMut.mutate(body);
  }

  function toggleActive(row: PartyDto) {
    const body: UpdatePartyBody = {
      kind: row.kind,
      displayName: row.displayName,
      legalName: row.legalName,
      taxId: row.taxId,
      email: row.email,
      phone: row.phone,
      notes: row.notes,
      isActive: !row.isActive,
    };
    patchMut.mutate({ partyId: row.partyId, body });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-blue-400/90">Masters · Organization</p>
          <h2 className="mt-1 flex items-center gap-3 text-2xl font-bold text-white">
            <Building2 className="h-8 w-8 text-blue-400" aria-hidden />
            Party onboarding
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Register counterparties for this organization — customers, vendors, or other relationships. Scoped to your current workplace (
            <span className="font-mono text-slate-300">organizationId</span> from JWT). Requires{' '}
            <span className="font-mono text-xs text-slate-400">parties.manage</span> to add or update records.
          </p>
        </div>
      </header>

      <section className="workspace-panel overflow-hidden p-6">
        <h3 className="text-sm font-semibold text-white">Add party</h3>
        <p className="mt-1 text-xs text-slate-500">Organization admins and seeded billing staff can onboard parties for invoicing and procurement workflows.</p>
        <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={(ev) => void onCreate(ev)}>
          <div className="sm:col-span-1">
            <label className="mb-1 block text-xs font-medium text-slate-400">Kind</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
            >
              {KIND_OPTIONS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-1">
            <label className="mb-1 block text-xs font-medium text-slate-400">Display name</label>
            <input
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Acme Corp"
              className="w-full rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-400">Legal name (optional)</label>
            <input
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Tax ID</label>
            <input
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Phone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-400">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-[#1f2937] px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500"
            />
          </div>
          {formError && (
            <div role="alert" className="sm:col-span-2 rounded-lg border border-rose-500/30 bg-rose-950/40 px-3 py-2 text-sm text-rose-200">
              {formError}
            </div>
          )}
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={createMut.isPending || !authed}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Save party
            </button>
          </div>
        </form>
      </section>

      <section className="workspace-panel overflow-hidden">
        {patchBanner && (
          <div role="alert" className="border-b border-amber-500/30 bg-amber-950/30 px-6 py-3 text-sm text-amber-100">
            {patchBanner}
          </div>
        )}
        <div className="border-b border-white/10 px-6 py-4">
          <h3 className="text-sm font-semibold text-white">Directory</h3>
          <p className="mt-0.5 text-xs text-slate-500">Filtered server-side to tenant + organization from your session.</p>
        </div>
        {listQ.isLoading && (
          <div className="flex items-center gap-3 px-6 py-16 text-slate-400">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-blue-400/30 border-t-blue-400" />
            Loading parties…
          </div>
        )}
        {listQ.isError && (
          <div role="alert" className="border border-rose-500/20 bg-rose-500/10 px-6 py-8 text-sm text-rose-200">
            Unable to load parties — needs <span className="font-mono">parties.read</span>.
          </div>
        )}
        {listQ.data && listQ.data.length === 0 && (
          <p className="px-6 py-16 text-center text-sm text-slate-500">No parties onboarded yet for this organization.</p>
        )}
        {listQ.data && listQ.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-6 py-4">Display name</th>
                  <th className="px-6 py-4">Kind</th>
                  <th className="px-6 py-4">Tax ID</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 font-mono text-xs">ID</th>
                  <th className="px-6 py-4"> </th>
                </tr>
              </thead>
              <tbody>
                {listQ.data.map((p) => (
                  <tr key={p.partyId} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <td className="px-6 py-3 font-medium text-slate-100">{p.displayName}</td>
                    <td className="px-6 py-3 text-slate-400">{p.kind}</td>
                    <td className="px-6 py-3 text-slate-400">{p.taxId ?? '—'}</td>
                    <td className="px-6 py-3 text-slate-400">
                      {[p.email, p.phone].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          p.isActive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-600/40 text-slate-400'
                        }`}
                      >
                        {p.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-mono text-xs text-slate-500">{p.partyId}</td>
                    <td className="px-6 py-3">
                      <button
                        type="button"
                        disabled={patchMut.isPending}
                        onClick={() => toggleActive(p)}
                        className="text-xs font-semibold text-blue-400 hover:text-blue-300 disabled:opacity-50"
                      >
                        {p.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
