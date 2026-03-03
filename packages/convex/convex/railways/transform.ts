import type { Doc } from "../_generated/dataModel";
import type { RailwayFeatureCollection } from "@repo/transit/geo";

export function toGeoJSON(railways: Doc<"railways">[]): RailwayFeatureCollection {
  return {
    type: "FeatureCollection",
    features: railways.flatMap((r) =>
      r.segments.map((s) => ({
        type: "Feature" as const,
        geometry: s.geo_shape.geometry as RailwayFeatureCollection["features"][number]["geometry"],
        properties: {
          line_code: r.line_code,
          railway_type: r.railway_type,
          name: r.name,
          is_active: s.is_active,
        },
      }))
    ),
  };
}
