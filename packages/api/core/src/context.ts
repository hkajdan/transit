import type { CreateNextContextOptions } from "@trpc/server/adapters/next";
export function createContext({ req }: CreateNextContextOptions) {
  return {
    user: req.headers.authorization ? { id: "user-id" } : null,
  };
}
export type Context = Awaited<ReturnType<typeof createContext>>;
