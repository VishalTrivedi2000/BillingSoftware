import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import type { SessionPayload } from '../auth/normalizeSessionPayload';
import { store } from '../../app/store';
import { clearSession, readPersistedAuth, setSession } from '../../features/auth/authSlice';
import { normalizeSessionPayload } from '../auth/normalizeSessionPayload';
import { getBaseApiUrl } from '../config';

const baseURL = getBaseApiUrl();

/** Unauthenticated calls (login, refresh) — no bearer / no refresh retry. */
export const plainApi = axios.create({
  baseURL,
});

/** Bearer requests + automatic refresh on 401 (except login/refresh paths). */
export const authApi = axios.create({
  baseURL,
});

/** True after we've already refreshed tokens and replayed this request once — a further 401 is terminal. */
type RetryCfg = InternalAxiosRequestConfig & { _billingReplayAfterRefresh?: boolean };

/** Single-flight refresh — parallel 401s must not each call /v1/auth/refresh (rotating refresh tokens would revoke siblings). */
let refreshInFlight: Promise<string | null> | null = null;

async function refreshSessionSingleFlight(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async (): Promise<string | null> => {
      let refreshToken = store.getState().auth.refreshToken;
      if (!refreshToken) {
        refreshToken = readPersistedAuth().refreshToken;
      }
      if (!refreshToken) {
        store.dispatch(clearSession());
        return null;
      }
      try {
        const oid =
          store.getState().auth.organizationId ?? readPersistedAuth().organizationId ?? undefined;
        const body: { refreshToken: string; organizationId?: number } = { refreshToken };
        if (oid != null) body.organizationId = oid;

        const { data } = await plainApi.post<unknown>('/v1/auth/refresh', body);
        const normalized = normalizeSessionPayload(data);
        if (!normalized) {
          store.dispatch(clearSession());
          return null;
        }
        store.dispatch(setSession(normalized));
        return normalized.accessToken;
      } catch (e) {
        // Network / TLS errors: keep stored session so the user can retry; only tear down on explicit auth failures.
        if (axios.isAxiosError(e)) {
          const status = e.response?.status;
          if (status === 401 || status === 403) {
            store.dispatch(clearSession());
          }
        }
        return null;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

function setBearer(config: InternalAxiosRequestConfig, accessToken: string) {
  if (!config.headers) {
    config.headers = new AxiosHeaders();
  }
  const bearer = `Bearer ${accessToken}`;
  const h = config.headers;

  /** AxiosHeaders: third arg false = skip if exists — stale Authorization must be replaced on refresh replay. */
  if (typeof h.delete === 'function') {
    h.delete('Authorization');
  }
  if (typeof h.set === 'function') {
    (h as AxiosHeaders).set('Authorization', bearer, true);
  } else {
    (config.headers as Record<string, string>)['Authorization'] = bearer;
  }
}

authApi.interceptors.request.use((config) => {
  let token = store.getState().auth.accessToken;
  if (!token) {
    const persisted = readPersistedAuth();
    if (
      persisted.accessToken &&
      persisted.refreshToken &&
      persisted.tenantId != null &&
      persisted.organizationId != null
    ) {
      store.dispatch(
        setSession({
          accessToken: persisted.accessToken,
          refreshToken: persisted.refreshToken,
          tenantId: persisted.tenantId,
          organizationId: persisted.organizationId,
        }),
      );
      token = persisted.accessToken;
    }
  }
  if (token) {
    setBearer(config, token);
  }
  return config;
});

authApi.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryCfg | undefined;
    if (!originalRequest) {
      return Promise.reject(error);
    }
    if (error.response?.status !== 401) {
      return Promise.reject(error);
    }

    const reqUrl = originalRequest.url ?? '';
    if (reqUrl.includes('/v1/auth/refresh') || reqUrl.includes('/v1/auth/login')) {
      store.dispatch(clearSession());
      return Promise.reject(error);
    }

    if (originalRequest._billingReplayAfterRefresh) {
      store.dispatch(clearSession());
      return Promise.reject(error);
    }

    originalRequest._billingReplayAfterRefresh = true;
    const accessToken = await refreshSessionSingleFlight();
    if (!accessToken) {
      return Promise.reject(error);
    }

    setBearer(originalRequest, accessToken);
    // error.config often drops baseURL; replay must resolve against the same API root as login.
    if (!originalRequest.baseURL) {
      originalRequest.baseURL = baseURL;
    }
    return authApi.request(originalRequest);
  },
);

/** JSON helper — GET by default; pass `{ method: 'PATCH', data }` etc. */
export async function apiJsonAuth<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
  const method = config?.method ?? 'GET';
  try {
    const res = await authApi.request<T>({
      ...(config ?? {}),
      url: path,
      method,
    });
    return res.data;
  } catch (e) {
    if (axios.isAxiosError(e)) {
      if (e.response?.status === 401) {
        // Session teardown is handled in the auth response interceptor after refresh/replay finishes.
        throw new Error('Unauthorized — sign in again.');
      }
      const m = method.toString().toUpperCase();
      throw new Error(`${m} ${path}: ${e.response?.status ?? 'network'}`);
    }
    throw e;
  }
}

export async function switchWorkplaceOrganization(organizationId: number): Promise<SessionPayload> {
  const rt = store.getState().auth.refreshToken ?? readPersistedAuth().refreshToken;
  if (!rt) throw new Error('Not signed in');

  const { data } = await plainApi.post<unknown>('/v1/auth/refresh', {
    refreshToken: rt,
    organizationId,
  });

  const normalized = normalizeSessionPayload(data);
  if (!normalized) throw new Error('Invalid refresh response');

  store.dispatch(setSession(normalized));
  return normalized;
}
