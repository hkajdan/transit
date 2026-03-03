import {
  internalAction,
  internalMutation,
  mutation,
} from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";

// ---- Ingest ----

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

export const fetchAndStoreSncfStations = internalAction({
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

      await ctx.runMutation(internal.z_sncf.stations.insertSncfStationsBatch, { records });

      total += records.length;
      offset += records.length;

      if (records.length < PAGE_SIZE) break;
    }

    console.log(`[sncf/stations] fetchAndStoreSncfStations: fetched and stored ${total} stations`);
    await ctx.runMutation(internal.z_sncf.stations.migrateStationsBatch, {});

    return { total };
  },
});

export const insertSncfStationsBatch = internalMutation({
  args: { records: v.array(v.any()) },
  handler: async (ctx, args) => {
    let inserted = 0;
    let updated = 0;

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
        updated++;
      } else {
        await ctx.db.insert("z_sncf_stations", row);
        inserted++;
      }
    }

    console.log(`[sncf/stations] insertSncfStationsBatch: total=${args.records.length} inserted=${inserted} updated=${updated}`);
  },
});

// ---- Migrate ----

const BATCH_SIZE = 500;

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
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { page, continueCursor, isDone } = await ctx.db
      .query("z_sncf_stations")
      .paginate({ cursor: args.cursor ?? null, numItems: BATCH_SIZE });

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

    console.log(`[sncf/stations] migrateStationsBatch: processed=${page.length} inserted=${inserted} updated=${updated} isDone=${isDone}`);

    if (!isDone) {
      await ctx.scheduler.runAfter(0, internal.z_sncf.stations.migrateStationsBatch, {
        cursor: continueCursor,
      });
    }

    return { processed: page.length, inserted, updated, isDone };
  },
});

// ---- Public entry points ----

export const ingestSncfStations = mutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.z_sncf.stations.fetchAndStoreSncfStations, {});
    return "SNCF ingest started";
  },
});

export const migrateSncfStations = mutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.z_sncf.stations.migrateStationsBatch, {});
    return "Migration started";
  },
});
