import { describe, it, expect } from "vitest";
import { UserRole } from "@prisma/client";
import {
  PERMISSIONS,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getRolePermissions,
} from "~/server/permissions";

describe("Permissions System", () => {
  describe("hasPermission", () => {
    it("should return true for admin with any permission", () => {
      expect(hasPermission(UserRole.ADMIN, PERMISSIONS.ORG_VIEW)).toBe(true);
      expect(hasPermission(UserRole.ADMIN, PERMISSIONS.ORG_DELETE)).toBe(true);
      expect(hasPermission(UserRole.ADMIN, PERMISSIONS.MEMBER_REMOVE)).toBe(true);
    });

    it("should return true for member with member permissions", () => {
      expect(hasPermission(UserRole.MEMBER, PERMISSIONS.ORG_VIEW)).toBe(true);
      expect(hasPermission(UserRole.MEMBER, PERMISSIONS.EXPENSE_CREATE)).toBe(true);
      expect(hasPermission(UserRole.MEMBER, PERMISSIONS.POLICY_VIEW)).toBe(true);
    });

    it("should return false for member with admin-only permissions", () => {
      expect(hasPermission(UserRole.MEMBER, PERMISSIONS.ORG_UPDATE)).toBe(false);
      expect(hasPermission(UserRole.MEMBER, PERMISSIONS.ORG_DELETE)).toBe(false);
      expect(hasPermission(UserRole.MEMBER, PERMISSIONS.MEMBER_REMOVE)).toBe(false);
      expect(hasPermission(UserRole.MEMBER, PERMISSIONS.EXPENSE_VIEW_ALL)).toBe(false);
    });
  });

  describe("hasAnyPermission", () => {
    it("should return true if user has any of the specified permissions", () => {
      expect(
        hasAnyPermission(UserRole.MEMBER, [
          PERMISSIONS.ORG_DELETE,
          PERMISSIONS.ORG_VIEW,
        ])
      ).toBe(true);
    });

    it("should return false if user has none of the specified permissions", () => {
      expect(
        hasAnyPermission(UserRole.MEMBER, [
          PERMISSIONS.ORG_DELETE,
          PERMISSIONS.MEMBER_REMOVE,
        ])
      ).toBe(false);
    });
  });

  describe("hasAllPermissions", () => {
    it("should return true if user has all specified permissions", () => {
      expect(
        hasAllPermissions(UserRole.MEMBER, [
          PERMISSIONS.ORG_VIEW,
          PERMISSIONS.EXPENSE_CREATE,
        ])
      ).toBe(true);
    });

    it("should return false if user is missing any specified permission", () => {
      expect(
        hasAllPermissions(UserRole.MEMBER, [
          PERMISSIONS.ORG_VIEW,
          PERMISSIONS.ORG_DELETE,
        ])
      ).toBe(false);
    });
  });

  describe("getRolePermissions", () => {
    it("should return all permissions for admin role", () => {
      const adminPermissions = getRolePermissions(UserRole.ADMIN);
      expect(adminPermissions).toContain(PERMISSIONS.ORG_VIEW);
      expect(adminPermissions).toContain(PERMISSIONS.ORG_UPDATE);
      expect(adminPermissions).toContain(PERMISSIONS.ORG_DELETE);
      expect(adminPermissions).toContain(PERMISSIONS.MEMBER_REMOVE);
      expect(adminPermissions).toContain(PERMISSIONS.EXPENSE_VIEW_ALL);
    });

    it("should return limited permissions for member role", () => {
      const memberPermissions = getRolePermissions(UserRole.MEMBER);
      expect(memberPermissions).toContain(PERMISSIONS.ORG_VIEW);
      expect(memberPermissions).toContain(PERMISSIONS.EXPENSE_CREATE);
      expect(memberPermissions).not.toContain(PERMISSIONS.ORG_UPDATE);
      expect(memberPermissions).not.toContain(PERMISSIONS.MEMBER_REMOVE);
    });
  });
});