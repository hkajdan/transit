import { query } from "../_generated/server";
import { v } from "convex/values";
import { toGeoJSON } from "./transform";

export const getStations = query({
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
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const q = args.country
      ? ctx.db
          .query("stations")
          .withIndex("by_country", (q) => q.eq("country", args.country!))
      : ctx.db.query("stations");

    const stations = await q.take(args.limit ?? 0);
    return toGeoJSON(stations);
  },
});
