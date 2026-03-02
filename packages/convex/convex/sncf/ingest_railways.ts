import {
  internalAction,
  internalMutation,
  mutation,
} from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

const BASE = "https://ressources.data.sncf.com/api/explore/v2.1/catalog/datasets";
const PAGE_SIZE = 100;

// --- Types ---

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

// Scalar-only lookups (no geo fetched)
type StatutLookup = { code_ligne: string; rg_troncon: number; lib_ligne: string | null; statut: string };
type TypeLookup = { code_ligne: string; rg_troncon: number; lib_ligne: string | null; type_ligne: string };
type VitesseLookup = { code_ligne: string; rg_troncon: number; v_max: string };
type CaracLookup = { code_ligne: string; type: string; valeur: number; pkd: string; pkf: string };

// --- Fetch helpers ---

/** Fetch all records of a dataset, selecting only specified fields (no geo). */
async function fetchAllScalar<T>(dataset: string, fields: string[]): Promise<T[]> {
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

/** Fetch one page of the formes dataset (includes geo_shape). */
async function fetchFormesPage(offset: number): Promise<{ results: FormeRecord[]; done: boolean }> {
  const select = "code_ligne,rg_troncon,mnemo,pk_debut_r,pk_fin_r,geo_shape";
  const url = `${BASE}/formes-des-lignes-du-rfn/records?limit=${PAGE_SIZE}&offset=${offset}&select=${select}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SNCF API error on formes: ${res.status}`);
  const json = (await res.json()) as { results: FormeRecord[] };
  return { results: json.results, done: json.results.length < PAGE_SIZE };
}

// --- Main action ---

export const fetchAndStoreRailways = internalAction({
  args: {},
  handler: async (ctx) => {
    const key = (code: string, rg: number) => `${code}|${rg}`;

    // Fetch lookup tables with scalar fields only (no geo) — small enough to hold in memory
    const [statuts, types, vitesses, caracs] = await Promise.all([
      fetchAllScalar<StatutLookup>("lignes-par-statut", ["code_ligne", "rg_troncon", "lib_ligne", "statut"]),
      fetchAllScalar<TypeLookup>("lignes-par-type", ["code_ligne", "rg_troncon", "lib_ligne", "type_ligne"]),
      fetchAllScalar<VitesseLookup>("vitesse-maximale-nominale-sur-ligne", ["code_ligne", "rg_troncon", "v_max"]),
      fetchAllScalar<CaracLookup>("caracteristique-des-voies-et-declivite", ["code_ligne", "type", "valeur", "pkd", "pkf"]),
    ]);

    const statutMap = new Map(statuts.map((r) => [key(r.code_ligne, r.rg_troncon), r]));
    const typeMap = new Map(types.map((r) => [key(r.code_ligne, r.rg_troncon), r]));
    const vitesseMap = new Map(vitesses.map((r) => [key(r.code_ligne, r.rg_troncon), r]));

    // caracMap: code_ligne → scalar voie records (no coordinates)
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

      await ctx.runMutation(internal.sncf.ingest_railways.insertBatch, { records: batch });
      total += formes.length;
      offset += formes.length;
      if (done) break;
    }

    return { total };
  },
});

export const insertBatch = internalMutation({
  args: { records: v.array(v.any()) },
  handler: async (ctx, args) => {
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
        .withIndex("by_code_ligne_troncon", (q) =>
          q.eq("code_ligne", record.code_ligne).eq("rg_troncon", record.rg_troncon),
        )
        .unique();

      if (existing) {
        await ctx.db.replace(existing._id, record);
      } else {
        await ctx.db.insert("z_sncf_railways", record);
      }
    }
  },
});

export const ingestSncfRailways = mutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.sncf.ingest_railways.fetchAndStoreRailways, {});
    return "SNCF railways ingest started";
  },
});
