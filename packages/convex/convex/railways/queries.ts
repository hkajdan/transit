import { query } from "../_generated/server";
import { v } from "convex/values";
import { toGeoJSON } from "./transform";

export const getRailways = query({
  args: {
    country: v.optional(
      v.union(
        v.literal("FR"),
        v.literal("DE"),
        v.literal("CH"),
        v.literal("BE"),
        v.literal("NL"),
        v.literal("IT"),
        v.literal("ES"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const q = args.country
      ? ctx.db
          .query("railways")
          .withIndex("by_country", (q) => q.eq("country", args.country!))
      : ctx.db.query("railways");

    const railways = await q.collect();
    return toGeoJSON(railways);
  },
});
