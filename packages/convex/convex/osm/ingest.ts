import {
  internalAction,
  internalMutation,
  mutation,
} from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const BATCH_SIZE = 500;

/** Tags we care about from OSM — stored in z_osm_stations.tags */
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

/** Reduced bbox for testing — Île-de-France */

type OverpassNode = {
  type: "node";
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
};

/** Fetch all railway stop nodes from Overpass for a given bounding box */
export const fetchAndStoreOsm = internalAction({
  args: { bbox: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const bbox = args.bbox ?? FRANCE_BBOX;
    console.log(`[osm/ingest] Starting OSM fetch for bbox=${bbox}`);
    const query = OVERPASS_QUERY.replaceAll("{{bbox}}", bbox);

    console.log(`[osm/ingest] Sending Overpass query`);
    const response = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      throw new Error(
        `Overpass API error: ${response.status} ${response.statusText}`,
      );
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

    console.log(`[osm/ingest] Received ${json.elements.length} elements, ${nodes.length} nodes after filtering`);

    // Insert in batches to avoid mutation size limits
    const numBatches = Math.ceil(nodes.length / BATCH_SIZE);
    console.log(`[osm/ingest] Inserting ${nodes.length} nodes in ${numBatches} batches of ${BATCH_SIZE}`);
    for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
      const batch = nodes.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      console.log(`[osm/ingest] Inserting batch ${batchNum}/${numBatches} (${batch.length} nodes)`);
      await ctx.runMutation(internal.osm.ingest.insertOsmStationsBatch, { nodes: batch });
    }

    console.log(`[osm/ingest] Fetch complete. Total nodes stored: ${nodes.length}`);
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

    console.log(`[osm/ingest] insertOsmStationsBatch: inserted=${inserted} updated=${updated}`);
  },
});

/** Public entry point — trigger from dashboard or CLI */
export const ingestOsmStations = mutation({
  args: { bbox: v.optional(v.string()) },
  handler: async (ctx, args) => {
    console.log(`[osm/ingest] ingestOsmStations triggered, bbox=${args.bbox ?? "default (France)"}`);
    await ctx.scheduler.runAfter(0, internal.osm.ingest.fetchAndStoreOsm, {
      bbox: args.bbox,
    });
    return "OSM ingest started";
  },
});
