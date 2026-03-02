import { query } from "../_generated/server";
import { v } from "convex/values";
import { toGeoJSON } from "./transform";

export const getStations = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const stations = await ctx.db
      .query("stations")
      .take(args.limit || 0);

    return toGeoJSON(stations);
  },
});
