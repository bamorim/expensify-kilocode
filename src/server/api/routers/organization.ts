import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const createOrganizationSchema = z.object({
  name: z.string().min(1, "Organization name is required"),
  slug: z.string().min(1, "Organization slug is required"),
});

const getOrganizationSchema = z.object({
  id: z.string(),
});

const updateOrganizationSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Organization name is required").optional(),
  slug: z.string().min(1, "Organization slug is required").optional(),
});

const getOrganizationMembersSchema = z.object({
  organizationId: z.string(),
});

export const organizationRouter = createTRPCRouter({
  // Create a new organization and make the user an admin
  create: protectedProcedure
    .input(createOrganizationSchema)
    .mutation(async ({ ctx, input }) => {
      // Check if organization with this slug already exists
      const existingOrg = await ctx.db.organization.findUnique({
        where: { slug: input.slug },
      });

      if (existingOrg) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Organization with this slug already exists",
        });
      }

      // Create organization and user membership in a transaction
      const result = await ctx.db.$transaction(async (tx) => {
        // Create the organization
        const organization = await tx.organization.create({
          data: {
            name: input.name,
            slug: input.slug,
          },
        });

        // Create the user-organization relationship with admin role
        await tx.userOrganization.create({
          data: {
            userId: ctx.session.user.id,
            organizationId: organization.id,
            role: "ADMIN",
          },
        });

        return organization;
      });

      return result;
    }),

  // Get a specific organization by ID
  get: protectedProcedure
    .input(getOrganizationSchema)
    .query(async ({ ctx, input }) => {
      // Check if user is a member of the organization
      const membership = await ctx.db.userOrganization.findUnique({
        where: {
          userId_organizationId: {
            userId: ctx.session.user.id,
            organizationId: input.id,
          },
        },
        include: {
          organization: true,
        },
      });

      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this organization",
        });
      }

      return membership.organization;
    }),

  // Get all organizations for the current user
  getUserOrganizations: protectedProcedure.query(async ({ ctx }) => {
    const userOrganizations = await ctx.db.userOrganization.findMany({
      where: {
        userId: ctx.session.user.id,
      },
      include: {
        organization: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return userOrganizations.map((uo) => ({
      ...uo.organization,
      role: uo.role,
    }));
  }),

  // Update organization details
  update: protectedProcedure
    .input(updateOrganizationSchema)
    .mutation(async ({ ctx, input }) => {
      // Check if user is an admin of the organization
      const membership = await ctx.db.userOrganization.findUnique({
        where: {
          userId_organizationId: {
            userId: ctx.session.user.id,
            organizationId: input.id,
          },
        },
      });

      if (!membership || membership.role !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can update organization details",
        });
      }

      // Check if slug is being updated and if it already exists
      if (input.slug) {
        const existingOrg = await ctx.db.organization.findFirst({
          where: {
            slug: input.slug,
            id: { not: input.id },
          },
        });

        if (existingOrg) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Organization with this slug already exists",
          });
        }
      }

      const updatedOrganization = await ctx.db.organization.update({
        where: { id: input.id },
        data: {
          ...(input.name && { name: input.name }),
          ...(input.slug && { slug: input.slug }),
        },
      });

      return updatedOrganization;
    }),

  // Get all members of an organization
  getMembers: protectedProcedure
    .input(getOrganizationMembersSchema)
    .query(async ({ ctx, input }) => {
      // Check if user is a member of the organization
      const membership = await ctx.db.userOrganization.findUnique({
        where: {
          userId_organizationId: {
            userId: ctx.session.user.id,
            organizationId: input.organizationId,
          },
        },
      });

      if (!membership) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not a member of this organization",
        });
      }

      const members = await ctx.db.userOrganization.findMany({
        where: {
          organizationId: input.organizationId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      return members;
    }),
});