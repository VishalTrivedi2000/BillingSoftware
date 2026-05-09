import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '../../app/hooks';
import { selectIsAuthenticated } from '../../features/auth/authSlice';

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const authed = useAppSelector(selectIsAuthenticated);
  if (!authed) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
}
