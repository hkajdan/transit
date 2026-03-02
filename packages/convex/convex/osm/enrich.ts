import { internalMutation, mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

const BATCH_SIZE = 500;

/** Map OSM tags to our station_type enum */
function resolveStationType(
  tags: Record<string, string>,
  osmType: string,
): "train" | "metro" | "rer" | "tram" | "light_rail" | "halt" | "unknown" {
  if (osmType === "halt" || tags["railway"] === "halt") return "halt";
  if (tags["railway"] === "tram_stop") return "tram";
  const station = tags["station"];
  if (station === "subway") return "metro";
  if (station === "light_rail") return "light_rail";
  if (station === "tram") return "tram";
  if (tags["network"] === "RER" || tags["line"]?.startsWith("RER"))
    return "rer";
  if (tags["railway"] === "station") return "train";
  return "unknown";
}

export const enrichBatch = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { page, continueCursor, isDone } = await ctx.db
      .query("z_osm_stations")
      .paginate({ cursor: args.cursor ?? null, numItems: BATCH_SIZE });

    let matched = 0;

    for (const osm of page) {
      if (!osm.uic_ref) continue;

      const station = await ctx.db
        .query("stations")
        .withIndex("by_uic_code", (q) => q.eq("uic_code", osm.uic_ref!))
        .unique();

      if (!station) continue;

      const tags = osm.tags as Record<string, string>;

      await ctx.db.patch(station._id, {
        station_type: resolveStationType(tags, osm.osm_type),
        metadata: {
          ...station.metadata,
          osm: {
            id: osm.osm_id,
            type: osm.osm_type,
            tags,
          },
        },
      });

      matched++;
    }

    if (!isDone) {
      await ctx.scheduler.runAfter(0, internal.osm.enrich.enrichBatch, {
        cursor: continueCursor,
      });
    }

    return { processed: page.length, matched, isDone };
  },
});

/** Public entry point — run after ingestOsmStations has completed */
export const enrichStationsWithOsm = mutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.osm.enrich.enrichBatch, {});
    return "OSM enrichment started";
  },
});
