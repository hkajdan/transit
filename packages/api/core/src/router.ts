import { router, publicProcedure } from "./trpc";
import { z } from "zod";
export const appRouter = router({
  health: publicProcedure.query(() => "OK"),
});
export type AppRouter = typeof appRouter;
