import { Link } from 'react-router-dom';
import { ExternalLink, FileText, Globe, Code2 } from 'lucide-react';

const columns = [
  { title: 'Documentation', links: ['AUTH_DEVELOPER_REVIEW.md', 'DEV_CREDENTIALS_TMP.md', 'db/migrations/*.sql'] },
  { title: 'Projects', links: ['BillingApp.Api (ASP.NET)', 'web (Vite + React)', 'BSDB on SQL Server'] },
  { title: 'API surface (examples)', links: ['POST /v1/auth/login', 'GET /v1/health', 'PATCH /v1/profile/me'] },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-400">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mb-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link to="/" className="mb-4 inline-flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
                <span className="text-sm font-black text-white">B</span>
              </div>
              <span className="text-lg font-bold text-white">Billing · BS</span>
            </Link>
            <p className="mb-4 max-w-md text-sm leading-relaxed">
              Developer workspace UI for the BS repository: JWT auth against BillingApp.Api, RBAC-aligned routes, and SQL-backed health checks —
              not a packaged SaaS storefront.
            </p>
            <div className="flex gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-400" title="Repository root">
                <Globe size={15} aria-hidden />
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-400" title="Docs">
                <FileText size={15} aria-hidden />
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-400" title="Source">
                <Code2 size={15} aria-hidden />
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-slate-400" title="External">
                <ExternalLink size={15} aria-hidden />
              </span>
            </div>
          </div>

          {columns.map(({ title, links }) => (
            <div key={title}>
              <h4 className="mb-3 text-sm font-semibold text-white">{title}</h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link}>
                    <span className="font-mono text-xs text-slate-500">{link}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-800 pt-8 sm:flex-row">
          <p className="text-xs">© {new Date().getFullYear()} BS Billing workspace · local development</p>
          <div className="flex gap-4 text-xs">
            <Link to="/login" className="hover:text-white">
              Sign in
            </Link>
            <Link to="/dashboard" className="hover:text-white">
              Dashboard
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
