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

type GeoPoint = { lon: number; lat: number } | null | undefined;

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
type VitesseLookup = {
  code_ligne: string;
  rg_troncon: number;
  v_max: string;
  pkd: string;
  pkf: string;
  c_geo_d: GeoPoint;
  c_geo_f: GeoPoint;
};
type CaracLookup = {
  code_ligne: string;
  rg_troncon: number;
  lib_ligne: string | null;
  type: string;
  valeur: number;
  pkd: string;
  pkf: string;
  c_geo_d: GeoPoint;
  c_geo_f: GeoPoint;
};
type ElectLookup = { code_ligne: string; elect: string };
type CatligLookup = { code_ligne: string; catlig: string };

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
    const tronconKey = (code: string, rg: number) => `${code}|${rg}`;

    const [statuts, types, vitesses, caracs, elects, catligs] = await Promise.all([
      fetchAllScalar<StatutLookup>("lignes-par-statut", [
        "code_ligne", "rg_troncon", "lib_ligne", "statut",
      ]),
      fetchAllScalar<TypeLookup>("lignes-par-type", [
        "code_ligne", "rg_troncon", "lib_ligne", "type_ligne",
      ]),
      fetchAllScalar<VitesseLookup>("vitesse-maximale-nominale-sur-ligne", [
        "code_ligne", "rg_troncon", "v_max", "pkd", "pkf", "c_geo_d", "c_geo_f",
      ]),
      fetchAllScalar<CaracLookup>("caracteristique-des-voies-et-declivite", [
        "code_ligne", "rg_troncon", "lib_ligne", "type", "valeur", "pkd", "pkf", "c_geo_d", "c_geo_f",
      ]),
      fetchAllScalar<ElectLookup>("liste-des-lignes-electrifiees", [
        "code_ligne", "elect",
      ]),
      fetchAllScalar<CatligLookup>("lignes-lgv-et-par-ecartement", [
        "code_ligne", "catlig",
      ]),
    ]);

    const statutMap = new Map(
      statuts.map((r) => [tronconKey(r.code_ligne, r.rg_troncon), r]),
    );
    const typeMap = new Map(
      types.map((r) => [tronconKey(r.code_ligne, r.rg_troncon), r]),
    );

    // Group speeds by code_ligne (many per line)
    const speedsMap = new Map<string, { rg_troncon: number; v_max: number; pkd: string; pkf: string; c_geo_d: GeoPoint; c_geo_f: GeoPoint }[]>();
    for (const vit of vitesses) {
      const arr = speedsMap.get(vit.code_ligne) ?? [];
      arr.push({
        rg_troncon: vit.rg_troncon,
        v_max: parseFloat(vit.v_max),
        pkd: vit.pkd,
        pkf: vit.pkf,
        c_geo_d: vit.c_geo_d,
        c_geo_f: vit.c_geo_f,
      });
      speedsMap.set(vit.code_ligne, arr);
    }

    // Group characteristics by code_ligne; collect first lib_ligne per line
    const caracMap = new Map<string, { rg_troncon: number; type: string; valeur: number; pkd: string; pkf: string; c_geo_d: GeoPoint; c_geo_f: GeoPoint }[]>();
    const caracNameMap = new Map<string, string>();
    for (const c of caracs) {
      const arr = caracMap.get(c.code_ligne) ?? [];
      arr.push({
        rg_troncon: c.rg_troncon,
        type: c.type,
        valeur: c.valeur,
        pkd: c.pkd,
        pkf: c.pkf,
        c_geo_d: c.c_geo_d,
        c_geo_f: c.c_geo_f,
      });
      caracMap.set(c.code_ligne, arr);
      if (c.lib_ligne && !caracNameMap.has(c.code_ligne))
        caracNameMap.set(c.code_ligne, c.lib_ligne);
    }

    // Electrification: deduplicated set per code_ligne (raw French strings kept in staging)
    const electMap = new Map<string, Set<string>>();
    for (const e of elects) {
      const set = electMap.get(e.code_ligne) ?? new Set();
      set.add(e.elect);
      electMap.set(e.code_ligne, set);
    }

    // catlig: 1:1 with code_ligne
    const catligMap = new Map(catligs.map((r) => [r.code_ligne, r.catlig]));

    // Process formes page by page — never accumulate geo data in memory
    let offset = 0;
    let total = 0;
    while (true) {
      const { results: formes, done } = await fetchFormesPage(offset);

      const batch = formes.map((f) => {
        const k = tronconKey(f.code_ligne, f.rg_troncon);
        const statut = statutMap.get(k);
        const type = typeMap.get(k);
        return {
          code_ligne: f.code_ligne,
          lib_ligne: caracNameMap.get(f.code_ligne) ?? statut?.lib_ligne ?? type?.lib_ligne ?? undefined,
          type_ligne: type?.type_ligne,
          catlig: catligMap.get(f.code_ligne),
          electrification: [...(electMap.get(f.code_ligne) ?? [])],
          segment: {
            rg_troncon: f.rg_troncon,
            mnemo: f.mnemo,
            statut: statut?.statut,
            pk_debut: f.pk_debut_r,
            pk_fin: f.pk_fin_r,
            geo_shape: f.geo_shape,
          },
          speeds: speedsMap.get(f.code_ligne) ?? [],
          characteristics: caracMap.get(f.code_ligne) ?? [],
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
      `[sncf/railways] fetchAndStoreSncfRailways: fetched and stored ${total} forme records`,
    );
    return { total };
  },
});

