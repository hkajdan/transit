import type { Doc } from "../_generated/dataModel";
import type { RailwayFeatureCollection } from "@repo/transit/geo";

export function toGeoJSON(railways: Doc<"railways">[]): RailwayFeatureCollection {
  return {
    type: "FeatureCollection",
    features: railways
      .filter((r) => r.is_active)
      .map((r) => ({
        type: "Feature" as const,
        geometry: r.geo_shape.geometry as RailwayFeatureCollection["features"][number]["geometry"],
        properties: {
          line_code: r.line_code,
          railway_type: r.railway_type,
          max_speed_kmh: r.max_speed_kmh ?? null,
          name: r.name,
        },
      })),
  };
}
