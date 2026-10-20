/**
 * BIM CREATIVE HUB — Backend Role-Based Access Control (RBAC) & Tenant/Guest Isolation Guard
 */
export type RoleCode = 'MASTER' | 'USER' | 'GUEST';
export type ModuleKey =
  | 'dashboard'
  | 'calendar'
  | 'analytics'
  | 'live'
  | 'procurement'
  | 'ads'
  | 'ai_studio'
  | 'design_order'
  | 'tasks'
  | 'notifications'
  | 'media'
  | 'profile'
  | 'master_settings';

export type ActionKey = 'view' | 'create' | 'edit' | 'approve' | 'delete' | 'export';

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: RoleCode;
  branchId?: string;
  isActive: boolean;
}

export function enforcePermission(
  user: SessionUser | null,
  module: ModuleKey,
  action: ActionKey,
  permissionMatrix: Record<string, Record<ActionKey, boolean>>
): { allowed: boolean; reason?: string } {
  if (!user || !user.isActive) {
    return { allowed: false, reason: 'UNAUTHENTICATED_OR_INACTIVE' };
  }
  if (user.role === 'MASTER') {
    return { allowed: true };
  }
  if (module === 'master_settings') {
    return { allowed: false, reason: 'MASTER_ONLY_MODULE' };
  }
  if (user.role === 'GUEST') {
    const guestAllowed: ModuleKey[] = ['dashboard', 'design_order', 'notifications', 'profile'];
    if (!guestAllowed.includes(module)) {
      return { allowed: false, reason: 'GUEST_MODULE_RESTRICTED' };
    }
    if (module === 'design_order' && ['view', 'create', 'edit', 'approve', 'export'].includes(action)) {
      return { allowed: true };
    }
    return { allowed: action === 'view' || action === 'edit' };
  }

  const modPerms = permissionMatrix[module];
  if (!modPerms || !modPerms[action]) {
    return { allowed: false, reason: `MISSING_PERMISSION:${module}.${action}` };
  }
  return { allowed: true };
}

/**
 * Ensures GUEST users can only read or mutate their own DesignOrders at the database query layer.
 */
export function buildDesignOrderWhereClause(user: SessionUser) {
  if (user.role === 'GUEST') {
    return { requesterId: user.id, deletedAt: null };
  }
  return { deletedAt: null };
}
