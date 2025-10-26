import { describe, expect, it, vi, beforeEach } from "vitest";
import { UserRole } from "@prisma/client";
import {
  canUserPerform,
  canUserPerformAny,
  canUserPerformAll,
  getUserPermissions,
  usePermission,
  useAnyPermission,
  useAllPermissions,
  PermissionGuard,
  AnyPermissionGuard,
  AllPermissionsGuard,
  ORG_ADMIN_PERMISSIONS,
  MEMBER_MANAGEMENT_PERMISSIONS,
  EXPENSE_MANAGEMENT_PERMISSIONS,
  EXPENSE_ADMIN_PERMISSIONS,
} from "~/lib/authorization";
import { PERMISSIONS } from "~/server/permissions";
import { renderHook } from "@testing-library/react";
import React from "react";

// Mock React for testing components
vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    createElement: vi.fn(),
    Fragment: vi.fn(),
  };
});

describe("Authorization Helpers", () => {
  describe("canUserPerform", () => {
    it("should return true for admin with any permission", () => {
      expect(canUserPerform(UserRole.ADMIN, PERMISSIONS.ORG_VIEW)).toBe(true);
      expect(canUserPerform(UserRole.ADMIN, PERMISSIONS.ORG_DELETE)).toBe(true);
      expect(canUserPerform(UserRole.ADMIN, PERMISSIONS.MEMBER_REMOVE)).toBe(true);
    });

    it("should return true for member with member permissions", () => {
      expect(canUserPerform(UserRole.MEMBER, PERMISSIONS.ORG_VIEW)).toBe(true);
      expect(canUserPerform(UserRole.MEMBER, PERMISSIONS.EXPENSE_CREATE)).toBe(true);
      expect(canUserPerform(UserRole.MEMBER, PERMISSIONS.POLICY_VIEW)).toBe(true);
    });

    it("should return false for member with admin-only permissions", () => {
      expect(canUserPerform(UserRole.MEMBER, PERMISSIONS.ORG_UPDATE)).toBe(false);
      expect(canUserPerform(UserRole.MEMBER, PERMISSIONS.ORG_DELETE)).toBe(false);
      expect(canUserPerform(UserRole.MEMBER, PERMISSIONS.MEMBER_REMOVE)).toBe(false);
      expect(canUserPerform(UserRole.MEMBER, PERMISSIONS.EXPENSE_VIEW_ALL)).toBe(false);
    });

    it("should return false for undefined role", () => {
      expect(canUserPerform(undefined as any, PERMISSIONS.ORG_VIEW)).toBe(false);
    });
  });

  describe("canUserPerformAny", () => {
    it("should return true if user has any of the specified permissions", () => {
      expect(
        canUserPerformAny(UserRole.MEMBER, [
          PERMISSIONS.ORG_DELETE,
          PERMISSIONS.ORG_VIEW,
        ])
      ).toBe(true);
    });

    it("should return false if user has none of the specified permissions", () => {
      expect(
        canUserPerformAny(UserRole.MEMBER, [
          PERMISSIONS.ORG_DELETE,
          PERMISSIONS.MEMBER_REMOVE,
        ])
      ).toBe(false);
    });

    it("should return false for undefined role", () => {
      expect(
        canUserPerformAny(undefined as any, [
          PERMISSIONS.ORG_VIEW,
          PERMISSIONS.ORG_UPDATE,
        ])
      ).toBe(false);
    });
  });

  describe("canUserPerformAll", () => {
    it("should return true if user has all specified permissions", () => {
      expect(
        canUserPerformAll(UserRole.MEMBER, [
          PERMISSIONS.ORG_VIEW,
          PERMISSIONS.EXPENSE_CREATE,
        ])
      ).toBe(true);
    });

    it("should return false if user is missing any specified permission", () => {
      expect(
        canUserPerformAll(UserRole.MEMBER, [
          PERMISSIONS.ORG_VIEW,
          PERMISSIONS.ORG_DELETE,
        ])
      ).toBe(false);
    });

    it("should return false for undefined role", () => {
      expect(
        canUserPerformAll(undefined as any, [
          PERMISSIONS.ORG_VIEW,
          PERMISSIONS.ORG_UPDATE,
        ])
      ).toBe(false);
    });
  });

  describe("getUserPermissions", () => {
    it("should return all permissions for admin role", () => {
      const adminPermissions = getUserPermissions(UserRole.ADMIN);
      expect(adminPermissions).toContain(PERMISSIONS.ORG_VIEW);
      expect(adminPermissions).toContain(PERMISSIONS.ORG_UPDATE);
      expect(adminPermissions).toContain(PERMISSIONS.ORG_DELETE);
      expect(adminPermissions).toContain(PERMISSIONS.MEMBER_REMOVE);
      expect(adminPermissions).toContain(PERMISSIONS.EXPENSE_VIEW_ALL);
    });

    it("should return limited permissions for member role", () => {
      const memberPermissions = getUserPermissions(UserRole.MEMBER);
      expect(memberPermissions).toContain(PERMISSIONS.ORG_VIEW);
      expect(memberPermissions).toContain(PERMISSIONS.EXPENSE_CREATE);
      expect(memberPermissions).not.toContain(PERMISSIONS.ORG_UPDATE);
      expect(memberPermissions).not.toContain(PERMISSIONS.MEMBER_REMOVE);
    });

    it("should return empty array for undefined role", () => {
      const permissions = getUserPermissions(undefined as any);
      expect(permissions).toEqual([]);
    });
  });
});

