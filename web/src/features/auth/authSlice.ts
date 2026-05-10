import type { PayloadAction } from '@reduxjs/toolkit';
import { createSelector, createSlice } from '@reduxjs/toolkit';
import type { SessionPayload } from '../../shared/auth/normalizeSessionPayload';

const ACCESS = 'billing.accessToken';
const REFRESH = 'billing.refreshToken';
const TENANT = 'billing.tenantId';
const ORG = 'billing.organizationId';

export type WorkplaceSnapshot = { tenantId: number; organizationId: number };

export type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  tenantId: number | null;
  organizationId: number | null;
};

const emptyState = (): AuthState => ({
  accessToken: null,
  refreshToken: null,
  tenantId: null,
  organizationId: null,
});

export function readPersistedAuth(): AuthState {
  try {
    const accessToken = localStorage.getItem(ACCESS);
    const refreshToken = localStorage.getItem(REFRESH);
    const t = localStorage.getItem(TENANT);
    const o = localStorage.getItem(ORG);
    if (!accessToken || !refreshToken || t == null || o == null) return emptyState();
    const tenantId = Number(t);
    const organizationId = Number(o);
    if (!Number.isFinite(tenantId) || !Number.isFinite(organizationId)) return emptyState();
    return { accessToken, refreshToken, tenantId, organizationId };
  } catch {
    return emptyState();
  }
}

function loadFromStorage(): AuthState {
  return readPersistedAuth();
}

function persist(state: AuthState): void {
  try {
    if (
      state.accessToken &&
      state.refreshToken &&
      state.tenantId != null &&
      state.organizationId != null
    ) {
      localStorage.setItem(ACCESS, state.accessToken);
      localStorage.setItem(REFRESH, state.refreshToken);
      localStorage.setItem(TENANT, String(state.tenantId));
      localStorage.setItem(ORG, String(state.organizationId));
    } else {
      localStorage.removeItem(ACCESS);
      localStorage.removeItem(REFRESH);
      localStorage.removeItem(TENANT);
      localStorage.removeItem(ORG);
    }
  } catch {
    /* ignore quota / private mode */
  }
}

const initialState: AuthState = loadFromStorage();

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSession(state, action: PayloadAction<SessionPayload>) {
      state.accessToken = action.payload.accessToken;
      state.refreshToken = action.payload.refreshToken;
      state.tenantId = action.payload.tenantId;
      state.organizationId = action.payload.organizationId;
      persist(state);
    },
    clearSession() {
      const cleared = emptyState();
      persist(cleared);
      return cleared;
    },
  },
});

export const { setSession, clearSession } = authSlice.actions;
export const authReducer = authSlice.reducer;

/** Auth subtree selector input — compatible with `RootState`. */
type AuthRoot = { auth: AuthState };

function sessionComplete(a: AuthState): boolean {
  return Boolean(
    a.accessToken && a.refreshToken && a.tenantId != null && a.organizationId != null,
  );
}

/**
 * Workspace routes require access + refresh + tenant/org (JWT workplace claims).
 * Avoid treating access-token-only as signed-in — dashboard queries would fire without org scope and loop on 401.
 */
export function selectIsAuthenticated(state: AuthRoot): boolean {
  if (sessionComplete(state.auth)) return true;
  const p = readPersistedAuth();
  return sessionComplete(p);
}

export function selectAccessToken(state: AuthRoot): string | null {
  if (state.auth.accessToken) return state.auth.accessToken;
  return readPersistedAuth().accessToken;
}

const selectAuthBranch = (state: AuthRoot) => state.auth;

/** Memoized so `useSelector` does not see a fresh object every call when IDs are unchanged. */
export const selectWorkplaceSnapshot = createSelector([selectAuthBranch], (auth): WorkplaceSnapshot | null => {
  let tenantId = auth.tenantId;
  let organizationId = auth.organizationId;
  if (tenantId == null || organizationId == null) {
    const p = readPersistedAuth();
    tenantId = p.tenantId;
    organizationId = p.organizationId;
  }
  if (tenantId != null && organizationId != null) return { tenantId, organizationId };
  return null;
});
