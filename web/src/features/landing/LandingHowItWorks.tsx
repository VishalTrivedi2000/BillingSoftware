import { ArrowRight } from 'lucide-react';

const steps = [
  {
    step: '01',
    title: 'Create BSDB',
    desc: 'Provision SQL Server database BSDB and point BillingApp.Api ConnectionStrings:DefaultConnection at it (see DEV_CREDENTIALS_TMP.md for local example).',
    color: 'from-blue-500 to-blue-600',
  },
  {
    step: '02',
    title: 'Run the API',
    desc: 'Start BillingApp.Api once so migrations + AuthDatabaseInitializer apply schema and seed admin, billing, and accountant users.',
    color: 'from-violet-500 to-violet-600',
  },
  {
    step: '03',
    title: 'Start the SPA',
    desc: 'From /web run npm install && npm run dev — Vite serves on localhost:5173 with proxy or VITE_BASE_API_URL to your API.',
    color: 'from-emerald-500 to-emerald-600',
  },
  {
    step: '04',
    title: 'Sign in & probe',
    desc: 'Use seeded credentials on /login, open /dashboard for /v1/health, and /profile for authenticated profile APIs.',
    color: 'from-amber-500 to-orange-500',
  },
];

export function LandingHowItWorks() {
  return (
    <section id="howitworks" className="bg-slate-950 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-400">Local development</p>
          <h2 className="text-3xl font-black text-white sm:text-4xl">
            Wire up <span className="gradient-text">BSDB + API + SPA</span>
          </h2>
          <p className="mt-4 text-slate-400">
            Matches the checklist in <span className="font-mono text-slate-300">docs/AUTH_DEVELOPER_REVIEW.md</span>.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-4">
          {steps.map(({ step, title, desc, color }, idx, arr) => (
            <div key={step} className="relative flex flex-col items-center text-center">
              <div
                className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${color} text-lg font-black text-white shadow-lg`}
              >
                {step}
              </div>
              {idx < arr.length - 1 && (
                <div className="absolute left-[60%] top-7 hidden w-[80%] md:block">
                  <ArrowRight size={20} className="text-slate-700" />
                </div>
              )}
              <h3 className="mb-1 text-sm font-bold text-white">{title}</h3>
              <p className="text-xs leading-relaxed text-slate-400">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
