import { internalMutation, mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";

const BATCH_SIZE = 500;

/** Map a raw sncf_stations row to a normalized stations row. */
function normalize(
  raw: Doc<"z_sncf_stations">,
): Omit<Doc<"stations">, "_id" | "_creationTime"> {
  return {
    country: "FR",
    network: "SNCF",
    name: raw.libelle,
    uic_code: raw.code_uic,
    is_passenger: raw.voyageurs === "O",
    coordinates: {
      lat: raw.geo_point_2d.lat,
      lon: raw.geo_point_2d.lon,
    },
    geo_shape: raw.geo_shape,
    metadata: {
      c_geo: raw.c_geo,
      code_ligne: raw.code_ligne,
      commune: raw.commune,
      departemen: raw.departemen,
      fret: raw.fret,
      idgaia: raw.idgaia,
      idreseau: raw.idreseau,
      pk: raw.pk,
      rg_troncon: raw.rg_troncon,
      x_l93: raw.x_l93,
      x_wgs84: raw.x_wgs84,
      y_l93: raw.y_l93,
      y_wgs84: raw.y_wgs84,
    },
  };
}

/**
 * Internal batch: reads up to BATCH_SIZE rows from sncf_stations starting
 * after `cursor`, upserts them into stations, then reschedules itself if
 * there are more rows to process.
 */
export const migrateBatch = internalMutation({
  args: {
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const query = args.cursor
      ? ctx.db
          .query("z_sncf_stations")
          .paginate({ cursor: args.cursor, numItems: BATCH_SIZE })
      : ctx.db
          .query("z_sncf_stations")
          .paginate({ cursor: null, numItems: BATCH_SIZE });

    const { page, continueCursor, isDone } = await query;

    for (const raw of page) {
      const normalized = normalize(raw);

      // Upsert: replace existing station with same UIC code if present
      const existing = await ctx.db
        .query("stations")
        .withIndex("by_uic_code", (q) => q.eq("uic_code", normalized.uic_code))
        .unique();

      if (existing) {
        await ctx.db.replace(existing._id, normalized);
      } else {
        await ctx.db.insert("stations", normalized);
      }
    }

    if (!isDone) {
      await ctx.scheduler.runAfter(0, internal.stations.migrate.migrateBatch, {
        cursor: continueCursor,
      });
    }

    return { processed: page.length, isDone };
  },
});

/**
 * Public entry point — call this once from the Convex dashboard or CLI
 * to kick off the migration.
 */
export const migrateSncfStations = mutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.stations.migrate.migrateBatch, {});
    return "Migration started";
  },
});
