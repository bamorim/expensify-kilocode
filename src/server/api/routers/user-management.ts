import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, authorize } from "~/server/api/trpc";
import { PERMISSIONS } from "~/server/permissions";
import { UserRole } from "@prisma/client";

const updateUserRoleSchema = z.object({
  userId: z.string(),
  organizationId: z.string(),
  role: z.nativeEnum(UserRole),
});

const removeUserFromOrganizationSchema = z.object({
  userId: z.string(),
  organizationId: z.string(),
});

export const userManagementRouter = createTRPCRouter({
  // Update a user's role in an organization (admin only)
  updateUserRole: protectedProcedure
    .input(updateUserRoleSchema)
    .mutation(async ({ ctx, input }) => {
      // Authorize user to update roles
      await authorize(
        ctx.db,
        ctx.session.user.id,
        input.organizationId,
        PERMISSIONS.MEMBER_UPDATE_ROLE
      );

      // Check if the target user is a member of the organization
      const targetUserOrg = await ctx.db.userOrganization.findUnique({
        where: {
          userId_organizationId: {
            userId: input.userId,
            organizationId: input.organizationId,
          },
        },
      });

      if (!targetUserOrg) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User is not a member of this organization",
        });
      }

      // Prevent the last admin from being demoted
      if (targetUserOrg.role === UserRole.ADMIN && input.role !== UserRole.ADMIN) {
        const adminCount = await ctx.db.userOrganization.count({
          where: {
            organizationId: input.organizationId,
            role: UserRole.ADMIN,
          },
        });

        if (adminCount <= 1) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Cannot remove the last admin from an organization",
          });
        }
      }

      // Update the user's role
      const updatedUserOrg = await ctx.db.userOrganization.update({
        where: {
          userId_organizationId: {
            userId: input.userId,
            organizationId: input.organizationId,
          },
        },
        data: {
          role: input.role,
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
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });

      return updatedUserOrg;
    }),

  // Remove a user from an organization (admin only)
  removeUserFromOrganization: protectedProcedure
    .input(removeUserFromOrganizationSchema)
    .mutation(async ({ ctx, input }) => {
      // Authorize user to remove members
      await authorize(
        ctx.db,
        ctx.session.user.id,
        input.organizationId,
        PERMISSIONS.MEMBER_REMOVE
      );

      // Check if the target user is a member of the organization
      const targetUserOrg = await ctx.db.userOrganization.findUnique({
        where: {
          userId_organizationId: {
            userId: input.userId,
            organizationId: input.organizationId,
          },
        },
      });

      if (!targetUserOrg) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User is not a member of this organization",
        });
      }

      // Prevent the last admin from being removed
      if (targetUserOrg.role === UserRole.ADMIN) {
        const adminCount = await ctx.db.userOrganization.count({
          where: {
            organizationId: input.organizationId,
            role: UserRole.ADMIN,
          },
        });

        if (adminCount <= 1) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Cannot remove the last admin from an organization",
          });
        }
      }

      // Remove the user from the organization
      await ctx.db.userOrganization.delete({
        where: {
          userId_organizationId: {
            userId: input.userId,
            organizationId: input.organizationId,
          },
        },
      });

      return { success: true };
    }),
});