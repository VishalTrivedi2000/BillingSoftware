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

export type ActiveRoleGrant = {
  grantId: number;
  roleId: number;
  roleName: string;
  startsUtc: string;
  expiresUtc: string | null;
};

export type ActivePermissionGrant = {
  grantId: number;
  permission: string;
  startsUtc: string;
  expiresUtc: string | null;
  /** ABAC-style scope string when the grant is narrowed (e.g. JSON resource predicate). */
  resourceScope: string | null;
};

export type AuthUserSummary = {
  userId: number;
  username: string;
  tenantId: number;
  organizationId: number;
  roles: string[];
  permissions: string[];
  activeRoleGrants: ActiveRoleGrant[];
  activePermissionGrants: ActivePermissionGrant[];
};

export type OrganizationMembership = {
  tenantId: number;
  organizationId: number;
  organizationCode: string;
  organizationName: string;
  isDefault: boolean;
};
