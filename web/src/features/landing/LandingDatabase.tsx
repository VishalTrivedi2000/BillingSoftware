import { Link } from 'react-router-dom';
import { FileCode } from 'lucide-react';

const migrations = [
  {
    file: '001_auth.sql',
    summary: 'Roles, Permissions, Users, RefreshTokens, Delegations, indexes',
  },
  {
    file: '002_user_permission_grants.sql',
    summary: 'Direct permission grants with optional expiry',
  },
  {
    file: '003_user_role_grants.sql',
    summary: 'Direct role grants merged with UserRoles',
  },
  {
    file: '004_user_profiles.sql',
    summary: 'Profile fields consumed by /v1/profile APIs',
  },
  {
    file: '005_users_developer_plaintext_password.sql',
    summary: 'Dev-only plaintext password column for seed accounts',
  },
];

export function LandingDatabase() {
  return (
    <section id="database" className="bg-slate-950 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-400">SQL Server BSDB</p>
          <h2 className="text-3xl font-black text-white sm:text-4xl">
            Migration scripts in <span className="gradient-text">db/migrations</span>
          </h2>
          <p className="mt-4 text-slate-400">
            Applied automatically on API startup via{' '}
            <span className="font-mono text-slate-300">AuthBootstrapOptions</span>, or manually with sqlcmd as documented.
          </p>
        </div>

        <div className="mx-auto grid max-w-4xl gap-4">
          {migrations.map(({ file, summary }) => (
            <div
              key={file}
              className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600/15 text-blue-400">
                  <FileCode size={20} />
                </span>
                <div>
                  <p className="font-mono text-sm font-semibold text-white">{file}</p>
                  <p className="mt-1 text-sm text-slate-400">{summary}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-sm text-slate-500">
          After migrations, run the API once against BSDB so <span className="font-mono text-slate-400">AuthDatabaseInitializer</span> inserts
          seed roles, permissions, and demo users.
        </p>

        <div className="mt-10 flex justify-center">
          <Link to="/login" className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-500">
            Continue to sign-in →
          </Link>
        </div>
      </div>
    </section>
  );
}
