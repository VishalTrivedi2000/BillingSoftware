import { Fragment, useId, useMemo, type ComponentType } from 'react';

/**
 * Pure-SVG chart primitives so we don't add a charting dependency.
 *
 * All charts inherit text colors from the surrounding panel via `currentColor`
 * and are dark-mode native. Pass a `palette` to override defaults.
 */

const DEFAULT_PALETTE = [
  '#60a5fa',
  '#34d399',
  '#fbbf24',
  '#fb7185',
  '#a78bfa',
  '#f472b6',
  '#22d3ee',
  '#f87171',
  '#84cc16',
  '#facc15',
];

function fmtTickShort(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (a >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(Math.round(n));
}

export type ChartTheme = 'dark' | 'light';

const CHART_THEME: Record<
  ChartTheme,
  { legend: string; legendMuted: string; centerTitle: string; centerValue: string; rowName: string; rowValue: string; rowSub: string; track: string }
> = {
  dark: {
    legend: 'text-slate-300',
    legendMuted: 'text-slate-500',
    centerTitle: 'text-slate-400',
    centerValue: 'text-slate-100',
    rowName: 'text-slate-200',
    rowValue: 'text-slate-100',
    rowSub: 'text-slate-500',
    track: 'bg-white/5',
  },
  light: {
    legend: 'text-slate-600',
    legendMuted: 'text-slate-500',
    centerTitle: 'text-slate-500',
    centerValue: 'text-slate-900',
    rowName: 'text-slate-700',
    rowValue: 'text-slate-900',
    rowSub: 'text-slate-500',
    track: 'bg-slate-100',
  },
};

/* ============================================================================
   Sparkline / line chart (multi-series supported)
   ============================================================================ */

export type LineChartSeries = {
  name: string;
  color?: string;
  values: number[];
  area?: boolean;
};

export function LineChart({
  series,
  xLabels,
  height = 200,
  showAxis = true,
  showLegend = true,
  yTickCount = 4,
  formatY,
  theme = 'dark',
}: {
  series: LineChartSeries[];
  xLabels: string[];
  height?: number;
  showAxis?: boolean;
  showLegend?: boolean;
  yTickCount?: number;
  formatY?: (n: number) => string;
  theme?: ChartTheme;
}) {
  const t = CHART_THEME[theme];
  const reactId = useId();
  const safe = useMemo(() => {
    const len = xLabels.length;
    return series.map((s, idx) => ({
      ...s,
      values: Array.from({ length: len }, (_, i) => s.values[i] ?? 0),
      color: s.color ?? DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length],
    }));
  }, [series, xLabels.length]);

  const maxVal = useMemo(() => {
    let max = 0;
    for (const s of safe) for (const v of s.values) if (v > max) max = v;
    return max === 0 ? 1 : max;
  }, [safe]);

  const w = 800;
  const h = height;
  const pad = { left: 44, right: 12, top: 12, bottom: 28 };
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;
  const stepX = innerW / Math.max(1, xLabels.length - 1);

  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => (maxVal * i) / yTickCount);

  return (
    <div>
      {showLegend && (
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          {safe.map((s) => (
            <span key={s.name} className={`flex items-center gap-1.5 ${t.legend}`}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" preserveAspectRatio="none">
        <defs>
          {safe.map((s, idx) => (
            <linearGradient key={`${reactId}-${idx}`} id={`${reactId}-${idx}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {showAxis &&
          yTicks.map((t, i) => {
            const y = pad.top + innerH - (t / maxVal) * innerH;
            return (
              <Fragment key={i}>
                <line
                  x1={pad.left}
                  x2={pad.left + innerW}
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity="0.08"
                />
                <text
                  x={pad.left - 6}
                  y={y + 4}
                  fontSize="10"
                  textAnchor="end"
                  fill="currentColor"
                  fillOpacity="0.55"
                >
                  {formatY ? formatY(t) : fmtTickShort(t)}
                </text>
              </Fragment>
            );
          })}
        {showAxis &&
          xLabels.map((label, i) => {
            const x = pad.left + i * stepX;
            return (
              <text
                key={`x-${i}`}
                x={x}
                y={pad.top + innerH + 18}
                fontSize="10"
                textAnchor="middle"
                fill="currentColor"
                fillOpacity="0.55"
              >
                {label}
              </text>
            );
          })}
        {safe.map((s, sidx) => {
          const points = s.values.map((v, i) => {
            const x = pad.left + i * stepX;
            const y = pad.top + innerH - (v / maxVal) * innerH;
            return `${x},${y}`;
          });
          const area = `${pad.left},${pad.top + innerH} ${points.join(' ')} ${pad.left + innerW},${pad.top + innerH}`;
          return (
            <Fragment key={s.name}>
              {s.area !== false && <polygon fill={`url(#${reactId}-${sidx})`} points={area} />}
              <polyline
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={points.join(' ')}
              />
              {s.values.map((v, i) => {
                const x = pad.left + i * stepX;
                const y = pad.top + innerH - (v / maxVal) * innerH;
                return <circle key={i} cx={x} cy={y} r="2.5" fill={s.color} />;
              })}
            </Fragment>
          );
        })}
      </svg>
    </div>
  );
}

/* ============================================================================
   Donut chart with legend (right side)
   ============================================================================ */

export type DonutSlice = { name: string; value: number; color?: string; href?: string };

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number, innerR: number) {
  const start = polarToCartesian(cx, cy, r, endDeg);
  const end = polarToCartesian(cx, cy, r, startDeg);
  const innerStart = polarToCartesian(cx, cy, innerR, endDeg);
  const innerEnd = polarToCartesian(cx, cy, innerR, startDeg);
  const largeArc = endDeg - startDeg <= 180 ? 0 : 1;
  return [
    `M ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 1 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

export function DonutChart({
  slices,
  centerTitle,
  centerValue,
  size = 200,
  thickness = 36,
  showLegend = true,
  showPercent = true,
  emptyLabel = 'No data',
  theme = 'dark',
}: {
  slices: DonutSlice[];
  centerTitle?: string;
  centerValue?: string;
  size?: number;
  thickness?: number;
  showLegend?: boolean;
  showPercent?: boolean;
  emptyLabel?: string;
  theme?: ChartTheme;
}) {
  const t = CHART_THEME[theme];
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);
  const r = size / 2;
  const innerR = r - thickness;

  if (total <= 0) {
    return (
      <div className="flex items-center gap-4">
        <div
          className={`flex items-center justify-center rounded-full border-2 border-dashed ${theme === 'light' ? 'border-slate-200' : 'border-white/10'}`}
          style={{ width: size, height: size }}
        >
          <span className={`text-xs ${t.legendMuted}`}>{emptyLabel}</span>
        </div>
      </div>
    );
  }

  let acc = 0;
  const segments = slices.map((sl, idx) => {
    const startDeg = (acc / total) * 360;
    acc += Math.max(0, sl.value);
    const endDeg = (acc / total) * 360;
    const pct = (sl.value / total) * 100;
    return {
      ...sl,
      color: sl.color ?? DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length],
      path: describeArc(r, r, r, startDeg, endDeg === 360 ? 359.999 : endDeg, innerR),
      pct,
    };
  });

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
          {segments.map((s) => (
            <path key={s.name} d={s.path} fill={s.color} />
          ))}
        </svg>
        {(centerTitle || centerValue) && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            {centerTitle && (
              <span className={`text-[10px] uppercase tracking-[0.14em] ${t.centerTitle}`}>
                {centerTitle}
              </span>
            )}
            {centerValue && (
              <span className={`text-lg font-bold ${t.centerValue}`}>{centerValue}</span>
            )}
          </div>
        )}
      </div>
      {showLegend && (
        <ul className="flex-1 space-y-1.5 text-sm">
          {segments.map((s) => (
            <li key={s.name} className="flex items-center justify-between gap-3">
              <span className={`flex items-center gap-2 ${t.legend}`}>
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: s.color }}
                />
                {s.name}
              </span>
              <span className={t.rowName}>
                {showPercent && (
                  <span className={`font-mono ${t.rowValue}`}>{s.pct.toFixed(1)}%</span>
                )}
                {showPercent ? (
                  <span className={`ml-1 text-xs ${t.rowSub}`}>({fmtTickShort(s.value)})</span>
                ) : (
                  <span className={`font-mono ${t.rowValue}`}>{fmtTickShort(s.value)}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ============================================================================
   Horizontal bar list / vertical bar chart
   ============================================================================ */

export function HorizontalBars({
  rows,
  formatValue,
  barColor = '#60a5fa',
  theme = 'dark',
}: {
  rows: { name: string; value: number; sub?: string }[];
  formatValue?: (n: number) => string;
  barColor?: string;
  theme?: ChartTheme;
}) {
  const t = CHART_THEME[theme];
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <ul className="space-y-2">
      {rows.map((r) => {
        const pct = Math.max(2, (Math.abs(r.value) / max) * 100);
        return (
          <li key={r.name} className="text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className={`min-w-0 flex-1 truncate ${t.rowName}`}>{r.name}</span>
              <span className={`font-mono ${t.rowValue}`}>
                {formatValue ? formatValue(r.value) : fmtTickShort(r.value)}
              </span>
            </div>
            {r.sub && <p className={`text-[11px] ${t.rowSub}`}>{r.sub}</p>}
            <div className={`mt-1 h-1.5 w-full rounded-full ${t.track}`}>
              <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: barColor }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export type VerticalBarSeries = { name: string; color?: string; values: number[] };

export function VerticalBars({
  categories,
  series,
  height = 220,
  stacked = false,
}: {
  categories: string[];
  series: VerticalBarSeries[];
  height?: number;
  stacked?: boolean;
}) {
  const safe = useMemo(
    () =>
      series.map((s, idx) => ({
        ...s,
        color: s.color ?? DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length],
        values: categories.map((_, i) => s.values[i] ?? 0),
      })),
    [series, categories],
  );
  const max = useMemo(() => {
    if (stacked) {
      let m = 1;
      for (let i = 0; i < categories.length; i++) {
        const sum = safe.reduce((s, x) => s + x.values[i], 0);
        if (sum > m) m = sum;
      }
      return m;
    }
    let m = 1;
    for (const s of safe) for (const v of s.values) if (v > m) m = v;
    return m;
  }, [safe, categories.length, stacked]);

  const w = 700;
  const h = height;
  const pad = { left: 44, right: 12, top: 8, bottom: 28 };
  const innerW = w - pad.left - pad.right;
  const innerH = h - pad.top - pad.bottom;
  const groupW = innerW / categories.length;
  const barW = stacked ? Math.min(groupW * 0.7, 40) : Math.min((groupW - 6) / safe.length, 22);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        {safe.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5 text-slate-300">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full">
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
          const y = pad.top + innerH - t * innerH;
          return (
            <Fragment key={i}>
              <line
                x1={pad.left}
                x2={pad.left + innerW}
                y1={y}
                y2={y}
                stroke="currentColor"
                strokeOpacity="0.08"
              />
              <text
                x={pad.left - 6}
                y={y + 4}
                fontSize="10"
                textAnchor="end"
                fill="currentColor"
                fillOpacity="0.55"
              >
                {fmtTickShort(t * max)}
              </text>
            </Fragment>
          );
        })}
        {categories.map((cat, i) => {
          const cx = pad.left + i * groupW + groupW / 2;
          return (
            <text
              key={cat + i}
              x={cx}
              y={pad.top + innerH + 18}
              fontSize="10"
              textAnchor="middle"
              fill="currentColor"
              fillOpacity="0.55"
            >
              {cat}
            </text>
          );
        })}
        {categories.map((_, i) => {
          let stackBaseline = pad.top + innerH;
          return safe.map((s, sidx) => {
            const v = s.values[i] ?? 0;
            const barH = (v / max) * innerH;
            const x = stacked
              ? pad.left + i * groupW + (groupW - barW) / 2
              : pad.left + i * groupW + (groupW - safe.length * barW) / 2 + sidx * barW;
            const y = stacked ? stackBaseline - barH : pad.top + innerH - barH;
            if (stacked) stackBaseline -= barH;
            return (
              <rect
                key={`${i}-${sidx}`}
                x={x}
                y={y}
                width={Math.max(2, barW - 2)}
                height={Math.max(1, barH)}
                rx="2"
                fill={s.color}
              />
            );
          });
        })}
      </svg>
    </div>
  );
}

/* ============================================================================
   KPI tile with optional trend indicator
   ============================================================================ */

export type KpiTone = 'blue' | 'emerald' | 'amber' | 'rose' | 'violet' | 'slate' | 'cyan';

const KPI_TONE: Record<KpiTone, string> = {
  blue: 'bg-blue-500/15 text-blue-300 ring-blue-500/25',
  emerald: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25',
  amber: 'bg-amber-500/15 text-amber-300 ring-amber-500/25',
  rose: 'bg-rose-500/15 text-rose-300 ring-rose-500/25',
  violet: 'bg-violet-500/15 text-violet-300 ring-violet-500/25',
  slate: 'bg-slate-500/15 text-slate-300 ring-slate-500/25',
  cyan: 'bg-cyan-500/15 text-cyan-300 ring-cyan-500/25',
};

export function KpiTile({
  title,
  value,
  hint,
  trend,
  icon: Icon,
  tone = 'blue',
}: {
  title: string;
  value: string;
  hint?: string;
  trend?: { delta: number; suffix?: string };
  icon?: ComponentType<{ className?: string }>;
  tone?: KpiTone;
}) {
  return (
    <div className="workspace-panel flex h-full flex-col border border-white/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {title}
          </p>
          <p className="mt-1 break-words font-mono text-xl font-bold tracking-tight text-white sm:text-2xl">
            {value}
          </p>
          {(hint || trend) && (
            <p className="mt-1 flex items-center gap-2 text-xs">
              {trend && (
                <span
                  className={`font-semibold ${
                    trend.delta >= 0 ? 'text-emerald-300' : 'text-rose-300'
                  }`}
                >
                  {trend.delta >= 0 ? '▲' : '▼'} {Math.abs(trend.delta).toFixed(1)}%
                  {trend.suffix ? ` ${trend.suffix}` : ''}
                </span>
              )}
              {hint && <span className="text-slate-500">{hint}</span>}
            </p>
          )}
        </div>
        {Icon && (
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${KPI_TONE[tone]}`}
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================================
   Progress bar (utilization, completion etc.)
   ============================================================================ */
export function ProgressBar({
  value,
  max = 100,
  tone = 'blue',
  height = 8,
  showLabel = false,
}: {
  value: number;
  max?: number;
  tone?: KpiTone;
  height?: number;
  showLabel?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  const toneRing = {
    blue: 'bg-blue-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    violet: 'bg-violet-500',
    slate: 'bg-slate-500',
    cyan: 'bg-cyan-500',
  }[tone];
  return (
    <div>
      <div className="h-2 w-full rounded-full bg-white/5" style={{ height }}>
        <div className={`h-full rounded-full ${toneRing}`} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && (
        <p className="mt-1 text-[11px] text-slate-400">
          <span className="font-mono text-slate-100">{pct.toFixed(0)}%</span> of {max}
        </p>
      )}
    </div>
  );
}