describe("Authorization Hooks", () => {
  describe("usePermission", () => {
    it("should return true for admin with any permission", () => {
      const { result } = renderHook(() =>
        usePermission(UserRole.ADMIN, PERMISSIONS.ORG_VIEW)
      );
      expect(result.current).toBe(true);
    });

    it("should return true for member with member permission", () => {
      const { result } = renderHook(() =>
        usePermission(UserRole.MEMBER, PERMISSIONS.ORG_VIEW)
      );
      expect(result.current).toBe(true);
    });

    it("should return false for member with admin permission", () => {
      const { result } = renderHook(() =>
        usePermission(UserRole.MEMBER, PERMISSIONS.ORG_DELETE)
      );
      expect(result.current).toBe(false);
    });

    it("should return false for undefined role", () => {
      const { result } = renderHook(() =>
        usePermission(undefined, PERMISSIONS.ORG_VIEW)
      );
      expect(result.current).toBe(false);
    });
  });

  describe("useAnyPermission", () => {
    it("should return true if user has any of the specified permissions", () => {
      const { result } = renderHook(() =>
        useAnyPermission(UserRole.MEMBER, [
          PERMISSIONS.ORG_DELETE,
          PERMISSIONS.ORG_VIEW,
        ])
      );
      expect(result.current).toBe(true);
    });

    it("should return false if user has none of the specified permissions", () => {
      const { result } = renderHook(() =>
        useAnyPermission(UserRole.MEMBER, [
          PERMISSIONS.ORG_DELETE,
          PERMISSIONS.MEMBER_REMOVE,
        ])
      );
      expect(result.current).toBe(false);
    });

    it("should return false for undefined role", () => {
      const { result } = renderHook(() =>
        useAnyPermission(undefined, [
          PERMISSIONS.ORG_VIEW,
          PERMISSIONS.ORG_UPDATE,
        ])
      );
      expect(result.current).toBe(false);
    });
  });

  describe("useAllPermissions", () => {
    it("should return true if user has all specified permissions", () => {
      const { result } = renderHook(() =>
        useAllPermissions(UserRole.MEMBER, [
          PERMISSIONS.ORG_VIEW,
          PERMISSIONS.EXPENSE_CREATE,
        ])
      );
      expect(result.current).toBe(true);
    });

    it("should return false if user is missing any specified permission", () => {
      const { result } = renderHook(() =>
        useAllPermissions(UserRole.MEMBER, [
          PERMISSIONS.ORG_VIEW,
          PERMISSIONS.ORG_DELETE,
        ])
      );
      expect(result.current).toBe(false);
    });

    it("should return false for undefined role", () => {
      const { result } = renderHook(() =>
        useAllPermissions(undefined, [
          PERMISSIONS.ORG_VIEW,
          PERMISSIONS.ORG_UPDATE,
        ])
      );
      expect(result.current).toBe(false);
    });
  });
});

