import { TRPCError } from "@trpc/server";
import { UserRole } from "@prisma/client";

/**
 * Permission definitions for different roles in the organization
 */
export const PERMISSIONS = {
  // Organization permissions
  ORG_VIEW: "org:view",
  ORG_UPDATE: "org:update",
  ORG_DELETE: "org:delete",
  
  // Member management permissions
  MEMBER_VIEW: "member:view",
  MEMBER_INVITE: "member:invite",
  MEMBER_UPDATE_ROLE: "member:update_role",
  MEMBER_REMOVE: "member:remove",
  
  // Expense permissions (for future use)
  EXPENSE_CREATE: "expense:create",
  EXPENSE_VIEW_OWN: "expense:view_own",
  EXPENSE_VIEW_ALL: "expense:view_all",
  EXPENSE_UPDATE_OWN: "expense:update_own",
  EXPENSE_UPDATE_ALL: "expense:update_all",
  EXPENSE_DELETE_OWN: "expense:delete_own",
  EXPENSE_DELETE_ALL: "expense:delete_all",
  
  // Policy permissions (for future use)
  POLICY_VIEW: "policy:view",
  POLICY_CREATE: "policy:create",
  POLICY_UPDATE: "policy:update",
  POLICY_DELETE: "policy:delete",
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

/**
 * Role-based permissions matrix
 * Maps each role to the permissions they have
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    // Organization permissions
    PERMISSIONS.ORG_VIEW,
    PERMISSIONS.ORG_UPDATE,
    PERMISSIONS.ORG_DELETE,
    
    // Member management permissions
    PERMISSIONS.MEMBER_VIEW,
    PERMISSIONS.MEMBER_INVITE,
    PERMISSIONS.MEMBER_UPDATE_ROLE,
    PERMISSIONS.MEMBER_REMOVE,
    
    // Expense permissions
    PERMISSIONS.EXPENSE_CREATE,
    PERMISSIONS.EXPENSE_VIEW_OWN,
    PERMISSIONS.EXPENSE_VIEW_ALL,
    PERMISSIONS.EXPENSE_UPDATE_OWN,
    PERMISSIONS.EXPENSE_UPDATE_ALL,
    PERMISSIONS.EXPENSE_DELETE_OWN,
    PERMISSIONS.EXPENSE_DELETE_ALL,
    
    // Policy permissions
    PERMISSIONS.POLICY_VIEW,
    PERMISSIONS.POLICY_CREATE,
    PERMISSIONS.POLICY_UPDATE,
    PERMISSIONS.POLICY_DELETE,
  ],
  
  [UserRole.MEMBER]: [
    // Organization permissions
    PERMISSIONS.ORG_VIEW,
    
    // Member management permissions
    PERMISSIONS.MEMBER_VIEW,
    
    // Expense permissions
    PERMISSIONS.EXPENSE_CREATE,
    PERMISSIONS.EXPENSE_VIEW_OWN,
    PERMISSIONS.EXPENSE_UPDATE_OWN,
    PERMISSIONS.EXPENSE_DELETE_OWN,
    
    // Policy permissions
    PERMISSIONS.POLICY_VIEW,
  ],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(role, permission));
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(role, permission));
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}