import { UserRole } from "@prisma/client";
import { PERMISSIONS, hasPermission, type Permission } from "~/server/permissions";
import React from "react";

/**
 * Client-side authorization helpers for React components
 */

/**
 * Check if a user role has a specific permission
 */
export function canUserPerform(role: UserRole, permission: Permission): boolean {
  return hasPermission(role, permission);
}

/**
 * Check if a user role has any of the specified permissions
 */
export function canUserPerformAny(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(role, permission));
}

/**
 * Check if a user role has all of the specified permissions
 */
export function canUserPerformAll(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(role, permission));
}

/**
 * Get all permissions for a role
 */
export function getUserPermissions(role: UserRole): Permission[] {
  return Object.values(PERMISSIONS).filter(permission => hasPermission(role, permission));
}

/**
 * Permission check hooks for React components
 */

/**
 * Hook to check if the current user can perform a specific action
 */
export function usePermission(
  role: UserRole | undefined,
  permission: Permission
): boolean {
  if (!role) return false;
  return canUserPerform(role, permission);
}

/**
 * Hook to check if the current user can perform any of the specified actions
 */
export function useAnyPermission(
  role: UserRole | undefined,
  permissions: Permission[]
): boolean {
  if (!role) return false;
  return canUserPerformAny(role, permissions);
}

/**
 * Hook to check if the current user can perform all of the specified actions
 */
export function useAllPermissions(
  role: UserRole | undefined,
  permissions: Permission[]
): boolean {
  if (!role) return false;
  return canUserPerformAll(role, permissions);
}

/**
 * Higher-order component to conditionally render based on permissions
 */
export function withPermissionCheck<T extends object>(
  Component: React.ComponentType<T>,
  role: UserRole | undefined,
  permission: Permission,
  fallback?: React.ComponentType | React.ReactElement | null
) {
  return function PermissionCheckedComponent(props: T) {
    const hasPermission = usePermission(role, permission);
    
    if (!hasPermission) {
      return fallback ? React.createElement(fallback as any) : null;
    }
    
    return React.createElement(Component, props);
  };
}

/**
 * Component to conditionally render children based on permissions
 */
interface PermissionGuardProps {
  role: UserRole | undefined;
  permission: Permission;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGuard({ 
  role, 
  permission, 
  fallback = null, 
  children 
}: PermissionGuardProps) {
  const hasPermission = usePermission(role, permission);
  
  if (!hasPermission) {
    return React.createElement(React.Fragment, null, fallback);
  }
  
  return React.createElement(React.Fragment, null, children);
}

/**
 * Component to conditionally render children based on any of multiple permissions
 */
interface AnyPermissionGuardProps {
  role: UserRole | undefined;
  permissions: Permission[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function AnyPermissionGuard({ 
  role, 
  permissions, 
  fallback = null, 
  children 
}: AnyPermissionGuardProps) {
  const hasPermission = useAnyPermission(role, permissions);
  
  if (!hasPermission) {
    return React.createElement(React.Fragment, null, fallback);
  }
  
  return React.createElement(React.Fragment, null, children);
}

/**
 * Component to conditionally render children based on all of multiple permissions
 */
interface AllPermissionsGuardProps {
  role: UserRole | undefined;
  permissions: Permission[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function AllPermissionsGuard({ 
  role, 
  permissions, 
  fallback = null, 
  children 
}: AllPermissionsGuardProps) {
  const hasPermission = useAllPermissions(role, permissions);
  
  if (!hasPermission) {
    return React.createElement(React.Fragment, null, fallback);
  }
  
  return React.createElement(React.Fragment, null, children);
}

/**
 * Common permission groups for convenience
 */
export const ORG_ADMIN_PERMISSIONS = [
  PERMISSIONS.ORG_UPDATE,
  PERMISSIONS.ORG_DELETE,
  PERMISSIONS.MEMBER_INVITE,
  PERMISSIONS.MEMBER_UPDATE_ROLE,
  PERMISSIONS.MEMBER_REMOVE,
] as const;

export const MEMBER_MANAGEMENT_PERMISSIONS = [
  PERMISSIONS.MEMBER_VIEW,
  PERMISSIONS.MEMBER_INVITE,
  PERMISSIONS.MEMBER_UPDATE_ROLE,
  PERMISSIONS.MEMBER_REMOVE,
] as const;

export const EXPENSE_MANAGEMENT_PERMISSIONS = [
  PERMISSIONS.EXPENSE_CREATE,
  PERMISSIONS.EXPENSE_VIEW_OWN,
  PERMISSIONS.EXPENSE_UPDATE_OWN,
  PERMISSIONS.EXPENSE_DELETE_OWN,
] as const;

export const EXPENSE_ADMIN_PERMISSIONS = [
  ...EXPENSE_MANAGEMENT_PERMISSIONS,
  PERMISSIONS.EXPENSE_VIEW_ALL,
  PERMISSIONS.EXPENSE_UPDATE_ALL,
  PERMISSIONS.EXPENSE_DELETE_ALL,
] as const;