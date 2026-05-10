import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { usePermissions } from './usePermissions';

type Props = {
  permission: string;
  children: ReactNode;
};

export function RequirePermission({ permission, children }: Props) {
  const { can } = usePermissions();
  if (!can(permission)) {
    return (
      <div className="workspace-panel mx-auto max-w-lg border border-amber-500/25 bg-amber-500/10 px-8 py-12 text-center">
        <p className="text-lg font-semibold text-amber-100">Access denied</p>
        <p className="mt-2 text-sm text-amber-200/90">
          You need <span className="font-mono">{permission}</span> for this screen.
        </p>
        <Link to="/dashboard" className="mt-8 inline-flex rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/15">
          Back to dashboard
        </Link>
      </div>
    );
  }
  return children;
}
