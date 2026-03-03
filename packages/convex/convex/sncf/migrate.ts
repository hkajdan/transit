import { internalMutation, mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";

const BATCH_SIZE = 500;

/** Map a raw z_sncf_stations row to a normalized stations row. */
function normalize(
  raw: Doc<"z_sncf_stations">,
): Omit<Doc<"stations">, "_id" | "_creationTime"> {
  return {
    country: "FR",
    network: "SNCF",
    station_type: "train",
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

export const migrateStationsBatch = internalMutation({
  args: {
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    console.log(`[sncf/migrate] migrateStationsBatch starting, cursor=${args.cursor ?? "null"}`);

    const { page, continueCursor, isDone } = await ctx.db
      .query("z_sncf_stations")
      .paginate({ cursor: args.cursor ?? null, numItems: BATCH_SIZE });

    console.log(`[sncf/migrate] Processing page of ${page.length} raw stations (isDone=${isDone})`);

    let inserted = 0;
    let updated = 0;

    for (const raw of page) {
      const normalized = normalize(raw);
      const existing = await ctx.db
        .query("stations")
        .withIndex("by_uic_code", (q) => q.eq("uic_code", normalized.uic_code))
        .unique();

      if (existing) {
        await ctx.db.replace(existing._id, normalized);
        updated++;
      } else {
        await ctx.db.insert("stations", normalized);
        inserted++;
      }
    }

    console.log(`[sncf/migrate] Batch done: inserted=${inserted} updated=${updated} isDone=${isDone}`);

    if (!isDone) {
      console.log(`[sncf/migrate] Scheduling next batch with cursor=${continueCursor}`);
      await ctx.scheduler.runAfter(0, internal.sncf.migrate.migrateStationsBatch, {
        cursor: continueCursor,
      });
    } else {
      console.log("[sncf/migrate] All stations migrated.");
    }

    return { processed: page.length, inserted, updated, isDone };
  },
});

/** Public entry point — trigger from dashboard or CLI */
export const migrateSncfStations = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("[sncf/migrate] migrateSncfStations triggered, scheduling migrateStationsBatch");
    await ctx.scheduler.runAfter(0, internal.sncf.migrate.migrateStationsBatch, {});
    return "Migration started";
  },
});
