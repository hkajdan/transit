import {
  internalAction,
  internalMutation,
  mutation,
} from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

const SNCF_API_URL =
  "https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets/liste-des-gares/records";
const PAGE_SIZE = 100;

type SncfRecord = {
  code_uic: string;
  libelle: string;
  fret: string;
  voyageurs: string;
  code_ligne: string;
  rg_troncon: number;
  pk: string;
  commune: string;
  departemen: string;
  idreseau: number;
  idgaia: string;
  x_l93: number;
  y_l93: number;
  x_wgs84: number;
  y_wgs84: number;
  c_geo: { lat: number; lon: number };
  geo_point_2d: { lat: number; lon: number };
  geo_shape: {
    type: string;
    geometry: { type: string; coordinates: number[] };
    properties: Record<string, never>;
  };
};

export const fetchAndStoreSncf = internalAction({
  args: {},
  handler: async (ctx) => {
    let offset = 0;
    let total = 0;

    while (true) {
      const url = `${SNCF_API_URL}?limit=${PAGE_SIZE}&offset=${offset}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`SNCF API error: ${response.status} ${response.statusText}`);
      }

      const json = (await response.json()) as { results: SncfRecord[] };
      const records = json.results;

      if (records.length === 0) break;

      await ctx.runMutation(internal.sncf.ingest.insertBatch, { records });

      total += records.length;
      offset += records.length;

      if (records.length < PAGE_SIZE) break;
    }

    await ctx.runMutation(internal.sncf.migrate.migrateBatch, {});

    return { total };
  },
});

export const insertBatch = internalMutation({
  args: {
    records: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    for (const record of args.records as SncfRecord[]) {
      const existing = await ctx.db
        .query("z_sncf_stations")
        .withIndex("by_code_uic", (q) => q.eq("code_uic", record.code_uic))
        .unique();

      const row = {
        code_uic: record.code_uic,
        libelle: record.libelle,
        fret: record.fret,
        voyageurs: record.voyageurs,
        code_ligne: record.code_ligne,
        rg_troncon: record.rg_troncon,
        pk: record.pk,
        commune: record.commune,
        departemen: record.departemen,
        idreseau: record.idreseau,
        idgaia: record.idgaia,
        x_l93: record.x_l93,
        y_l93: record.y_l93,
        x_wgs84: record.x_wgs84,
        y_wgs84: record.y_wgs84,
        c_geo: record.c_geo,
        geo_point_2d: record.geo_point_2d,
        geo_shape: record.geo_shape,
      };

      if (existing) {
        await ctx.db.replace(existing._id, row);
      } else {
        await ctx.db.insert("z_sncf_stations", row);
      }
    }
  },
});

/** Public entry point — trigger from dashboard or CLI */
export const ingestSncfStations = mutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.sncf.ingest.fetchAndStoreSncf, {});
    return "SNCF ingest started";
  },
});
