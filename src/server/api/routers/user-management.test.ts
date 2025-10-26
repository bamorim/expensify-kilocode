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

  describe("Edge Cases with Non-Existent Resources", () => {
    let adminUser: any;
    let organization: any;

    beforeEach(async () => {
      // Create test user and organization
      adminUser = await db.user.create({
        data: {
          name: "Admin User",
          email: faker.internet.email(),
        },
      });

      // Generate a unique slug using timestamp and random string
      const uniqueSlug = `test-org-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      
      organization = await db.organization.create({
        data: {
          name: "Test Organization",
          slug: uniqueSlug,
        },
      });

      // Add user as admin
      await db.userOrganization.create({
        data: {
          userId: adminUser.id,
          organizationId: organization.id,
          role: UserRole.ADMIN,
        },
      });
    });

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
          userId: adminUser.id,
          organizationId: "non-existent-org-id",
          role: UserRole.ADMIN,
        })
      ).rejects.toThrow(TRPCError);

      try {
        await caller.updateUserRole({
          userId: adminUser.id,
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
    let mainUser: any;
    let mainOrganization: any;

    beforeEach(async () => {
      // Create a user and organization not connected to main test data
      otherUser = await db.user.create({
        data: {
          name: "Other User",
          email: faker.internet.email(),
        },
      });

      // Generate a unique slug using timestamp and random string
      const uniqueSlug1 = `other-org-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      
      otherOrganization = await db.organization.create({
        data: {
          name: "Other Organization",
          slug: uniqueSlug1,
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

      // Create main test data
      mainUser = await db.user.create({
        data: {
          name: "Main User",
          email: faker.internet.email(),
        },
      });

      // Generate a unique slug using timestamp and random string
      const uniqueSlug2 = `main-org-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      
      mainOrganization = await db.organization.create({
        data: {
          name: "Main Organization",
          slug: uniqueSlug2,
        },
      });

      await db.userOrganization.create({
        data: {
          userId: mainUser.id,
          organizationId: mainOrganization.id,
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

      // otherUser should not be able to manage mainUser in the main organization
      await expect(
        caller.updateUserRole({
          userId: mainUser.id,
          organizationId: mainOrganization.id,
          role: UserRole.ADMIN,
        })
      ).rejects.toThrow(TRPCError);

      try {
        await caller.updateUserRole({
          userId: mainUser.id,
          organizationId: mainOrganization.id,
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

  describe("Edge Cases with Self-Management", () => {
    let adminUser: any;
    let organization: any;

    beforeEach(async () => {
      // Create test user and organization
      adminUser = await db.user.create({
        data: {
          name: "Admin User",
          email: faker.internet.email(),
        },
      });

      // Generate a unique slug using timestamp and random string
      const uniqueSlug = `self-org-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      
      organization = await db.organization.create({
        data: {
          name: "Test Organization",
          slug: uniqueSlug,
        },
      });

      // Add user as admin
      await db.userOrganization.create({
        data: {
          userId: adminUser.id,
          organizationId: organization.id,
          role: UserRole.ADMIN,
        },
      });
    });

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

  describe("User Management Across Organizations", () => {
    let user: any;
    let org1: any;
    let org2: any;
    let org3: any;
    let otherUser: any;

    beforeEach(async () => {
      // Create test user
      user = await db.user.create({
        data: {
          name: "Test User",
          email: faker.internet.email(),
        },
      });

      // Create test organizations
      org1 = await db.organization.create({
        data: {
          name: "Organization 1",
          slug: "org-1",
        },
      });

      org2 = await db.organization.create({
        data: {
          name: "Organization 2",
          slug: "org-2",
        },
      });

      org3 = await db.organization.create({
        data: {
          name: "Organization 3",
          slug: "org-3",
        },
      });

      // Create user memberships with different roles
      await db.userOrganization.create({
        data: {
          userId: user.id,
          organizationId: org1.id,
          role: UserRole.ADMIN,
        },
      });

      await db.userOrganization.create({
        data: {
          userId: user.id,
          organizationId: org2.id,
          role: UserRole.MEMBER,
        },
      });

      await db.userOrganization.create({
        data: {
          userId: user.id,
          organizationId: org3.id,
          role: UserRole.ADMIN,
        },
      });

      // Create another user to test user management
      otherUser = await db.user.create({
        data: {
          name: "Other User",
          email: faker.internet.email(),
        },
      });

      // Add other user to all organizations as a member
      await db.userOrganization.create({
        data: {
          userId: otherUser.id,
          organizationId: org1.id,
          role: UserRole.MEMBER,
        },
      });

      await db.userOrganization.create({
        data: {
          userId: otherUser.id,
          organizationId: org2.id,
          role: UserRole.MEMBER,
        },
      });

      await db.userOrganization.create({
        data: {
          userId: otherUser.id,
          organizationId: org3.id,
          role: UserRole.MEMBER,
        },
      });
    });

    it("should allow user management in organizations where user is admin", async () => {
      const mockSession = {
        user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = userManagementRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      // Should be able to update roles in org1 (admin role)
      const updateResult1 = await caller.updateUserRole({
        userId: otherUser.id,
        organizationId: org1.id,
        role: UserRole.ADMIN,
      });
      expect(updateResult1.role).toEqual(UserRole.ADMIN);

      // Should be able to update roles in org3 (admin role)
      const updateResult3 = await caller.updateUserRole({
        userId: otherUser.id,
        organizationId: org3.id,
        role: UserRole.ADMIN,
      });
      expect(updateResult3.role).toEqual(UserRole.ADMIN);
    });

    it("should prevent user management in organizations where user is member", async () => {
      const mockSession = {
        user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = userManagementRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      // Should NOT be able to update roles in org2 (member role)
      await expect(
        caller.updateUserRole({
          userId: otherUser.id,
          organizationId: org2.id,
          role: UserRole.ADMIN,
        })
      ).rejects.toThrow(TRPCError);

      try {
        await caller.updateUserRole({
          userId: otherUser.id,
          organizationId: org2.id,
          role: UserRole.ADMIN,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        if (error instanceof TRPCError) {
          expect(error.code).toBe("FORBIDDEN");
          expect(error.message).toBe("You don't have permission to perform this action");
        }
      }
    });

    it("should allow removing users from organizations where user is admin", async () => {
      const mockSession = {
        user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = userManagementRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      // Should be able to remove users from org1 (admin role)
      const removeResult1 = await caller.removeUserFromOrganization({
        userId: otherUser.id,
        organizationId: org1.id,
      });
      expect(removeResult1.success).toBe(true);

      // Should be able to remove users from org3 (admin role)
      const removeResult3 = await caller.removeUserFromOrganization({
        userId: otherUser.id,
        organizationId: org3.id,
      });
      expect(removeResult3.success).toBe(true);
    });

    it("should prevent removing users from organizations where user is member", async () => {
      const mockSession = {
        user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = userManagementRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      // Should NOT be able to remove users from org2 (member role)
      await expect(
        caller.removeUserFromOrganization({
          userId: otherUser.id,
          organizationId: org2.id,
        })
      ).rejects.toThrow(TRPCError);

      try {
        await caller.removeUserFromOrganization({
          userId: otherUser.id,
          organizationId: org2.id,
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
});