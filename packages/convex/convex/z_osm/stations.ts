import {
  internalAction,
  internalMutation,
  mutation,
} from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

// ---- Ingest ----

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const INGEST_BATCH_SIZE = 500;

const OVERPASS_QUERY = `
[out:json][timeout:300];
(
  node["railway"="station"]({{bbox}});
  node["railway"="halt"]({{bbox}});
  node["railway"="tram_stop"]({{bbox}});
  node["station"="subway"]({{bbox}});
  node["station"="light_rail"]({{bbox}});
);
out body;
`.trim();

/** Bounding box covering mainland France + Corsica */
const FRANCE_BBOX = "41.0,-5.5,51.5,10.0";

type OverpassNode = {
  type: "node";
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
};

export const fetchAndStoreOsm = internalAction({
  args: { bbox: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const bbox = args.bbox ?? FRANCE_BBOX;
    const query = OVERPASS_QUERY.replaceAll("{{bbox}}", bbox);

    const response = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
    }

    const json = (await response.json()) as { elements: OverpassNode[] };
    // Convex only allows ASCII field names — strip non-ASCII keys before passing to mutation
    const nodes = json.elements
      .filter((e) => e.type === "node")
      .map((e) => ({
        ...e,
        tags: e.tags
          ? Object.fromEntries(
              Object.entries(e.tags).filter(([k]) => /^[\x20-\x7E]+$/.test(k)),
            )
          : undefined,
      }));

    for (let i = 0; i < nodes.length; i += INGEST_BATCH_SIZE) {
      await ctx.runMutation(internal.z_osm.stations.insertOsmStationsBatch, {
        nodes: nodes.slice(i, i + INGEST_BATCH_SIZE),
      });
    }

    console.log(`[osm/stations] fetchAndStoreOsm: fetched and stored ${nodes.length} nodes`);
    return { total: nodes.length };
  },
});

export const insertOsmStationsBatch = internalMutation({
  args: {
    nodes: v.array(
      v.object({
        type: v.literal("node"),
        id: v.number(),
        lat: v.float64(),
        lon: v.float64(),
        tags: v.optional(v.any()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    let inserted = 0;
    let updated = 0;

    for (const node of args.nodes) {
      const existing = await ctx.db
        .query("z_osm_stations")
        .withIndex("by_osm_id", (q) => q.eq("osm_id", node.id))
        .unique();

      const row = {
        osm_id: node.id,
        osm_type: "node" as const,
        uic_ref: node.tags?.uic_ref,
        lat: node.lat,
        lon: node.lon,
        tags: node.tags ?? {},
      };

      if (existing) {
        await ctx.db.replace(existing._id, row);
        updated++;
      } else {
        await ctx.db.insert("z_osm_stations", row);
        inserted++;
      }
    }

    console.log(`[osm/stations] insertOsmStationsBatch: total=${args.nodes.length} inserted=${inserted} updated=${updated}`);
  },
});

// ---- Enrich ----

const ENRICH_BATCH_SIZE = 500;

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
  if (tags["network"] === "RER" || tags["line"]?.startsWith("RER")) return "rer";
  if (tags["railway"] === "station") return "train";
  return "unknown";
}

export const enrichBatch = internalMutation({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { page, continueCursor, isDone } = await ctx.db
      .query("z_osm_stations")
      .paginate({ cursor: args.cursor ?? null, numItems: ENRICH_BATCH_SIZE });

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
          osm: { id: osm.osm_id, type: osm.osm_type, tags },
        },
      });

      matched++;
    }

    console.log(`[osm/stations] enrichBatch: processed=${page.length} matched=${matched} isDone=${isDone}`);

    if (!isDone) {
      await ctx.scheduler.runAfter(0, internal.z_osm.stations.enrichBatch, {
        cursor: continueCursor,
      });
    }

    return { processed: page.length, matched, isDone };
  },
});

// ---- Public entry points ----

export const ingestOsmStations = mutation({
  args: { bbox: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await ctx.scheduler.runAfter(0, internal.z_osm.stations.fetchAndStoreOsm, {
      bbox: args.bbox,
    });
    return "OSM ingest started";
  },
});

export const enrichStationsWithOsm = mutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.z_osm.stations.enrichBatch, {});
    return "OSM enrichment started";
  },
});
