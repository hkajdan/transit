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
      v.literal("train"),      // gare ferroviaire intercités/TGV/régional
      v.literal("metro"),      // métro urbain
      v.literal("rer"),        // RER (spécifique IDF)
      v.literal("tram"),       // tramway
      v.literal("light_rail"), // train léger / tramway-train
      v.literal("halt"),       // halte (petit arrêt sans guichet)
      v.literal("unknown"),    // fallback
    ),

    // Source-specific fields — not queryable, varies per country
    metadata: v.optional(v.any()),
  })
    .index("by_country", ["country"])
    .index("by_uic_code", ["uic_code"])
    .index("by_country_passenger", ["country", "is_passenger"])
    .index("by_country_type", ["country", "station_type"]),

  // --- Attendance: SNCF ridership statistics ---
  attendance: defineTable({
    code_postal: v.string(),
    code_uic_complet: v.string(),
    direction_regionale_gares: v.union(v.null(), v.string()),
    nom_gare: v.string(),
    non_voyageurs: v.float64(),
    segmentation_drg: v.union(v.null(), v.string()),
    segmentation_marketing: v.union(v.null(), v.string()),
    total_voyageurs_2015: v.float64(),
    total_voyageurs_2016: v.float64(),
    total_voyageurs_2018: v.float64(),
    total_voyageurs_2019: v.float64(),
    total_voyageurs_2020: v.float64(),
    total_voyageurs_2021: v.float64(),
    total_voyageurs_2022: v.float64(),
    total_voyageurs_2023: v.float64(),
    total_voyageurs_2024: v.float64(),
    total_voyageurs_non_voyageurs_2015: v.float64(),
    total_voyageurs_non_voyageurs_2016: v.float64(),
    total_voyageurs_non_voyageurs_2017: v.float64(),
    total_voyageurs_non_voyageurs_2018: v.float64(),
    total_voyageurs_non_voyageurs_2019: v.float64(),
    total_voyageurs_non_voyageurs_2020: v.float64(),
    total_voyageurs_non_voyageurs_2021: v.float64(),
    total_voyageurs_non_voyageurs_2022: v.float64(),
    total_voyageurs_non_voyageurs_2023: v.float64(),
    total_voyageurs_non_voyageurs_2024: v.float64(),
    totalvoyageurs2017: v.float64(),
  }).index("by_uic", ["code_uic_complet"]),

  // --- OSM: raw Overpass data ---
  z_osm_stations: defineTable({
    osm_id: v.number(),
    osm_type: v.string(),          // "node" | "way" | "relation"
    uic_ref: v.optional(v.string()), // join key with stations.uic_code
    lat: v.float64(),
    lon: v.float64(),
    tags: v.any(),                 // raw OSM tags
  })
    .index("by_uic_ref", ["uic_ref"])
    .index("by_osm_id", ["osm_id"]),

  // --- Railways: physical rail infrastructure ---
  railways: defineTable({
    country: v.union(
      v.literal("FR"), v.literal("DE"), v.literal("CH"),
      v.literal("BE"), v.literal("NL"), v.literal("IT"), v.literal("ES"),
    ),
    network: v.string(),
    name: v.string(),
    line_code: v.string(),
    rg_troncon: v.optional(v.number()), // tronçon index within line (SNCF-specific)
    is_active: v.boolean(),

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

    electrified: v.optional(v.boolean()),
    gauge_mm: v.optional(v.number()),
    max_speed_kmh: v.optional(v.number()),

    geo_shape: v.object({
      type: v.string(),
      geometry: v.object({
        type: v.string(),
        coordinates: v.any(),
      }),
      properties: v.object({}),
    }),

    pk_debut: v.optional(v.string()),   // segment start km point (SNCF-specific)
    metadata: v.optional(v.any()),
  })
    .index("by_country", ["country"])
    .index("by_line_code", ["line_code"])
    .index("by_country_type", ["country", "railway_type"])
    .index("by_line_code_troncon", ["line_code", "rg_troncon"])
    .index("by_segment", ["line_code", "rg_troncon", "pk_debut"]),

  // --- SNCF Railways: raw tronçon data from 5 open data endpoints ---
  z_sncf_railways: defineTable({
    code_ligne: v.string(),
    rg_troncon: v.number(),
    lib_ligne: v.optional(v.string()),
    mnemo: v.string(),                 // status code ("SERV", "NEUT"...)
    statut: v.optional(v.string()),    // human readable ("Exploitée", "Neutralisée"...)
    type_ligne: v.optional(v.string()), // "LGV", "Rac", "SERV"...
    v_max: v.optional(v.number()),
    pk_debut: v.string(),
    pk_fin: v.string(),
    geo_shape: v.object({
      type: v.string(),
      geometry: v.object({ type: v.string(), coordinates: v.any() }),
      properties: v.object({}),
    }),
    metadata: v.optional(v.any()),     // voies/déclivité brutes
  })
    .index("by_code_ligne", ["code_ligne"])
    .index("by_code_ligne_troncon", ["code_ligne", "rg_troncon"])
    .index("by_segment", ["code_ligne", "rg_troncon", "pk_debut"]),

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
