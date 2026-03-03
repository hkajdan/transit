import {
  internalAction,
  internalMutation,
  mutation,
} from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";

// ---- Ingest ----

const BASE =
  "https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets";
const PAGE_SIZE = 100;

type GeoShape = {
  type: string;
  geometry: { type: string; coordinates: unknown };
  properties: Record<string, never>;
};

type FormeRecord = {
  code_ligne: string;
  rg_troncon: number;
  mnemo: string;
  pk_debut_r: string;
  pk_fin_r: string;
  geo_shape: GeoShape;
};

type StatutLookup = {
  code_ligne: string;
  rg_troncon: number;
  lib_ligne: string | null;
  statut: string;
};
type TypeLookup = {
  code_ligne: string;
  rg_troncon: number;
  lib_ligne: string | null;
  type_ligne: string;
};
type VitesseLookup = { code_ligne: string; rg_troncon: number; v_max: string };
type CaracLookup = {
  code_ligne: string;
  type: string;
  valeur: number;
  pkd: string;
  pkf: string;
};

async function fetchAllScalar<T>(
  dataset: string,
  fields: string[],
): Promise<T[]> {
  const results: T[] = [];
  let offset = 0;
  const select = fields.join(",");
  while (true) {
    const url = `${BASE}/${dataset}/records?limit=${PAGE_SIZE}&offset=${offset}&select=${select}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`SNCF API error on ${dataset}: ${res.status}`);
    const json = (await res.json()) as { results: T[] };
    results.push(...json.results);
    if (json.results.length < PAGE_SIZE) break;
    offset += json.results.length;
  }
  return results;
}

async function fetchFormesPage(
  offset: number,
): Promise<{ results: FormeRecord[]; done: boolean }> {
  const select = "code_ligne,rg_troncon,mnemo,pk_debut_r,pk_fin_r,geo_shape";
  const url = `${BASE}/formes-des-lignes-du-rfn/records?limit=${PAGE_SIZE}&offset=${offset}&select=${select}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SNCF API error on formes: ${res.status}`);
  const json = (await res.json()) as { results: FormeRecord[] };
  return { results: json.results, done: json.results.length < PAGE_SIZE };
}

export const fetchAndStoreSncfRailways = internalAction({
  args: {},
  handler: async (ctx) => {
    const key = (code: string, rg: number) => `${code}|${rg}`;

    const [statuts, types, vitesses, caracs] = await Promise.all([
      fetchAllScalar<StatutLookup>("lignes-par-statut", [
        "code_ligne",
        "rg_troncon",
        "lib_ligne",
        "statut",
      ]),
      fetchAllScalar<TypeLookup>("lignes-par-type", [
        "code_ligne",
        "rg_troncon",
        "lib_ligne",
        "type_ligne",
      ]),
      fetchAllScalar<VitesseLookup>("vitesse-maximale-nominale-sur-ligne", [
        "code_ligne",
        "rg_troncon",
        "v_max",
      ]),
      fetchAllScalar<CaracLookup>("caracteristique-des-voies-et-declivite", [
        "code_ligne",
        "type",
        "valeur",
        "pkd",
        "pkf",
      ]),
    ]);

    const statutMap = new Map(
      statuts.map((r) => [key(r.code_ligne, r.rg_troncon), r]),
    );
    const typeMap = new Map(
      types.map((r) => [key(r.code_ligne, r.rg_troncon), r]),
    );
    const vitesseMap = new Map(
      vitesses.map((r) => [key(r.code_ligne, r.rg_troncon), r]),
    );

    const caracMap = new Map<string, CaracLookup[]>();
    for (const c of caracs) {
      const arr = caracMap.get(c.code_ligne) ?? [];
      arr.push(c);
      caracMap.set(c.code_ligne, arr);
    }

    // Process formes page by page — never accumulate geo data in memory
    let offset = 0;
    let total = 0;
    while (true) {
      const { results: formes, done } = await fetchFormesPage(offset);

      const batch = formes.map((f) => {
        const k = key(f.code_ligne, f.rg_troncon);
        const statut = statutMap.get(k);
        const type = typeMap.get(k);
        const vitesse = vitesseMap.get(k);
        return {
          code_ligne: f.code_ligne,
          rg_troncon: f.rg_troncon,
          lib_ligne: statut?.lib_ligne ?? type?.lib_ligne ?? undefined,
          mnemo: f.mnemo,
          statut: statut?.statut,
          type_ligne: type?.type_ligne,
          v_max: vitesse?.v_max ? parseFloat(vitesse.v_max) : undefined,
          pk_debut: f.pk_debut_r,
          pk_fin: f.pk_fin_r,
          geo_shape: f.geo_shape,
          metadata: { voies: caracMap.get(f.code_ligne) ?? [] },
        };
      });

      await ctx.runMutation(internal.z_sncf.railways.insertSncfRailwaysBatch, {
        records: batch,
      });
      total += formes.length;
      offset += formes.length;

      if (done) break;
    }

    console.log(
      `[sncf/railways] fetchAndStoreSncfRailways: fetched and stored ${total} railways`,
    );
    return { total };
  },
});

export const insertSncfRailwaysBatch = internalMutation({
  args: { records: v.array(v.any()) },
  handler: async (ctx, args) => {
    let inserted = 0;
    let updated = 0;

    for (const record of args.records as Array<{
      code_ligne: string;
      rg_troncon: number;
      lib_ligne?: string;
      mnemo: string;
      statut?: string;
      type_ligne?: string;
      v_max?: number;
      pk_debut: string;
      pk_fin: string;
      geo_shape: GeoShape;
      metadata?: unknown;
    }>) {
      const existing = await ctx.db
        .query("z_sncf_railways")
        .withIndex("by_segment", (q) =>
          q
            .eq("code_ligne", record.code_ligne)
            .eq("rg_troncon", record.rg_troncon)
            .eq("pk_debut", record.pk_debut),
        )
        .unique();

      if (existing) {
        await ctx.db.replace(existing._id, record);
        updated++;
      } else {
        await ctx.db.insert("z_sncf_railways", record);
        inserted++;
      }
    }

    console.log(
      `[sncf/railways] insertSncfRailwaysBatch: total=${args.records.length} inserted=${inserted} updated=${updated}`,
    );
  },
});

// ---- Migrate ----

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
    pk_debut: raw.pk_debut,
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
    const { page, continueCursor, isDone } = await ctx.db
      .query("z_sncf_railways")
      .paginate({ cursor: args.cursor ?? null, numItems: BATCH_SIZE });

    let inserted = 0;
    let updated = 0;

    for (const raw of page) {
      const normalized = normalize(raw);

      const existing = await ctx.db
        .query("railways")
        .withIndex("by_segment", (q) =>
          q
            .eq("line_code", normalized.line_code)
            .eq("rg_troncon", normalized.rg_troncon)
            .eq("pk_debut", normalized.pk_debut),
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

    console.log(
      `[sncf/railways] migrateRailwaysBatch: processed=${page.length} inserted=${inserted} updated=${updated} isDone=${isDone}`,
    );

    if (!isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.z_sncf.railways.migrateRailwaysBatch,
        {
          cursor: continueCursor,
        },
      );
    }

    return { processed: page.length, inserted, updated, isDone };
  },
});

// ---- Public entry points ----

export const ingestSncfRailways = mutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(
      0,
      internal.z_sncf.railways.fetchAndStoreSncfRailways,
      {},
    );
    return "SNCF railways ingest started";
  },
});

export const migrateSncfRailways = mutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(
      0,
      internal.z_sncf.railways.migrateRailwaysBatch,
      {},
    );
    return "SNCF railways migration started";
  },
});
