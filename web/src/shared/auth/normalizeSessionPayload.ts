/**
 * Maps ASP.NET JSON whether properties are camelCase or PascalCase (edge proxies / custom serializers).
 */
export type SessionPayload = {
  accessToken: string;
  refreshToken: string;
  tenantId: number;
  organizationId: number;
};

/** Strip accidental `Bearer ` prefix so headers stay `Bearer <jwt>` not `Bearer Bearer …`. */
function stripBearerSchemePrefix(token: string): string {
  const t = token.trim();
  return /^Bearer\s+/i.test(t) ? t.replace(/^Bearer\s+/i, '').trim() : t;
}

function pickStr(o: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string') {
      const t = v.trim();
      if (t.length > 0) return t;
    }
  }
  return undefined;
}

function pickLong(o: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim().length > 0) {
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

export function normalizeSessionPayload(raw: unknown): SessionPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const accessRaw = pickStr(o, 'accessToken', 'AccessToken');
  const refreshRaw = pickStr(o, 'refreshToken', 'RefreshToken');
  const accessToken = accessRaw ? stripBearerSchemePrefix(accessRaw) : undefined;
  const refreshToken = refreshRaw ? stripBearerSchemePrefix(refreshRaw) : undefined;
  const tenantId = pickLong(o, 'tenantId', 'TenantId');
  const organizationId = pickLong(o, 'organizationId', 'OrganizationId');
  if (!accessToken || !refreshToken || tenantId == null || organizationId == null) return null;
  return { accessToken, refreshToken, tenantId, organizationId };
}
