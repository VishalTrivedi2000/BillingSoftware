import { useCallback, useMemo } from 'react';
import { useAppSelector } from '../../app/hooks';
import { selectAccessToken } from '../../features/auth/authSlice';
import { extractPermissionsFromAccessToken } from './jwtPermissions';

export function usePermissions(): {
  permissions: string[];
  can: (permission: string) => boolean;
} {
  const token = useAppSelector(selectAccessToken);
  const permissions = useMemo(() => extractPermissionsFromAccessToken(token), [token]);
  const can = useCallback((permission: string) => permissions.includes(permission), [permissions]);
  return { permissions, can };
}
