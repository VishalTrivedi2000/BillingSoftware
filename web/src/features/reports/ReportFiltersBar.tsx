import { CalendarRange, Filter } from 'lucide-react';
import type { PeriodPresetId } from './dateRangePresets';
import { PRESET_OPTIONS } from './dateRangePresets';

type Props = {
  preset: PeriodPresetId;
  onPresetChange: (id: PeriodPresetId) => void;
  fromDate: string;
  toDate: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
};

export function ReportFiltersBar({
  preset,
  onPresetChange,
  fromDate,
  toDate,
  onFromChange,
  onToChange,
  search,
  onSearchChange,
  searchPlaceholder = 'Search in loaded rows…',
}: Props) {
  return (
    <div className="workspace-panel-soft flex flex-col gap-4 p-4 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex min-w-[160px] flex-col gap-1.5 text-xs font-medium text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 opacity-70" aria-hidden />
          Period
        </span>
        <select
          value={preset}
          onChange={(e) => onPresetChange(e.target.value as PeriodPresetId)}
          className="rounded-lg border border-white/10 bg-[#0f141f] px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500/50"
        >
          {PRESET_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-w-[140px] flex-col gap-1.5 text-xs font-medium text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <CalendarRange className="h-3.5 w-3.5 opacity-70" aria-hidden />
          From
        </span>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => onFromChange(e.target.value)}
          disabled={preset !== 'custom'}
          className="rounded-lg border border-white/10 bg-[#0f141f] px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500/50 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </label>

      <label className="flex min-w-[140px] flex-col gap-1.5 text-xs font-medium text-slate-400">
        <span>To</span>
        <input
          type="date"
          value={toDate}
          onChange={(e) => onToChange(e.target.value)}
          disabled={preset !== 'custom'}
          className="rounded-lg border border-white/10 bg-[#0f141f] px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500/50 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </label>

      <label className="flex min-w-[220px] flex-1 flex-col gap-1.5 text-xs font-medium text-slate-400">
        <span>Search</span>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="rounded-lg border border-white/10 bg-[#0f141f] px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-blue-500/50"
        />
      </label>

      <p className="text-[11px] leading-snug text-slate-600 sm:basis-full">
        Dates filter on the server (invoice issue date / purchase bill date, UTC calendar day). Multi-firm and per-user filters are not wired yet — data follows your active workspace.
      </p>
    </div>
  );
}
