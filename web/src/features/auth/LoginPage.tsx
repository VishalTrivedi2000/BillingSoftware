import { FormEvent, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, Loader2, Lock, Shield, Database, User } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { selectIsAuthenticated, setSession } from '../../features/auth/authSlice';
import { plainApi } from '../../shared/api/axiosClient';
import { apiUrl } from '../../shared/config';
import { normalizeSessionPayload } from '../../shared/auth/normalizeSessionPayload';

const seedRows = [
  { user: 'admin', password: 'Admin@123', note: 'Full access seed' },
  { user: 'billing', password: 'Billing@123', note: 'Billing role' },
  { user: 'accountant', password: 'Account@123', note: 'Accountant role' },
];

export function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectRaw =
    typeof location.state === 'object' &&
    location.state !== null &&
    'from' in location.state &&
    typeof (location.state as { from?: string }).from === 'string'
      ? (location.state as { from: string }).from
      : '/dashboard';

  /** Never bounce back to /login or off-site after a successful sign-in. */
  const redirectTo =
    !redirectRaw ||
    redirectRaw === '/login' ||
    !redirectRaw.startsWith('/') ||
    redirectRaw.startsWith('//')
      ? '/dashboard'
      : redirectRaw;

  const alreadyIn = useAppSelector(selectIsAuthenticated);
  const loginEndpoint = apiUrl('/v1/auth/login');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [organizationIdInput, setOrganizationIdInput] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body: { username: string; password: string; organizationId?: number } = { username, password };
      const oid = organizationIdInput.trim();
      if (oid.length > 0) {
        const n = Number(oid);
        if (!Number.isInteger(n) || n <= 0) {
          setError('Organization ID must be a positive integer when provided.');
          return;
        }
        body.organizationId = n;
      }

      let res: { data: unknown };
      try {
        res = await plainApi.post<unknown>('/v1/auth/login', body);
      } catch (err: unknown) {
        const status =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { status?: number } }).response?.status
            : undefined;
        setError(status === 401 ? 'Invalid username or password.' : `Login failed (${status ?? 'network'}).`);
        return;
      }

      const normalized = normalizeSessionPayload(res.data);
      if (!normalized) {
        setError('Login succeeded but the response did not include usable tokens.');
        return;
      }

      flushSync(() => {
        dispatch(setSession(normalized));
      });

      if (remember) {
        try {
          localStorage.setItem('billing.rememberDevice', '1');
        } catch {
          /* ignore */
        }
      } else {
        try {
          localStorage.removeItem('billing.rememberDevice');
        } catch {
          /* ignore */
        }
      }
      navigate(redirectTo, { replace: true });
    } catch {
      setError(`Cannot reach API at ${loginEndpoint}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0c14]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-25" />
      <div className="pointer-events-none absolute left-1/4 top-0 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-violet-600/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-8 px-4 py-12 lg:flex-row lg:items-center lg:gap-10 lg:py-16">
        {/* Marketing */}
        <div className="flex-1 rounded-3xl border border-slate-800 bg-[#111827] p-8 shadow-2xl shadow-black/40 lg:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/40 bg-blue-950/40 px-3 py-1.5">
            <Shield size={14} className="text-blue-400" />
            <span className="text-xs font-semibold text-blue-400">BillingApp.Api · BS workspace</span>
          </div>
          <h1 className="mt-6 text-2xl font-bold leading-tight text-white sm:text-3xl lg:text-[1.65rem] xl:text-4xl">
            Sign in to the Billing backend workspace
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            This SPA talks to <strong className="font-medium text-slate-300">BillingApp.Api</strong> on SQL Server (
            <strong className="font-medium text-slate-300">BSDB</strong>). JWT access tokens, hashed refresh tokens, and RBAC policies match
            the auth schema under <code className="rounded bg-slate-800 px-1 font-mono text-[11px] text-slate-300">db/migrations</code>.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: Shield,
                title: 'Roles & policies',
                desc: 'Permissions map to authorization policies (e.g. perm:*). Admin bypass is documented in AUTH_DEVELOPER_REVIEW.md.',
              },
              {
                icon: Database,
                title: 'SQL Server + seed',
                desc: 'Auth tables and profiles come from migrations; AuthDatabaseInitializer seeds demo users when the API starts.',
              },
              {
                icon: Lock,
                title: 'Refresh + protected UI',
                desc: 'Dashboard calls /v1/health with a bearer token; /profile requires auth. CORS allows localhost:5173 in dev.',
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/15 text-blue-400">
                  <Icon size={20} />
                </div>
                <h3 className="mt-3 text-sm font-bold text-white">{title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Form */}
        <div className="w-full flex-1 lg:max-w-md">
          <div className="rounded-3xl border border-slate-800 bg-[#111827] p-8 shadow-2xl shadow-black/40 lg:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">Secure sign-in</p>
            <h2 className="mt-2 text-2xl font-bold text-white">Access the dev dashboard</h2>
            <p className="mt-2 text-sm text-slate-400">
              Use the seeded SQL users created by <span className="font-mono text-slate-300">AuthDatabaseInitializer</span> — passwords are
              listed in the repo docs for local use only.
            </p>

            <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-xs text-slate-400">
              <p className="font-semibold text-slate-300">Seeded credentials</p>
              <ul className="mt-2 space-y-1 font-mono text-[11px] text-slate-400">
                {seedRows.map((row) => (
                  <li key={row.user}>
                    <span className="text-slate-300">{row.user}</span> / <span className="text-slate-300">{row.password}</span>
                    <span className="text-slate-600"> · {row.note}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 break-all text-[11px] text-slate-500">
                API: <span className="text-blue-400/90">{loginEndpoint}</span>
              </p>
              <p className="mt-1 text-[11px] text-slate-600">
                Full connection string & JWT notes: <span className="font-mono text-slate-500">docs/DEV_CREDENTIALS_TMP.md</span> · Auth checklist:{' '}
                <span className="font-mono text-slate-500">docs/AUTH_DEVELOPER_REVIEW.md</span>
              </p>
            </div>

            {alreadyIn && (
              <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-200">
                Session active.{' '}
                <Link to={redirectTo} className="font-semibold text-emerald-400 underline-offset-2 hover:underline">
                  Continue to app
                </Link>
              </div>
            )}

            <form className="mt-6 space-y-4" onSubmit={(e) => void onSubmit(e)}>
              <div>
                <label htmlFor="login-user" className="mb-1.5 block text-sm font-medium text-slate-300">
                  Username
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
                  <input
                    id="login-user"
                    autoComplete="username"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin"
                    title="Seeded username (not email)"
                    className="w-full rounded-xl border border-slate-700 bg-[#1f2937] py-3 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-pass" className="mb-1.5 block text-sm font-medium text-slate-300">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
                  <input
                    id="login-pass"
                    type={showPass ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-slate-700 bg-[#1f2937] py-3 pl-10 pr-11 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-white"
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                  >
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="login-org-id" className="mb-1.5 block text-sm font-medium text-slate-300">
                  Organization ID <span className="font-normal text-slate-500">(optional)</span>
                </label>
                <input
                  id="login-org-id"
                  inputMode="numeric"
                  value={organizationIdInput}
                  onChange={(e) => setOrganizationIdInput(e.target.value)}
                  placeholder="Leave blank for default workplace"
                  className="w-full rounded-xl border border-slate-700 bg-[#1f2937] px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25"
                />
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Use when your user belongs to multiple organizations; JWT will carry{' '}
                  <span className="font-mono text-slate-400">org_id</span> for billing isolation.
                </p>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-400">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-blue-600 focus:ring-blue-500"
                />
                Remember this device
              </label>

              {error && (
                <div role="alert" className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    <KeyRound size={18} />
                    Sign in to dashboard
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-2 text-sm">
              <Link to="/" className="text-slate-400 transition hover:text-white">
                ← Back to home
              </Link>
              <Link to="/dashboard" className="text-blue-400 transition hover:text-blue-300">
                Workspace
              </Link>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-slate-600">Protected routes redirect here when your session expires.</p>
        </div>
      </div>
    </div>
  );
}
