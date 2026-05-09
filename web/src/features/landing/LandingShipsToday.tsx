const highlights = [
  {
    title: 'Auth schema',
    body: 'Roles, permissions, users, refresh tokens, delegations — applied from db/migrations with API bootstrap.',
  },
  {
    title: 'Granular grants',
    body: 'UserPermissionGrants and UserRoleGrants migrations (002–003) extend RBAC without redeploying role rows.',
  },
  {
    title: 'Developer plaintext column',
    body: 'Optional Users.DeveloperPlaintextPassword (005) keeps demo passwords obvious locally; drop before production.',
  },
  {
    title: 'SPA routes',
    body: 'Public landing, login, dashboard shell, and RequireAuth profile page aligned with JWT storage helpers.',
  },
  {
    title: 'SignalR roadmap',
    body: 'Dashboard copy reserves Phase 1 for live metrics and SignalR — not wired in this Phase 0 shell.',
  },
  {
    title: 'Docs for reviewers',
    body: 'AUTH_DEVELOPER_REVIEW.md covers signing keys, CORS, stale JWT vs grants, and sqlcmd ordering.',
  },
];

function RepoSnapshotBar() {
  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 text-center text-white md:grid-cols-4">
          {[
            { val: '006', label: 'Latest migration script' },
            { val: '3', label: 'Seeded demo users' },
            { val: '5173', label: 'Default Vite origin (CORS)' },
            { val: 'Phase 0', label: 'Dashboard & profile UI' },
          ].map(({ val, label }) => (
            <div key={label}>
              <p className="text-3xl font-black sm:text-4xl">{val}</p>
              <p className="mt-1 text-sm font-medium text-blue-200">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LandingShipsToday() {
  return (
    <>
      <RepoSnapshotBar />
      <section id="ships" className="border-t border-slate-800 bg-[#0a0c14] py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-400">Repository scope</p>
            <h2 className="text-3xl font-black text-white sm:text-4xl">
              Ships in <span className="gradient-text">this branch</span>
            </h2>
            <p className="mt-4 text-slate-400">
              Facts tied to the BS codebase — no fabricated customer logos or revenue claims.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {highlights.map(({ title, body }) => (
              <div
                key={title}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-slate-700 hover:shadow-xl"
              >
                <h3 className="text-sm font-bold text-white">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
