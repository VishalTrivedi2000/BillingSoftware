import {
  BadgeCheck,
  Camera,
  Database,
  GitBranch,
  HeartPulse,
  KeyRound,
  ShieldCheck,
  Users,
} from 'lucide-react';

const features = [
  {
    icon: KeyRound,
    title: 'JWT login & refresh',
    desc: 'POST /v1/auth/login returns access + refresh tokens; rotation-friendly refresh storage on the API side.',
    border: 'border-blue-500/20 hover:border-blue-500/40',
    iconWrap: 'bg-blue-500/15 text-blue-400',
  },
  {
    icon: ShieldCheck,
    title: 'RBAC policies',
    desc: 'Permissions become authorization policies (perm:*). Admin bypass behaviour is documented for reviewers.',
    border: 'border-violet-500/20 hover:border-violet-500/40',
    iconWrap: 'bg-violet-500/15 text-violet-400',
  },
  {
    icon: BadgeCheck,
    title: 'UserPermissionGrants',
    desc: 'Extra permission tuples per user with optional expiry — merges into effective claims on token issue.',
    border: 'border-emerald-500/20 hover:border-emerald-500/40',
    iconWrap: 'bg-emerald-500/15 text-emerald-400',
  },
  {
    icon: Users,
    title: 'UserRoleGrants',
    desc: 'Time-bounded extra roles on top of UserRoles membership; combined with delegations for effective access.',
    border: 'border-amber-500/20 hover:border-amber-500/40',
    iconWrap: 'bg-amber-500/15 text-amber-400',
  },
  {
    icon: GitBranch,
    title: 'Delegations',
    desc: 'Schema supports time-bounded role delegation; handlers merge active delegated roles into permission sets.',
    border: 'border-pink-500/20 hover:border-pink-500/40',
    iconWrap: 'bg-pink-500/15 text-pink-400',
  },
  {
    icon: Camera,
    title: 'Profiles & uploads',
    desc: 'UserProfiles with PATCH + multipart picture endpoint; static files served under configured storage path.',
    border: 'border-cyan-500/20 hover:border-cyan-500/40',
    iconWrap: 'bg-cyan-500/15 text-cyan-400',
  },
  {
    icon: Database,
    title: 'SQL migrations',
    desc: 'Bootstrap applies 001→005 scripts (auth, grants, profiles, dev plaintext column) when API starts against BSDB.',
    border: 'border-indigo-500/20 hover:border-indigo-500/40',
    iconWrap: 'bg-indigo-500/15 text-indigo-400',
  },
  {
    icon: HeartPulse,
    title: 'Health probe',
    desc: 'Dashboard calls GET /v1/health with bearer auth to prove SQL connectivity and token-permission wiring.',
    border: 'border-yellow-500/20 hover:border-yellow-500/40',
    iconWrap: 'bg-yellow-500/15 text-yellow-400',
  },
];

export function LandingFeatures() {
  return (
    <section id="features" className="border-y border-slate-800 bg-[#0a0c14] py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-400">Backend capabilities</p>
          <h2 className="text-3xl font-black text-white sm:text-4xl">
            What <span className="gradient-text">BillingApp.Api</span> ships today
          </h2>
          <p className="mt-4 text-slate-400">
            Feature cards mirror this repository&apos;s auth schema, grants, profiles, and SPA routes — not a separate commercial product.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, desc, border, iconWrap }) => (
            <div
              key={title}
              className={`rounded-xl border bg-slate-900/50 p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${border}`}
            >
              <div className={`mb-4 inline-flex rounded-xl p-3 ${iconWrap}`}>
                <Icon size={22} />
              </div>
              <h3 className="mb-1.5 text-sm font-bold text-white">{title}</h3>
              <p className="text-xs leading-relaxed text-slate-400">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
