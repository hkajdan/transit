import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // --- Stations: normalized across all countries ---
  stations: defineTable({
    // Generic fields — present for every station, every country
    country: v.union(
      v.literal("FR"),
      v.literal("DE"),
      v.literal("CH"),
      v.literal("BE"),
      v.literal("NL"),
      v.literal("IT"),
      v.literal("ES"),
    ),
    network: v.string(), // "SNCF", "DB", "SBB", etc.
    name: v.string(), // human-readable station name
    uic_code: v.string(), // UIC code — universal standard across Europe
    is_passenger: v.boolean(),
    coordinates: v.object({
      lat: v.float64(),
      lon: v.float64(),
    }),
    geo_shape: v.object({
      geometry: v.object({
        coordinates: v.array(v.float64()),
        type: v.string(),
      }),
      properties: v.object({}),
      type: v.string(),
    }),

    station_type: v.union(
      v.literal("train"), // gare ferroviaire intercités/TGV/régional
      v.literal("metro"), // métro urbain
      v.literal("rer"), // RER (spécifique IDF)
      v.literal("tram"), // tramway
      v.literal("light_rail"), // train léger / tramway-train
      v.literal("halt"), // halte (petit arrêt sans guichet)
      v.literal("unknown"), // fallback
    ),

    // Source-specific fields — not queryable, varies per country
    metadata: v.optional(v.any()),
  })
    .index("by_country", ["country"])
    .index("by_uic_code", ["uic_code"])
    .index("by_country_passenger", ["country", "is_passenger"])
    .index("by_country_type", ["country", "station_type"]),

  // --- OSM: raw Overpass data ---
  z_osm_stations: defineTable({
    osm_id: v.number(),
    osm_type: v.string(), // "node" | "way" | "relation"
    uic_ref: v.optional(v.string()), // join key with stations.uic_code
    lat: v.float64(),
    lon: v.float64(),
    tags: v.any(), // raw OSM tags
  })
    .index("by_uic_ref", ["uic_ref"])
    .index("by_osm_id", ["osm_id"]),

  // --- Railways: physical rail infrastructure (one doc per line_code) ---
  railways: defineTable({
    country: v.union(
      v.literal("FR"),
      v.literal("DE"),
      v.literal("CH"),
      v.literal("BE"),
      v.literal("NL"),
      v.literal("IT"),
      v.literal("ES"),
    ),
    network: v.string(),
    name: v.string(),
    line_code: v.string(),

    railway_type: v.union(
      v.literal("high_speed"),
      v.literal("main"),
      v.literal("regional"),
      v.literal("suburban"),
      v.literal("metro"),
      v.literal("tram"),
      v.literal("light_rail"),
      v.literal("unknown"),
    ),

    segments: v.array(v.object({
      rg_troncon: v.number(),
      is_active: v.boolean(),
      geo_shape: v.object({
        type: v.string(),
        geometry: v.object({ type: v.string(), coordinates: v.any() }),
        properties: v.object({}),
      }),
    })),

    speeds: v.array(v.object({
      rg_troncon: v.number(),
      v_max: v.number(),
      pkd: v.string(),
      pkf: v.string(),
    })),

    characteristics: v.array(v.object({
      rg_troncon: v.number(),
      type: v.string(), // "PENTE", "ALIGNEMENT", etc.
      valeur: v.number(),
      pkd: v.string(),
      pkf: v.string(),
    })),
  })
    .index("by_country", ["country"])
    .index("by_line_code", ["line_code"])
    .index("by_country_type", ["country", "railway_type"]),

  // --- SNCF Railways: raw staging data (one doc per code_ligne) ---
  z_sncf_railways: defineTable({
    code_ligne: v.string(),
    lib_ligne: v.optional(v.string()),
    type_ligne: v.optional(v.string()), // "LGV", "Rac", "SERV"...
    segments: v.array(v.object({
      rg_troncon: v.number(),
      mnemo: v.string(), // status code ("SERV", "NEUT"...)
      statut: v.optional(v.string()), // human readable ("Exploitée", "Neutralisée"...)
      pk_debut: v.string(),
      pk_fin: v.string(),
      geo_shape: v.object({
        type: v.string(),
        geometry: v.object({ type: v.string(), coordinates: v.any() }),
        properties: v.object({}),
      }),
    })),
    speeds: v.array(v.object({
      rg_troncon: v.number(),
      v_max: v.number(),
      pkd: v.string(),
      pkf: v.string(),
    })),
    characteristics: v.array(v.object({
      rg_troncon: v.number(),
      type: v.string(),
      valeur: v.number(),
      pkd: v.string(),
      pkf: v.string(),
    })),
  })
    .index("by_code_ligne", ["code_ligne"]),

  z_sncf_stations: defineTable({
    c_geo: v.object({ lat: v.float64(), lon: v.float64() }),
    code_ligne: v.string(),
    code_uic: v.string(),
    commune: v.string(),
    departemen: v.string(),
    fret: v.string(),
    geo_point_2d: v.object({
      lat: v.float64(),
      lon: v.float64(),
    }),
    geo_shape: v.object({
      geometry: v.object({
        coordinates: v.array(v.float64()),
        type: v.string(),
      }),
      properties: v.object({}),
      type: v.string(),
    }),
    idgaia: v.string(),
    idreseau: v.float64(),
    libelle: v.string(),
    pk: v.string(),
    rg_troncon: v.float64(),
    voyageurs: v.string(),
    x_l93: v.float64(),
    x_wgs84: v.float64(),
    y_l93: v.float64(),
    y_wgs84: v.float64(),
  }).index("by_code_uic", ["code_uic"]),
});
