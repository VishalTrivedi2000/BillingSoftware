/** Mirrors LockSystem RBAC JSON (`RbacController` ASP.NET camelCase). */

export type RoleSummary = {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  scopeLevel: string;
  permissionCount: number;
  userCount: number;
};

export type RoleDetail = {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  scopeLevel: string;
  permissionIds: string[];
};

export type PermissionCatalogEntry = {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  category: string;
};

export type SetRolePermissionsBody = {
  permissionIds: string[];
};