/** Merge an incoming LineString into an existing geometry (LineString or MultiLineString). */
function mergeGeometry(existing: GeoShape, incoming: GeoShape): GeoShape {
  const incomingCoords = (incoming.geometry as { type: string; coordinates: unknown[] }).coordinates;
  const existingGeom = existing.geometry as { type: string; coordinates: unknown[] };

  const allCoords: unknown[][] =
    existingGeom.type === "MultiLineString"
      ? [...(existingGeom.coordinates as unknown[][]), incomingCoords as unknown[]]
      : [existingGeom.coordinates as unknown[], incomingCoords as unknown[]];

  return {
    ...existing,
    geometry: { type: "MultiLineString", coordinates: allCoords },
  };
}

type IncomingSegment = {
  rg_troncon: number;
  mnemo: string;
  statut?: string;
  pk_debut: string;
  pk_fin: string;
  geo_shape: GeoShape;
};

export const insertSncfRailwaysBatch = internalMutation({
  args: { records: v.array(v.any()) },
  handler: async (ctx, args) => {
    let inserted = 0;
    let merged = 0;

    for (const record of args.records as Array<{
      code_ligne: string;
      lib_ligne?: string;
      type_ligne?: string;
      catlig?: string;
      electrification: string[];
      segment: IncomingSegment;
      speeds: unknown[];
      characteristics: unknown[];
    }>) {
      const existing = await ctx.db
        .query("z_sncf_railways")
        .withIndex("by_code_ligne", (q) => q.eq("code_ligne", record.code_ligne))
        .unique();

      if (existing) {
        const existingSegIdx = existing.segments.findIndex(
          (s) => s.rg_troncon === record.segment.rg_troncon,
        );
        if (existingSegIdx >= 0) {
          const updatedSegments = [...existing.segments];
          updatedSegments[existingSegIdx] = {
            ...updatedSegments[existingSegIdx],
            geo_shape: mergeGeometry(
              updatedSegments[existingSegIdx].geo_shape,
              record.segment.geo_shape,
            ),
          };
          await ctx.db.patch(existing._id, { segments: updatedSegments });
        } else {
          await ctx.db.patch(existing._id, {
            segments: [...existing.segments, record.segment],
          });
        }
        merged++;
      } else {
        await ctx.db.insert("z_sncf_railways", {
          code_ligne: record.code_ligne,
          lib_ligne: record.lib_ligne,
          type_ligne: record.type_ligne,
          catlig: record.catlig,
          electrification: record.electrification,
          segments: [record.segment],
          speeds: record.speeds as Doc<"z_sncf_railways">["speeds"],
          characteristics: record.characteristics as Doc<"z_sncf_railways">["characteristics"],
        });
        inserted++;
      }
    }

    console.log(
      `[sncf/railways] insertSncfRailwaysBatch: total=${args.records.length} inserted=${inserted} merged=${merged}`,
    );
  },
});