describe("Permission Guard Components", () => {
  const mockCreateElement = vi.mocked(React.createElement);

  beforeEach(() => {
    mockCreateElement.mockClear();
  });

  describe("PermissionGuard", () => {
    it("should render children when user has permission", () => {
      const children = React.createElement("div", {}, "Protected Content");
      const fallback = React.createElement("div", {}, "Access Denied");

      PermissionGuard({
        role: UserRole.ADMIN,
        permission: PERMISSIONS.ORG_DELETE,
        fallback,
        children,
      });

      expect(mockCreateElement).toHaveBeenCalledWith(
        React.Fragment,
        null,
        children
      );
    });

    it("should render fallback when user lacks permission", () => {
      const children = React.createElement("div", {}, "Protected Content");
      const fallback = React.createElement("div", {}, "Access Denied");

      PermissionGuard({
        role: UserRole.MEMBER,
        permission: PERMISSIONS.ORG_DELETE,
        fallback,
        children,
      });

      expect(mockCreateElement).toHaveBeenCalledWith(
        React.Fragment,
        null,
        fallback
      );
    });

    it("should render null when user lacks permission and no fallback is provided", () => {
      const children = React.createElement("div", {}, "Protected Content");

      PermissionGuard({
        role: UserRole.MEMBER,
        permission: PERMISSIONS.ORG_DELETE,
        children,
      });

      expect(mockCreateElement).toHaveBeenCalledWith(
        React.Fragment,
        null,
        null
      );
    });

    it("should render fallback when role is undefined", () => {
      const children = React.createElement("div", {}, "Protected Content");
      const fallback = React.createElement("div", {}, "Access Denied");

      PermissionGuard({
        role: undefined,
        permission: PERMISSIONS.ORG_VIEW,
        fallback,
        children,
      });

      expect(mockCreateElement).toHaveBeenCalledWith(
        React.Fragment,
        null,
        fallback
      );
    });
  });

  describe("AnyPermissionGuard", () => {
    it("should render children when user has any of the specified permissions", () => {
      const children = React.createElement("div", {}, "Protected Content");
      const fallback = React.createElement("div", {}, "Access Denied");

      AnyPermissionGuard({
        role: UserRole.MEMBER,
        permissions: [PERMISSIONS.ORG_DELETE, PERMISSIONS.ORG_VIEW],
        fallback,
        children,
      });

      expect(mockCreateElement).toHaveBeenCalledWith(
        React.Fragment,
        null,
        children
      );
    });

    it("should render fallback when user has none of the specified permissions", () => {
      const children = React.createElement("div", {}, "Protected Content");
      const fallback = React.createElement("div", {}, "Access Denied");

      AnyPermissionGuard({
        role: UserRole.MEMBER,
        permissions: [PERMISSIONS.ORG_DELETE, PERMISSIONS.MEMBER_REMOVE],
        fallback,
        children,
      });

      expect(mockCreateElement).toHaveBeenCalledWith(
        React.Fragment,
        null,
        fallback
      );
    });

    it("should render fallback when role is undefined", () => {
      const children = React.createElement("div", {}, "Protected Content");
      const fallback = React.createElement("div", {}, "Access Denied");

      AnyPermissionGuard({
        role: undefined,
        permissions: [PERMISSIONS.ORG_VIEW, PERMISSIONS.ORG_UPDATE],
        fallback,
        children,
      });

      expect(mockCreateElement).toHaveBeenCalledWith(
        React.Fragment,
        null,
        fallback
      );
    });
  });

  describe("AllPermissionsGuard", () => {
    it("should render children when user has all specified permissions", () => {
      const children = React.createElement("div", {}, "Protected Content");
      const fallback = React.createElement("div", {}, "Access Denied");

      AllPermissionsGuard({
        role: UserRole.MEMBER,
        permissions: [PERMISSIONS.ORG_VIEW, PERMISSIONS.EXPENSE_CREATE],
        fallback,
        children,
      });

      expect(mockCreateElement).toHaveBeenCalledWith(
        React.Fragment,
        null,
        children
      );
    });

    it("should render fallback when user is missing any specified permission", () => {
      const children = React.createElement("div", {}, "Protected Content");
      const fallback = React.createElement("div", {}, "Access Denied");

      AllPermissionsGuard({
        role: UserRole.MEMBER,
        permissions: [PERMISSIONS.ORG_VIEW, PERMISSIONS.ORG_DELETE],
        fallback,
        children,
      });

      expect(mockCreateElement).toHaveBeenCalledWith(
        React.Fragment,
        null,
        fallback
      );
    });

    it("should render fallback when role is undefined", () => {
      const children = React.createElement("div", {}, "Protected Content");
      const fallback = React.createElement("div", {}, "Access Denied");

      AllPermissionsGuard({
        role: undefined,
        permissions: [PERMISSIONS.ORG_VIEW, PERMISSIONS.ORG_UPDATE],
        fallback,
        children,
      });

      expect(mockCreateElement).toHaveBeenCalledWith(
        React.Fragment,
        null,
        fallback
      );
    });
  });
});

