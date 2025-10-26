import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { auth } from "~/server/auth";

export const authRouter = createTRPCRouter({
  getSession: publicProcedure.query(async ({ ctx }) => {
    return await auth();
  }),
});