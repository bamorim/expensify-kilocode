import { describe, expect, it, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { organizationRouter } from "~/server/api/routers/organization";
import { db } from "~/server/db";
import { faker } from "@faker-js/faker";

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
});