describe("Permission Groups", () => {
  describe("ORG_ADMIN_PERMISSIONS", () => {
    it("should contain all organization admin permissions", () => {
      expect(ORG_ADMIN_PERMISSIONS).toContain(PERMISSIONS.ORG_UPDATE);
      expect(ORG_ADMIN_PERMISSIONS).toContain(PERMISSIONS.ORG_DELETE);
      expect(ORG_ADMIN_PERMISSIONS).toContain(PERMISSIONS.MEMBER_INVITE);
      expect(ORG_ADMIN_PERMISSIONS).toContain(PERMISSIONS.MEMBER_UPDATE_ROLE);
      expect(ORG_ADMIN_PERMISSIONS).toContain(PERMISSIONS.MEMBER_REMOVE);
    });

    it("should be accessible to admin users", () => {
      expect(
        canUserPerformAll(UserRole.ADMIN, ORG_ADMIN_PERMISSIONS)
      ).toBe(true);
    });

    it("should not be accessible to member users", () => {
      expect(
        canUserPerformAll(UserRole.MEMBER, ORG_ADMIN_PERMISSIONS)
      ).toBe(false);
    });
  });

  describe("MEMBER_MANAGEMENT_PERMISSIONS", () => {
    it("should contain all member management permissions", () => {
      expect(MEMBER_MANAGEMENT_PERMISSIONS).toContain(PERMISSIONS.MEMBER_VIEW);
      expect(MEMBER_MANAGEMENT_PERMISSIONS).toContain(PERMISSIONS.MEMBER_INVITE);
      expect(MEMBER_MANAGEMENT_PERMISSIONS).toContain(PERMISSIONS.MEMBER_UPDATE_ROLE);
      expect(MEMBER_MANAGEMENT_PERMISSIONS).toContain(PERMISSIONS.MEMBER_REMOVE);
    });

    it("should be accessible to admin users", () => {
      expect(
        canUserPerformAll(UserRole.ADMIN, MEMBER_MANAGEMENT_PERMISSIONS)
      ).toBe(true);
    });

    it("should not be fully accessible to member users", () => {
      expect(
        canUserPerformAll(UserRole.MEMBER, MEMBER_MANAGEMENT_PERMISSIONS)
      ).toBe(false);
    });

    it("should be partially accessible to member users", () => {
      expect(
        canUserPerformAny(UserRole.MEMBER, MEMBER_MANAGEMENT_PERMISSIONS)
      ).toBe(true);
    });
  });

  describe("EXPENSE_MANAGEMENT_PERMISSIONS", () => {
    it("should contain all basic expense permissions", () => {
      expect(EXPENSE_MANAGEMENT_PERMISSIONS).toContain(PERMISSIONS.EXPENSE_CREATE);
      expect(EXPENSE_MANAGEMENT_PERMISSIONS).toContain(PERMISSIONS.EXPENSE_VIEW_OWN);
      expect(EXPENSE_MANAGEMENT_PERMISSIONS).toContain(PERMISSIONS.EXPENSE_UPDATE_OWN);
      expect(EXPENSE_MANAGEMENT_PERMISSIONS).toContain(PERMISSIONS.EXPENSE_DELETE_OWN);
    });

    it("should be accessible to both admin and member users", () => {
      expect(
        canUserPerformAll(UserRole.ADMIN, EXPENSE_MANAGEMENT_PERMISSIONS)
      ).toBe(true);
      expect(
        canUserPerformAll(UserRole.MEMBER, EXPENSE_MANAGEMENT_PERMISSIONS)
      ).toBe(true);
    });
  });

  describe("EXPENSE_ADMIN_PERMISSIONS", () => {
    it("should contain all expense permissions including admin ones", () => {
      expect(EXPENSE_ADMIN_PERMISSIONS).toContain(PERMISSIONS.EXPENSE_CREATE);
      expect(EXPENSE_ADMIN_PERMISSIONS).toContain(PERMISSIONS.EXPENSE_VIEW_OWN);
      expect(EXPENSE_ADMIN_PERMISSIONS).toContain(PERMISSIONS.EXPENSE_UPDATE_OWN);
      expect(EXPENSE_ADMIN_PERMISSIONS).toContain(PERMISSIONS.EXPENSE_DELETE_OWN);
      expect(EXPENSE_ADMIN_PERMISSIONS).toContain(PERMISSIONS.EXPENSE_VIEW_ALL);
      expect(EXPENSE_ADMIN_PERMISSIONS).toContain(PERMISSIONS.EXPENSE_UPDATE_ALL);
      expect(EXPENSE_ADMIN_PERMISSIONS).toContain(PERMISSIONS.EXPENSE_DELETE_ALL);
    });

    it("should be accessible to admin users", () => {
      expect(
        canUserPerformAll(UserRole.ADMIN, EXPENSE_ADMIN_PERMISSIONS)
      ).toBe(true);
    });

    it("should not be fully accessible to member users", () => {
      expect(
        canUserPerformAll(UserRole.MEMBER, EXPENSE_ADMIN_PERMISSIONS)
      ).toBe(false);
    });

    it("should be partially accessible to member users", () => {
      expect(
        canUserPerformAny(UserRole.MEMBER, EXPENSE_ADMIN_PERMISSIONS)
      ).toBe(true);
    });
  });
});