import { describe, expect, it, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { organizationRouter } from "~/server/api/routers/organization";
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

describe("Edge Cases - Last Admin Prevention", () => {
  let adminUser: any;
  let memberUser: any;
  let organization: any;

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
  });

  describe("Preventing Last Admin Removal", () => {
    it("should prevent removing the last admin from organization", async () => {
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

    it("should prevent demoting the last admin to member", async () => {
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

    it("should allow removing an admin when there are multiple admins", async () => {
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

    it("should allow demoting an admin when there are multiple admins", async () => {
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

    it("should prevent member from removing the last admin", async () => {
      const mockSession = {
        user: memberUser,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = userManagementRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      // Member shouldn't be able to remove admin due to both permission and last admin check
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

    it("should prevent member from demoting the last admin", async () => {
      const mockSession = {
        user: memberUser,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = userManagementRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      // Member shouldn't be able to demote admin due to permission check
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
  });

  describe("Edge Cases with Organization Creation", () => {
    it("should always create the creator as an admin", async () => {
      const mockSession = {
        user: memberUser, // Using memberUser to show they become admin
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = organizationRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      const newOrg = await caller.create({
        name: "New Organization",
        slug: "new-org",
      });

      // Verify the user was added as an admin
      const membership = await db.userOrganization.findUnique({
        where: {
          userId_organizationId: {
            userId: memberUser.id,
            organizationId: newOrg.id,
          },
        },
      });
      expect(membership).toBeDefined();
      expect(membership?.role).toEqual(UserRole.ADMIN);
    });

    it("should prevent creating organization with duplicate slug", async () => {
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
        caller.create({
          name: "Duplicate Organization",
          slug: "test-org", // Same slug as existing organization
        })
      ).rejects.toThrow(TRPCError);

      try {
        await caller.create({
          name: "Duplicate Organization",
          slug: "test-org",
        });
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        if (error instanceof TRPCError) {
          expect(error.code).toBe("CONFLICT");
          expect(error.message).toBe("Organization with this slug already exists");
        }
      }
    });
  });

  describe("Edge Cases with Non-Existent Resources", () => {
    it("should handle updating role of non-existent user", async () => {
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

    it("should handle removing non-existent user", async () => {
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

    it("should handle operations in non-existent organization", async () => {
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
          userId: memberUser.id,
          organizationId: "non-existent-org-id",
          role: UserRole.ADMIN,
        })
      ).rejects.toThrow(TRPCError);

      try {
        await caller.updateUserRole({
          userId: memberUser.id,
          organizationId: "non-existent-org-id",
          role: UserRole.ADMIN,
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

  describe("Edge Cases with User Not in Organization", () => {
    let otherUser: any;
    let otherOrganization: any;

    beforeEach(async () => {
      // Create a user and organization not connected to the main test data
      otherUser = await db.user.create({
        data: {
          name: "Other User",
          email: faker.internet.email(),
        },
      });

      otherOrganization = await db.organization.create({
        data: {
          name: "Other Organization",
          slug: "other-org",
        },
      });

      // Add otherUser as admin of otherOrganization
      await db.userOrganization.create({
        data: {
          userId: otherUser.id,
          organizationId: otherOrganization.id,
          role: UserRole.ADMIN,
        },
      });
    });

    it("should prevent user from managing users in organizations they're not part of", async () => {
      const mockSession = {
        user: otherUser,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = userManagementRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      // otherUser should not be able to manage memberUser in the main organization
      await expect(
        caller.updateUserRole({
          userId: memberUser.id,
          organizationId: organization.id,
          role: UserRole.ADMIN,
        })
      ).rejects.toThrow(TRPCError);

      try {
        await caller.updateUserRole({
          userId: memberUser.id,
          organizationId: organization.id,
          role: UserRole.ADMIN,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        if (error instanceof TRPCError) {
          expect(error.code).toBe("FORBIDDEN");
          expect(error.message).toBe("You are not a member of this organization");
        }
      }
    });

    it("should prevent user from accessing organizations they're not part of", async () => {
      const mockSession = {
        user: otherUser,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = organizationRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      // otherUser should not be able to access the main organization
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

  describe("Edge Cases with Self-Management", () => {
    it("should allow admin to demote themselves when other admins exist", async () => {
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

      // Admin should be able to demote themselves
      const result = await caller.updateUserRole({
        userId: adminUser.id,
        organizationId: organization.id,
        role: UserRole.MEMBER,
      });

      expect(result.role).toEqual(UserRole.MEMBER);
    });

    it("should allow admin to remove themselves when other admins exist", async () => {
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

      // Admin should be able to remove themselves
      const result = await caller.removeUserFromOrganization({
        userId: adminUser.id,
        organizationId: organization.id,
      });

      expect(result.success).toBe(true);
    });
  });
});