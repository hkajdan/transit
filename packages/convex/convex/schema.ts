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

    // Source-specific fields — not queryable, varies per country
    metadata: v.optional(v.any()),
  })
    .index("by_country", ["country"])
    .index("by_uic_code", ["uic_code"])
    .index("by_country_passenger", ["country", "is_passenger"]),

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

  // Other tables here...

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
  }),
});
