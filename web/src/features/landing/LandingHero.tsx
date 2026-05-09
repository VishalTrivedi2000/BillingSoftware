import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, KeyRound, Server, HeartPulse } from 'lucide-react';

function WorkspacePreview() {
  return (
    <div className="relative">
      <div className="absolute -inset-4 rounded-3xl bg-blue-500/20 blur-2xl" />
      <div className="relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-slate-700 bg-slate-800 px-4 py-3">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-500" />
            <span className="h-3 w-3 rounded-full bg-yellow-500" />
            <span className="h-3 w-3 rounded-full bg-green-500" />
          </div>
          <div className="mx-4 flex h-5 flex-1 items-center rounded-md bg-slate-700 px-2 font-mono text-xs text-slate-400">
            localhost:5173/dashboard
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 p-4">
          {[
            { label: 'API', val: 'BillingApp.Api', sub: 'ASP.NET Core', icon: Server, color: 'text-sky-400', bg: 'bg-sky-500/10' },
            { label: 'Auth', val: 'JWT + refresh', sub: 'RBAC policies', icon: KeyRound, color: 'text-blue-400', bg: 'bg-blue-500/10' },
            { label: 'Health', val: '/v1/health', sub: 'SQL probe', icon: HeartPulse, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          ].map(({ label, val, sub, icon: Icon, color, bg }) => (
            <div key={label} className={`rounded-xl p-3 ${bg}`}>
              <Icon size={16} className={color} />
              <p className="mt-1 truncate font-mono text-sm font-bold text-white">{val}</p>
              <p className="text-xs text-slate-400">{label}</p>
              <p className="text-[10px] text-slate-500">{sub}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-800 px-4 py-3 font-mono text-[11px] leading-relaxed text-slate-400">
          <span className="text-emerald-400">GET</span> /api/v1/health{' '}
          <span className="text-slate-600">→ bearer token · permission check</span>
        </div>
      </div>
    </div>
  );
}

export function LandingHero() {
  return (
    <section className="relative overflow-hidden bg-slate-950 pb-20 pt-28">
      <div className="pointer-events-none absolute left-1/4 top-0 h-96 w-96 rounded-full bg-blue-600/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-violet-600/10 blur-3xl" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-950/50 px-3 py-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
              <span className="text-xs font-semibold text-blue-400">BillingApp.Api · SQL Server BSDB · Vite SPA</span>
            </div>

            <h1 className="text-4xl font-black leading-tight text-white sm:text-5xl lg:text-6xl">
              Billing workspace, <span className="gradient-text">repo-aligned UI</span>
            </h1>

            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-400">
              Phase 0 shell for the <strong className="font-semibold text-slate-300">BS</strong> repository: JWT login against seeded SQL users,
              permission-aware API routes, user profiles with disk-backed photos, and a dashboard health probe — wired the same way your backend
              docs describe.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/login"
                className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-xl shadow-blue-600/30 transition-all duration-200 hover:bg-blue-500 hover:shadow-blue-500/40"
              >
                Sign in (seeded users)
                <ArrowRight size={18} />
              </Link>
              <a
                href="#howitworks"
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-6 py-3 font-semibold text-slate-300 transition hover:bg-slate-800/50"
              >
                <BookOpen size={18} className="text-blue-400" />
                Run locally
              </a>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              {['JWT + refresh tokens', 'RBAC + grants + delegation', 'Migrations in db/', 'CORS :5173 dev'].map((badge) => (
                <span key={badge} className="flex items-center gap-1 text-xs font-medium text-slate-500">
                  <span className="text-emerald-500">✓</span> {badge}
                </span>
              ))}
            </div>
          </div>

          <div className="hidden lg:block">
            <WorkspacePreview />
          </div>
        </div>
      </div>
    </section>
  );
}
