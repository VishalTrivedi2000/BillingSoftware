import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';
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

/**
 * True when Redux has an access token OR persisted keys exist (covers hydration timing / Strict Mode oddities).
 * Axios request interceptor syncs Redux from localStorage before attaching Authorization.
 */
export function selectIsAuthenticated(state: AuthRoot): boolean {
  if (Boolean(state.auth.accessToken)) return true;
  const p = readPersistedAuth();
  return Boolean(p.accessToken && p.refreshToken && p.tenantId != null && p.organizationId != null);
}

export function selectAccessToken(state: AuthRoot): string | null {
  if (state.auth.accessToken) return state.auth.accessToken;
  return readPersistedAuth().accessToken;
}

export function selectWorkplaceSnapshot(state: AuthRoot): WorkplaceSnapshot | null {
  const { tenantId, organizationId } = state.auth;
  if (tenantId != null && organizationId != null) return { tenantId, organizationId };
  const p = readPersistedAuth();
  if (p.tenantId != null && p.organizationId != null) return { tenantId: p.tenantId, organizationId: p.organizationId };
  return null;
}
