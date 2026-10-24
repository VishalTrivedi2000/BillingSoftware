import { apiJsonAuth } from '../../shared/api/axiosClient';
import type { PermissionCatalogEntry, RoleDetail, RoleSummary, SetRolePermissionsBody } from './rbac.types';

export const rbacApi = {
  async listRoles(): Promise<RoleSummary[]> {
    return apiJsonAuth<RoleSummary[]>('/v1/rbac/roles');
  },

  async getRole(id: string): Promise<RoleDetail> {
    return apiJsonAuth<RoleDetail>(`/v1/rbac/roles/${encodeURIComponent(id)}`);
  },

  async setRolePermissions(id: string, body: SetRolePermissionsBody): Promise<RoleDetail> {
    return apiJsonAuth<RoleDetail>(`/v1/rbac/roles/${encodeURIComponent(id)}/permissions`, {
      method: 'PUT',
      data: body,
    });
  },

  async listPermissions(): Promise<PermissionCatalogEntry[]> {
    return apiJsonAuth<PermissionCatalogEntry[]>('/v1/rbac/permissions');
  },
};
