import { describe, expect, it, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { organizationRouter } from "~/server/api/routers/organization";
import { db } from "~/server/db";
import { faker } from "@faker-js/faker";
import { UserRole } from "@prisma/client";

// Mock the database to use the transactional testing wrapper
vi.mock("~/server/db");

// Mock the auth module
vi.mock("~/server/auth", () => ({
  auth: vi.fn(),
}));

describe("organizationRouter", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await db.user.create({
      data: {
        name: "Test User",
        email: faker.internet.email(),
      },
    });
  });

  describe("create", () => {
    it("should create a new organization and make the user an admin", async () => {
      const user = await db.user.findFirst();
      if (!user) throw new Error("No user found");

      const mockSession = {
        user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = organizationRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      const result = await caller.create({
        name: "Test Organization",
        slug: "test-org",
      });

      expect(result.name).toEqual("Test Organization");
      expect(result.slug).toEqual("test-org");

      // Verify the organization was created
      const organization = await db.organization.findUnique({
        where: { id: result.id },
      });
      expect(organization).toBeDefined();

      // Verify the user was added as an admin
      const membership = await db.userOrganization.findUnique({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: result.id,
          },
        },
      });
      expect(membership).toBeDefined();
      expect(membership?.role).toEqual("ADMIN");
    });

    it("should throw an error if organization slug already exists", async () => {
      const user = await db.user.findFirst();
      if (!user) throw new Error("No user found");

      // Create an existing organization
      await db.organization.create({
        data: {
          name: "Existing Organization",
          slug: "test-org",
        },
      });

      const mockSession = {
        user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = organizationRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });
      
      await expect(
        caller.create({
          name: "Test Organization",
          slug: "test-org",
        })
      ).rejects.toThrow(TRPCError);

      try {
        await caller.create({
          name: "Test Organization",
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

  describe("get", () => {
    it("should return organization if user is a member", async () => {
      const user = await db.user.findFirst();
      if (!user) throw new Error("No user found");

      // Create an organization
      const organization = await db.organization.create({
        data: {
          name: "Test Organization",
          slug: "test-org",
        },
      });

      // Add user as a member
      await db.userOrganization.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: "ADMIN",
        },
      });

      const mockSession = {
        user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = organizationRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });
      
      const result = await caller.get({ id: organization.id });

      expect(result.id).toEqual(organization.id);
      expect(result.name).toEqual(organization.name);
      expect(result.slug).toEqual(organization.slug);
    });

    it("should throw an error if user is not a member", async () => {
      const user = await db.user.findFirst();
      if (!user) throw new Error("No user found");

      // Create an organization
      const organization = await db.organization.create({
        data: {
          name: "Test Organization",
          slug: "test-org",
        },
      });

      const mockSession = {
        user,
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

    it("should throw an error if organization does not exist", async () => {
      const user = await db.user.findFirst();
      if (!user) throw new Error("No user found");

      // Create an organization
      const organization = await db.organization.create({
        data: {
          name: "Test Organization",
          slug: "test-org",
        },
      });

      // Add user as a member
      await db.userOrganization.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: "ADMIN",
        },
      });

      const mockSession = {
        user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = organizationRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });
      
      // Try to get a non-existent organization
      await expect(
        caller.get({ id: "non-existent-org-id" })
      ).rejects.toThrow(TRPCError);

      try {
        await caller.get({ id: "non-existent-org-id" });
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        if (error instanceof TRPCError) {
          expect(error.code).toBe("FORBIDDEN");
          expect(error.message).toBe("You are not a member of this organization");
        }
      }
    });
  });

  describe("getUserOrganizations", () => {
    it("should return all organizations for user", async () => {
      const user = await db.user.findFirst();
      if (!user) throw new Error("No user found");

      // Create organizations
      const org1 = await db.organization.create({
        data: {
          name: "Organization 1",
          slug: "org-1",
        },
      });

      const org2 = await db.organization.create({
        data: {
          name: "Organization 2",
          slug: "org-2",
        },
      });

      // Add user to both organizations
      await db.userOrganization.create({
        data: {
          userId: user.id,
          organizationId: org1.id,
          role: "ADMIN",
        },
      });

      await db.userOrganization.create({
        data: {
          userId: user.id,
          organizationId: org2.id,
          role: "MEMBER",
        },
      });

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

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: org1.id,
        name: "Organization 1",
        slug: "org-1",
        role: "ADMIN",
      });
      expect(result[1]).toMatchObject({
        id: org2.id,
        name: "Organization 2",
        slug: "org-2",
        role: "MEMBER",
      });
    });

    it("should return organizations in creation order", async () => {
      const user = await db.user.findFirst();
      if (!user) throw new Error("No user found");

      // Create organizations with explicit timestamps to ensure consistent ordering
      const now = new Date();
      const org1 = await db.organization.create({
        data: {
          name: "Organization 1",
          slug: "org-1",
          createdAt: new Date(now.getTime() - 2000), // 2 seconds ago
        },
      });

      const org2 = await db.organization.create({
        data: {
          name: "Organization 2",
          slug: "org-2",
          createdAt: new Date(now.getTime() - 1000), // 1 second ago
        },
      });

      const org3 = await db.organization.create({
        data: {
          name: "Organization 3",
          slug: "org-3",
          createdAt: now, // Now
        },
      });

      // Add user to all organizations with different roles
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

    it("should return all organizations for the user with their roles", async () => {
      const user = await db.user.create({
        data: {
          name: "Test User",
          email: faker.internet.email(),
        },
      });

      // Create organizations
      const org1 = await db.organization.create({
        data: {
          name: "Organization 1",
          slug: "org-1",
        },
      });

      const org2 = await db.organization.create({
        data: {
          name: "Organization 2",
          slug: "org-2",
        },
      });

      const org3 = await db.organization.create({
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

  describe("update", () => {
    it("should update organization if user is an admin", async () => {
      const user = await db.user.findFirst();
      if (!user) throw new Error("No user found");

      // Create an organization
      const organization = await db.organization.create({
        data: {
          name: "Test Organization",
          slug: "test-org",
        },
      });

      // Add user as an admin
      await db.userOrganization.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: "ADMIN",
        },
      });

      const mockSession = {
        user,
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
        slug: "updated-org",
      });

      expect(result.name).toEqual("Updated Organization");
      expect(result.slug).toEqual("updated-org");

      // Verify the organization was updated
      const updatedOrg = await db.organization.findUnique({
        where: { id: organization.id },
      });
      expect(updatedOrg?.name).toEqual("Updated Organization");
      expect(updatedOrg?.slug).toEqual("updated-org");
    });

    it("should throw an error if user is not an admin", async () => {
      const user = await db.user.findFirst();
      if (!user) throw new Error("No user found");

      // Create an organization
      const organization = await db.organization.create({
        data: {
          name: "Test Organization",
          slug: "test-org",
        },
      });

      // Add user as a member (not admin)
      await db.userOrganization.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: "MEMBER",
        },
      });

      const mockSession = {
        user,
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
  });

  describe("getMembers", () => {
    it("should return all members of an organization if user is a member", async () => {
      const user = await db.user.findFirst();
      if (!user) throw new Error("No user found");

      // Create another user
      const otherUser = await db.user.create({
        data: {
          name: "Other User",
          email: faker.internet.email(),
        },
      });

      // Create an organization
      const organization = await db.organization.create({
        data: {
          name: "Test Organization",
          slug: "test-org",
        },
      });

      // Add users to organization
      await db.userOrganization.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: "MEMBER",
        },
      });

      await db.userOrganization.create({
        data: {
          userId: otherUser.id,
          organizationId: organization.id,
          role: "ADMIN",
        },
      });

      const mockSession = {
        user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = organizationRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });
      
      const result = await caller.getMembers({ organizationId: organization.id });

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        userId: user.id,
        organizationId: organization.id,
        role: "MEMBER",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
      });
      expect(result[1]).toMatchObject({
        userId: otherUser.id,
        organizationId: organization.id,
        role: "ADMIN",
        user: {
          id: otherUser.id,
          name: otherUser.name,
          email: otherUser.email,
        },
      });
    });

    it("should throw an error if user is not a member", async () => {
      const user = await db.user.findFirst();
      if (!user) throw new Error("No user found");

      // Create an organization
      const organization = await db.organization.create({
        data: {
          name: "Test Organization",
          slug: "test-org",
        },
      });

      const mockSession = {
        user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = organizationRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });
      
      await expect(
        caller.getMembers({ organizationId: organization.id })
      ).rejects.toThrow(TRPCError);

      try {
        await caller.getMembers({ organizationId: organization.id });
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        if (error instanceof TRPCError) {
          expect(error.code).toBe("FORBIDDEN");
          expect(error.message).toBe("You are not a member of this organization");
        }
      }
    });
  });

  describe("getUserRoleInOrganization", () => {
    let user: any;
    let org1: any;
    let org2: any;
    let org3: any;

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
    });

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
          organizationId: org1.id 
        })
      ).rejects.toThrow(TRPCError);

      try {
        await caller.getUserRoleInOrganization({ 
          organizationId: org1.id 
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

  describe("Cross-Organization Access Control", () => {
    let adminUser: any;
    let memberUser: any;
    let organization: any;
    let anotherOrganization: any;

    beforeEach(async () => {
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

      const caller = organizationRouter.createCaller({
        db,
        session: mockSession,
        headers: new Headers(),
      });

      // Should not be able to access organization where user is not a member
      await expect(
        caller.get({ id: thirdOrganization.id })
      ).rejects.toThrow(TRPCError);

      try {
        await caller.get({ id: thirdOrganization.id });
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

      // Create main test data
      mainUser = await db.user.create({
        data: {
          name: "Main User",
          email: faker.internet.email(),
        },
      });

      mainOrganization = await db.organization.create({
        data: {
          name: "Main Organization",
          slug: "main-org",
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

      // otherUser should not be able to access main organization
      await expect(
        caller.get({ id: mainOrganization.id })
      ).rejects.toThrow(TRPCError);

      try {
        await caller.get({ id: mainOrganization.id });
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        if (error instanceof TRPCError) {
          expect(error.code).toBe("FORBIDDEN");
          expect(error.message).toBe("You are not a member of this organization");
        }
      }
    });
  });

  describe("Organization Switching Edge Cases", () => {
    let user: any;
    let org1: any;
    let org2: any;
    let org3: any;

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

    it("should handle user leaving and rejoining organizations", async () => {
      const mockSession = {
        user,
        expires: "2030-12-31T23:59:59.999Z",
      };

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
      await db.userOrganization.delete({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: org1.id,
          },
        },
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
  });
});