// ---- Migrate ----

const BATCH_SIZE = 500;

type RailwayType = Doc<"railways">["railway_type"];

function mapRailwayType(catlig: string | undefined, type_ligne: string | undefined): RailwayType {
  if (catlig === "Ligne à grande vitesse") return "high_speed";
  if (catlig === "Ligne du réseau conventionnel à voie étroite") return "light_rail";
  if (!type_ligne) return "unknown";
  const t = type_ligne.toLowerCase();
  if (t === "ligne") return "main";
  // "Rac" (raccordement), "Vmère", "Vport" are junction/port tracks
  return "regional";
}

function mapGauge(catlig: string | undefined): number | undefined {
  if (!catlig) return undefined;
  if (catlig === "Ligne du réseau conventionnel à voie étroite") return 1000;
  return 1435; // LGV and normal conventional are both standard gauge
}

function normalizeElectrification(
  raw: string[],
): Doc<"railways">["electrification"] {
  return raw.map((s) => {
    const lower = s.toLowerCase();
    const contact: "overhead" | "third_rail" =
      lower.includes("3ème rail") || lower.includes("3e rail") ? "third_rail" : "overhead";
    const current: "AC" | "DC" = lower.includes("alternatif") ? "AC" : "DC";
    const match = s.match(/(\d+)\s*volts?/i);
    const voltage_v = match ? parseInt(match[1], 10) : 0;
    return { voltage_v, current, contact };
  });
}

// Only statuts where the track has been physically lifted off the ground.
const REMOVED_STATUTS = new Set([
  "Fermée et déposée (Plus utilisable)",
  "Retranchée (Plus utilisable)",
]);

function isActive(statut: string | undefined): boolean {
  if (!statut) return true;
  return !REMOVED_STATUTS.has(statut);
}

const CHARACTERISTIC_TYPE_MAP: Record<string, string> = {
  PENTE: "GRADIENT",
  ALIGNEMENT: "ALIGNMENT",
};

function normalizeCharacteristicType(type: string): string {
  return CHARACTERISTIC_TYPE_MAP[type.toUpperCase()] ?? type;
}

function normalize(
  raw: Doc<"z_sncf_railways">,
): Omit<Doc<"railways">, "_id" | "_creationTime"> {
  return {
    country: "FR",
    network: "SNCF",
    name: raw.lib_ligne ?? raw.code_ligne,
    line_code: raw.code_ligne,
    railway_type: mapRailwayType(raw.catlig, raw.type_ligne),
    gauge_mm: mapGauge(raw.catlig),
    electrification: normalizeElectrification(raw.electrification),
    segments: raw.segments.map((s) => ({
      segment_id: s.rg_troncon,
      is_active: isActive(s.statut),
      geo_shape: s.geo_shape,
    })),
    speeds: raw.speeds.map(({ rg_troncon, ...rest }) => ({
      segment_id: rg_troncon,
      ...rest,
    })),
    characteristics: raw.characteristics.map(({ rg_troncon, type, valeur, ...rest }) => ({
      segment_id: rg_troncon,
      type: normalizeCharacteristicType(type),
      value: valeur,
      ...rest,
    })),
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
        .withIndex("by_line_code", (q) => q.eq("line_code", normalized.line_code))
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
        { cursor: continueCursor },
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
