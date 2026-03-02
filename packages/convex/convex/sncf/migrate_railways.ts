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

export const migrateBatch = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { page, continueCursor, isDone } = await ctx.db
      .query("z_sncf_railways")
      .paginate({ cursor: args.cursor ?? null, numItems: BATCH_SIZE });

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
      } else {
        await ctx.db.insert("railways", normalized);
      }
    }

    if (!isDone) {
      await ctx.scheduler.runAfter(0, internal.sncf.migrate_railways.migrateBatch, {
        cursor: continueCursor,
      });
    }

    return { processed: page.length, isDone };
  },
});

export const migrateSncfRailways = mutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.sncf.migrate_railways.migrateBatch, {});
    return "SNCF railways migration started";
  },
});
