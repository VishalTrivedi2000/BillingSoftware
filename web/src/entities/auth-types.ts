/** Mirrors BillingApp.Application.Auth DTOs (camelCase JSON from ASP.NET Core). */

export type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  tokenType: string;
  username: string;
  roles: string[];
  permissions: string[];
  tenantId: number;
  organizationId: number;
};

export type AuthUserSummary = {
  userId: number;
  username: string;
  tenantId: number;
  organizationId: number;
  roles: string[];
  permissions: string[];
  activeRoleGrants: unknown[];
  activePermissionGrants: unknown[];
};

export type OrganizationMembership = {
  tenantId: number;
  organizationId: number;
  organizationCode: string;
  organizationName: string;
  isDefault: boolean;
};
