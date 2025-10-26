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

describe("Organization Switching with Different Roles", () => {
  let user: any;
  let org1: any;
  let org2: any;
  let org3: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
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
  });

  describe("Getting User Organizations", () => {
    it("should return all organizations for the user with their roles", async () => {
      const mockSession = {
        user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = organizationRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      const result = await caller.getUserOrganizations();

      expect(result).toHaveLength(3);
      
      // Check that all organizations are returned with correct roles
      const org1Result = result.find(org => org.id === org1.id);
      const org2Result = result.find(org => org.id === org2.id);
      const org3Result = result.find(org => org.id === org3.id);

      expect(org1Result?.role).toEqual(UserRole.ADMIN);
      expect(org2Result?.role).toEqual(UserRole.MEMBER);
      expect(org3Result?.role).toEqual(UserRole.ADMIN);
    });

    it("should return organizations in creation order", async () => {
      const mockSession = {
        user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = organizationRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      const result = await caller.getUserOrganizations();

      // Should be ordered by createdAt asc
      expect(result[0]?.id).toEqual(org1.id);
      expect(result[1]?.id).toEqual(org2.id);
      expect(result[2]?.id).toEqual(org3.id);
    });
  });

  describe("Role-Based Access When Switching Organizations", () => {
    it("should allow admin actions in organization where user is admin", async () => {
      const mockSession = {
        user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = organizationRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      // Should be able to update org1 (admin role)
      const updateResult1 = await caller.update({
        id: org1.id,
        name: "Updated Org 1",
      });
      expect(updateResult1.name).toEqual("Updated Org 1");

      // Should be able to update org3 (admin role)
      const updateResult3 = await caller.update({
        id: org3.id,
        name: "Updated Org 3",
      });
      expect(updateResult3.name).toEqual("Updated Org 3");
    });

    it("should prevent admin actions in organization where user is member", async () => {
      const mockSession = {
        user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = organizationRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      // Should NOT be able to update org2 (member role)
      await expect(
        caller.update({
          id: org2.id,
          name: "Updated Org 2",
        })
      ).rejects.toThrow(TRPCError);

      try {
        await caller.update({
          id: org2.id,
          name: "Updated Org 2",
        });
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        if (error instanceof TRPCError) {
          expect(error.code).toBe("FORBIDDEN");
          expect(error.message).toBe("You don't have permission to perform this action");
        }
      }
    });

    it("should allow viewing members in all organizations", async () => {
      const mockSession = {
        user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = organizationRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      // Should be able to view members in all organizations
      const members1 = await caller.getMembers({ organizationId: org1.id });
      const members2 = await caller.getMembers({ organizationId: org2.id });
      const members3 = await caller.getMembers({ organizationId: org3.id });

      expect(members1).toHaveLength(1); // Only the test user
      expect(members2).toHaveLength(1); // Only the test user
      expect(members3).toHaveLength(1); // Only the test user

      expect(members1[0]?.role).toEqual(UserRole.ADMIN);
      expect(members2[0]?.role).toEqual(UserRole.MEMBER);
      expect(members3[0]?.role).toEqual(UserRole.ADMIN);
    });
  });

  describe("User Management Across Organizations", () => {
    let otherUser: any;

    beforeEach(async () => {
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

  describe("Getting User Role in Different Organizations", () => {
    it("should return correct role for each organization", async () => {
      const mockSession = {
        user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = organizationRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      // Should return ADMIN for org1
      const role1 = await caller.getUserRoleInOrganization({ 
        organizationId: org1.id 
      });
      expect(role1).toEqual(UserRole.ADMIN);

      // Should return MEMBER for org2
      const role2 = await caller.getUserRoleInOrganization({ 
        organizationId: org2.id 
      });
      expect(role2).toEqual(UserRole.MEMBER);

      // Should return ADMIN for org3
      const role3 = await caller.getUserRoleInOrganization({ 
        organizationId: org3.id 
      });
      expect(role3).toEqual(UserRole.ADMIN);
    });
  });

  describe("Edge Cases", () => {
    it("should handle user leaving and rejoining organizations", async () => {
      const mockSession = {
        user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = userManagementRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      // Create another admin in org1 before removing the user
      const anotherAdmin = await db.user.create({
        data: {
          name: "Another Admin",
          email: faker.internet.email(),
        },
      });

      await db.userOrganization.create({
        data: {
          userId: anotherAdmin.id,
          organizationId: org1.id,
          role: UserRole.ADMIN,
        },
      });

      // User leaves org1 (where they are admin)
      await caller.removeUserFromOrganization({
        userId: user.id,
        organizationId: org1.id,
      });

      // User should no longer be able to access org1
      const orgCaller = organizationRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      await expect(
        orgCaller.get({ id: org1.id })
      ).rejects.toThrow(TRPCError);

      try {
        await orgCaller.get({ id: org1.id });
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        if (error instanceof TRPCError) {
          expect(error.code).toBe("FORBIDDEN");
          expect(error.message).toBe("You are not a member of this organization");
        }
      }

      // User rejoins org1 as a member
      await db.userOrganization.create({
        data: {
          userId: user.id,
          organizationId: org1.id,
          role: UserRole.MEMBER,
        },
      });

      // User should now be able to view org1 but not update it
      const getResult = await orgCaller.get({ id: org1.id });
      expect(getResult.id).toEqual(org1.id);

      await expect(
        orgCaller.update({
          id: org1.id,
          name: "Updated Org 1",
        })
      ).rejects.toThrow(TRPCError);
    });

    it("should handle user with no organizations", async () => {
      const userWithNoOrgs = await db.user.create({
        data: {
          name: "User With No Orgs",
          email: faker.internet.email(),
        },
      });

      const mockSession = {
        user: userWithNoOrgs,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = organizationRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      // Should return empty list
      const result = await caller.getUserOrganizations();
      expect(result).toHaveLength(0);
    });
  });
});