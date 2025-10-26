import { describe, expect, it, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { userManagementRouter } from "~/server/api/routers/user-management";
import { db } from "~/server/db";
import { faker } from "@faker-js/faker";
import { UserRole } from "@prisma/client";

// Mock the database to use the transactional testing wrapper
vi.mock("~/server/db");

// Mock the auth module
vi.mock("~/server/auth", () => ({
  auth: vi.fn(),
}));

describe("userManagementRouter", () => {
  let adminUser: any;
  let memberUser: any;
  let organization: any;
  let adminMembership: any;
  let memberMembership: any;

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

    // Create test organization
    organization = await db.organization.create({
      data: {
        name: "Test Organization",
        slug: "test-org",
      },
    });

    // Create user memberships
    adminMembership = await db.userOrganization.create({
      data: {
        userId: adminUser.id,
        organizationId: organization.id,
        role: UserRole.ADMIN,
      },
    });

    memberMembership = await db.userOrganization.create({
      data: {
        userId: memberUser.id,
        organizationId: organization.id,
        role: UserRole.MEMBER,
      },
    });
  });

  describe("updateUserRole", () => {
    it("should allow admin to update a member's role to admin", async () => {
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

      expect(result.userId).toEqual(memberUser.id);
      expect(result.organizationId).toEqual(organization.id);
      expect(result.role).toEqual(UserRole.ADMIN);
      expect(result.user.id).toEqual(memberUser.id);
      expect(result.organization.id).toEqual(organization.id);

      // Verify the role was updated in the database
      const updatedMembership = await db.userOrganization.findUnique({
        where: {
          userId_organizationId: {
            userId: memberUser.id,
            organizationId: organization.id,
          },
        },
      });
      expect(updatedMembership?.role).toEqual(UserRole.ADMIN);
    });

    it("should allow admin to update an admin's role to member", async () => {
      // Create another admin user
      const anotherAdmin = await db.user.create({
        data: {
          name: "Another Admin",
          email: faker.internet.email(),
        },
      });

      await db.userOrganization.create({
        data: {
          userId: anotherAdmin.id,
          organizationId: organization.id,
          role: UserRole.ADMIN,
        },
      });

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
        userId: anotherAdmin.id,
        organizationId: organization.id,
        role: UserRole.MEMBER,
      });

      expect(result.role).toEqual(UserRole.MEMBER);
    });

    it("should prevent member from updating another user's role", async () => {
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

    it("should throw an error when trying to update a non-existent user", async () => {
      const mockSession = {
        user: adminUser,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = userManagementRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      await expect(
        caller.updateUserRole({
          userId: "non-existent-user-id",
          organizationId: organization.id,
          role: UserRole.MEMBER,
        })
      ).rejects.toThrow(TRPCError);

      try {
        await caller.updateUserRole({
          userId: "non-existent-user-id",
          organizationId: organization.id,
          role: UserRole.MEMBER,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        if (error instanceof TRPCError) {
          expect(error.code).toBe("NOT_FOUND");
          expect(error.message).toBe("User is not a member of this organization");
        }
      }
    });

    it("should prevent demoting the last admin", async () => {
      const mockSession = {
        user: adminUser,
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
          expect(error.message).toBe("Cannot remove the last admin from an organization");
        }
      }
    });

    it("should allow updating own role if there are other admins", async () => {
      // Create another admin
      const anotherAdmin = await db.user.create({
        data: {
          name: "Another Admin",
          email: faker.internet.email(),
        },
      });

      await db.userOrganization.create({
        data: {
          userId: anotherAdmin.id,
          organizationId: organization.id,
          role: UserRole.ADMIN,
        },
      });

      const mockSession = {
        user: adminUser,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = userManagementRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      // Now adminUser should be able to demote themselves
      const result = await caller.updateUserRole({
        userId: adminUser.id,
        organizationId: organization.id,
        role: UserRole.MEMBER,
      });

      expect(result.role).toEqual(UserRole.MEMBER);
    });
  });

  describe("removeUserFromOrganization", () => {
    it("should allow admin to remove a member from organization", async () => {
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

      // Verify the user was removed from the organization
      const membership = await db.userOrganization.findUnique({
        where: {
          userId_organizationId: {
            userId: memberUser.id,
            organizationId: organization.id,
          },
        },
      });
      expect(membership).toBeNull();
    });

    it("should prevent member from removing another user from organization", async () => {
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

    it("should throw an error when trying to remove a non-existent user", async () => {
      const mockSession = {
        user: adminUser,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = userManagementRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      await expect(
        caller.removeUserFromOrganization({
          userId: "non-existent-user-id",
          organizationId: organization.id,
        })
      ).rejects.toThrow(TRPCError);

      try {
        await caller.removeUserFromOrganization({
          userId: "non-existent-user-id",
          organizationId: organization.id,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        if (error instanceof TRPCError) {
          expect(error.code).toBe("NOT_FOUND");
          expect(error.message).toBe("User is not a member of this organization");
        }
      }
    });

    it("should prevent removing the last admin", async () => {
      const mockSession = {
        user: adminUser,
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
          expect(error.message).toBe("Cannot remove the last admin from an organization");
        }
      }
    });

    it("should allow removing an admin if there are other admins", async () => {
      // Create another admin
      const anotherAdmin = await db.user.create({
        data: {
          name: "Another Admin",
          email: faker.internet.email(),
        },
      });

      await db.userOrganization.create({
        data: {
          userId: anotherAdmin.id,
          organizationId: organization.id,
          role: UserRole.ADMIN,
        },
      });

      const mockSession = {
        user: adminUser,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = userManagementRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      // Create a third admin to remove
      const adminToRemove = await db.user.create({
        data: {
          name: "Admin To Remove",
          email: faker.internet.email(),
        },
      });

      const adminToRemoveMembership = await db.userOrganization.create({
        data: {
          userId: adminToRemove.id,
          organizationId: organization.id,
          role: UserRole.ADMIN,
        },
      });

      // Now adminUser should be able to remove adminToRemove
      const result = await caller.removeUserFromOrganization({
        userId: adminToRemove.id,
        organizationId: organization.id,
      });

      expect(result.success).toBe(true);

      // Verify the admin was removed
      const membership = await db.userOrganization.findUnique({
        where: {
          userId_organizationId: {
            userId: adminToRemove.id,
            organizationId: organization.id,
          },
        },
      });
      expect(membership).toBeNull();
    });

    it("should allow admin to remove themselves if there are other admins", async () => {
      // Create another admin
      const anotherAdmin = await db.user.create({
        data: {
          name: "Another Admin",
          email: faker.internet.email(),
        },
      });

      await db.userOrganization.create({
        data: {
          userId: anotherAdmin.id,
          organizationId: organization.id,
          role: UserRole.ADMIN,
        },
      });

      const mockSession = {
        user: adminUser,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = userManagementRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      // Now adminUser should be able to remove themselves
      const result = await caller.removeUserFromOrganization({
        userId: adminUser.id,
        organizationId: organization.id,
      });

      expect(result.success).toBe(true);

      // Verify the admin was removed
      const membership = await db.userOrganization.findUnique({
        where: {
          userId_organizationId: {
            userId: adminUser.id,
            organizationId: organization.id,
          },
        },
      });
      expect(membership).toBeNull();
    });
  });
});