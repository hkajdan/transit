import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Other tables here...

  stations: defineTable({
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
