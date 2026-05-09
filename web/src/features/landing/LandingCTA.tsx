import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export function LandingCTA() {
  return (
    <section className="border-t border-slate-800 bg-[#0a0c14] py-20">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 p-12 shadow-2xl">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-white/10" />

          <div className="relative">
            <h2 className="mb-4 text-3xl font-black text-white sm:text-4xl">Working on the Billing backend?</h2>
            <p className="mx-auto mb-8 max-w-2xl text-lg text-blue-100">
              Use the seeded accounts from DEV_CREDENTIALS_TMP.md, hit /dashboard for health, and extend APIs knowing the SPA already handles JWT
              storage and profile flows.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                to="/login"
                className="flex items-center justify-center gap-2 rounded-xl bg-white px-7 py-3.5 font-bold text-blue-700 shadow-xl transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-50"
              >
                Open login
                <ArrowRight size={18} />
              </Link>
              <Link
                to="/dashboard"
                className="flex items-center justify-center gap-2 rounded-xl border-2 border-white/30 px-7 py-3.5 font-bold text-white transition hover:bg-white/10"
              >
                Dashboard (SPA shell)
              </Link>
            </div>
            <p className="mt-5 text-sm text-blue-200">Local only · rotate secrets before any shared deployment</p>
          </div>
        </div>
      </div>
    </section>
  );
}
