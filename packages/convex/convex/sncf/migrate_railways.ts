import { internalMutation, mutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";

const BATCH_SIZE = 500;

type RailwayType = Doc<"railways">["railway_type"];

function mapRailwayType(type_ligne: string | undefined): RailwayType {
  if (!type_ligne) return "unknown";
  const t = type_ligne.toUpperCase();
  if (t === "LGV") return "high_speed";
  if (t === "SERV") return "main";
  if (t === "RAC" || t === "FRET") return "regional";
  return "unknown";
}

function isActive(statut: string | undefined, mnemo: string): boolean {
  if (statut) return statut.toLowerCase().includes("exploit");
  return mnemo === "SERV";
}

function normalize(
  raw: Doc<"z_sncf_railways">,
): Omit<Doc<"railways">, "_id" | "_creationTime"> {
  return {
    country: "FR",
    network: "SNCF",
    name: raw.lib_ligne ?? raw.code_ligne,
    line_code: raw.code_ligne,
    rg_troncon: raw.rg_troncon,
    is_active: isActive(raw.statut, raw.mnemo),
    railway_type: mapRailwayType(raw.type_ligne),
    max_speed_kmh: raw.v_max,
    geo_shape: raw.geo_shape,
    metadata: raw.metadata,
  };
}

export const migrateRailwaysBatch = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    console.log(`[sncf/migrate_railways] migrateRailwaysBatch starting, cursor=${args.cursor ?? "null"}`);

    const { page, continueCursor, isDone } = await ctx.db
      .query("z_sncf_railways")
      .paginate({ cursor: args.cursor ?? null, numItems: BATCH_SIZE });

    console.log(`[sncf/migrate_railways] Processing page of ${page.length} raw railways (isDone=${isDone})`);

    let inserted = 0;
    let updated = 0;

    for (const raw of page) {
      const normalized = normalize(raw);

      const existing = await ctx.db
        .query("railways")
        .withIndex("by_line_code_troncon", (q) =>
          q.eq("line_code", normalized.line_code).eq("rg_troncon", normalized.rg_troncon),
        )
        .unique();

      if (existing) {
        await ctx.db.replace(existing._id, normalized);
        updated++;
      } else {
        await ctx.db.insert("railways", normalized);
        inserted++;
      }
    }

    console.log(`[sncf/migrate_railways] Batch done: inserted=${inserted} updated=${updated} isDone=${isDone}`);

    if (!isDone) {
      console.log(`[sncf/migrate_railways] Scheduling next batch with cursor=${continueCursor}`);
      await ctx.scheduler.runAfter(0, internal.sncf.migrate_railways.migrateRailwaysBatch, {
        cursor: continueCursor,
      });
    } else {
      console.log("[sncf/migrate_railways] All railways migrated.");
    }

    return { processed: page.length, inserted, updated, isDone };
  },
});

export const migrateSncfRailways = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("[sncf/migrate_railways] migrateSncfRailways triggered, scheduling migrateRailwaysBatch");
    await ctx.scheduler.runAfter(0, internal.sncf.migrate_railways.migrateRailwaysBatch, {});
    return "SNCF railways migration started";
  },
});
