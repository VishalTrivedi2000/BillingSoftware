import { useState, type ComponentType } from 'react';
import { Calendar, FileSpreadsheet, FileText, Mail, Plus, X } from 'lucide-react';
import { Modal } from './Modal';

/**
 * Schedule & Export Report modal (matches screenshot 20).
 *
 * Provides a uniform schedule / export experience for every report page.
 * On confirm we call `onExport` (one-time download) or `onSchedule` (recurring delivery).
 * The default Export+Schedule flow is local (UI-only); a backend endpoint can be
 * plugged in via the optional callbacks.
 */

export type ReportExportFormat = 'pdf' | 'excel' | 'csv';
export type ReportSchedule = 'once' | 'daily' | 'weekly' | 'monthly';

export type ScheduleReportPayload = {
  reportName: string;
  reportType: string;
  fromDate: string;
  toDate: string;
  format: ReportExportFormat;
  recipients: string[];
  frequency: ReportSchedule;
  includeCharts: boolean;
  includeSummaryCards: boolean;
  passwordProtect: boolean;
  emailOnCompletion: boolean;
};

export function ScheduleReportModal({
  open,
  onClose,
  defaults,
  onExport,
  onSchedule,
}: {
  open: boolean;
  onClose: () => void;
  defaults: Partial<ScheduleReportPayload>;
  onExport?: (p: ScheduleReportPayload) => void | Promise<void>;
  onSchedule?: (p: ScheduleReportPayload) => void | Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [name, setName] = useState(defaults.reportName ?? 'Report');
  const [type, setType] = useState(defaults.reportType ?? 'General report');
  const [fromDate, setFromDate] = useState(defaults.fromDate ?? sevenDaysAgo);
  const [toDate, setToDate] = useState(defaults.toDate ?? today);
  const [format, setFormat] = useState<ReportExportFormat>(defaults.format ?? 'pdf');
  const [recipients, setRecipients] = useState<string[]>(defaults.recipients ?? []);
  const [recipientInput, setRecipientInput] = useState('');
  const [frequency, setFrequency] = useState<ReportSchedule>(defaults.frequency ?? 'once');
  const [includeCharts, setIncludeCharts] = useState(defaults.includeCharts ?? true);
  const [includeSummary, setIncludeSummary] = useState(defaults.includeSummaryCards ?? true);
  const [passwordProtect, setPasswordProtect] = useState(defaults.passwordProtect ?? false);
  const [emailOnCompletion, setEmailOnCompletion] = useState(defaults.emailOnCompletion ?? true);
  const [busy, setBusy] = useState(false);

  function addRecipient() {
    const trimmed = recipientInput.trim();
    if (!trimmed) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setRecipientInput('');
      return;
    }
    setRecipients((r) => Array.from(new Set([...r, trimmed])));
    setRecipientInput('');
  }
  function removeRecipient(email: string) {
    setRecipients((r) => r.filter((x) => x !== email));
  }

  function build(): ScheduleReportPayload {
    return {
      reportName: name,
      reportType: type,
      fromDate,
      toDate,
      format,
      recipients,
      frequency,
      includeCharts,
      includeSummaryCards: includeSummary,
      passwordProtect,
      emailOnCompletion,
    };
  }

  async function handleExport() {
    if (busy) return;
    setBusy(true);
    try {
      await onExport?.(build());
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function handleSchedule() {
    if (busy) return;
    setBusy(true);
    try {
      await onSchedule?.(build());
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Schedule & Export Report"
      subtitle="Configure your report, choose delivery options, and schedule or export."
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-400/40 bg-blue-500/10 px-4 py-2 text-sm font-semibold text-blue-100 hover:bg-blue-500/20"
          >
            <FileText className="h-4 w-4" /> Export now
          </button>
          <button
            type="button"
            onClick={handleSchedule}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            <Calendar className="h-4 w-4" /> Save schedule
          </button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-300">
              Report name *
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
              />
            </label>
            <label className="text-xs font-semibold text-slate-300">
              Report type
              <input
                type="text"
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-300">
              From date
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
              />
            </label>
            <label className="text-xs font-semibold text-slate-300">
              To date
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-white focus:border-blue-400 focus:outline-none"
              />
            </label>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-300">Format</p>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {(
                [
                  { v: 'pdf', label: 'PDF', icon: FileText, tone: 'rose' },
                  { v: 'excel', label: 'Excel', icon: FileSpreadsheet, tone: 'emerald' },
                  { v: 'csv', label: 'CSV', icon: FileText, tone: 'blue' },
                ] as const
              ).map((opt) => {
                const active = format === opt.v;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setFormat(opt.v)}
                    className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                      active
                        ? 'border-blue-400/60 bg-blue-500/15 text-blue-100'
                        : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-300">Recipients</p>
            <div className="mt-1 flex flex-wrap gap-1.5 rounded-lg border border-white/10 bg-slate-900/80 p-2">
              {recipients.map((r) => (
                <span
                  key={r}
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-500/15 px-2 py-0.5 text-xs text-blue-100"
                >
                  {r}
                  <button
                    type="button"
                    onClick={() => removeRecipient(r)}
                    className="rounded-sm hover:bg-blue-500/40"
                    aria-label={`Remove ${r}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                type="email"
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                placeholder="Add email address…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addRecipient();
                  }
                }}
                onBlur={addRecipient}
                className="min-w-[180px] flex-1 bg-transparent px-2 py-1 text-sm text-white focus:outline-none"
              />
              <button
                type="button"
                onClick={addRecipient}
                className="inline-flex items-center gap-1 rounded-md px-2 text-xs font-semibold text-slate-300 hover:bg-white/10"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-300">Frequency</p>
            <div className="mt-1 grid grid-cols-4 gap-2">
              {(['once', 'daily', 'weekly', 'monthly'] as const).map((f) => {
                const active = frequency === f;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFrequency(f)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? 'border-blue-400/60 bg-blue-500/15 text-blue-100'
                        : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {f.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>

          <fieldset className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <legend className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Options
            </legend>
            <ToggleRow checked={includeCharts} onChange={setIncludeCharts} label="Include charts" hint="Add visual charts and graphs in the report" />
            <ToggleRow checked={includeSummary} onChange={setIncludeSummary} label="Include summary cards" hint="Include summary metric cards" />
            <ToggleRow checked={passwordProtect} onChange={setPasswordProtect} label="Password protect" hint="Require password to open the exported file" />
            <ToggleRow checked={emailOnCompletion} onChange={setEmailOnCompletion} label="Email on completion" hint="Send an email notification when the report is ready" icon={Mail} />
          </fieldset>
        </div>

        <aside className="rounded-xl border border-white/10 bg-slate-950/50 p-4 text-xs text-slate-300">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Export preview
          </p>
          <div className="mt-3 aspect-[3/4] rounded-md border border-white/10 bg-slate-900/80 p-3">
            <div className="h-2 w-1/2 rounded bg-slate-700" />
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <div className="h-6 rounded bg-blue-500/20" />
              <div className="h-6 rounded bg-emerald-500/20" />
              <div className="h-6 rounded bg-amber-500/20" />
            </div>
            <div className="mt-2 h-16 rounded bg-slate-800/70" />
            <div className="mt-2 space-y-1.5">
              <div className="h-1.5 rounded bg-slate-700" />
              <div className="h-1.5 w-4/5 rounded bg-slate-700" />
              <div className="h-1.5 w-3/5 rounded bg-slate-700" />
              <div className="h-1.5 w-2/3 rounded bg-slate-700" />
            </div>
          </div>
          <dl className="mt-3 space-y-1 text-[11px]">
            <Pair k="Estimated size" v={`~ ${(0.6 + recipients.length * 0.1).toFixed(1)} MB`} />
            <Pair k="Format" v={format.toUpperCase()} />
            <Pair k="Recipients" v={recipients.length > 0 ? String(recipients.length) : '—'} />
            <Pair k="Frequency" v={frequency.toUpperCase()} />
            <Pair k="Date range" v={`${fromDate} → ${toDate}`} />
          </dl>
        </aside>
      </div>
    </Modal>
  );
}

function ToggleRow({
  checked,
  onChange,
  label,
  hint,
  icon: Icon,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <span
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
          checked ? 'bg-blue-500' : 'bg-slate-700'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </span>
      <span className="flex-1">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-100">
          {Icon && <Icon className="h-3.5 w-3.5" />} {label}
        </span>
        {hint && <span className="block text-[11px] text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}

function Pair({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-right font-medium text-slate-100">{v}</dd>
    </div>
  );
}
