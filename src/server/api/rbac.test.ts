import { describe, expect, it, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { organizationRouter } from "~/server/api/routers/organization";
import { userManagementRouter } from "~/server/api/routers/user-management";
import { db } from "~/server/db";
import { faker } from "@faker-js/faker";
import { UserRole } from "@prisma/client";
import { PERMISSIONS } from "~/server/permissions";

// Mock the database to use the transactional testing wrapper
vi.mock("~/server/db");

// Mock the auth module
vi.mock("~/server/auth", () => ({
  auth: vi.fn(),
}));

describe("Role-Based Access Control Integration Tests", () => {
  let adminUser: any;
  let memberUser: any;
  let organization: any;
  let anotherOrganization: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Create test users
    adminUser = await db.user.create({
      data: {
        name: "Admin User",
        email: faker.internet.email(),
      },
    });

    memberUser = await db.user.create({
      data: {
        name: "Member User",
        email: faker.internet.email(),
      },
    });

    // Create test organizations
    organization = await db.organization.create({
      data: {
        name: "Test Organization",
        slug: "test-org",
      },
    });

    anotherOrganization = await db.organization.create({
      data: {
        name: "Another Organization",
        slug: "another-org",
      },
    });

    // Create user memberships
    await db.userOrganization.create({
      data: {
        userId: adminUser.id,
        organizationId: organization.id,
        role: UserRole.ADMIN,
      },
    });

    await db.userOrganization.create({
      data: {
        userId: memberUser.id,
        organizationId: organization.id,
        role: UserRole.MEMBER,
      },
    });

    // Admin user is also a member in another organization (as a member)
    await db.userOrganization.create({
      data: {
        userId: adminUser.id,
        organizationId: anotherOrganization.id,
        role: UserRole.MEMBER,
      },
    });
  });

  describe("Organization Access Control", () => {
    it("should allow admin to view organization", async () => {
      const mockSession = {
        user: adminUser,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = organizationRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      const result = await caller.get({ id: organization.id });
      expect(result.id).toEqual(organization.id);
    });

    it("should allow member to view organization", async () => {
      const mockSession = {
        user: memberUser,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = organizationRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      const result = await caller.get({ id: organization.id });
      expect(result.id).toEqual(organization.id);
    });

    it("should allow admin to update organization", async () => {
      const mockSession = {
        user: adminUser,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = organizationRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      const result = await caller.update({
        id: organization.id,
        name: "Updated Organization",
      });

      expect(result.name).toEqual("Updated Organization");
    });

    it("should prevent member from updating organization", async () => {
      const mockSession = {
        user: memberUser,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = organizationRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      await expect(
        caller.update({
          id: organization.id,
          name: "Updated Organization",
        })
      ).rejects.toThrow(TRPCError);

      try {
        await caller.update({
          id: organization.id,
          name: "Updated Organization",
        });
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        if (error instanceof TRPCError) {
          expect(error.code).toBe("FORBIDDEN");
          expect(error.message).toBe("You don't have permission to perform this action");
        }
      }
    });

    it("should prevent user from accessing organization they are not a member of", async () => {
      const nonMemberUser = await db.user.create({
        data: {
          name: "Non Member User",
          email: faker.internet.email(),
        },
      });

      const mockSession = {
        user: nonMemberUser,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = organizationRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      await expect(
        caller.get({ id: organization.id })
      ).rejects.toThrow(TRPCError);

      try {
        await caller.get({ id: organization.id });
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        if (error instanceof TRPCError) {
          expect(error.code).toBe("FORBIDDEN");
          expect(error.message).toBe("You are not a member of this organization");
        }
      }
    });
  });

  describe("User Management Access Control", () => {
    it("should allow admin to update user roles", async () => {
      const mockSession = {
        user: adminUser,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = userManagementRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      const result = await caller.updateUserRole({
        userId: memberUser.id,
        organizationId: organization.id,
        role: UserRole.ADMIN,
      });

      expect(result.role).toEqual(UserRole.ADMIN);
    });

    it("should prevent member from updating user roles", async () => {
      const mockSession = {
        user: memberUser,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = userManagementRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      await expect(
        caller.updateUserRole({
          userId: adminUser.id,
          organizationId: organization.id,
          role: UserRole.MEMBER,
        })
      ).rejects.toThrow(TRPCError);

      try {
        await caller.updateUserRole({
          userId: adminUser.id,
          organizationId: organization.id,
          role: UserRole.MEMBER,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        if (error instanceof TRPCError) {
          expect(error.code).toBe("FORBIDDEN");
          expect(error.message).toBe("You don't have permission to perform this action");
        }
      }
    });

    it("should allow admin to remove users from organization", async () => {
      const mockSession = {
        user: adminUser,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = userManagementRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      const result = await caller.removeUserFromOrganization({
        userId: memberUser.id,
        organizationId: organization.id,
      });

      expect(result.success).toBe(true);
    });

    it("should prevent member from removing users from organization", async () => {
      const mockSession = {
        user: memberUser,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = userManagementRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      await expect(
        caller.removeUserFromOrganization({
          userId: adminUser.id,
          organizationId: organization.id,
        })
      ).rejects.toThrow(TRPCError);

      try {
        await caller.removeUserFromOrganization({
          userId: adminUser.id,
          organizationId: organization.id,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        if (error instanceof TRPCError) {
          expect(error.code).toBe("FORBIDDEN");
          expect(error.message).toBe("You don't have permission to perform this action");
        }
      }
    });
  });

  describe("Cross-Organization Access Control", () => {
    it("should respect different roles in different organizations", async () => {
      // Admin user is admin in organization but member in anotherOrganization
      const mockSession = {
        user: adminUser,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = organizationRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      // Should be able to update organization where user is admin
      const updateResult = await caller.update({
        id: organization.id,
        name: "Updated by Admin",
      });
      expect(updateResult.name).toEqual("Updated by Admin");

      // Should NOT be able to update anotherOrganization where user is member
      await expect(
        caller.update({
          id: anotherOrganization.id,
          name: "Updated by Member",
        })
      ).rejects.toThrow(TRPCError);

      try {
        await caller.update({
          id: anotherOrganization.id,
          name: "Updated by Member",
        });
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        if (error instanceof TRPCError) {
          expect(error.code).toBe("FORBIDDEN");
          expect(error.message).toBe("You don't have permission to perform this action");
        }
      }
    });

    it("should prevent actions in organizations where user is not a member", async () => {
      const thirdOrganization = await db.organization.create({
        data: {
          name: "Third Organization",
          slug: "third-org",
        },
      });

      const mockSession = {
        user: memberUser,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = userManagementRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      // Should not be able to perform user management in organization where user is not a member
      await expect(
        caller.updateUserRole({
          userId: adminUser.id,
          organizationId: thirdOrganization.id,
          role: UserRole.MEMBER,
        })
      ).rejects.toThrow(TRPCError);

      try {
        await caller.updateUserRole({
          userId: adminUser.id,
          organizationId: thirdOrganization.id,
          role: UserRole.MEMBER,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        if (error instanceof TRPCError) {
          expect(error.code).toBe("FORBIDDEN");
          expect(error.message).toBe("You are not a member of this organization");
        }
      }
    });
  });

  describe("Member Management Access Control", () => {
    it("should allow admin to view organization members", async () => {
      const mockSession = {
        user: adminUser,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = organizationRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      const result = await caller.getMembers({ organizationId: organization.id });
      expect(result).toHaveLength(2); // adminUser and memberUser
    });

    it("should allow member to view organization members", async () => {
      const mockSession = {
        user: memberUser,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = organizationRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      const result = await caller.getMembers({ organizationId: organization.id });
      expect(result).toHaveLength(2); // adminUser and memberUser
    });

    it("should allow users to get their own role in organization", async () => {
      const mockSession = {
        user: memberUser,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = organizationRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      const result = await caller.getUserRoleInOrganization({ 
        organizationId: organization.id 
      });
      expect(result).toEqual(UserRole.MEMBER);
    });

    it("should throw error when non-member tries to get their role", async () => {
      const nonMemberUser = await db.user.create({
        data: {
          name: "Non Member User",
          email: faker.internet.email(),
        },
      });

      const mockSession = {
        user: nonMemberUser,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = organizationRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      await expect(
        caller.getUserRoleInOrganization({ 
          organizationId: organization.id 
        })
      ).rejects.toThrow(TRPCError);

      try {
        await caller.getUserRoleInOrganization({ 
          organizationId: organization.id 
        });
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        if (error instanceof TRPCError) {
          expect(error.code).toBe("NOT_FOUND");
          expect(error.message).toBe("User is not a member of this organization");
        }
      }
    });
  });
});