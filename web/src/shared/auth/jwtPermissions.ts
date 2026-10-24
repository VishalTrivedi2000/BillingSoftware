/** Billing JWT uses claim type `permission` (see BillingClaims.Permission). */

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    const mid = parts.length > 1 ? parts[1] : '';
    if (!mid) return null;
    const b64 = mid.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const json = atob(b64 + pad);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function extractPermissionsFromAccessToken(token: string | null | undefined): string[] {
  if (!token) return [];
  const payload = decodeJwtPayload(token);
  if (!payload) return [];
  const raw = payload.permission ?? payload.Permission;
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string');
  if (typeof raw === 'string') return [raw];
  return [];
}
